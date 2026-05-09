/**
 *  DPIA (Data Protection Impact Assessment) — DPDP §10 + Rule 13.
 *
 *  A Significant Data Fiduciary (SDF) under §10 must conduct a periodic DPIA
 *  for high-risk processing. This module implements:
 *    - a structured questionnaire keyed to DPDP §10(2) factors
 *    - a heuristic risk score (LOW / MEDIUM / HIGH / CRITICAL)
 *    - an SDF-ready PDF/Markdown export that ties answers back to the
 *      Register, Vendors, Incidents, and Notices already captured in the
 *      workspace
 *
 *  The DPIA itself is a TenantWorkspace-level record list so a workspace
 *  can carry multiple DPIAs over time (annual + per-launch).
 */

import type { Processor, RegisterEntry, TenantWorkspace } from "@prooflyt/contracts";

export interface DpiaQuestionnaire {
  /** Description of the processing activity being assessed */
  activityName: string;
  activityDescription: string;
  /** Categories of personal data — refer to register entries */
  dataCategories: string[];
  /** Estimated number of data principals affected */
  estimatedDataPrincipals: number;
  /** Whether children's data is processed */
  involvesChildrenData: boolean;
  /** Whether sensitive identifiers (Aadhaar/PAN/biometric) are processed */
  involvesSensitiveIdentifiers: boolean;
  /** Whether processing involves cross-border transfer */
  crossBorderTransfer: boolean;
  /** Whether automated decision making with significant effects */
  automatedDecisionMaking: boolean;
  /** Whether public-facing surveillance / profiling */
  largeScaleProfiling: boolean;
  /** Linked processor ids from the Vendors module */
  linkedProcessorIds: string[];
  /** Linked register entry ids */
  linkedRegisterEntryIds: string[];
  /** Mitigations the operator has documented */
  mitigations: string;
  /** Owner / DPO */
  conductedBy: string;
}

export interface DpiaResult {
  id: string;
  conductedAt: string;
  questionnaire: DpiaQuestionnaire;
  riskFactors: Array<{ id: string; label: string; weight: number; triggered: boolean }>;
  riskScore: number; // 0–100
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  /** Auto-generated per-factor recommendations */
  recommendations: string[];
  /** Markdown export — operator can paste into a regulator submission */
  markdownReport: string;
}

const RISK_FACTORS: Array<{
  id: string;
  label: string;
  weight: number;
  test: (q: DpiaQuestionnaire, ws: TenantWorkspace) => boolean;
  recommendation: string;
}> = [
  {
    id: "children",
    label: "Processing of children's data (DPDP §9)",
    weight: 25,
    test: (q) => q.involvesChildrenData,
    recommendation:
      "Implement verifiable parental consent per Rule 10. Disable behavioural advertising and tracking aimed at minors. Document age-gating mechanism in the Notice.",
  },
  {
    id: "sensitive",
    label: "Sensitive identifiers (Aadhaar/PAN/biometric)",
    weight: 20,
    test: (q) => q.involvesSensitiveIdentifiers,
    recommendation:
      "Apply UIDAI Aadhaar Authentication Framework where Aadhaar is used. Mask in logs and analytics. Restrict access to a named role and surface in the Audit module.",
  },
  {
    id: "cross-border",
    label: "Cross-border transfer (DPDP §16 + Rule 15)",
    weight: 15,
    test: (q) => q.crossBorderTransfer,
    recommendation:
      "Verify destination country is on the Government of India notified list. Add a cross-border-transfer disclosure to the Notice. Update the Register entry with destination + lawful basis.",
  },
  {
    id: "automated",
    label: "Automated decision-making with significant effects",
    weight: 12,
    test: (q) => q.automatedDecisionMaking,
    recommendation:
      "Add a human-in-the-loop review stage. Document the model, training data, and override mechanism. Make the right-of-explanation visible in the privacy notice.",
  },
  {
    id: "profiling",
    label: "Large-scale profiling / public-facing surveillance",
    weight: 10,
    test: (q) => q.largeScaleProfiling,
    recommendation:
      "Run a separate Section 7 review. Consider data minimisation alternatives. Engage the DPB if processing is at scale (>50,000 principals).",
  },
  {
    id: "scale",
    label: "Large data principal base (>100k)",
    weight: 8,
    test: (q) => q.estimatedDataPrincipals >= 100_000,
    recommendation:
      "At this scale, file an annual DPIA per Rule 13 even if not formally classified as SDF. Maintain an internal data-flow diagram updated quarterly.",
  },
  {
    id: "open-incidents",
    label: "Open incidents linked to this activity",
    weight: 8,
    test: (_q, ws) => ws.incidents.some((i) => i.status !== "CLOSED"),
    recommendation:
      "Resolve open incidents before signing off this DPIA. Reference each incident in the mitigations section.",
  },
  {
    id: "missing-dpa",
    label: "Linked processors without signed DPA",
    weight: 10,
    test: (q, ws) => {
      const linked = ws.processors.filter((p: Processor) => q.linkedProcessorIds.includes(p.id));
      return linked.some((p) => p.dpaStatus !== "SIGNED");
    },
    recommendation:
      "Block production launch until every linked processor has a SIGNED DPA. Use the Vendor DPA generator (PR #6) for new ones.",
  },
  {
    id: "incomplete-register",
    label: "Linked register entries with PARTIAL/MISSING completeness",
    weight: 8,
    test: (q, ws) => {
      const linked = ws.registerEntries.filter((r: RegisterEntry) => q.linkedRegisterEntryIds.includes(r.id));
      return linked.some((r) => r.completeness !== "COMPLETE");
    },
    recommendation:
      "Complete the Data Register entries before sign-off. Each must have legal basis, retention label, and linked notice.",
  },
];

function levelFromScore(score: number): DpiaResult["riskLevel"] {
  if (score >= 70) return "CRITICAL";
  if (score >= 50) return "HIGH";
  if (score >= 25) return "MEDIUM";
  return "LOW";
}

/**
 *  Run the DPIA, producing a deterministic risk score + recommendations +
 *  a Markdown report ready to attach as evidence or paste into a regulator
 *  submission.
 */
export function runDpia(
  workspace: TenantWorkspace,
  q: DpiaQuestionnaire,
): DpiaResult {
  const factors = RISK_FACTORS.map((f) => ({
    id: f.id,
    label: f.label,
    weight: f.weight,
    triggered: f.test(q, workspace),
  }));
  const total = factors.filter((f) => f.triggered).reduce((acc, f) => acc + f.weight, 0);
  const riskScore = Math.min(100, total);
  const riskLevel = levelFromScore(riskScore);
  const recommendations = factors
    .filter((f) => f.triggered)
    .map((f) => RISK_FACTORS.find((rf) => rf.id === f.id)!.recommendation);

  // dpiaResults is persisted via persistDpia() which casts to a wider type;
  // the read path needs the same cast since TenantWorkspace doesn't carry
  // dpiaResults on the public contract yet.
  const existingDpias = (workspace as TenantWorkspace & { dpiaResults?: DpiaResult[] }).dpiaResults ?? [];
  const id = `DPIA-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${existingDpias.length + 1}`;
  const conductedAt = new Date().toISOString();

  const linkedProcessors = workspace.processors.filter((p) => q.linkedProcessorIds.includes(p.id));
  const linkedRegister = workspace.registerEntries.filter((r) => q.linkedRegisterEntryIds.includes(r.id));

  const markdownReport = [
    `# Data Protection Impact Assessment — ${id}`,
    ``,
    `**Conducted at:** ${conductedAt}`,
    `**Conducted by:** ${q.conductedBy}`,
    `**Activity:** ${q.activityName}`,
    `**Tenant:** ${workspace.tenant.name} (${workspace.tenant.industry})`,
    ``,
    `## 1. Activity description`,
    q.activityDescription,
    ``,
    `## 2. Personal data processed`,
    `**Categories:** ${q.dataCategories.join(", ") || "—"}`,
    `**Estimated data principals:** ${q.estimatedDataPrincipals.toLocaleString("en-IN")}`,
    `**Involves children's data:** ${q.involvesChildrenData ? "Yes" : "No"}`,
    `**Involves sensitive identifiers (Aadhaar/PAN/biometric):** ${q.involvesSensitiveIdentifiers ? "Yes" : "No"}`,
    `**Cross-border transfer:** ${q.crossBorderTransfer ? "Yes" : "No"}`,
    ``,
    `## 3. Linked register entries`,
    ...(linkedRegister.length === 0
      ? ["_None linked._"]
      : linkedRegister.map((r) => `- **${r.system}** — ${r.dataCategory} (${r.legalBasis}, retention: ${r.retentionLabel}, lifecycle: ${r.lifecycle}, completeness: ${r.completeness})`)),
    ``,
    `## 4. Linked processors`,
    ...(linkedProcessors.length === 0
      ? ["_None linked._"]
      : linkedProcessors.map((p) => `- **${p.name}** — ${p.service} (DPA: ${p.dpaStatus}, Purge: ${p.purgeAckStatus}, sub-processors: ${p.subProcessorCount})`)),
    ``,
    `## 5. Risk factors`,
    `| Factor | Weight | Triggered |`,
    `|---|---|---|`,
    ...factors.map((f) => `| ${f.label} | ${f.weight} | ${f.triggered ? "✓" : ""} |`),
    ``,
    `**Total risk score:** ${riskScore} / 100  →  **${riskLevel}**`,
    ``,
    `## 6. Recommendations`,
    ...(recommendations.length === 0 ? ["_No mitigations needed at the current risk level._"] : recommendations.map((r, i) => `${i + 1}. ${r}`)),
    ``,
    `## 7. Operator-documented mitigations`,
    q.mitigations || "_None documented in the questionnaire._",
    ``,
    `## 8. Sign-off`,
    `**Conducted by:** ${q.conductedBy}`,
    `**Date:** ${conductedAt.slice(0, 10)}`,
    `**Re-assessment due:** ${new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)} (annual per Rule 13)`,
    ``,
    `---`,
    `*Auto-generated by Prooflyt DPIA wizard. Operator must review before submitting to the Data Protection Board or attaching as evidence.*`,
  ].join("\n");

  return {
    id,
    conductedAt,
    questionnaire: q,
    riskFactors: factors,
    riskScore,
    riskLevel,
    recommendations,
    markdownReport,
  };
}

/**
 *  Persist a DPIA result onto the workspace + auto-link as an
 *  EvidenceArtifact so it appears in the Compliance Pack.
 */
export function persistDpia(workspace: TenantWorkspace, result: DpiaResult): void {
  const ws = workspace as TenantWorkspace & { dpiaResults?: DpiaResult[] };
  if (!ws.dpiaResults) ws.dpiaResults = [];
  ws.dpiaResults!.unshift(result);

  workspace.evidence.unshift({
    id: `ev-${result.id}`,
    label: `DPIA — ${result.questionnaire.activityName} (${result.riskLevel})`,
    classification: "ATTESTATION",
    linkedRecord: result.id,
    createdAt: result.conductedAt,
    contentIndexed: false,
  });
}
