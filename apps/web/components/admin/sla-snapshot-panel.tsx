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
    <section
      style={{
        border: "1px solid var(--border)", borderRadius: 12,
        background: "var(--surface-1)", padding: "0.85rem 1rem",
        marginBottom: "1rem",
        display: "grid", gridTemplateColumns: "1fr auto", gap: "0.75rem",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, auto)", gap: "1.5rem", alignItems: "center" }}>
        <Stat label="Total" value={summary.total} />
        <Stat label="Overdue" value={summary.overdue} color="#b94a4a" />
        <Stat label="At risk" value={summary.atRisk} color="#c4a032" />
        <Stat label="On track" value={summary.onTrack} color="#5a8a52" />
        <Stat label="Closed" value={summary.closed} color="#7a7a6e" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-end", gap: "0.4rem" }}>
        {summary.worstCase && (
          <span style={{ fontSize: "0.74rem", color: "var(--ink-4)" }}>
            Worst: <code>{summary.worstCase.id}</code> · {Math.floor(summary.worstCase.daysRemaining)}d
          </span>
        )}
        <form action={escalateRightsSlaAction.bind(null, tenantSlug)}>
          <button type="submit" className="ghost-button" style={{ fontSize: "0.78rem", padding: "0.35rem 0.75rem" }}>
            Run SLA escalation
          </button>
        </form>
        {flashEscalated && (
          <span style={{ fontSize: "0.7rem", color: "#5a8a52" }}>Escalation pass complete.</span>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ textAlign: "left" }}>
      <div style={{ fontSize: "0.66rem", color: "var(--ink-3)", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: "1.4rem", fontWeight: 700, color: color ?? "var(--ink)" }}>{value}</div>
    </div>
  );
}
