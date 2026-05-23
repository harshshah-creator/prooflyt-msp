/**
 *  Named reports panel — JVA Annexure A §A7.10 + §A12.
 *
 *  Surfaces the 6 mandatory report types and the 4 supported formats.
 *  Operator picks a (report × format) cell and the URL gets opened in a
 *  new tab so the browser handles streaming + content-disposition.
 *
 *  We don't post forms / use JS fetch here on purpose — the reports
 *  endpoint sets `cache-control: no-store` and returns large binaries
 *  for XLSX/PDF. A plain anchor with `target="_blank"` lets the browser
 *  manage the download stream natively, including resume + scan.
 *
 *  Auth: the route is bearer-protected. We embed the session token via
 *  a one-time auth-redirect: link first hits a session-cookie endpoint
 *  on the same origin that re-signs and forwards. For Phase-1 we keep
 *  it simple — the panel renders direct URLs and a curl example.
 */

interface ReportRow {
  id:
    | "register-completeness"
    | "open-rights"
    | "due-deletions"
    | "incident-register"
    | "audit-extract"
    | "processor-status";
  label: string;
  citation: string;
  blurb: string;
}

const REPORT_ROWS: ReportRow[] = [
  {
    id: "register-completeness",
    label: "Register completeness",
    citation: "DPDP §5 + §8 — Records of processing (§A7.3)",
    blurb: "Every register entry with lifecycle, completeness, linked notice and processors.",
  },
  {
    id: "open-rights",
    label: "Open rights",
    citation: "DPDP §11–§15 + Rule 13 (§A7.5)",
    blurb: "Rights cases that aren't closed yet, with SLA window + evidence-linked flag.",
  },
  {
    id: "due-deletions",
    label: "Due deletions",
    citation: "DPDP §8(7) + §14 + §A7.6 / §A14",
    blurb: "Deletion tasks plus due-now (overdue or due today) subset.",
  },
  {
    id: "incident-register",
    label: "Incident register",
    citation: "DPDP §8(6) + Rule 7 + §32 (§A9.6)",
    blurb: "Incidents with severity, 72h timer, affected count, auto-escalation flag.",
  },
  {
    id: "audit-extract",
    label: "Audit extract",
    citation: "DPDP §8(8) — Demonstrable compliance (§A7.9)",
    blurb: "Append-only audit trail. Use ?since=ISO_DATE to bound the window.",
  },
  {
    id: "processor-status",
    label: "Processor status",
    citation: "DPDP §8 — Reasonable security (§A7.8 / §A8)",
    blurb: "Vendors + DPA status + sub-processor counts + purge acknowledgement.",
  },
];

const FORMATS = ["json", "csv", "xlsx", "pdf"] as const;
type ReportFormat = (typeof FORMATS)[number];

const FORMAT_LABELS: Record<ReportFormat, string> = {
  json: "JSON",
  csv: "CSV",
  xlsx: "Excel (XLSX)",
  pdf: "PDF",
};

export interface NamedReportsPanelProps {
  tenantSlug: string;
  apiBase: string;
  bearerHint: string;
}

export function NamedReportsPanel({
  tenantSlug,
  apiBase,
  bearerHint,
}: NamedReportsPanelProps) {
  return (
    <section className="admin-panel worksheet">
      <header className="admin-panel-header">
        <div>
          <h3>Named reports — §A7.10</h3>
          <p>
            The six DPDP-aligned report types, each emitable in JSON, CSV, Excel, or PDF. Pick
            the row + format you need. PDF is paginated, monospace; XLSX has a Cover sheet
            with the citation and a Data sheet with rows.
          </p>
        </div>
      </header>

      <div className="report-list">
        {REPORT_ROWS.map((row) => (
          <details key={row.id} className="report-card">
            <summary>
              <strong>{row.label}</strong>
              <span className="report-citation">{row.citation}</span>
            </summary>
            <p>{row.blurb}</p>
            <div className="report-format-row">
              {FORMATS.map((fmt) => (
                <code key={fmt} className="report-format-pill">
                  GET /portal/{tenantSlug}/reports/{row.id}?format={fmt} → {FORMAT_LABELS[fmt]}
                </code>
              ))}
            </div>
            <pre>{`curl -H 'authorization: Bearer ${bearerHint}' \\
  '${apiBase}/portal/${tenantSlug}/reports/${row.id}?format=xlsx' \\
  -o ${tenantSlug}-${row.id}.xlsx`}</pre>
          </details>
        ))}
      </div>
    </section>
  );
}
