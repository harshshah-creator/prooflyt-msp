/**
 *  Compliance Pack export — auditor-firm picker.
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
  bearerHint: string;
  firms: string[];
}

export function CompliancePackExport({
  tenantSlug, apiBase, bearerHint, firms,
}: CompliancePackExportProps) {
  const sortedFirms = ["generic", ...firms.filter((f) => f !== "generic")];
  return (
    <section className="admin-panel worksheet">
      <header className="admin-panel-header">
        <div>
          <h3>Compliance Pack — auditor cover sheets</h3>
          <p>Pick the audit firm receiving the pack. Cover letter, TOC, control mapping, and evidence cross-reference will be flavoured to that firm's convention. CSV bundles unchanged.</p>
        </div>
      </header>

      <div className="firm-list">
        {sortedFirms.map((firm) => (
          <details key={firm} className="firm-card">
            <summary>{FIRM_LABELS[firm] ?? firm}</summary>
            <p>
              Endpoint: <code>GET /api/portal/{tenantSlug}/export/compliance-pack?firm={firm}</code>
            </p>
            <p>
              Response is <code>multipart/mixed</code> with cover Markdown + CSV/JSON members.
              Use a multipart-aware tool to split.
            </p>
            <pre>{`curl -H 'authorization: Bearer ${bearerHint}' \\
  '${apiBase}/portal/${tenantSlug}/export/compliance-pack?firm=${firm}' \\
  -o ${tenantSlug}-compliance-pack${firm === "generic" ? "" : `-${firm}`}.bin`}</pre>
          </details>
        ))}
      </div>
    </section>
  );
}
