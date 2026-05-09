/**
 *  SLA snapshot strip — sits at the top of the Rights module.
 *  Shows totals + worst-case + the Run-Escalate button.
 */

import { escalateRightsSlaAction } from "../../app/workspace/admin-actions";

export interface SlaSnapshotPanelProps {
  tenantSlug: string;
  summary: {
    total: number;
    overdue: number;
    atRisk: number;
    onTrack: number;
    closed: number;
    worstCase?: { id: string; daysRemaining: number; type: string };
  };
  flashEscalated?: boolean;
}

export function SlaSnapshotPanel({ tenantSlug, summary, flashEscalated }: SlaSnapshotPanelProps) {
  return (
    <section className="sla-snapshot">
      <div className="sla-stats">
        <Stat label="Total"    value={summary.total} />
        <Stat label="Overdue"  value={summary.overdue}  cls="is-overdue" />
        <Stat label="At risk"  value={summary.atRisk}   cls="is-at-risk" />
        <Stat label="On track" value={summary.onTrack}  cls="is-on-track" />
        <Stat label="Closed"   value={summary.closed}   cls="is-closed" />
      </div>
      <div className="sla-actions">
        {summary.worstCase && (
          <span className="sla-worst">
            Worst: <code>{summary.worstCase.id}</code> · {Math.floor(summary.worstCase.daysRemaining)}d
          </span>
        )}
        <form action={escalateRightsSlaAction.bind(null, tenantSlug)}>
          <button type="submit" className="ghost-button" style={{ fontSize: "0.78rem", padding: "0.35rem 0.75rem" }}>
            Run SLA escalation
          </button>
        </form>
        {flashEscalated && <span className="sla-flash">Escalation pass complete.</span>}
      </div>
    </section>
  );
}

function Stat({ label, value, cls }: { label: string; value: number; cls?: string }) {
  return (
    <div className="sla-stat">
      <div className="sla-stat-label">{label}</div>
      <div className={`sla-stat-value ${cls ?? ""}`}>{value}</div>
    </div>
  );
}
