/**
 *  Anomaly panel — surfaces heuristics-detected audit anomalies.
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

const SEV_CLS: Record<AnomalyAlert["severity"], string> = {
  URGENT: "is-urgent",
  REVIEW: "is-review",
  INFO:   "is-info",
};

export function AnomalyPanel({ tenantSlug, alerts, scannedFlash }: AnomalyPanelProps) {
  return (
    <section className="admin-panel worksheet">
      <header className="admin-panel-header">
        <div>
          <h3>Audit-trail anomalies</h3>
          <p>Heuristic detection: bulk export spikes, off-hours admin changes, repeated failures, weekend high-priority work.</p>
        </div>
        <form action={runAnomalyScanAction.bind(null, tenantSlug)}>
          <button type="submit" className="ghost-button">Run scan now</button>
        </form>
      </header>

      {scannedFlash && (
        <p className="form-status success">Scan run. Any new alerts appear below.</p>
      )}

      {alerts.length === 0 && (
        <p className="admin-empty">
          No anomalies persisted. Click <strong>Run scan now</strong> to walk the audit log.
        </p>
      )}

      <ul className="anomaly-list">
        {alerts.map((a) => (
          <li key={a.id} className={`anomaly-row ${SEV_CLS[a.severity]}`}>
            <div className="anomaly-row-head">
              <strong className={`anomaly-row-title ${SEV_CLS[a.severity]}`}>
                {a.severity} · {a.kind.replace(/_/g, " ")}
              </strong>
              <span className="anomaly-row-when">
                {new Date(a.detectedAt).toLocaleString("en-IN")}
              </span>
            </div>
            <p className="anomaly-row-detail">{a.detail}</p>
            <div className="anomaly-row-meta">
              Actor: <code>{a.actor}</code> · {a.count} event{a.count === 1 ? "" : "s"} · window{" "}
              {new Date(a.windowStart).toLocaleTimeString("en-IN")}
              {" → "}
              {new Date(a.windowEnd).toLocaleTimeString("en-IN")}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
