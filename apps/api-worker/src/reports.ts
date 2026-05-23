/**
 *  Named reports generator — JVA Annexure A §A7.10 + §A12 + Schedule 1 §S1.8(c).
 *
 *  Six required report types, each emitable in 4 formats so auditors can
 *  drop them into Excel, board decks, GRC tools, or printed binders:
 *    · register-completeness   — register entries by lifecycle + completeness
 *    · open-rights             — open rights cases with SLA windows
 *    · due-deletions           — deletion tasks with proof + processor status
 *    · incident-register       — incidents with severity + 72h timer
 *    · audit-extract           — append-only audit trail (filterable window)
 *    · processor-status        — vendors + DPA + DPDP §8 obligations
 *
 *  Formats:
 *    · json   — full row-array, machine-consumable
 *    · csv    — RFC-4180 CSV with header row
 *    · xlsx   — single-sheet workbook with header styling
 *    · pdf    — minimal text PDF (header + monospace rows) — pure-TS
 *               generator, no native deps, works in Cloudflare Workers
 *
 *  Why a hand-rolled PDF generator: pdf-lib + pdfkit pull in Node-only
 *  shims that don't tree-shake into Workers. The JVA spec requires PDF
 *  output (§A7.10), so we ship a deterministic 1-page-per-N-rows writer
 *  that emits valid PDF-1.4 bytes. Auditors get a printable artifact;
 *  if they need rich layout they pivot to the XLSX/CSV variants.
 */

import * as XLSX from "xlsx";
import type { TenantWorkspace } from "@prooflyt/contracts";

export type ReportType =
  | "register-completeness"
  | "open-rights"
  | "due-deletions"
  | "incident-register"
  | "audit-extract"
  | "processor-status";

export type ReportFormat = "json" | "csv" | "xlsx" | "pdf";

export const REPORT_TYPES: ReportType[] = [
  "register-completeness",
  "open-rights",
  "due-deletions",
  "incident-register",
  "audit-extract",
  "processor-status",
];

export const REPORT_FORMATS: ReportFormat[] = ["json", "csv", "xlsx", "pdf"];

interface ReportShape {
  title: string;
  citation: string;
  headers: string[];
  rows: (string | number | boolean | null | undefined)[][];
  /** Optional summary blurb rendered at the top of the PDF cover page. */
  summary?: string;
}

/* ------------------------------------------------------------------ */
/*  Report shape builders                                              */
/* ------------------------------------------------------------------ */

function buildRegisterCompleteness(workspace: TenantWorkspace): ReportShape {
  const rows = workspace.registerEntries.map((e) => [
    e.id,
    e.system,
    e.dataCategory,
    e.purpose,
    e.legalBasis,
    e.retentionLabel,
    e.lifecycle,
    e.completeness,
    e.linkedNoticeId || "",
    (e.linkedProcessorIds || []).join(";"),
    e.sourceTrace,
  ]);
  const approved = workspace.registerEntries.filter((e) => e.lifecycle === "APPROVED").length;
  const complete = workspace.registerEntries.filter((e) => e.completeness === "COMPLETE").length;
  return {
    title: "Register completeness report",
    citation:
      "DPDP §5 + §8 — Records of processing. JVA Schedule 1 §S1.4 Module 3 / §A7.3.",
    summary:
      `Approved entries: ${approved}/${workspace.registerEntries.length}. ` +
      `Complete entries: ${complete}/${workspace.registerEntries.length}.`,
    headers: [
      "ID",
      "System",
      "Data category",
      "Purpose",
      "Legal basis",
      "Retention",
      "Lifecycle",
      "Completeness",
      "Linked notice",
      "Linked processors",
      "Source trace",
    ],
    rows,
  };
}

function buildOpenRights(workspace: TenantWorkspace): ReportShape {
  const open = workspace.rightsCases.filter((c) => c.status !== "CLOSED");
  const rows = open.map((c) => [
    c.id,
    c.type,
    c.requestor,
    c.status,
    c.sla,
    c.evidenceLinked ? "yes" : "no",
    c.linkedDeletionTaskId || "",
  ]);
  return {
    title: "Open rights report",
    citation:
      "DPDP §11–§15 + Rule 13 — Rights of data principal. JVA §S1.4 Module 6 / §A7.5 / §S1.9 SLA.",
    summary: `${open.length} open rights cases (out of ${workspace.rightsCases.length} total).`,
    headers: ["ID", "Type", "Requestor", "Status", "SLA", "Evidence linked", "Deletion task"],
    rows,
  };
}

function buildDueDeletions(workspace: TenantWorkspace): ReportShape {
  const today = new Date().toISOString().slice(0, 10);
  const due = workspace.deletionTasks.filter(
    (t) => t.status !== "CLOSED" && t.dueDate <= today,
  );
  const rows = workspace.deletionTasks.map((t) => [
    t.id,
    t.label,
    t.system,
    t.dueDate,
    t.status,
    t.proofLinked ? "yes" : "no",
    t.processorAcknowledged ? "yes" : "no",
  ]);
  return {
    title: "Due deletions report",
    citation:
      "DPDP §8(7) + §14 — Erasure obligations. JVA §S1.4 Module 7 / §A7.6 + §A14 retention.",
    summary:
      `Due-now (overdue or due today): ${due.length}. ` +
      `Total deletion tasks: ${workspace.deletionTasks.length}.`,
    headers: ["ID", "Label", "System", "Due date", "Status", "Proof linked", "Processor ack."],
    rows,
  };
}

function buildIncidentRegister(workspace: TenantWorkspace): ReportShape {
  const rows = workspace.incidents.map((i) => [
    i.id,
    i.title,
    i.severity,
    i.status,
    i.boardDeadline,
    i.remediationOwner,
    i.evidenceLinked ? "yes" : "no",
    i.affectedCount ?? "",
    i.discoveryDate ?? "",
    i.autoEscalated ? "yes" : "no",
  ]);
  const active = workspace.incidents.filter((i) => i.status !== "CLOSED").length;
  const high = workspace.incidents.filter(
    (i) => i.severity === "HIGH" || i.severity === "CRITICAL",
  ).length;
  return {
    title: "Incident register",
    citation:
      "DPDP §8(6) + Rule 7 + §32 — Breach notification. JVA §S1.4 Module 8 / §A7.7 + §A9.6 (72h timer).",
    summary: `Active incidents: ${active}. HIGH/CRITICAL severity: ${high}.`,
    headers: [
      "ID",
      "Title",
      "Severity",
      "Status",
      "Board deadline",
      "Remediation owner",
      "Evidence linked",
      "Affected count",
      "Discovery date",
      "Auto-escalated",
    ],
    rows,
  };
}

function buildAuditExtract(workspace: TenantWorkspace, since?: string): ReportShape {
  const window = since
    ? workspace.auditTrail.filter((a) => a.createdAt >= since)
    : workspace.auditTrail;
  const rows = window.map((a) => [
    a.id,
    a.createdAt,
    a.actor,
    a.module,
    a.action,
    a.targetId,
    a.summary,
  ]);
  return {
    title: "Audit extract",
    citation:
      "DPDP §8(8) — Demonstrable compliance. JVA §S1.4 Module 10 / §A7.9 + §S1.8(c) integrity.",
    summary:
      `Audit events: ${window.length}` +
      (since ? ` (since ${since})` : "") +
      `. Append-only — hash-chain integrity per §S1.8(c).`,
    headers: ["ID", "Timestamp", "Actor", "Module", "Action", "Target", "Summary"],
    rows,
  };
}

function buildProcessorStatus(workspace: TenantWorkspace): ReportShape {
  const rows = workspace.processors.map((p) => [
    p.id,
    p.name,
    p.service,
    p.dpaStatus,
    p.purgeAckStatus,
    p.subProcessorCount,
  ]);
  const signed = workspace.processors.filter((p) => p.dpaStatus === "SIGNED").length;
  return {
    title: "Processor status report",
    citation:
      "DPDP §8 — Reasonable security safeguards via processors. JVA §S1.4 Module 9 / §A7.8 / §A8.",
    summary:
      `Processors with signed DPA: ${signed}/${workspace.processors.length}. ` +
      `Sub-processors total: ${workspace.processors.reduce((acc, p) => acc + p.subProcessorCount, 0)}.`,
    headers: [
      "ID",
      "Name",
      "Service",
      "DPA status",
      "Purge ack. status",
      "Sub-processor count",
    ],
    rows,
  };
}

/* ------------------------------------------------------------------ */
/*  Dispatcher                                                         */
/* ------------------------------------------------------------------ */

export function buildReport(
  workspace: TenantWorkspace,
  type: ReportType,
  options: { since?: string } = {},
): ReportShape {
  switch (type) {
    case "register-completeness":
      return buildRegisterCompleteness(workspace);
    case "open-rights":
      return buildOpenRights(workspace);
    case "due-deletions":
      return buildDueDeletions(workspace);
    case "incident-register":
      return buildIncidentRegister(workspace);
    case "audit-extract":
      return buildAuditExtract(workspace, options.since);
    case "processor-status":
      return buildProcessorStatus(workspace);
  }
}

/* ------------------------------------------------------------------ */
/*  Format renderers                                                   */
/* ------------------------------------------------------------------ */

function csvEscape(value: unknown): string {
  const s = String(value ?? "");
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function renderCsv(report: ReportShape): string {
  const rows = [report.headers, ...report.rows];
  return rows.map((r) => r.map(csvEscape).join(",")).join("\n");
}

function renderJson(report: ReportShape, tenantSlug: string): string {
  const objectRows = report.rows.map((row) => {
    const obj: Record<string, unknown> = {};
    report.headers.forEach((h, i) => {
      obj[h] = row[i];
    });
    return obj;
  });
  return JSON.stringify(
    {
      tenant: tenantSlug,
      title: report.title,
      citation: report.citation,
      summary: report.summary,
      generatedAt: new Date().toISOString(),
      rowCount: report.rows.length,
      headers: report.headers,
      rows: objectRows,
    },
    null,
    2,
  );
}

function renderXlsx(report: ReportShape, tenantSlug: string): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  // Cover sheet with citation + summary.
  const cover = XLSX.utils.aoa_to_sheet([
    [report.title],
    [`Tenant: ${tenantSlug}`],
    [`Citation: ${report.citation}`],
    [`Generated: ${new Date().toISOString()}`],
    [report.summary || ""],
  ]);
  XLSX.utils.book_append_sheet(wb, cover, "Cover");
  // Data sheet — header row + rows.
  const data = XLSX.utils.aoa_to_sheet([report.headers, ...report.rows]);
  XLSX.utils.book_append_sheet(wb, data, "Data");
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return out;
}

/* ------------------------------------------------------------------ */
/*  Minimal PDF generator (PDF-1.4, monospace, paginated)              */
/* ------------------------------------------------------------------ */

/**
 *  Escape characters that would break a PDF text literal. PDF literals
 *  are wrapped in parentheses; backslash, opening and closing parens
 *  must be escaped. Newlines/CRs get squashed to spaces (the layout
 *  engine emits its own line breaks per row).
 */
function pdfEscape(text: string): string {
  return String(text ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[\r\n]+/g, " ");
}

/** Truncate a string to fit a column width (monospace assumed). */
function trunc(s: string, n: number): string {
  s = String(s ?? "");
  if (s.length <= n) return s.padEnd(n, " ");
  return s.slice(0, Math.max(1, n - 1)) + "…";
}

/**
 *  Render a report to a minimal PDF byte sequence.
 *
 *  Layout: A4 (595×842 pt), 36 pt margins, Courier 8 pt. Header on each
 *  page. Auto-paginates rows. Returns a Uint8Array of PDF bytes.
 */
function renderPdf(report: ReportShape, tenantSlug: string): Uint8Array {
  // ---- Page geometry & font metrics ------------------------------
  const pageW = 595;
  const pageH = 842;
  const margin = 36;
  const fontSize = 8;
  const lineHeight = 11; // pt
  // Courier @ 8pt: each glyph is ~0.6 × fontSize = 4.8 pt wide.
  const charW = fontSize * 0.6;
  const maxChars = Math.floor((pageW - margin * 2) / charW); // ≈108
  const headerLines = 4; // title + tenant + citation + spacer
  const rowsPerPage = Math.floor((pageH - margin * 2 - headerLines * lineHeight) / lineHeight) - 2;

  // ---- Column widths ---------------------------------------------
  // Allocate column widths proportional to header length and observed
  // max-cell length, with a small floor so very short columns still
  // get a few chars. Total widths must fit within maxChars.
  const colCount = report.headers.length;
  const observed = report.headers.map((h, i) => {
    let max = h.length;
    for (const row of report.rows) {
      const len = String(row[i] ?? "").length;
      if (len > max) max = len;
    }
    return Math.max(4, Math.min(60, max));
  });
  const totalObserved = observed.reduce((a, b) => a + b, 0);
  // 1 char separator between columns.
  const available = maxChars - (colCount - 1);
  const colW = observed.map((w) =>
    Math.max(4, Math.floor((w / totalObserved) * available)),
  );

  // ---- Build text lines ------------------------------------------
  const headerLine = report.headers.map((h, i) => trunc(h, colW[i])).join(" ");
  const sepLine = colW.map((w) => "-".repeat(w)).join(" ");
  const dataLines = report.rows.map((r) =>
    r.map((cell, i) => trunc(String(cell ?? ""), colW[i])).join(" "),
  );

  // Paginate.
  const pages: string[][] = [];
  for (let i = 0; i < dataLines.length; i += rowsPerPage) {
    pages.push(dataLines.slice(i, i + rowsPerPage));
  }
  if (pages.length === 0) pages.push([]);

  // ---- Compose content streams -----------------------------------
  // Each page draws title + tenant + citation + spacer + header row +
  // separator + data lines. Coordinates: PDF origin = bottom-left.
  const pageStreams: string[] = pages.map((rows, pageIdx) => {
    const lines: { text: string; y: number; bold?: boolean }[] = [];
    let y = pageH - margin;
    const writeLine = (text: string, bold = false) => {
      lines.push({ text, y, bold });
      y -= lineHeight;
    };
    writeLine(report.title);
    writeLine(`Tenant: ${tenantSlug}   Page ${pageIdx + 1}/${pages.length}   ${new Date().toISOString()}`);
    writeLine(`Citation: ${trunc(report.citation, maxChars - 10)}`);
    writeLine(""); // spacer
    writeLine(headerLine, true);
    writeLine(sepLine);
    for (const row of rows) writeLine(row);
    // Build the page-content stream.
    const segments = ["BT", `/F1 ${fontSize} Tf`, `${lineHeight} TL`];
    for (const ln of lines) {
      segments.push(`${margin} ${ln.y} Td`);
      // Reset matrix per line because Td accumulates.
    }
    // Simpler approach: position each line absolutely via Tm.
    segments.length = 0;
    segments.push("BT");
    segments.push(`/F1 ${fontSize} Tf`);
    for (const ln of lines) {
      segments.push(`1 0 0 1 ${margin} ${ln.y} Tm`);
      segments.push(`(${pdfEscape(ln.text)}) Tj`);
    }
    segments.push("ET");
    return segments.join("\n");
  });

  // ---- PDF object table ------------------------------------------
  // 1 = Catalog, 2 = Pages, 3 = Font, 4..N = page objects (alternating
  // page dict + content stream).
  const objects: string[] = [];
  const offsets: number[] = [];
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let cursor = 0;
  const push = (s: string) => {
    const bytes = encoder.encode(s);
    chunks.push(bytes);
    cursor += bytes.length;
  };
  const pushObj = (id: number, body: string) => {
    offsets[id] = cursor;
    push(`${id} 0 obj\n${body}\nendobj\n`);
  };

  push("%PDF-1.4\n");
  push("%\xe2\xe3\xcf\xd3\n"); // binary marker so viewers know it's binary

  // We need to know page-object IDs first to write /Kids. We'll lay out
  // IDs deterministically: catalog=1, pages=2, font=3, then pairs:
  //   page object i  = 4 + (i*2)
  //   content obj i  = 5 + (i*2)
  const pageObjIds: number[] = pages.map((_, i) => 4 + i * 2);
  const contentObjIds: number[] = pages.map((_, i) => 5 + i * 2);

  // 1: Catalog
  pushObj(1, `<< /Type /Catalog /Pages 2 0 R >>`);
  // 2: Pages
  pushObj(
    2,
    `<< /Type /Pages /Count ${pages.length} /Kids [${pageObjIds
      .map((id) => `${id} 0 R`)
      .join(" ")}] >>`,
  );
  // 3: Font (Courier — standard 14-font, no embedding required).
  pushObj(
    3,
    `<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>`,
  );
  // 4...: pages
  pageStreams.forEach((stream, i) => {
    const pageId = pageObjIds[i];
    const contentId = contentObjIds[i];
    pushObj(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    const len = encoder.encode(stream).length;
    pushObj(contentId, `<< /Length ${len} >>\nstream\n${stream}\nendstream`);
  });

  // xref
  const xrefOffset = cursor;
  const totalObjects = 4 + pages.length * 2; // ids 1..(3 + pages*2)
  push(`xref\n0 ${totalObjects}\n`);
  push("0000000000 65535 f \n");
  for (let id = 1; id < totalObjects; id++) {
    const off = offsets[id] ?? 0;
    push(`${String(off).padStart(10, "0")} 00000 n \n`);
  }
  push(`trailer\n<< /Size ${totalObjects} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  // Concatenate.
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export interface RenderedReport {
  body: string | Uint8Array | ArrayBuffer;
  contentType: string;
  fileName: string;
}

export function renderReport(
  workspace: TenantWorkspace,
  tenantSlug: string,
  type: ReportType,
  format: ReportFormat,
  options: { since?: string } = {},
): RenderedReport {
  const report = buildReport(workspace, type, options);
  const baseName = `${tenantSlug}-${type}-${new Date().toISOString().slice(0, 10)}`;
  switch (format) {
    case "json":
      return {
        body: renderJson(report, tenantSlug),
        contentType: "application/json",
        fileName: `${baseName}.json`,
      };
    case "csv":
      return {
        body: renderCsv(report),
        contentType: "text/csv; charset=utf-8",
        fileName: `${baseName}.csv`,
      };
    case "xlsx":
      return {
        body: renderXlsx(report, tenantSlug),
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        fileName: `${baseName}.xlsx`,
      };
    case "pdf":
      return {
        body: renderPdf(report, tenantSlug),
        contentType: "application/pdf",
        fileName: `${baseName}.pdf`,
      };
  }
}

export function isReportType(s: string): s is ReportType {
  return (REPORT_TYPES as readonly string[]).includes(s);
}

export function isReportFormat(s: string): s is ReportFormat {
  return (REPORT_FORMATS as readonly string[]).includes(s);
}
