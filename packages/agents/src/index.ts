import type {
  AgentAction,
  Incident,
  RightsCase,
  TenantWorkspace,
  Processor,
  RegisterEntry,
} from "../../contracts/dist/index.js";

/* ── Unique ID ─────────────────────────────────────────────── */

let counter = 0;
function agentId(): string {
  counter += 1;
  return `agent-${Date.now()}-${counter}`;
}

/* ── Breach Response Agent ─────────────────────────────────── */

function severityRationale(incident: Incident, workspace: TenantWorkspace): string {
  const affectedSources = workspace.registerEntries.filter(
    (entry) => entry.completeness !== "MISSING",
  );
  const directIdentifierCount = workspace.sourceProfiles.filter(
    (profile) => profile.identifierType === "Direct identifier",
  ).length;

  const lines = [
    `## Severity Assessment — ${incident.id}`,
    `**Incident:** ${incident.title}`,
    `**Current severity:** ${incident.severity}`,
    `**Remediation owner:** ${incident.remediationOwner}`,
    "",
    "### Impact analysis",
    `- Register entries in scope: ${affectedSources.length}`,
    `- Direct identifiers exposed: ${directIdentifierCount}`,
    `- Processors with pending DPA: ${workspace.processors.filter((p) => p.dpaStatus !== "SIGNED").length}`,
    "",
    "### Severity rationale",
  ];

  if (incident.severity === "CRITICAL") {
    lines.push(
      "This incident involves direct personal identifiers and is rated CRITICAL.",
      "Under DPDP Section 29, the Data Protection Board must be notified within 72 hours.",
      "Immediate containment and parallel notification workflows are recommended.",
    );
  } else if (incident.severity === "HIGH") {
    lines.push(
      "This incident has HIGH severity. While Board notification may not be mandatory,",
      "proactive disclosure is recommended given the number of data principals affected.",
    );
  } else {
    lines.push(
      `Severity rated ${incident.severity}. Standard containment protocol applies.`,
      "Monitor for escalation triggers over the next 48 hours.",
    );
  }

  return lines.join("\n");
}

function boardNotificationDraft(incident: Incident, workspace: TenantWorkspace): string {
  const tenant = workspace.tenant;
  return [
    `## Section 29 Board Notification Draft`,
    "",
    `**To:** Data Protection Board of India`,
    `**From:** ${tenant.name} (${tenant.industry})`,
    `**Date:** ${new Date().toISOString().split("T")[0]}`,
    `**Reference:** ${incident.id}`,
    "",
    `### Nature of breach`,
    `${incident.title}`,
    "",
    `### Categories of personal data affected`,
    ...workspace.registerEntries
      .filter((entry) => entry.completeness !== "MISSING")
      .slice(0, 5)
      .map((entry) => `- ${entry.dataCategory} (${entry.system})`),
    "",
    `### Estimated data principals affected`,
    `Assessment pending. Initial scope based on register entries above.`,
    "",
    `### Measures taken`,
    `- Incident triaged and assigned to ${incident.remediationOwner}`,
    `- Containment measures initiated`,
    `- Processor notification queue activated`,
    "",
    `### Contact`,
    `DPO Lead, ${tenant.name}`,
    "",
    `---`,
    `*This is an AI-drafted notification. It must be reviewed and approved by the Compliance Manager before submission.*`,
  ].join("\n");
}

function processorNotifications(incident: Incident, workspace: TenantWorkspace): string {
  const lines = [
    `## Processor Notification Queue — ${incident.id}`,
    "",
  ];

  for (const processor of workspace.processors) {
    const status = processor.dpaStatus === "SIGNED" ? "Active DPA" : "DPA " + processor.dpaStatus;
    lines.push(
      `### ${processor.name}`,
      `**Service:** ${processor.service}`,
      `**DPA status:** ${status}`,
      `**Sub-processors:** ${processor.subProcessorCount}`,
      "",
      `Dear ${processor.name} Privacy Team,`,
      "",
      `We are writing to inform you of a personal data breach (${incident.id}: ${incident.title}) `,
      `that may involve data processed under our agreement.`,
      "",
      `Please confirm within 48 hours:`,
      `1. Whether any personal data under your processing was affected`,
      `2. Containment measures applied on your side`,
      `3. Estimated scope of affected records`,
      "",
      `---`,
      "",
    );
  }

  lines.push("*Each notification must be individually approved before sending.*");
  return lines.join("\n");
}

function investigationChecklist(incident: Incident): string {
  return [
    `## Investigation Checklist — ${incident.id}`,
    "",
    "### Immediate (0–4 hours)",
    "- [ ] Confirm scope of affected systems",
    "- [ ] Isolate affected data flows",
    "- [ ] Preserve forensic evidence (logs, access records)",
    "- [ ] Notify internal security team",
    "",
    "### Short-term (4–24 hours)",
    "- [ ] Complete root cause analysis",
    "- [ ] Document timeline of events",
    "- [ ] Assess whether data principals need notification",
    "- [ ] Verify processor containment confirmation",
    "",
    "### Medium-term (24–72 hours)",
    "- [ ] Finalize Board notification (if CRITICAL/HIGH)",
    "- [ ] Draft data principal communication (if required)",
    "- [ ] Update remediation plan with preventive measures",
    "- [ ] Attach all investigation artifacts to evidence library",
    "",
    "### Closure",
    "- [ ] Remediation owner sign-off",
    "- [ ] Compliance Manager review",
    "- [ ] Evidence sealed and linked",
    "- [ ] Incident status moved to CLOSED",
    "",
    "*Auto-generated checklist. Adjust based on incident specifics.*",
  ].join("\n");
}

function principalCommunication(incident: Incident, workspace: TenantWorkspace): string {
  const tenant = workspace.tenant;
  return [
    `## Data Principal Communication Draft — ${incident.id}`,
    "",
    `**Subject:** Important notice about your personal data — ${tenant.name}`,
    "",
    `Dear Customer,`,
    "",
    `We are writing to inform you about a data security incident that may have `,
    `affected your personal information held by ${tenant.name}.`,
    "",
    `**What happened:** ${incident.title}`,
    "",
    `**What data was involved:** We are still completing our assessment, but the `,
    `categories that may be affected include personal identifiers and contact information.`,
    "",
    `**What we are doing:**`,
    `- We have contained the incident and are conducting a thorough investigation`,
    `- We have notified the Data Protection Board as required under the DPDP Act`,
    `- We are strengthening our safeguards to prevent recurrence`,
    "",
    `**What you can do:**`,
    `- Monitor your accounts for unusual activity`,
    `- Exercise your data rights at: ${tenant.publicBrand.publicDomain}`,
    `- Contact our privacy team for questions`,
    "",
    `We sincerely apologize for this incident and are committed to protecting your data.`,
    "",
    `Regards,`,
    `Privacy Team, ${tenant.name}`,
    "",
    `---`,
    `*This communication must be reviewed and approved before distribution.*`,
  ].join("\n");
}

function countdownTimer(incident: Incident): string {
  return [
    `## 72-Hour Board Notification Countdown`,
    "",
    `**Incident:** ${incident.id} — ${incident.title}`,
    `**Severity:** ${incident.severity}`,
    `**Current deadline:** ${incident.boardDeadline}`,
    "",
    `### Timeline`,
    `| Milestone | Target | Status |`,
    `|-----------|--------|--------|`,
    `| Incident triaged | T+0h | Complete |`,
    `| Severity assessed | T+2h | ${incident.status !== "TRIAGE" ? "Complete" : "Pending"} |`,
    `| Board draft prepared | T+12h | ${incident.status === "CONTAINMENT" || incident.status === "CLOSED" ? "Complete" : "Pending"} |`,
    `| Board notification sent | T+72h | Pending approval |`,
    `| Processor notifications sent | T+48h | Pending approval |`,
    `| Data principal communication | T+96h | Pending assessment |`,
    "",
    `*Timer is advisory. The Compliance Manager must approve the Board notification before the 72-hour window expires.*`,
  ].join("\n");
}

export function generateBreachActions(incident: Incident, workspace: TenantWorkspace): AgentAction[] {
  const now = new Date().toISOString();

  return [
    {
      id: agentId(),
      agentId: "breach-response",
      triggerId: incident.id,
      category: "DRAFT",
      state: "DRAFT",
      label: "Severity assessment",
      contentType: "severity-assessment",
      body: severityRationale(incident, workspace),
      createdAt: now,
    },
    {
      id: agentId(),
      agentId: "breach-response",
      triggerId: incident.id,
      category: "DRAFT",
      state: "DRAFT",
      label: "Board notification (Section 29)",
      contentType: "board-notification",
      body: boardNotificationDraft(incident, workspace),
      createdAt: now,
    },
    {
      id: agentId(),
      agentId: "breach-response",
      triggerId: incident.id,
      category: "RECOMMEND",
      state: "DRAFT",
      label: "Processor notifications",
      contentType: "processor-notification",
      body: processorNotifications(incident, workspace),
      createdAt: now,
    },
    {
      id: agentId(),
      agentId: "breach-response",
      triggerId: incident.id,
      category: "DRAFT",
      state: "DRAFT",
      label: "Investigation checklist",
      contentType: "investigation-checklist",
      body: investigationChecklist(incident),
      createdAt: now,
    },
    {
      id: agentId(),
      agentId: "breach-response",
      triggerId: incident.id,
      category: "EXECUTE",
      state: "DRAFT",
      label: "Data principal communication",
      contentType: "principal-communication",
      body: principalCommunication(incident, workspace),
      createdAt: now,
    },
    {
      id: agentId(),
      agentId: "breach-response",
      triggerId: incident.id,
      category: "RECOMMEND",
      state: "DRAFT",
      label: "72-hour countdown",
      contentType: "countdown-timer",
      body: countdownTimer(incident),
      createdAt: now,
    },
  ];
}

/* ── Rights Request Orchestrator ───────────────────────────── */

function dataMap(rightsCase: RightsCase, workspace: TenantWorkspace): string {
  const matchingSources = workspace.registerEntries.filter(
    (entry) => entry.completeness !== "MISSING",
  );
  const matchingProcessors = workspace.processors;

  return [
    `## Data Principal Mapping — ${rightsCase.id}`,
    "",
    `**Requestor:** ${rightsCase.requestor}`,
    `**Request type:** ${rightsCase.type}`,
    "",
    `### Systems holding data for this principal`,
    ...matchingSources.map(
      (entry) =>
        `- **${entry.system}**: ${entry.dataCategory} (${entry.legalBasis}, retention: ${entry.retentionLabel})`,
    ),
    "",
    `### Processors involved`,
    ...matchingProcessors.map(
      (proc) =>
        `- **${proc.name}**: ${proc.service} — DPA: ${proc.dpaStatus}, Purge: ${proc.purgeAckStatus}`,
    ),
    "",
    `### Coverage summary`,
    `- Register entries mapped: ${matchingSources.length}`,
    `- Processors requiring coordination: ${matchingProcessors.length}`,
    `- Sources with direct identifiers: ${workspace.sourceProfiles.filter((p) => p.identifierType === "Direct identifier").length}`,
    "",
    `*This mapping is auto-generated from the data register. Verify completeness before proceeding.*`,
  ].join("\n");
}

function slaCalculation(rightsCase: RightsCase): string {
  const slaMap: Record<string, { days: number; basis: string }> = {
    ACCESS: { days: 30, basis: "DPDP Section 13 — Right to access" },
    CORRECTION: { days: 30, basis: "DPDP Section 14 — Right to correction" },
    DELETION: { days: 45, basis: "DPDP Section 14 — Right to erasure" },
    GRIEVANCE: { days: 30, basis: "DPDP Section 15 — Grievance redressal" },
    WITHDRAWAL: { days: 30, basis: "DPDP Section 12 — Withdrawal of consent" },
  };

  const sla = slaMap[rightsCase.type] || { days: 30, basis: "Default SLA" };

  return [
    `## SLA Calculation — ${rightsCase.id}`,
    "",
    `**Request type:** ${rightsCase.type}`,
    `**Legal basis:** ${sla.basis}`,
    `**SLA window:** ${sla.days} calendar days`,
    `**Current status:** ${rightsCase.status}`,
    "",
    `### Milestone targets`,
    `| Phase | Target | Owner |`,
    `|-------|--------|-------|`,
    `| Acknowledgment sent | Day 1 | Case Handler |`,
    `| Data mapping complete | Day 3 | Privacy Ops |`,
    `| Processor requests issued | Day 5 | Privacy Ops |`,
    `| Processor responses due | Day 15 | Processors |`,
    `| Response assembled | Day ${sla.days - 5} | Case Handler |`,
    `| Final response sent | Day ${sla.days} | Compliance Manager |`,
    "",
    rightsCase.type === "DELETION"
      ? `**Note:** Deletion requests carry a 45-day SLA and require linked DeletionTask closure with proof before the rights case can close.`
      : `**Note:** ${rightsCase.type} requests must be fulfilled within ${sla.days} days per the DPDP Act.`,
    "",
    `*SLA deadlines are advisory. The Compliance Manager holds final accountability.*`,
  ].join("\n");
}

function acknowledgmentDraft(rightsCase: RightsCase, workspace: TenantWorkspace): string {
  const tenant = workspace.tenant;

  return [
    `## Acknowledgment Email Draft — ${rightsCase.id}`,
    "",
    `**To:** ${rightsCase.requestor}`,
    `**From:** Privacy Team, ${tenant.name}`,
    `**Subject:** Your ${rightsCase.type.toLowerCase()} request has been received — ${rightsCase.id}`,
    "",
    `Dear Data Principal,`,
    "",
    `Thank you for submitting your ${rightsCase.type.toLowerCase()} request to ${tenant.name}.`,
    "",
    `**Reference number:** ${rightsCase.id}`,
    `**Request type:** ${rightsCase.type}`,
    `**Received on:** ${new Date().toISOString().split("T")[0]}`,
    "",
    `We have initiated processing of your request and will respond within the `,
    `timeframe prescribed under the Digital Personal Data Protection Act, 2023.`,
    "",
    `If you have questions about your request, please reference ${rightsCase.id} in all correspondence.`,
    "",
    `Regards,`,
    `Privacy Team`,
    `${tenant.name}`,
    "",
    `---`,
    `*This acknowledgment must be approved before sending to the data principal.*`,
  ].join("\n");
}

function purgeRequestDrafts(rightsCase: RightsCase, workspace: TenantWorkspace): string {
  if (rightsCase.type !== "DELETION") {
    return [
      `## Processor Purge Requests — ${rightsCase.id}`,
      "",
      `This request type (${rightsCase.type}) does not require processor-level data purge.`,
      `No purge requests generated.`,
    ].join("\n");
  }

  const lines = [
    `## Processor Purge Request Drafts — ${rightsCase.id}`,
    "",
    `**Requestor:** ${rightsCase.requestor}`,
    `**Request type:** DELETION`,
    "",
  ];

  for (const processor of workspace.processors) {
    lines.push(
      `### ${processor.name}`,
      `**Service:** ${processor.service}`,
      `**DPA status:** ${processor.dpaStatus}`,
      `**Current purge ack:** ${processor.purgeAckStatus}`,
      "",
      `Dear ${processor.name} Data Protection Contact,`,
      "",
      `Under our Data Processing Agreement and the requirements of the DPDP Act, `,
      `we request the deletion of all personal data associated with the following data principal:`,
      "",
      `- **Identifier:** ${rightsCase.requestor}`,
      `- **Reference:** ${rightsCase.id}`,
      "",
      `Please confirm deletion within 15 calendar days and provide:`,
      `1. Confirmation of complete data removal from primary and backup systems`,
      `2. Confirmation that sub-processors (${processor.subProcessorCount}) have been notified`,
      `3. A deletion certificate for our evidence library`,
      "",
      `---`,
      "",
    );
  }

  lines.push("*Each purge request must be individually approved before transmission.*");
  return lines.join("\n");
}

function escalationNotice(rightsCase: RightsCase, workspace: TenantWorkspace): string {
  const overdueProcessors = workspace.processors.filter(
    (proc) => proc.purgeAckStatus === "PENDING" || proc.purgeAckStatus === "REFUSED",
  );

  return [
    `## Escalation Monitor — ${rightsCase.id}`,
    "",
    `### Processors requiring follow-up`,
    ...overdueProcessors.map(
      (proc) =>
        `- **${proc.name}**: Purge status ${proc.purgeAckStatus} — ${proc.purgeAckStatus === "REFUSED" ? "ESCALATE to legal" : "Send reminder"}`,
    ),
    overdueProcessors.length === 0 ? "- No overdue processors at this time." : "",
    "",
    `### Recommended escalation actions`,
    overdueProcessors.length > 0
      ? [
          `1. Send 48-hour reminder to pending processors`,
          `2. Flag refused processors for legal review`,
          `3. Consider updating SLA communication to data principal`,
        ].join("\n")
      : "No escalation required at this time.",
    "",
    `*Escalation actions require Compliance Manager approval.*`,
  ].join("\n");
}

function responseAssembly(rightsCase: RightsCase, workspace: TenantWorkspace): string {
  const tenant = workspace.tenant;

  return [
    `## Final Response Assembly — ${rightsCase.id}`,
    "",
    `**To:** ${rightsCase.requestor}`,
    `**From:** Privacy Team, ${tenant.name}`,
    `**Subject:** Response to your ${rightsCase.type.toLowerCase()} request — ${rightsCase.id}`,
    "",
    `Dear Data Principal,`,
    "",
    `We are writing to provide our response to your ${rightsCase.type.toLowerCase()} request `,
    `(Reference: ${rightsCase.id}).`,
    "",
    rightsCase.type === "ACCESS"
      ? [
          `Attached you will find a summary of personal data held about you across our systems:`,
          ...workspace.registerEntries
            .filter((e) => e.completeness !== "MISSING")
            .map((e) => `- ${e.system}: ${e.dataCategory}`),
        ].join("\n")
      : rightsCase.type === "DELETION"
        ? [
            `We have processed your deletion request across the following systems:`,
            ...workspace.registerEntries
              .filter((e) => e.completeness !== "MISSING")
              .map((e) => `- ${e.system}: ${e.dataCategory} — Deletion ${workspace.processors.find((p) => e.linkedProcessorIds.includes(p.id))?.purgeAckStatus === "ACKNOWLEDGED" ? "confirmed" : "in progress"}`),
          ].join("\n")
        : `Your ${rightsCase.type.toLowerCase()} request has been processed in accordance with the DPDP Act.`,
    "",
    `If you have further questions or wish to exercise additional rights, `,
    `please visit ${tenant.publicBrand.publicDomain} or contact our privacy team.`,
    "",
    `Regards,`,
    `Privacy Team`,
    `${tenant.name}`,
    "",
    `---`,
    `*This response and all attachments must be approved by the Compliance Manager before sending.*`,
    `*An evidence record will be automatically created upon approval.*`,
  ].join("\n");
}

export function generateRightsActions(rightsCase: RightsCase, workspace: TenantWorkspace): AgentAction[] {
  const now = new Date().toISOString();

  return [
    {
      id: agentId(),
      agentId: "rights-orchestrator",
      triggerId: rightsCase.id,
      category: "DRAFT",
      state: "DRAFT",
      label: "Data principal mapping",
      contentType: "data-map",
      body: dataMap(rightsCase, workspace),
      createdAt: now,
    },
    {
      id: agentId(),
      agentId: "rights-orchestrator",
      triggerId: rightsCase.id,
      category: "DRAFT",
      state: "DRAFT",
      label: "SLA calculation",
      contentType: "sla-calculation",
      body: slaCalculation(rightsCase),
      createdAt: now,
    },
    {
      id: agentId(),
      agentId: "rights-orchestrator",
      triggerId: rightsCase.id,
      category: "EXECUTE",
      state: "DRAFT",
      label: "Acknowledgment email",
      contentType: "acknowledgment-draft",
      body: acknowledgmentDraft(rightsCase, workspace),
      createdAt: now,
    },
    {
      id: agentId(),
      agentId: "rights-orchestrator",
      triggerId: rightsCase.id,
      category: "EXECUTE",
      state: "DRAFT",
      label: "Processor purge requests",
      contentType: "purge-request",
      body: purgeRequestDrafts(rightsCase, workspace),
      createdAt: now,
    },
    {
      id: agentId(),
      agentId: "rights-orchestrator",
      triggerId: rightsCase.id,
      category: "RECOMMEND",
      state: "DRAFT",
      label: "Overdue escalation",
      contentType: "escalation-notice",
      body: escalationNotice(rightsCase, workspace),
      createdAt: now,
    },
    {
      id: agentId(),
      agentId: "rights-orchestrator",
      triggerId: rightsCase.id,
      category: "EXECUTE",
      state: "DRAFT",
      label: "Final response to principal",
      contentType: "response-assembly",
      body: responseAssembly(rightsCase, workspace),
      createdAt: now,
    },
  ];
}

/* ── Groq-enhanced generation ──────────────────────────────── */

export type { GroqAgentConfig } from "./groq-agent.js";

export async function generateBreachActionsWithGroq(
  incident: Incident,
  workspace: TenantWorkspace,
  groqConfig: { apiKey: string; model?: string },
): Promise<AgentAction[]> {
  const { groqBreachSeverity, groqBoardNotification, groqProcessorNotifications, groqInvestigationChecklist, groqPrincipalCommunication } = await import("./groq-agent.js");

  // Fire all Groq requests in parallel, fall back to heuristic per action
  const [severity, board, processors, checklist, communication] = await Promise.allSettled([
    groqBreachSeverity(groqConfig, incident, workspace),
    groqBoardNotification(groqConfig, incident, workspace),
    groqProcessorNotifications(groqConfig, incident, workspace),
    groqInvestigationChecklist(groqConfig, incident),
    groqPrincipalCommunication(groqConfig, incident, workspace),
  ]);

  const heuristic = generateBreachActions(incident, workspace);

  // Replace body with Groq output where available
  const groqResults = [severity, board, processors, checklist, communication];
  for (let i = 0; i < 5 && i < heuristic.length; i++) {
    const result = groqResults[i];
    if (result.status === "fulfilled" && result.value) {
      heuristic[i].body = result.value;
    }
  }

  return heuristic;
}

export async function generateRightsActionsWithGroq(
  rightsCase: RightsCase,
  workspace: TenantWorkspace,
  groqConfig: { apiKey: string; model?: string },
): Promise<AgentAction[]> {
  const { groqDataMap, groqSlaCalculation, groqRightsAcknowledgment, groqPurgeRequests, groqFinalResponse } = await import("./groq-agent.js");

  const [dataMap, sla, ack, purge, response] = await Promise.allSettled([
    groqDataMap(groqConfig, rightsCase, workspace),
    groqSlaCalculation(groqConfig, rightsCase),
    groqRightsAcknowledgment(groqConfig, rightsCase, workspace),
    groqPurgeRequests(groqConfig, rightsCase, workspace),
    groqFinalResponse(groqConfig, rightsCase, workspace),
  ]);

  const heuristic = generateRightsActions(rightsCase, workspace);

  // Map: dataMap→0, sla→1, ack→2, purge→3, escalation stays heuristic(4), response→5
  const groqMap: Array<[number, PromiseSettledResult<string | null>]> = [
    [0, dataMap], [1, sla], [2, ack], [3, purge], [5, response],
  ];

  for (const [idx, result] of groqMap) {
    if (result.status === "fulfilled" && result.value && idx < heuristic.length) {
      heuristic[idx].body = result.value;
    }
  }

  return heuristic;
}
