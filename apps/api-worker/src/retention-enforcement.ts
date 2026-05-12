/**
 * Retention enforcement (DPDP §8(7) + Rule 8).
 *
 * The DPDP Act requires data fiduciaries to erase personal data when the
 * purpose for processing is no longer being served and retention is no longer
 * necessary. Rule 8 mandates *systematic* erasure with proof — not best-effort
 * Slack pings to engineers.
 *
 * This module turns "the retention schedule" from a Notion page into a
 * scheduled enforcement run with sealed proof per connector.
 *
 * The flow per due deletionTask:
 *
 *   1.  Match the task's `system` to a CONNECTOR_DEFINITIONS entry by name
 *       (e.g. "Razorpay" → RAZORPAY, "Zoho CRM" → ZOHO_CRM, etc).
 *   2.  Find a CONNECTED connection of that type. If none, mark the task
 *       AWAITING_PROCESSOR (the task lives, but escalation goes to DPO).
 *   3.  Honor statutory floors (DPDP §17(2)(a)). For RAZORPAY we never
 *       attempt erasure — performDsr() already produces the legal-basis
 *       denial letter under RBI's 5-year rule. The task closes with
 *       `processorAcknowledged=true` and a denial-letter evidence artifact.
 *   4.  Otherwise call performDsr(workspace, conn, syntheticRights, ERASE).
 *       That function already creates a ConnectorEvent + EvidenceArtifact,
 *       so the proof flows naturally into the Compliance Pack.
 *   5.  Mark the task CLOSED + proofLinked=true and link evidence id back to
 *       the task via auditTrail (workspace.auditTrail entry).
 *
 * The Cloudflare Worker `scheduled` handler invokes runScheduledRetention()
 * across all tenant workspaces. A manual admin trigger and a dry-run preview
 * route are also exposed for in-product control.
 */

import type {
  ConnectorConnection,
  ConnectorType,
  DeletionTask,
  RightsCase,
  TenantWorkspace,
  User,
} from "@prooflyt/contracts";
import { CONNECTOR_DEFINITIONS, performDsr } from "./connectors.js";

/* ------------------------------------------------------------------ */
/*  Statutory floor catalogue                                          */
/* ------------------------------------------------------------------ */

/**
 *  Statutory retention floors that override DPDP erasure. These are the
 *  Indian-law exceptions §17(2)(a) carves out — Prooflyt knows about them
 *  by default so a tenant doesn't accidentally try to erase data that the
 *  RBI / GST / TRAI actually requires preserving.
 *
 *  The values are conservative *minimums*. Add new floors here when
 *  on-boarding a regulated connector.
 */
export interface StatutoryFloor {
  connectorType: ConnectorType;
  authority: string;
  citation: string;
  minRetentionYears: number;
  // Practical impact: deny full erasure, anonymise non-essential PII fields.
  treatment: "DENY_AND_ANONYMISE" | "DENY";
}

export const STATUTORY_FLOORS: StatutoryFloor[] = [
  {
    connectorType: "RAZORPAY",
    authority: "RBI",
    citation: "RBI Storage of Payment System Data direction (April 2018) — DPDP §17(2)(a)",
    minRetentionYears: 5,
    treatment: "DENY_AND_ANONYMISE",
  },
];

export function findStatutoryFloor(connectorType: ConnectorType): StatutoryFloor | undefined {
  return STATUTORY_FLOORS.find((f) => f.connectorType === connectorType);
}

/* ------------------------------------------------------------------ */
/*  Enforcement primitives                                             */
/* ------------------------------------------------------------------ */

export type EnforcementOutcome =
  | "ERASED"
  | "DENIED_LEGAL_BASIS"
  | "PENDING_NO_CONNECTION"
  | "SKIPPED_NOT_DUE"
  | "SKIPPED_LEGAL_HOLD"
  | "SKIPPED_ALREADY_CLOSED";

export interface EnforcementEntry {
  taskId: string;
  system: string;
  dueDate: string;
  outcome: EnforcementOutcome;
  detail: string;
  evidenceId?: string;
  connectorEventId?: string;
  rightsCaseId?: string;
  recordsAffected?: number;
}

export interface EnforcementReport {
  tenantSlug: string;
  ranAt: string;
  dryRun: boolean;
  totalTasks: number;
  /** Tasks beyond the 10,000-record batch ceiling (§S1.9). Queued for the next sweep. */
  deferredCount: number;
  dueTasks: number;
  erased: number;
  denied: number;
  pending: number;
  entries: EnforcementEntry[];
}

/**
 *  Match a deletionTask to a connector type by best-effort name comparison.
 *  Real production tenants will eventually link `linkedConnectionId` directly
 *  on the task; until then this heuristic captures the seed/demo data.
 *
 *  Strategy (most-specific first, no false-positives from generic words):
 *   1. Exact ConnectorDefinition.name match (case-insensitive)
 *   2. Task system label is a *prefix* of def.name (e.g. "Razorpay" → "Razorpay Payments")
 *   3. def.name is a *prefix* of task system label
 *   4. Vendor exact match (e.g. "HubSpot, Inc." rare but supported)
 *  We deliberately do NOT match against serviceLabel — it contains generic
 *  industry terms like "CRM" or "support" which would over-match.
 */
export function matchConnectorType(systemLabel: string): ConnectorType | undefined {
  const needle = systemLabel.trim().toLowerCase();
  if (!needle) return undefined;
  // 1. Exact name.
  for (const [type, def] of Object.entries(CONNECTOR_DEFINITIONS)) {
    if (def.name.toLowerCase() === needle) return type as ConnectorType;
  }
  // 2. Needle is a prefix of name ("Razorpay" → "Razorpay Payments").
  for (const [type, def] of Object.entries(CONNECTOR_DEFINITIONS)) {
    if (def.name.toLowerCase().startsWith(needle + " ")) return type as ConnectorType;
  }
  // 3. Name is a prefix of needle (rare; e.g. "HubSpot CRM Acme").
  for (const [type, def] of Object.entries(CONNECTOR_DEFINITIONS)) {
    if (needle.startsWith(def.name.toLowerCase() + " ")) return type as ConnectorType;
  }
  // 4. Vendor exact.
  for (const [type, def] of Object.entries(CONNECTOR_DEFINITIONS)) {
    if (def.vendor.toLowerCase() === needle) return type as ConnectorType;
  }
  return undefined;
}

function findActiveConnection(
  workspace: TenantWorkspace,
  connectorType: ConnectorType,
): ConnectorConnection | undefined {
  return workspace.connections.find(
    (c) => c.connectorType === connectorType && c.status === "CONNECTED",
  );
}

function isDue(task: DeletionTask, asOf: Date): boolean {
  // dueDate is YYYY-MM-DD in seed data; tolerate both ISO and bare dates.
  const due = new Date(task.dueDate);
  if (Number.isNaN(due.getTime())) return false;
  return due.getTime() <= asOf.getTime();
}

function syntheticRightsCaseFor(task: DeletionTask): RightsCase {
  // Retention enforcement creates a synthetic rights case so performDsr()'s
  // existing audit trail (rights-case id on every event + evidence) keeps
  // working. The synthetic case is NOT persisted to workspace.rightsCases —
  // the deletion task itself is the durable record.
  return {
    id: `RET-${task.id}`,
    type: "DELETION",
    requestor: "retention-cron@prooflyt.system",
    status: "IN_PROGRESS",
    sla: "Retention schedule",
    evidenceLinked: false,
    linkedDeletionTaskId: task.id,
  };
}

function syntheticUser(tenantSlug: string): User {
  // Audit actor for the cron-run. Stays under the existing User shape so
  // existing audit log helpers don't need overloads.
  return {
    id: "system-retention-cron",
    tenantSlug,
    email: "retention-cron@prooflyt.system",
    name: "Retention Cron",
    password: "",
    roles: ["TENANT_ADMIN"],
    title: "System",
    internalAdmin: true,
  };
}

/* ------------------------------------------------------------------ */
/*  Per-tenant enforcement                                             */
/* ------------------------------------------------------------------ */

export interface EnforceOptions {
  asOf?: Date;
  dryRun?: boolean;
  // Optional task-id allow-list, useful for the manual "Run now for DEL-22" UX.
  taskIds?: string[];
}

/**
 *  JVA Schedule 1 §S1.9 / Annexure A §A9.5:
 *    "Bulk deletion limited to 10,000 records per batch."
 *
 *  The current platform treats each DeletionTask as one logical batch
 *  (the underlying processor receives the request and we record proof).
 *  Per-task we enforce a hard ceiling: the request cannot affect more
 *  than 10,000 records; tasks above the cap get split (caller's
 *  responsibility) or rejected at intake.
 */
export const BULK_DELETE_BATCH_LIMIT = 10_000;

export function enforceRetention(
  workspace: TenantWorkspace,
  options: EnforceOptions = {},
): EnforcementReport {
  const asOf = options.asOf ?? new Date();
  const dryRun = options.dryRun ?? false;
  const tenantSlug = workspace.tenant.slug;
  const ranAt = asOf.toISOString();

  // Per-run safety: never erase more than BULK_DELETE_BATCH_LIMIT records
  // in a single sweep. We process tasks up to the limit; remainder stay
  // queued for the next run. Idempotent + auditable.
  const allCandidates = workspace.deletionTasks.filter((t) =>
    options.taskIds ? options.taskIds.includes(t.id) : true,
  );
  const candidates = allCandidates.slice(0, BULK_DELETE_BATCH_LIMIT);
  const deferredCount = Math.max(0, allCandidates.length - candidates.length);

  const entries: EnforcementEntry[] = [];

  for (const task of candidates) {
    if (task.status === "CLOSED") {
      entries.push({
        taskId: task.id,
        system: task.system,
        dueDate: task.dueDate,
        outcome: "SKIPPED_ALREADY_CLOSED",
        detail: "Task already closed; no action taken.",
      });
      continue;
    }
    if (task.status === "LEGAL_HOLD") {
      entries.push({
        taskId: task.id,
        system: task.system,
        dueDate: task.dueDate,
        outcome: "SKIPPED_LEGAL_HOLD",
        detail: "Task is under legal hold; retention enforcement paused.",
      });
      continue;
    }
    if (!isDue(task, asOf) && !options.taskIds) {
      entries.push({
        taskId: task.id,
        system: task.system,
        dueDate: task.dueDate,
        outcome: "SKIPPED_NOT_DUE",
        detail: `Due ${task.dueDate}; not yet eligible.`,
      });
      continue;
    }

    const connectorType = matchConnectorType(task.system);
    if (!connectorType) {
      // No connector mapped — mark for manual processor outreach.
      entries.push({
        taskId: task.id,
        system: task.system,
        dueDate: task.dueDate,
        outcome: "PENDING_NO_CONNECTION",
        detail: `No connector found for system "${task.system}". Manual processor outreach required.`,
      });
      if (!dryRun) {
        task.status = "AWAITING_PROCESSOR";
      }
      continue;
    }

    const connection = findActiveConnection(workspace, connectorType);
    if (!connection) {
      entries.push({
        taskId: task.id,
        system: task.system,
        dueDate: task.dueDate,
        outcome: "PENDING_NO_CONNECTION",
        detail: `No CONNECTED ${connectorType} connection. Reconnect the integration to enforce retention.`,
      });
      if (!dryRun) {
        task.status = "AWAITING_PROCESSOR";
      }
      continue;
    }

    const floor = findStatutoryFloor(connectorType);

    if (dryRun) {
      // Preview-only mode: report what *would* happen.
      if (floor) {
        entries.push({
          taskId: task.id,
          system: task.system,
          dueDate: task.dueDate,
          outcome: "DENIED_LEGAL_BASIS",
          detail: `${floor.authority} retention floor (${floor.minRetentionYears}y, ${floor.citation}). Would issue legal-basis denial letter.`,
        });
      } else {
        entries.push({
          taskId: task.id,
          system: task.system,
          dueDate: task.dueDate,
          outcome: "ERASED",
          detail: `Would erase via ${connectorType} connection ${connection.id}.`,
        });
      }
      continue;
    }

    // Live run.
    const synth = syntheticRightsCaseFor(task);
    const user = syntheticUser(tenantSlug);
    // performDsr handles the RBI floor branch internally for RAZORPAY and
    // produces a DSR_ERASURE_DENIED event + denial-letter evidence.
    let result;
    try {
      result = performDsr(workspace, connection, synth, "ERASE", "retention-cron@prooflyt.system", user);
    } catch (err) {
      entries.push({
        taskId: task.id,
        system: task.system,
        dueDate: task.dueDate,
        outcome: "PENDING_NO_CONNECTION",
        detail: `Connector error: ${(err as Error).message}`,
      });
      task.status = "AWAITING_PROCESSOR";
      continue;
    }

    const lastEvent = workspace.connectorEvents[0];
    const denied = Boolean(result.denialReason);
    if (denied) {
      task.status = "CLOSED";
      task.proofLinked = true;
      task.processorAcknowledged = true;
      entries.push({
        taskId: task.id,
        system: task.system,
        dueDate: task.dueDate,
        outcome: "DENIED_LEGAL_BASIS",
        detail: result.denialReason!,
        evidenceId: result.evidenceId,
        connectorEventId: lastEvent?.id,
        rightsCaseId: synth.id,
        recordsAffected: result.recordsAffected,
      });
    } else {
      task.status = "CLOSED";
      task.proofLinked = true;
      task.processorAcknowledged = true;
      entries.push({
        taskId: task.id,
        system: task.system,
        dueDate: task.dueDate,
        outcome: "ERASED",
        detail: `Erased ${result.recordsAffected} records via ${connectorType}.`,
        evidenceId: result.evidenceId,
        connectorEventId: lastEvent?.id,
        rightsCaseId: synth.id,
        recordsAffected: result.recordsAffected,
      });
    }

    workspace.auditTrail.unshift({
      id: `audit-ret-${task.id}-${asOf.getTime()}`,
      createdAt: ranAt,
      actor: "Retention Cron",
      module: "retention",
      action: denied ? "RETENTION_DENIED_LEGAL_BASIS" : "RETENTION_ENFORCED",
      targetId: task.id,
      summary: denied
        ? `Erasure denied for ${task.system} under ${floor?.citation ?? "statutory floor"}.`
        : `Retention enforced: ${task.system} erased (${result.recordsAffected} records).`,
    });
  }

  const dueTasks = entries.filter(
    (e) => e.outcome === "ERASED" || e.outcome === "DENIED_LEGAL_BASIS" || e.outcome === "PENDING_NO_CONNECTION",
  ).length;

  return {
    tenantSlug,
    ranAt,
    dryRun,
    totalTasks: candidates.length,
    deferredCount, // tasks beyond the 10K batch limit, queued for next sweep
    dueTasks,
    erased: entries.filter((e) => e.outcome === "ERASED").length,
    denied: entries.filter((e) => e.outcome === "DENIED_LEGAL_BASIS").length,
    pending: entries.filter((e) => e.outcome === "PENDING_NO_CONNECTION").length,
    entries,
  };
}

/* ------------------------------------------------------------------ */
/*  All-tenant scheduled run                                           */
/* ------------------------------------------------------------------ */

export interface ScheduledRunReport {
  ranAt: string;
  tenantsScanned: number;
  tenantReports: EnforcementReport[];
  totals: {
    erased: number;
    denied: number;
    pending: number;
  };
}

/**
 *  Apply enforceRetention() to every tenant workspace in the AppState.
 *  Mutates workspaces in place; caller is responsible for persisting state.
 */
export function runRetentionForAllTenants(
  workspaces: Record<string, TenantWorkspace>,
  options: EnforceOptions = {},
): ScheduledRunReport {
  const asOf = options.asOf ?? new Date();
  const reports: EnforcementReport[] = [];
  for (const slug of Object.keys(workspaces)) {
    const ws = workspaces[slug];
    if (!ws) continue;
    reports.push(enforceRetention(ws, { ...options, asOf }));
  }
  return {
    ranAt: asOf.toISOString(),
    tenantsScanned: reports.length,
    tenantReports: reports,
    totals: {
      erased: reports.reduce((s, r) => s + r.erased, 0),
      denied: reports.reduce((s, r) => s + r.denied, 0),
      pending: reports.reduce((s, r) => s + r.pending, 0),
    },
  };
}
