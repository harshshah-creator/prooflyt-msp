/**
 * Audit-firm-specific Compliance Pack templates.
 *
 * Every Big-4 + GT-style audit practice has a different convention for
 * how DPDP / privacy evidence is presented:
 *
 *   KPMG          uses "EV-NN" cross-references and a control-objective
 *                 mapping table at the front; partners want a "Test
 *                 Procedure" line per control.
 *   EY            insists on a numbered Section/Sub-section TOC and an
 *                 explicit "scope letter" cover that lists the period
 *                 covered, in-scope entities, and exclusions.
 *   PwC           prefers "Exhibit A/B/C..." for evidence and a
 *                 risk-rating heatmap up front.
 *   Deloitte      uses an "appendix" model with per-domain partner
 *                 sign-off boxes and an executive summary that focuses
 *                 on residual risk.
 *   Grant Thornton uses a "Trust Services" framing aligned to SOC 2,
 *                 plus an India-specific "RBI / DPDP cross-walk" page.
 *
 * Tenants that send their pack to one of these firms today rebuild the
 * front-matter manually in Word every quarter. This module lets them
 * pick a firm via ?firm=kpmg and get a Markdown cover + TOC + evidence
 * map in the auditor's expected shape, alongside the existing CSVs.
 *
 * The CSV bodies are unchanged — auditors all want the same data, just
 * with different wrappers. We only re-skin the cover materials.
 */

import type { TenantWorkspace } from "@prooflyt/contracts";

export const SUPPORTED_FIRMS = ["generic", "kpmg", "ey", "pwc", "deloitte", "grantthornton"] as const;
export type AuditFirm = (typeof SUPPORTED_FIRMS)[number];

export function normaliseFirm(raw: string | null | undefined): AuditFirm {
  if (!raw) return "generic";
  const v = raw.toLowerCase().trim().replace(/\s|_|-/g, "");
  if ((SUPPORTED_FIRMS as readonly string[]).includes(v)) return v as AuditFirm;
  // Common aliases.
  if (v === "gt") return "grantthornton";
  if (v === "pricewaterhousecoopers") return "pwc";
  if (v === "ernstandyoung") return "ey";
  return "generic";
}

/* ------------------------------------------------------------------ */
/*  Firm metadata                                                       */
/* ------------------------------------------------------------------ */

interface FirmProfile {
  display: string;
  evidencePrefix: string;        // "EV", "Exhibit", "Appendix"
  preferredFontHint: string;     // shown in the cover for the auditor's typesetter
  scopeLetterMode: "narrative" | "tabular";
  controlMappingFramework: string; // SOC 2 / RBI / DPDP / ISO 27701
}

const FIRMS: Record<AuditFirm, FirmProfile> = {
  generic: {
    display: "Audit Pack",
    evidencePrefix: "EV",
    preferredFontHint: "system",
    scopeLetterMode: "narrative",
    controlMappingFramework: "DPDP Act, 2023",
  },
  kpmg: {
    display: "KPMG India — DPDP Readiness Pack",
    evidencePrefix: "EV",
    preferredFontHint: "Univers / Arial",
    scopeLetterMode: "tabular",
    controlMappingFramework: "DPDP Act + KPMG TPRM CO mapping",
  },
  ey: {
    display: "EY India — Privacy Compliance Reporting Pack",
    evidencePrefix: "Exhibit",
    preferredFontHint: "EYInterstate / Arial",
    scopeLetterMode: "narrative",
    controlMappingFramework: "DPDP Act § & Rule cross-walk",
  },
  pwc: {
    display: "PwC India — Data Privacy Assurance File",
    evidencePrefix: "Exhibit",
    preferredFontHint: "Charter / Georgia",
    scopeLetterMode: "tabular",
    controlMappingFramework: "DPDP + ISO/IEC 27701 cross-reference",
  },
  deloitte: {
    display: "Deloitte India — DPDP Compliance Dossier",
    evidencePrefix: "Appendix",
    preferredFontHint: "Open Sans",
    scopeLetterMode: "narrative",
    controlMappingFramework: "DPDP + Deloitte Privacy Maturity Framework",
  },
  grantthornton: {
    display: "Grant Thornton Bharat — Trust Services Pack",
    evidencePrefix: "EV",
    preferredFontHint: "Source Sans Pro",
    scopeLetterMode: "tabular",
    controlMappingFramework: "DPDP + SOC 2 Trust Services + RBI Master Direction cross-walk",
  },
};

/* ------------------------------------------------------------------ */
/*  Cover renderers                                                     */
/* ------------------------------------------------------------------ */

export interface FirmCoverBundle {
  firm: AuditFirm;
  coverLetterMarkdown: string;
  tocMarkdown: string;
  controlMappingMarkdown: string;
  evidenceMapMarkdown: string;
  fileNameSuffix: string;
}

export function renderForFirm(workspace: TenantWorkspace, firm: AuditFirm): FirmCoverBundle {
  const profile = FIRMS[firm];
  const today = new Date().toISOString().slice(0, 10);
  const periodStart = startOfPeriod(today);

  const coverLetter = renderCover(workspace, profile, today, periodStart);
  const toc = renderToc(profile);
  const controlMap = renderControlMapping(workspace, profile);
  const evidenceMap = renderEvidenceMap(workspace, profile);

  return {
    firm,
    coverLetterMarkdown: coverLetter,
    tocMarkdown: toc,
    controlMappingMarkdown: controlMap,
    evidenceMapMarkdown: evidenceMap,
    fileNameSuffix: firm === "generic" ? "" : `-${firm}`,
  };
}

function startOfPeriod(today: string): string {
  // 90-day reporting window — most audit firms run a quarterly cycle.
  const d = new Date(today);
  d.setUTCDate(d.getUTCDate() - 90);
  return d.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/*  Cover letter                                                        */
/* ------------------------------------------------------------------ */

function renderCover(
  workspace: TenantWorkspace,
  profile: FirmProfile,
  today: string,
  periodStart: string,
): string {
  const t = workspace.tenant;
  const m = workspace.metrics;
  const lines: string[] = [];
  lines.push(`# ${profile.display}`);
  lines.push("");
  lines.push(`**Subject entity:** ${t.name} (slug: \`${t.slug}\`)`);
  lines.push(`**Industry:** ${t.industry}`);
  lines.push(`**Reporting period:** ${periodStart} to ${today}`);
  lines.push(`**Pack generated:** ${today}`);
  lines.push(`**Control framework:** ${profile.controlMappingFramework}`);
  lines.push(`**Typeset hint:** ${profile.preferredFontHint}`);
  lines.push("");

  if (profile.scopeLetterMode === "tabular") {
    lines.push("## Scope summary");
    lines.push("");
    lines.push("| Field | Value |");
    lines.push("|---|---|");
    lines.push(`| In-scope entity | ${t.name} |`);
    lines.push(`| Reporting period | ${periodStart} → ${today} |`);
    lines.push(`| Readiness score | ${m.readinessScore}% |`);
    lines.push(`| Owner coverage | ${m.ownerCoverage}% |`);
    lines.push(`| Evidence coverage | ${m.evidenceCoverage}% |`);
    lines.push(`| Open gaps | ${m.openGaps} |`);
    lines.push(`| Open rights cases | ${m.openRights} |`);
    lines.push(`| Overdue deletion tasks | ${m.overdueDeletions} |`);
    lines.push(`| Active incidents | ${m.activeIncidents} |`);
  } else {
    lines.push("## Scope letter");
    lines.push("");
    lines.push(
      `This pack documents ${t.name}'s DPDP Act, 2023 compliance posture for ` +
      `the period ${periodStart} through ${today}. The subject entity reports a ` +
      `composite readiness score of ${m.readinessScore}% with owner coverage at ` +
      `${m.ownerCoverage}% and evidence coverage at ${m.evidenceCoverage}%. ` +
      `Open compliance gaps total ${m.openGaps}; open rights cases total ` +
      `${m.openRights}; overdue deletion tasks total ${m.overdueDeletions}; and ` +
      `${m.activeIncidents} incident(s) remain active.`,
    );
    lines.push("");
    lines.push(`**Operational narrative:** ${t.operationalStory}`);
  }
  lines.push("");
  lines.push("## Reading order");
  lines.push("");
  lines.push(`1. \`01-toc.md\` — Table of contents`);
  lines.push(`2. \`02-control-mapping.md\` — Section/control cross-walk`);
  lines.push(`3. \`03-evidence-map.md\` — ${profile.evidencePrefix} cross-references`);
  lines.push(`4. \`data-register.csv\` — Article 30-equivalent Record of Processing`);
  lines.push(`5. \`rights-cases.csv\` — DPDP §13–§15 case ledger`);
  lines.push(`6. \`deletion-log.csv\` — DPDP §8(7) / Rule 8 erasure ledger`);
  lines.push(`7. \`incident-register.csv\` — DPDP §32 incident register`);
  lines.push(`8. \`processor-list.csv\` — Sub-processor inventory`);
  lines.push(`9. \`notice-snapshots.json\` — DPDP §5 notice history`);
  lines.push(`10. \`evidence-manifest.json\` — Sealed evidence index`);
  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
/*  Table of contents                                                   */
/* ------------------------------------------------------------------ */

function renderToc(profile: FirmProfile): string {
  const lines: string[] = [];
  lines.push(`# Table of Contents`);
  lines.push("");
  lines.push(`Section numbers are aligned with ${profile.controlMappingFramework}.`);
  lines.push("");
  lines.push(`| § | Section | File |`);
  lines.push(`|---|---|---|`);
  lines.push(`| 1 | Cover letter & scope | \`00-cover.md\` |`);
  lines.push(`| 2 | Table of contents (this file) | \`01-toc.md\` |`);
  lines.push(`| 3 | Control mapping | \`02-control-mapping.md\` |`);
  lines.push(`| 4 | Evidence ${profile.evidencePrefix} cross-reference | \`03-evidence-map.md\` |`);
  lines.push(`| 5 | Data register (Record of Processing) | \`data-register.csv\` |`);
  lines.push(`| 6 | Rights-case ledger (§13–§15) | \`rights-cases.csv\` |`);
  lines.push(`| 7 | Deletion / retention log (§8(7)) | \`deletion-log.csv\` |`);
  lines.push(`| 8 | Incident register (§32) | \`incident-register.csv\` |`);
  lines.push(`| 9 | Processor inventory | \`processor-list.csv\` |`);
  lines.push(`| 10 | Notice snapshots (§5) | \`notice-snapshots.json\` |`);
  lines.push(`| 11 | Evidence manifest | \`evidence-manifest.json\` |`);
  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
/*  Control mapping                                                     */
/* ------------------------------------------------------------------ */

/**
 *  Static module → DPDP citation map. The citations themselves are fixed
 *  by statute; tenants don't override them. Keeping this here means the
 *  Compliance Pack always renders the right §/Rule even when the
 *  ObligationBucket (which doesn't carry citations on its public type)
 *  hasn't been freshly seeded.
 */
const MODULE_DPDP_CITATIONS: Record<string, { section: string; rule: string }> = {
  setup: { section: "—", rule: "—" },
  sources: { section: "Section 8(1)", rule: "Rule 6" },
  register: { section: "Section 8(1)", rule: "Rule 6" },
  notices: { section: "Section 5", rule: "Rule 3" },
  rights: { section: "Sections 13–15", rule: "Rule 13" },
  retention: { section: "Section 8(7)", rule: "Rule 8" },
  incidents: { section: "Section 8(6) + 32", rule: "Rule 7" },
  processors: { section: "Section 8(2)", rule: "—" },
  evidence: { section: "Section 8(5)", rule: "Rule 6" },
  reports: { section: "Section 10", rule: "—" },
  "dpdp-reference": { section: "Schedule (whole)", rule: "—" },
  connectors: { section: "Section 8(2)", rule: "—" },
  dashboard: { section: "—", rule: "—" },
};

function renderControlMapping(workspace: TenantWorkspace, profile: FirmProfile): string {
  const lines: string[] = [];
  lines.push(`# Control mapping`);
  lines.push("");
  lines.push(`Framework: ${profile.controlMappingFramework}`);
  lines.push("");
  lines.push(`| Control | DPDP § | DPDP Rule | Test procedure | Status | Maturity | Evidence |`);
  lines.push(`|---|---|---|---|---|---|---|`);
  for (const o of workspace.obligations) {
    const cite = MODULE_DPDP_CITATIONS[o.module] ?? { section: "—", rule: "—" };
    const evidenceRef = workspace.evidence
      .filter((e) => e.linkedRecord && (e.linkedRecord.includes(o.module) || e.label.toLowerCase().includes(o.module)))
      .slice(0, 3)
      .map((e) => `${profile.evidencePrefix}-${e.id.replace(/^ev-?/, "").slice(0, 8)}`)
      .join(", ") || "—";
    lines.push(
      `| ${escapeMd(o.title)} | ${cite.section} | ${cite.rule} | ${escapeMd(o.operationalLabel)} | ${o.status} | ${o.maturity}% | ${evidenceRef} |`,
    );
  }
  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
/*  Evidence map                                                        */
/* ------------------------------------------------------------------ */

function renderEvidenceMap(workspace: TenantWorkspace, profile: FirmProfile): string {
  const lines: string[] = [];
  lines.push(`# Evidence ${profile.evidencePrefix} cross-reference`);
  lines.push("");
  lines.push(`Each evidence artefact in the manifest maps to a stable ` +
    `${profile.evidencePrefix}-NN reference for the auditor's working papers.`);
  lines.push("");
  lines.push(`| ${profile.evidencePrefix} ref | Label | Classification | Linked record | Created |`);
  lines.push(`|---|---|---|---|---|`);
  workspace.evidence.forEach((e, i) => {
    const ref = `${profile.evidencePrefix}-${String(i + 1).padStart(3, "0")}`;
    lines.push(
      `| ${ref} | ${escapeMd(e.label)} | ${e.classification} | ${escapeMd(e.linkedRecord)} | ${e.createdAt.slice(0, 10)} |`,
    );
  });
  return lines.join("\n");
}

/**
 *  Markdown-cell escaper. The cover sheet is auditor-rendered Markdown,
 *  not HTML, so XSS isn't the threat. The threat is a malicious tenant
 *  user putting `[phishing](http://evil)` in their tenant name and
 *  having it render as a clickable link in the auditor's Markdown
 *  viewer. We neutralise:
 *    * pipe `|`            — would break the table
 *    * newline             — would break the row
 *    * backslash + space   — preserves intent
 *    * backtick `` ` ``    — would render as inline code
 *    * brackets `[` `]`    — would form `[text](url)` links
 *    * parentheses `(` `)` — same
 *    * hash `#`            — would render as a heading if line-leading
 *    * angle brackets      — would render as autolinks or HTML
 *    * leading `>`         — blockquote
 *    * leading `-` / `*`   — list item
 *  We backslash-escape rather than strip so the original character is
 *  still visible to a human reader.
 */
function escapeMd(s: string | undefined | null): string {
  if (!s) return "—";
  return s
    .replace(/\\/g, "\\\\")           // escape escapes first
    .replace(/\|/g, "\\|")
    .replace(/`/g, "\\`")
    .replace(/\[/g, "\\[")
    .replace(/]/g, "\\]")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/#/g, "\\#")
    .replace(/</g, "\\<")
    .replace(/>/g, "\\>")
    .replace(/^[-*+]/, "\\$&")        // leading list-item char
    .replace(/^>/, "\\>")             // leading blockquote
    .replace(/\n/g, " ");
}
