/**
 *  Compliance Pack export — auditor-firm picker.
 *  Tenants going to KPMG / EY / PwC / Deloitte / GT get a cover sheet
 *  matched to that firm's expected format. Default "generic" preserves
 *  the legacy 8-file bundle.
 */

const FIRM_LABELS: Record<string, string> = {
  generic:       "Generic — platform default",
  kpmg:          "KPMG India",
  ey:            "EY India",
  pwc:           "PwC India",
  deloitte:      "Deloitte India",
  grantthornton: "Grant Thornton Bharat",
};

export interface CompliancePackExportProps {
  tenantSlug: string;
  apiBase: string;
  bearerHint: string;       // shown for the user to know which session they'll auth with
  firms: string[];
}

export function CompliancePackExport({
  tenantSlug,
  apiBase,
  bearerHint,
  firms,
}: CompliancePackExportProps) {
  // The pack endpoint requires a bearer header on every request, so we
  // don't link directly to it (a plain <a href> can't carry auth). Instead
  // we render a one-line shell command the operator can run, and a
  // download button that forms a temporary GET with credentials via fetch
  // would need client JS. Pragmatic v1: copyable curl + clear explanation.
  const sortedFirms = ["generic", ...firms.filter((f) => f !== "generic")];
  return (
    <section className="worksheet" style={{ padding: "1rem 1.25rem" }}>
      <header style={{ marginBottom: "0.6rem" }}>
        <h3 style={{ margin: 0, fontSize: "1rem" }}>Compliance Pack — auditor cover sheets</h3>
        <p style={{ margin: "0.2rem 0 0", color: "var(--ink-3)", fontSize: "0.8rem" }}>
          Pick the audit firm receiving the pack. Cover letter, TOC, control
          mapping, and evidence cross-reference will be flavoured to that
          firm's convention. CSV bundles unchanged.
        </p>
      </header>

      <div style={{ display: "grid", gap: "0.6rem", maxWidth: 720 }}>
        {sortedFirms.map((firm) => (
          <details key={firm} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "0.5rem 0.75rem" }}>
            <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "0.9rem" }}>
              {FIRM_LABELS[firm] ?? firm}
            </summary>
            <p style={{ fontSize: "0.78rem", color: "var(--ink-3)", marginTop: "0.4rem" }}>
              Endpoint: <code>GET /api/portal/{tenantSlug}/export/compliance-pack?firm={firm}</code>
            </p>
            <p style={{ fontSize: "0.78rem", color: "var(--ink-3)" }}>
              The response is <code>multipart/mixed</code> with cover Markdown +
              CSV/JSON members. Use a multipart-aware tool to split the response.
            </p>
            <pre style={{
              fontSize: "0.72rem", padding: "0.6rem", borderRadius: 6,
              background: "rgba(0,0,0,0.06)", overflowX: "auto",
            }}>
{`curl -H 'authorization: Bearer ${bearerHint}' \\
  '${apiBase}/portal/${tenantSlug}/export/compliance-pack?firm=${firm}' \\
  -o ${tenantSlug}-compliance-pack${firm === "generic" ? "" : `-${firm}`}.bin`}
            </pre>
          </details>
        ))}
      </div>
    </section>
  );
}
