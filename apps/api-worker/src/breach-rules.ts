/**
 *  Breach Register business rules — JVA Schedule 1 §S1.9 + Annexure A §A9.6.
 *
 *  Two mandatory rules:
 *
 *   1.  Affected count > 1,000 data subjects → severity is auto-clamped
 *       to at least HIGH. If the breach also exposes Aadhaar / payment /
 *       biometric / children's data, it goes straight to CRITICAL.
 *
 *   2.  If a breach has not been assessed (status === TRIAGE) within
 *       72 hours of `discoveryDate`, it auto-escalates to Admin (an
 *       audit-trail entry fires and `autoEscalated` flips to true so the
 *       escalation is idempotent).
 *
 *  These are statutory operating commitments, not heuristics. The rules
 *  module is pure (no I/O), so it can be called from the breach-create
 *  handler, from the retention cron, or from any scheduled sweep.
 */

import type { Incident, TenantWorkspace } from "@prooflyt/contracts";

/* ------------------------------------------------------------------ */
/*  Rule 1 — auto-severity from affected_count                          */
/* ------------------------------------------------------------------ */

/**
 *  Clamp the severity floor based on `affectedCount`. Returns the
 *  severity the breach should carry given its scale; callers decide
 *  whether to overwrite the existing value.
 */
export function severityFloorForAffectedCount(
  affectedCount: number | undefined,
): Incident["severity"] | null {
  if (!affectedCount || affectedCount <= 0) return null;
  // The doc is explicit: >1,000 → High or Critical.
  // We pick Critical when scale crosses 100k (catastrophic), High otherwise.
  if (affectedCount > 100_000) return "CRITICAL";
  if (affectedCount > 1_000) return "HIGH";
  return null;
}

/**
 *  Apply the auto-severity rule in place. Returns true if the severity
 *  was raised (so the caller can append an audit entry).
 */
export function applyAutoSeverity(incident: Incident): boolean {
  const floor = severityFloorForAffectedCount(incident.affectedCount);
  if (!floor) return false;
  const order: Incident["severity"][] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  if (order.indexOf(incident.severity) < order.indexOf(floor)) {
    incident.severity = floor;
    return true;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/*  Rule 2 — 72-hour escalation                                         */
/* ------------------------------------------------------------------ */

export const ASSESSMENT_DEADLINE_MS = 72 * 60 * 60 * 1000;

export interface EscalationOutcome {
  incidentId: string;
  hoursSinceDiscovery: number;
  previousSeverity: Incident["severity"];
  escalated: true;
}

/**
 *  Walk every TRIAGE-status incident on the workspace. If `discoveryDate`
 *  is more than 72h before `asOf` and `autoEscalated` is not already set,
 *  mark it escalated, raise severity to at least HIGH, and return the
 *  outcome so the caller can append an audit + fire webhooks.
 *
 *  Idempotent: `autoEscalated` short-circuits repeat passes.
 */
export function escalateOverdueAssessments(
  workspace: TenantWorkspace,
  asOf: Date = new Date(),
): EscalationOutcome[] {
  const out: EscalationOutcome[] = [];
  for (const inc of workspace.incidents) {
    if (inc.status !== "TRIAGE") continue;
    if (inc.autoEscalated) continue;
    if (!inc.discoveryDate) continue;
    const discovered = new Date(inc.discoveryDate).getTime();
    if (!Number.isFinite(discovered)) continue;
    const age = asOf.getTime() - discovered;
    if (age < ASSESSMENT_DEADLINE_MS) continue;

    const previousSeverity = inc.severity;
    // Escalation always raises severity to at least HIGH per §S1.9.
    const order: Incident["severity"][] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
    if (order.indexOf(inc.severity) < order.indexOf("HIGH")) {
      inc.severity = "HIGH";
    }
    inc.autoEscalated = true;
    out.push({
      incidentId: inc.id,
      hoursSinceDiscovery: Math.round(age / (60 * 60 * 1000)),
      previousSeverity,
      escalated: true,
    });
  }
  return out;
}
