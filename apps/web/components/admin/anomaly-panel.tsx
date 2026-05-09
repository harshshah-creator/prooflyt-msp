/**
 *  Anomaly panel — surfaces heuristics-detected audit anomalies.
 *  Lives inside the Incidents module since URGENT anomalies are
 *  effectively "early-warning incidents".
 */

import { runAnomalyScanAction } from "../../app/workspace/admin-actions";

interface AnomalyAlert {
  id: string;
  kind: string;
  severity: "URGENT" | "REVIEW" | "INFO";
  actor: string;
  detectedAt: string;
  windowStart: string;
  windowEnd: string;
  count: number;
  detail: string;
}

export interface AnomalyPanelProps {
  tenantSlug: string;
  alerts: AnomalyAlert[];
  scannedFlash?: boolean;
}

const SEVERITY_PALETTE: Record<AnomalyAlert["severity"], { bg: string; fg: string }> = {
  URGENT: { bg: "rgba(185,74,74,0.12)",   fg: "#7d1818" },
  REVIEW: { bg: "rgba(196,160,50,0.12)",  fg: "#7a5e0e" },
  INFO:   { bg: "rgba(0,0,0,0.04)",       fg: "#3d3d36" },
};

export function AnomalyPanel({ tenantSlug, alerts, scannedFlash }: AnomalyPanelProps) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.8rem" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1rem" }}>Audit-trail anomalies</h3>
          <p style={{ margin: "0.2rem 0 0", color: "var(--ink-3)", fontSize: "0.8rem" }}>
            Heuristic detection: bulk export spikes, off-hours admin changes, repeated failures, weekend high-priority work.
          </p>
        </div>
        <form action={runAnomalyScanAction.bind(null, tenantSlug)}>
          <button type="submit" className="ghost-button">
            Run scan now
          </button>
        </form>
      </div>

      {scannedFlash && (
        <p className="form-status success" style={{ marginBottom: "0.8rem" }}>
          Scan run. Any new alerts appear below.
        </p>
      )}

      {alerts.length === 0 && (
        <p style={{ color: "var(--ink-3)", fontSize: "0.85rem" }}>
          No anomalies persisted. Click <strong>Run scan now</strong> to walk the audit log.
        </p>
      )}

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.5rem" }}>
        {alerts.map((a) => {
          const c = SEVERITY_PALETTE[a.severity];
          return (
            <li
              key={a.id}
              style={{
                border: "1px solid var(--border)", borderRadius: 8,
                padding: "0.6rem 0.85rem", background: c.bg,
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <strong style={{ color: c.fg, fontSize: "0.85rem" }}>
                  {a.severity} · {a.kind.replace(/_/g, " ")}
                </strong>
                <span style={{ fontSize: "0.7rem", color: "var(--ink-4)" }}>
                  {new Date(a.detectedAt).toLocaleString("en-IN")}
                </span>
              </div>
              <p style={{ fontSize: "0.82rem", color: "var(--ink)", margin: "0.3rem 0 0" }}>{a.detail}</p>
              <div style={{ fontSize: "0.7rem", color: "var(--ink-3)", marginTop: "0.3rem" }}>
                Actor: <code>{a.actor}</code> · {a.count} event{a.count === 1 ? "" : "s"} ·{" "}
                window {new Date(a.windowStart).toLocaleTimeString("en-IN")}
                {" → "}
                {new Date(a.windowEnd).toLocaleTimeString("en-IN")}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
