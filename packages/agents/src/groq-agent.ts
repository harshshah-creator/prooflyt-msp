import type {
  AgentAction,
  Incident,
  RightsCase,
  TenantWorkspace,
} from "../../contracts/dist/index.js";

interface GroqChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export interface GroqAgentConfig {
  apiKey: string;
  model?: string;
}

async function groqChat(config: GroqAgentConfig, systemPrompt: string, userPrompt: string): Promise<string | null> {
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model || "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as GroqChatResponse;
    return payload.choices?.[0]?.message?.content || null;
  } catch {
    return null;
  }
}

const BREACH_SYSTEM_PROMPT = `You are a DPDP Act compliance agent specializing in breach response under Section 29.
You generate structured, actionable compliance documents for Indian companies responding to data breaches.
Be specific, reference the DPDP Act sections, and follow the 72-hour notification timeline.
Write in clear professional English. Use markdown formatting.
Do NOT include any preamble or explanation — output only the requested document.`;

const RIGHTS_SYSTEM_PROMPT = `You are a DPDP Act compliance agent specializing in data principal rights under Sections 11-15.
You generate structured documents for rights request handling: acknowledgments, SLA tracking, processor purge requests, and final responses.
Reference specific DPDP Act sections. Be precise about SLA deadlines (30 days for access/correction/grievance, 45 days for deletion).
Write in clear professional English. Use markdown formatting.
Do NOT include any preamble or explanation — output only the requested document.`;

function buildWorkspaceContext(workspace: TenantWorkspace): string {
  return [
    `Company: ${workspace.tenant.name} (${workspace.tenant.industry})`,
    `Register entries: ${workspace.registerEntries.map((e) => `${e.system}: ${e.dataCategory}`).join("; ")}`,
    `Processors: ${workspace.processors.map((p) => `${p.name} (${p.service}, DPA: ${p.dpaStatus}, Purge: ${p.purgeAckStatus})`).join("; ")}`,
    `Direct identifiers in profile: ${workspace.sourceProfiles.filter((p) => p.identifierType === "Direct identifier").length}`,
    `Open rights cases: ${workspace.rightsCases.filter((c) => c.status !== "CLOSED").length}`,
    `Open incidents: ${workspace.incidents.filter((i) => i.status !== "CLOSED").length}`,
  ].join("\n");
}

export async function groqBreachSeverity(config: GroqAgentConfig, incident: Incident, workspace: TenantWorkspace): Promise<string | null> {
  const context = buildWorkspaceContext(workspace);
  return groqChat(config, BREACH_SYSTEM_PROMPT,
    `Generate a severity assessment for this breach:\n\nIncident ID: ${incident.id}\nTitle: ${incident.title}\nSeverity: ${incident.severity}\nOwner: ${incident.remediationOwner}\nStatus: ${incident.status}\n\nWorkspace context:\n${context}\n\nGenerate a markdown document with: Impact analysis (systems, identifiers, processors affected), Severity rationale referencing DPDP Section 29, and Recommended immediate actions.`
  );
}

export async function groqBoardNotification(config: GroqAgentConfig, incident: Incident, workspace: TenantWorkspace): Promise<string | null> {
  const context = buildWorkspaceContext(workspace);
  return groqChat(config, BREACH_SYSTEM_PROMPT,
    `Draft a Section 29 Board notification for the Data Protection Board of India:\n\nIncident: ${incident.id} — ${incident.title}\nSeverity: ${incident.severity}\nCompany: ${workspace.tenant.name} (${workspace.tenant.industry})\n\nWorkspace context:\n${context}\n\nDraft a formal notification including: Nature of breach, Categories of personal data affected, Estimated data principals, Measures taken, and Contact information. End with a note that this is an AI draft requiring Compliance Manager approval.`
  );
}

export async function groqProcessorNotifications(config: GroqAgentConfig, incident: Incident, workspace: TenantWorkspace): Promise<string | null> {
  const context = buildWorkspaceContext(workspace);
  return groqChat(config, BREACH_SYSTEM_PROMPT,
    `Draft processor notification letters for this breach:\n\nIncident: ${incident.id} — ${incident.title}\nSeverity: ${incident.severity}\n\nProcessors to notify:\n${workspace.processors.map((p) => `- ${p.name}: ${p.service} (DPA: ${p.dpaStatus}, Sub-processors: ${p.subProcessorCount})`).join("\n")}\n\nDraft individual notification letters for each processor requesting: confirmation of affected data, containment measures, and scope assessment within 48 hours.`
  );
}

export async function groqInvestigationChecklist(config: GroqAgentConfig, incident: Incident): Promise<string | null> {
  return groqChat(config, BREACH_SYSTEM_PROMPT,
    `Generate an investigation checklist for:\n\nIncident: ${incident.id} — ${incident.title}\nSeverity: ${incident.severity}\nCurrent status: ${incident.status}\n\nCreate a phased checklist with checkboxes (using - [ ]) organized into: Immediate (0-4h), Short-term (4-24h), Medium-term (24-72h), and Closure phases. Include DPDP-specific items like Board notification and data principal communication timelines.`
  );
}

export async function groqPrincipalCommunication(config: GroqAgentConfig, incident: Incident, workspace: TenantWorkspace): Promise<string | null> {
  return groqChat(config, BREACH_SYSTEM_PROMPT,
    `Draft a data principal communication for:\n\nIncident: ${incident.id} — ${incident.title}\nCompany: ${workspace.tenant.name}\nPublic domain: ${workspace.tenant.publicBrand.publicDomain}\n\nDraft a clear, empathetic notification email covering: What happened, What data was involved, What the company is doing, What the principal can do. Reference DPDP Act rights. End with a note requiring approval before distribution.`
  );
}

export async function groqRightsAcknowledgment(config: GroqAgentConfig, rightsCase: RightsCase, workspace: TenantWorkspace): Promise<string | null> {
  return groqChat(config, RIGHTS_SYSTEM_PROMPT,
    `Draft an acknowledgment email for:\n\nCase: ${rightsCase.id}\nType: ${rightsCase.type}\nRequestor: ${rightsCase.requestor}\nCompany: ${workspace.tenant.name}\n\nDraft a professional acknowledgment confirming receipt, providing the reference number, stating the applicable SLA under the DPDP Act, and setting expectations for next steps.`
  );
}

export async function groqDataMap(config: GroqAgentConfig, rightsCase: RightsCase, workspace: TenantWorkspace): Promise<string | null> {
  const context = buildWorkspaceContext(workspace);
  return groqChat(config, RIGHTS_SYSTEM_PROMPT,
    `Generate a data principal mapping analysis for:\n\nCase: ${rightsCase.id}\nType: ${rightsCase.type}\nRequestor: ${rightsCase.requestor}\n\nWorkspace context:\n${context}\n\nMap which systems hold data for this principal, which processors are involved, what data categories exist, and the completeness of the mapping. Include a coverage summary.`
  );
}

export async function groqSlaCalculation(config: GroqAgentConfig, rightsCase: RightsCase): Promise<string | null> {
  return groqChat(config, RIGHTS_SYSTEM_PROMPT,
    `Calculate SLA milestones for:\n\nCase: ${rightsCase.id}\nType: ${rightsCase.type}\nStatus: ${rightsCase.status}\nCurrent SLA: ${rightsCase.sla}\n\nProvide: The applicable DPDP section, SLA window in days, milestone targets in a table (Acknowledgment, Data mapping, Processor requests, Responses due, Assembly, Final response) with target day and responsible owner.`
  );
}

export async function groqPurgeRequests(config: GroqAgentConfig, rightsCase: RightsCase, workspace: TenantWorkspace): Promise<string | null> {
  if (rightsCase.type !== "DELETION") {
    return null;
  }
  return groqChat(config, RIGHTS_SYSTEM_PROMPT,
    `Draft processor purge request letters for:\n\nCase: ${rightsCase.id}\nRequestor: ${rightsCase.requestor}\nType: DELETION\n\nProcessors:\n${workspace.processors.map((p) => `- ${p.name}: ${p.service} (DPA: ${p.dpaStatus}, Sub-processors: ${p.subProcessorCount})`).join("\n")}\n\nDraft formal deletion requests for each processor referencing the DPA and DPDP Act, requesting confirmation within 15 days, including sub-processor notification and deletion certificate.`
  );
}

export async function groqFinalResponse(config: GroqAgentConfig, rightsCase: RightsCase, workspace: TenantWorkspace): Promise<string | null> {
  return groqChat(config, RIGHTS_SYSTEM_PROMPT,
    `Draft the final response to the data principal for:\n\nCase: ${rightsCase.id}\nType: ${rightsCase.type}\nRequestor: ${rightsCase.requestor}\nCompany: ${workspace.tenant.name}\nPublic domain: ${workspace.tenant.publicBrand.publicDomain}\n\nSystems: ${workspace.registerEntries.map((e) => `${e.system}: ${e.dataCategory}`).join("; ")}\n\nDraft a professional response addressing the ${rightsCase.type.toLowerCase()} request, summarizing actions taken, and providing details about the data or actions performed. End with note requiring Compliance Manager approval.`
  );
}
