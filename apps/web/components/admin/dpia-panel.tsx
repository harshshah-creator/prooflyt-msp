/**
 *  DPIA wizard surface — under the Reports module.
 *  Shows existing DPIAs + a single-form "run new" entry point.
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

const RISK_PALETTE: Record<DpiaResultRow["riskLevel"], string> = {
  LOW:      "#5a8a52",
  MEDIUM:   "#c4a032",
  HIGH:     "#d68a32",
  CRITICAL: "#b94a4a",
};

export function DpiaPanel({
  tenantSlug,
  results,
  flashOk,
  flashRisk,
  flashError,
}: {
  tenantSlug: string;
  results: DpiaResultRow[];
  flashOk?: string;
  flashRisk?: string;
  flashError?: string;
}) {
  return (
    <section className="worksheet" style={{ padding: "1rem 1.25rem", marginTop: "1rem" }}>
      <header style={{ marginBottom: "0.6rem" }}>
        <h3 style={{ margin: 0, fontSize: "1rem" }}>Data Protection Impact Assessment</h3>
        <p style={{ margin: "0.2rem 0 0", color: "var(--ink-3)", fontSize: "0.8rem" }}>
          DPDP §10 + Rule 13. Significant Data Fiduciaries must run a DPIA before
          any high-risk processing — children's data, sensitive identifiers,
          large-scale profiling, or cross-border transfers.
        </p>
      </header>

      {flashOk && (
        <div className="callout-success" style={{ marginBottom: "0.8rem" }}>
          DPIA <code>{flashOk}</code> recorded · risk level{" "}
          <strong style={{ color: RISK_PALETTE[(flashRisk as DpiaResultRow["riskLevel"]) ?? "LOW"] }}>
            {flashRisk}
          </strong>
        </div>
      )}
      {flashError && (
        <p className="form-status error" style={{ marginBottom: "0.8rem" }}>{flashError}</p>
      )}

      <details style={{ marginBottom: "1rem" }}>
        <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "0.85rem", color: "var(--ink-2)" }}>
          + Run a new DPIA
        </summary>
        <form
          action={runDpiaAction.bind(null, tenantSlug)}
          style={{ display: "grid", gap: "0.5rem", marginTop: "0.5rem", maxWidth: 720 }}
        >
          <label style={{ fontSize: "0.78rem", color: "var(--ink-2)" }}>
            Activity name
            <input name="activityName" required placeholder="e.g. Customer KYC ingestion via Aadhaar e-KYC" style={inputStyle} />
          </label>
          <label style={{ fontSize: "0.78rem", color: "var(--ink-2)" }}>
            Description
            <textarea name="activityDescription" rows={3} style={inputStyle} />
          </label>
          <label style={{ fontSize: "0.78rem", color: "var(--ink-2)" }}>
            Conducted by
            <input name="conductedBy" required placeholder="DPO / Compliance Manager" style={inputStyle} />
          </label>
          <label style={{ fontSize: "0.78rem", color: "var(--ink-2)" }}>
            Data categories (comma-separated)
            <input name="dataCategories" placeholder="name, email, Aadhaar, transactions" style={inputStyle} />
          </label>
          <label style={{ fontSize: "0.78rem", color: "var(--ink-2)" }}>
            Estimated data principals
            <input type="number" name="estimatedDataPrincipals" defaultValue={1000} style={inputStyle} />
          </label>
          <fieldset style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem", border: 0, padding: 0, fontSize: "0.78rem" }}>
            <label><input type="checkbox" name="involvesChildrenData" /> Children's data (§9)</label>
            <label><input type="checkbox" name="involvesSensitiveIdentifiers" /> Aadhaar/PAN/biometric</label>
            <label><input type="checkbox" name="crossBorderTransfer" /> Cross-border transfer</label>
            <label><input type="checkbox" name="automatedDecisionMaking" /> Automated decisioning</label>
            <label><input type="checkbox" name="largeScaleProfiling" /> Large-scale profiling</label>
          </fieldset>
          <label style={{ fontSize: "0.78rem", color: "var(--ink-2)" }}>
            Mitigations / safeguards
            <textarea name="mitigations" rows={2} style={inputStyle} />
          </label>
          <button type="submit" className="primary-button" style={{ justifySelf: "start" }}>
            Run DPIA
          </button>
        </form>
      </details>

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.4rem" }}>
        {results.length === 0 && (
          <li style={{ color: "var(--ink-3)", fontSize: "0.85rem" }}>
            No DPIAs on record yet. Run one above before launching a new high-risk processing activity.
          </li>
        )}
        {results.map((r) => (
          <li
            key={r.id}
            style={{
              border: "1px solid var(--border)", borderRadius: 8,
              padding: "0.55rem 0.85rem", display: "flex", gap: "0.75rem", alignItems: "center",
            }}
          >
            <span
              style={{
                padding: "0.18rem 0.5rem", borderRadius: 4,
                background: `${RISK_PALETTE[r.riskLevel]}1a`,
                color: RISK_PALETTE[r.riskLevel],
                fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.05em",
              }}
            >
              {r.riskLevel} {r.riskScore}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ fontSize: "0.88rem" }}>{r.activityName}</strong>
              <div style={{ fontSize: "0.72rem", color: "var(--ink-4)" }}>
                {r.id} · {new Date(r.conductedAt).toLocaleDateString("en-IN")} by {r.conductedBy}
              </div>
            </div>
            {r.recommendations.length > 0 && (
              <details>
                <summary style={{ cursor: "pointer", fontSize: "0.74rem", color: "var(--accent)" }}>
                  {r.recommendations.length} recommendation{r.recommendations.length === 1 ? "" : "s"}
                </summary>
                <ul style={{ listStyle: "disc", paddingLeft: "1.2rem", margin: "0.3rem 0 0", fontSize: "0.74rem" }}>
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

const inputStyle = {
  width: "100%", marginTop: "0.25rem",
  padding: "0.5rem 0.75rem",
  border: "1px solid var(--border-strong)",
  borderRadius: 8,
};
