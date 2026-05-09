/**
 *  DPIA wizard surface — under the Reports module.
 */

import { runDpiaAction } from "../../app/workspace/admin-actions";

export interface DpiaResultRow {
  id: string;
  activityName: string;
  conductedAt: string;
  conductedBy: string;
  riskScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  recommendations: string[];
}

const RISK_CLS: Record<DpiaResultRow["riskLevel"], string> = {
  LOW:      "is-low",
  MEDIUM:   "is-medium",
  HIGH:     "is-high",
  CRITICAL: "is-critical",
};

export function DpiaPanel({
  tenantSlug, results, flashOk, flashRisk, flashError,
}: {
  tenantSlug: string;
  results: DpiaResultRow[];
  flashOk?: string;
  flashRisk?: string;
  flashError?: string;
}) {
  return (
    <section className="admin-panel worksheet">
      <header className="admin-panel-header">
        <div>
          <h3>Data Protection Impact Assessment</h3>
          <p>DPDP §10 + Rule 13. Significant Data Fiduciaries must run a DPIA before any high-risk processing — children's data, sensitive identifiers, large-scale profiling, or cross-border transfers.</p>
        </div>
      </header>

      {flashOk && (
        <div className="admin-key-flash">
          DPIA <code>{flashOk}</code> recorded · risk level{" "}
          <span className={`dpia-risk-badge ${RISK_CLS[(flashRisk as DpiaResultRow["riskLevel"]) ?? "LOW"]}`}>
            {flashRisk}
          </span>
        </div>
      )}
      {flashError && <p className="form-status error">{flashError}</p>}

      <details>
        <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "0.85rem", color: "var(--ink-2)" }}>
          + Run a new DPIA
        </summary>
        <form action={runDpiaAction.bind(null, tenantSlug)} className="admin-form-stacked">
          <label>
            Activity name
            <input name="activityName" required placeholder="e.g. Customer KYC ingestion via Aadhaar e-KYC" className="admin-input" />
          </label>
          <label>
            Description
            <textarea name="activityDescription" rows={3} className="admin-input" />
          </label>
          <label>
            Conducted by
            <input name="conductedBy" required placeholder="DPO / Compliance Manager" className="admin-input" />
          </label>
          <label>
            Data categories (comma-separated)
            <input name="dataCategories" placeholder="name, email, Aadhaar, transactions" className="admin-input" />
          </label>
          <label>
            Estimated data principals
            <input type="number" name="estimatedDataPrincipals" defaultValue={1000} className="admin-input" />
          </label>
          <fieldset className="dpia-flags">
            <label><input type="checkbox" name="involvesChildrenData" /> Children's data (§9)</label>
            <label><input type="checkbox" name="involvesSensitiveIdentifiers" /> Aadhaar/PAN/biometric</label>
            <label><input type="checkbox" name="crossBorderTransfer" /> Cross-border transfer</label>
            <label><input type="checkbox" name="automatedDecisionMaking" /> Automated decisioning</label>
            <label><input type="checkbox" name="largeScaleProfiling" /> Large-scale profiling</label>
          </fieldset>
          <label>
            Mitigations / safeguards
            <textarea name="mitigations" rows={2} className="admin-input" />
          </label>
          <button type="submit" className="primary-button" style={{ justifySelf: "start" }}>Run DPIA</button>
        </form>
      </details>

      <ul className="dpia-list" style={{ marginTop: "0.75rem" }}>
        {results.length === 0 && (
          <li className="admin-empty">
            No DPIAs on record yet. Run one above before launching a new high-risk processing activity.
          </li>
        )}
        {results.map((r) => (
          <li key={r.id} className="dpia-row">
            <span className={`dpia-risk-badge ${RISK_CLS[r.riskLevel]}`}>
              {r.riskLevel} {r.riskScore}
            </span>
            <div className="dpia-row-body">
              <div className="dpia-row-title">{r.activityName}</div>
              <div className="dpia-row-meta">
                {r.id} · {new Date(r.conductedAt).toLocaleDateString("en-IN")} by {r.conductedBy}
              </div>
            </div>
            {r.recommendations.length > 0 && (
              <details>
                <summary className="dpia-recs">
                  {r.recommendations.length} recommendation{r.recommendations.length === 1 ? "" : "s"}
                </summary>
                <ul className="dpia-recs-list">
                  {r.recommendations.map((rec, i) => <li key={i}>{rec}</li>)}
                </ul>
              </details>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
