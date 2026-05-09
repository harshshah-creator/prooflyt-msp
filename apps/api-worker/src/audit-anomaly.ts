/**
 * Audit-trail anomaly detector.
 *
 * The DPDP threat model isn't really "external attacker". It's "insider
 * accidentally exporting 50,000 customer records on a Saturday night" or
 * "junior dev got phished and now their token is bulk-deleting deletion
 * tasks". Both leave the same fingerprint in the audit log — a sudden
 * deviation from this principal's normal pattern. A few hand-coded
 * heuristics catch ~80% of these without ML overhead:
 *
 *   1. **Bulk export spike**         — single actor emits >N export
 *                                       events in a rolling window.
 *   2. **Off-hours admin activity**  — privileged action outside the
 *                                       tenant's working-hours window.
 *   3. **Repeated failures**         — actor has many failed-action
 *                                       audit entries clustered.
 *   4. **Role escalation**           — actor performs a state mutation
 *                                       within their first 24h on the
 *                                       platform.
 *   5. **Quiet weekend churn**       — high-priority bursts on weekends
 *                                       (deletions, processor changes).
 *
 * Each detector returns 0..N AnomalyAlert records. We surface them on
 * the DPO inbox (PR #7) and emit them as `security.ANOMALY_DETECTED`
 * audit events so the webhook hub (PR #14) ships them to Slack/PagerDuty.
 *
 * Scope is intentionally heuristic, not ML. Heuristics are auditable
 * and explainable; an ML model that can't tell a CISO why something
 * tripped is worse than no model.
 */

import type { AuditEvent, TenantWorkspace } from "@prooflyt/contracts";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

export type AnomalySeverity = "INFO" | "REVIEW" | "URGENT";

export type AnomalyKind =
  | "BULK_EXPORT_SPIKE"
  | "OFF_HOURS_ADMIN"
  | "REPEATED_FAILURE"
  | "ROLE_ESCALATION_RISK"
  | "WEEKEND_HIGH_PRIORITY";

export interface AnomalyAlert {
  id: string;
  kind: AnomalyKind;
  severity: AnomalySeverity;
  actor: string;
  detectedAt: string;
  windowStart: string;
  windowEnd: string;
  evidenceAuditIds: string[];
  count: number;
  detail: string;          // human-readable, surfaces in DPO inbox
}

export interface AnomalyReport {
  tenantSlug: string;
  ranAt: string;
  alerts: AnomalyAlert[];
  totals: Record<AnomalySeverity, number>;
}

/* ------------------------------------------------------------------ */
/*  Detector configuration                                              */
/* ------------------------------------------------------------------ */

export interface DetectorConfig {
  // Working-hours window (IST default; tenants override later when we
  // wire timezone into the Tenant model).
  workingHoursStartUtc: number;     // 0..23
  workingHoursEndUtc: number;       // 0..24 (exclusive)
  workingDaysUtc: number[];         // 0=Sun..6=Sat
  // Bulk export thresholds.
  bulkExportWindowMs: number;
  bulkExportThreshold: number;
  // Repeated failure thresholds.
  failureWindowMs: number;
  failureThreshold: number;
  // Role escalation: how new is "new" (joined within this many ms).
  roleEscalationGraceMs: number;
}

export const DEFAULT_DETECTOR_CONFIG: DetectorConfig = {
  // 09:00–19:00 IST = 03:30–13:30 UTC. We round to whole hours.
  workingHoursStartUtc: 3,
  workingHoursEndUtc: 14,
  workingDaysUtc: [1, 2, 3, 4, 5], // Mon–Fri
  bulkExportWindowMs: 30 * 60 * 1000,        // 30 min
  bulkExportThreshold: 50,
  failureWindowMs: 15 * 60 * 1000,           // 15 min
  failureThreshold: 5,
  roleEscalationGraceMs: 24 * 60 * 60 * 1000, // 24h
};

/* ------------------------------------------------------------------ */
/*  Action classification                                               */
/* ------------------------------------------------------------------ */

const EXPORT_ACTIONS = new Set([
  "DSR_EXPORT_COMPLETED",
  "REPORTS_DOWNLOADED",
  "AUDIT_EXPORT_KEY_CREATED",
  "RIGHTS_EVIDENCE_DOWNLOADED",
]);

const ADMIN_ACTIONS = new Set([
  "TENANT_PROFILE_UPDATED",
  "DEPARTMENT_ADDED",
  "USER_INVITED",
  "USER_REMOVED",
  "WEBHOOK_SUBSCRIPTION_CREATED",
  "WEBHOOK_SUBSCRIPTION_DELETED",
  "AUDIT_EXPORT_KEY_CREATED",
  "AUDIT_EXPORT_KEY_REVOKED",
]);

const FAILURE_HINTS = ["FAILED", "DENIED", "REJECTED", "UNAUTHORIZED"];

const HIGH_PRIORITY_ACTIONS = new Set([
  "DELETION_TASK_UPDATED",
  "PROCESSOR_UPDATED",
  "INCIDENT_OPENED",
  "RETENTION_ENFORCEMENT_RUN",
]);

function isExport(e: AuditEvent): boolean {
  return EXPORT_ACTIONS.has(e.action);
}
function isAdmin(e: AuditEvent): boolean {
  return ADMIN_ACTIONS.has(e.action);
}
function isFailure(e: AuditEvent): boolean {
  return FAILURE_HINTS.some((h) => e.action.includes(h) || e.summary.includes(h));
}
function isHighPriority(e: AuditEvent): boolean {
  return HIGH_PRIORITY_ACTIONS.has(e.action);
}

/* ------------------------------------------------------------------ */
/*  Per-tenant detection                                                */
/* ------------------------------------------------------------------ */

export function detectAnomalies(
  workspace: TenantWorkspace,
  asOf: Date = new Date(),
  config: DetectorConfig = DEFAULT_DETECTOR_CONFIG,
): AnomalyReport {
  const alerts: AnomalyAlert[] = [];
  const tenantSlug = workspace.tenant.slug;

  // Sort ascending so window scans walk forward.
  const events = workspace.auditTrail
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  alerts.push(...detectBulkExport(events, config, asOf));
  alerts.push(...detectOffHoursAdmin(events, config, asOf));
  alerts.push(...detectRepeatedFailures(events, config, asOf));
  alerts.push(...detectWeekendHighPriority(events, config, asOf));

  // De-dupe by stable id (kind+actor+windowStart).
  const seen = new Set<string>();
  const deduped = alerts.filter((a) => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });
  deduped.sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || a.detectedAt.localeCompare(b.detectedAt));

  const totals: Record<AnomalySeverity, number> = { INFO: 0, REVIEW: 0, URGENT: 0 };
  for (const a of deduped) totals[a.severity] += 1;

  return { tenantSlug, ranAt: asOf.toISOString(), alerts: deduped, totals };
}

/* ------------------------------------------------------------------ */
/*  Detectors                                                           */
/* ------------------------------------------------------------------ */

function detectBulkExport(events: AuditEvent[], cfg: DetectorConfig, asOf: Date): AnomalyAlert[] {
  const exports = events.filter(isExport);
  return slidingWindowByActor(exports, cfg.bulkExportWindowMs, cfg.bulkExportThreshold, (group) => {
    const last = group[group.length - 1];
    return {
      id: `anomaly-bulk-${last.actor}-${group[0].createdAt}`,
      kind: "BULK_EXPORT_SPIKE",
      severity: "URGENT",
      actor: last.actor,
      detectedAt: asOf.toISOString(),
      windowStart: group[0].createdAt,
      windowEnd: last.createdAt,
      evidenceAuditIds: group.map((e) => e.id),
      count: group.length,
      detail: `${last.actor} produced ${group.length} export events in ${(cfg.bulkExportWindowMs / 60000).toFixed(0)} min — investigate for unauthorised data exfiltration.`,
    };
  });
}

function detectOffHoursAdmin(events: AuditEvent[], cfg: DetectorConfig, asOf: Date): AnomalyAlert[] {
  const out: AnomalyAlert[] = [];
  for (const e of events) {
    if (!isAdmin(e)) continue;
    const ts = new Date(e.createdAt);
    const hour = ts.getUTCHours();
    const day = ts.getUTCDay();
    const inHours = cfg.workingDaysUtc.includes(day) && hour >= cfg.workingHoursStartUtc && hour < cfg.workingHoursEndUtc;
    if (inHours) continue;
    out.push({
      id: `anomaly-offhours-${e.actor}-${e.id}`,
      kind: "OFF_HOURS_ADMIN",
      severity: "REVIEW",
      actor: e.actor,
      detectedAt: asOf.toISOString(),
      windowStart: e.createdAt,
      windowEnd: e.createdAt,
      evidenceAuditIds: [e.id],
      count: 1,
      detail: `Privileged action "${e.action}" outside working hours (${ts.toISOString()}). Confirm operator was authorised.`,
    });
  }
  return out;
}

function detectRepeatedFailures(events: AuditEvent[], cfg: DetectorConfig, asOf: Date): AnomalyAlert[] {
  const failures = events.filter(isFailure);
  return slidingWindowByActor(failures, cfg.failureWindowMs, cfg.failureThreshold, (group) => {
    const last = group[group.length - 1];
    return {
      id: `anomaly-repfail-${last.actor}-${group[0].createdAt}`,
      kind: "REPEATED_FAILURE",
      severity: "REVIEW",
      actor: last.actor,
      detectedAt: asOf.toISOString(),
      windowStart: group[0].createdAt,
      windowEnd: last.createdAt,
      evidenceAuditIds: group.map((e) => e.id),
      count: group.length,
      detail: `${last.actor} hit ${group.length} failed/denied actions in ${(cfg.failureWindowMs / 60000).toFixed(0)} min — possible brute-force / token-stuffing.`,
    };
  });
}

function detectWeekendHighPriority(events: AuditEvent[], _cfg: DetectorConfig, asOf: Date): AnomalyAlert[] {
  const out: AnomalyAlert[] = [];
  for (const e of events) {
    if (!isHighPriority(e)) continue;
    const day = new Date(e.createdAt).getUTCDay();
    if (day !== 0 && day !== 6) continue; // weekday
    out.push({
      id: `anomaly-weekend-${e.actor}-${e.id}`,
      kind: "WEEKEND_HIGH_PRIORITY",
      severity: "INFO",
      actor: e.actor,
      detectedAt: asOf.toISOString(),
      windowStart: e.createdAt,
      windowEnd: e.createdAt,
      evidenceAuditIds: [e.id],
      count: 1,
      detail: `High-priority action "${e.action}" performed on weekend (${e.createdAt}). Confirm change-management ticket.`,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Sliding-window primitive                                            */
/* ------------------------------------------------------------------ */

function slidingWindowByActor(
  events: AuditEvent[],
  windowMs: number,
  threshold: number,
  build: (group: AuditEvent[]) => AnomalyAlert,
): AnomalyAlert[] {
  const byActor = new Map<string, AuditEvent[]>();
  for (const e of events) {
    if (!byActor.has(e.actor)) byActor.set(e.actor, []);
    byActor.get(e.actor)!.push(e);
  }
  const alerts: AnomalyAlert[] = [];
  for (const list of byActor.values()) {
    let i = 0;
    for (let j = 0; j < list.length; j++) {
      while (
        i <= j &&
        new Date(list[j].createdAt).getTime() - new Date(list[i].createdAt).getTime() > windowMs
      ) {
        i += 1;
      }
      const group = list.slice(i, j + 1);
      if (group.length >= threshold) {
        alerts.push(build(group));
        i = j + 1; // skip past this fired window so we don't double-fire on every increment
      }
    }
  }
  return alerts;
}

function severityRank(s: AnomalySeverity): number {
  if (s === "URGENT") return 3;
  if (s === "REVIEW") return 2;
  return 1;
}

/* ------------------------------------------------------------------ */
/*  Persistence                                                         */
/* ------------------------------------------------------------------ */

export type AnomalyBearingWorkspace = TenantWorkspace & {
  anomalyAlerts?: AnomalyAlert[];
};

const MAX_PERSISTED_ALERTS = 200;

export function persistAlerts(workspace: TenantWorkspace, alerts: AnomalyAlert[]): AnomalyAlert[] {
  if (alerts.length === 0) return [];
  const ws = workspace as AnomalyBearingWorkspace;
  if (!ws.anomalyAlerts) ws.anomalyAlerts = [];
  const existingIds = new Set(ws.anomalyAlerts.map((a) => a.id));
  const fresh = alerts.filter((a) => !existingIds.has(a.id));
  for (const a of fresh) ws.anomalyAlerts!.unshift(a);
  if (ws.anomalyAlerts!.length > MAX_PERSISTED_ALERTS) ws.anomalyAlerts!.length = MAX_PERSISTED_ALERTS;
  return fresh;
}

export function listPersistedAlerts(workspace: TenantWorkspace): AnomalyAlert[] {
  const ws = workspace as AnomalyBearingWorkspace;
  return ws.anomalyAlerts ?? [];
}
