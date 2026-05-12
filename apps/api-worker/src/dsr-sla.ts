/**
 * DSR SLA clock (DPDP §13 / §14 / §15 / §6(4) deadlines).
 *
 * Today every RightsCase ships with a static `sla: "7 days remaining"`
 * string that never updates. That's a compliance liability — the whole
 * point of an SLA clock is that it ticks. This module computes the
 * deadline, time-remaining, and state (ON_TRACK / AT_RISK / OVERDUE) from
 * the case's submittedAt, on demand, so every read of the case shows the
 * truth.
 *
 * Statutory windows (DPDP Rules 2025 + industry norms):
 *
 *   ACCESS (§13)         45 days (industry-aligned with GDPR-style
 *                                 "reasonable period"; DPDP is silent on
 *                                 the exact number, this gives us cover
 *                                 against the toughest reading)
 *   CORRECTION (§14)     30 days
 *   DELETION (§14)       30 days
 *   GRIEVANCE (§15)      30 days  — Rule 13 sets the outer max at 90 but
 *                                   30 is the operational target most
 *                                   regulated tenants commit to.
 *   WITHDRAWAL (§6(4))    7 days  — must be \"as easy as giving consent\";
 *                                   we bound the audit-trail close at 7d.
 *
 * State thresholds:
 *   OVERDUE     deadline already passed
 *   AT_RISK     <= 25% of total window remains, or <= 5 days for any case
 *   ON_TRACK    everything else
 *
 * We deliberately do NOT modify the persisted RightsCase shape (contracts
 * package) — the original `sla` string stays for backwards compatibility.
 * Instead we publish enriched fields alongside the case in API responses.
 */

import type { AuditEvent, RightsCase, TenantWorkspace } from "@prooflyt/contracts";

/* ------------------------------------------------------------------ */
/*  Window catalogue                                                    */
/* ------------------------------------------------------------------ */

// Window catalogue per Schedule 1 §S1.9 / Annexure A §A9.4:
//   "Access requests: 30-day response deadline. Deletion requests:
//    45-day response deadline."
// These are the operational commitments the JV agreed to in writing.
// DPDP §13/§14 don't enumerate exact days ("reasonable period"); 30/45
// are the contractual operating targets.
export const STATUTORY_WINDOWS_DAYS: Record<RightsCase["type"], { days: number; citation: string }> = {
  ACCESS: { days: 30, citation: "DPDP §13 + JVA Schedule 1 §S1.9 — 30-day access response window" },
  CORRECTION: { days: 30, citation: "DPDP §14(1)(b) — correction within reasonable period" },
  DELETION: { days: 45, citation: "DPDP §14(1)(c) + JVA Schedule 1 §S1.9 — 45-day deletion response window" },
  PORTABILITY: { days: 30, citation: "DPDP §13 + JVA Schedule 1 §S1.9 — 30-day portability response window (treated as access)" },
  GRIEVANCE: { days: 30, citation: "DPDP §15 + Rule 13 — operational target (max 90 days)" },
  WITHDRAWAL: { days: 7, citation: "DPDP §6(4) — withdrawal must be as easy as giving" },
};

const AT_RISK_FRACTION = 0.25;
const AT_RISK_FLOOR_DAYS = 5;

/* ------------------------------------------------------------------ */
/*  Submission timestamp resolution                                     */
/* ------------------------------------------------------------------ */

/**
 *  Find the earliest auditTrail entry mentioning this case — that's our
 *  ground truth for "when did the clock start ticking". For seed/demo
 *  cases the audit trail might not have a matching entry; we fall back
 *  to the case's id-baked year ("RR-2026-016" → start of 2026) and
 *  finally to "now" so SLA never returns NaN.
 */
export function submittedAtOf(workspace: TenantWorkspace, rightsCase: RightsCase): Date {
  const matches = workspace.auditTrail.filter(
    (e: AuditEvent) => e.targetId === rightsCase.id,
  );
  if (matches.length > 0) {
    // auditTrail is unshift-ordered (newest first), so earliest is last.
    const earliest = matches[matches.length - 1];
    const ts = new Date(earliest.createdAt);
    if (!Number.isNaN(ts.getTime())) return ts;
  }
  // Fallback: parse year out of the id pattern.
  const yearMatch = /RR-(\d{4})/.exec(rightsCase.id);
  if (yearMatch) {
    const yr = Number(yearMatch[1]);
    if (yr > 2000 && yr < 2100) return new Date(`${yr}-01-01T00:00:00.000Z`);
  }
  return new Date();
}

/* ------------------------------------------------------------------ */
/*  Compute SLA                                                         */
/* ------------------------------------------------------------------ */

export type SlaState = "ON_TRACK" | "AT_RISK" | "OVERDUE" | "CLOSED";

export interface SlaInfo {
  state: SlaState;
  windowDays: number;
  citation: string;
  submittedAt: string;
  deadline: string;
  msRemaining: number;
  daysRemaining: number;       // negative when overdue
  hoursRemaining: number;      // negative when overdue, granular for the URGENT bucket
  humanLabel: string;          // for inline UI, e.g. "Due in 3 days" / "Overdue by 12h"
}

export function computeSlaFor(
  rightsCase: RightsCase,
  submittedAt: Date,
  asOf: Date = new Date(),
): SlaInfo {
  const window = STATUTORY_WINDOWS_DAYS[rightsCase.type];
  const windowMs = window.days * 86_400_000;
  const deadline = new Date(submittedAt.getTime() + windowMs);
  const msRemaining = deadline.getTime() - asOf.getTime();
  const daysRemaining = Math.floor(msRemaining / 86_400_000);
  const hoursRemaining = Math.floor(msRemaining / 3_600_000);

  let state: SlaState;
  if (rightsCase.status === "CLOSED") {
    state = "CLOSED";
  } else if (msRemaining < 0) {
    state = "OVERDUE";
  } else {
    const fractionLeft = msRemaining / windowMs;
    if (fractionLeft <= AT_RISK_FRACTION || daysRemaining <= AT_RISK_FLOOR_DAYS) {
      state = "AT_RISK";
    } else {
      state = "ON_TRACK";
    }
  }

  return {
    state,
    windowDays: window.days,
    citation: window.citation,
    submittedAt: submittedAt.toISOString(),
    deadline: deadline.toISOString(),
    msRemaining,
    daysRemaining,
    hoursRemaining,
    humanLabel: humanLabelFor(state, daysRemaining, hoursRemaining),
  };
}

function humanLabelFor(state: SlaState, daysRemaining: number, hoursRemaining: number): string {
  if (state === "CLOSED") return "Closed";
  if (state === "OVERDUE") {
    const overBy = -daysRemaining;
    if (overBy >= 1) return `Overdue by ${overBy} day${overBy === 1 ? "" : "s"}`;
    return `Overdue by ${Math.max(1, -hoursRemaining)} hour${-hoursRemaining === 1 ? "" : "s"}`;
  }
  if (daysRemaining >= 1) return `Due in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`;
  return `Due in ${Math.max(0, hoursRemaining)} hour${hoursRemaining === 1 ? "" : "s"}`;
}

/* ------------------------------------------------------------------ */
/*  Enrich + escalate                                                   */
/* ------------------------------------------------------------------ */

export interface EnrichedRightsCase extends RightsCase {
  slaInfo: SlaInfo;
}

export function enrichRightsCase(
  workspace: TenantWorkspace,
  rightsCase: RightsCase,
  asOf: Date = new Date(),
): EnrichedRightsCase {
  const submittedAt = submittedAtOf(workspace, rightsCase);
  const slaInfo = computeSlaFor(rightsCase, submittedAt, asOf);
  return { ...rightsCase, slaInfo };
}

export function enrichAllRightsCases(
  workspace: TenantWorkspace,
  asOf: Date = new Date(),
): EnrichedRightsCase[] {
  return workspace.rightsCases.map((rc) => enrichRightsCase(workspace, rc, asOf));
}

/* ------------------------------------------------------------------ */
/*  Summary block (for dashboard / DPO inbox)                           */
/* ------------------------------------------------------------------ */

export interface SlaSummary {
  total: number;
  closed: number;
  onTrack: number;
  atRisk: number;
  overdue: number;
  // The single most-urgent open case, for "what to look at next".
  worst?: { id: string; type: RightsCase["type"]; humanLabel: string; state: SlaState };
}

export function summariseSla(workspace: TenantWorkspace, asOf: Date = new Date()): SlaSummary {
  const enriched = enrichAllRightsCases(workspace, asOf);
  const open = enriched.filter((c) => c.status !== "CLOSED");
  const onTrack = open.filter((c) => c.slaInfo.state === "ON_TRACK").length;
  const atRisk = open.filter((c) => c.slaInfo.state === "AT_RISK").length;
  const overdue = open.filter((c) => c.slaInfo.state === "OVERDUE").length;
  const worstCandidate = open
    .slice()
    .sort((a, b) => a.slaInfo.msRemaining - b.slaInfo.msRemaining)[0];
  return {
    total: enriched.length,
    closed: enriched.filter((c) => c.status === "CLOSED").length,
    onTrack,
    atRisk,
    overdue,
    worst: worstCandidate
      ? {
          id: worstCandidate.id,
          type: worstCandidate.type,
          humanLabel: worstCandidate.slaInfo.humanLabel,
          state: worstCandidate.slaInfo.state,
        }
      : undefined,
  };
}

/* ------------------------------------------------------------------ */
/*  Escalation                                                          */
/* ------------------------------------------------------------------ */

export interface EscalationOutcome {
  caseId: string;
  type: RightsCase["type"];
  state: SlaState;
  humanLabel: string;
  daysRemaining: number;
}

/**
 *  Walk the workspace looking for OVERDUE / AT_RISK open cases and emit
 *  audit-log entries per case (which causes outbound webhooks to fire if
 *  the tenant has subscribed). Idempotent within the same UTC day:
 *  re-running won't double-emit because each escalation entry is keyed by
 *  the case id + the UTC date.
 */
export function flagSlaEscalations(
  workspace: TenantWorkspace,
  asOf: Date = new Date(),
): EscalationOutcome[] {
  const enriched = enrichAllRightsCases(workspace, asOf);
  const outcomes: EscalationOutcome[] = [];
  const isoDay = asOf.toISOString().slice(0, 10);

  for (const rc of enriched) {
    if (rc.status === "CLOSED") continue;
    if (rc.slaInfo.state !== "OVERDUE" && rc.slaInfo.state !== "AT_RISK") continue;
    // De-dupe: have we already escalated this case today?
    const dupe = workspace.auditTrail.some(
      (e) =>
        e.targetId === rc.id &&
        e.action === "RIGHTS_SLA_ESCALATED" &&
        e.createdAt.startsWith(isoDay),
    );
    if (dupe) continue;
    workspace.auditTrail.unshift({
      id: `audit-sla-${rc.id}-${asOf.getTime()}`,
      createdAt: asOf.toISOString(),
      actor: "SLA Clock",
      module: "rights",
      action: "RIGHTS_SLA_ESCALATED",
      targetId: rc.id,
      summary: `${rc.type} case ${rc.id}: ${rc.slaInfo.humanLabel} (${rc.slaInfo.state}).`,
    });
    outcomes.push({
      caseId: rc.id,
      type: rc.type,
      state: rc.slaInfo.state,
      humanLabel: rc.slaInfo.humanLabel,
      daysRemaining: rc.slaInfo.daysRemaining,
    });
  }
  return outcomes;
}

export function flagSlaEscalationsAcrossTenants(
  workspaces: Record<string, TenantWorkspace>,
  asOf: Date = new Date(),
): { tenantSlug: string; outcomes: EscalationOutcome[] }[] {
  const results: { tenantSlug: string; outcomes: EscalationOutcome[] }[] = [];
  for (const slug of Object.keys(workspaces)) {
    const ws = workspaces[slug];
    if (!ws) continue;
    const outcomes = flagSlaEscalations(ws, asOf);
    if (outcomes.length > 0) results.push({ tenantSlug: slug, outcomes });
  }
  return results;
}
