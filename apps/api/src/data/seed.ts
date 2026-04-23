import type {
  AgentAction,
  Department,
  DeletionTask,
  EvidenceArtifact,
  Incident,
  Invite,
  Notice,
  ObligationBucket,
  PasswordReset,
  Processor,
  RegisterEntry,
  RightsCase,
  SessionRecord,
  SourceSystem,
  SourceFieldProfile,
  DataSource,
  Tenant,
  TenantWorkspace,
  User,
} from "../domain/types.js";

export interface AppState {
  tenants: Tenant[];
  users: User[];
  invites: Invite[];
  resets: PasswordReset[];
  sessions: SessionRecord[];
  workspaces: Record<string, TenantWorkspace>;
}

const tenant: Tenant = {
  id: "tenant-bgl",
  slug: "bombay-grooming-labs",
  name: "Bombay Grooming Labs",
  industry: "D2C / Personal Care",
  descriptor: "D2C / Personal Care",
  operationalStory: "Your company collects personal data from customers, leads, and support interactions. Prooflyt tracks every obligation, workflow, and proof artifact so you can demonstrate DPDP readiness to leadership, auditors, and the Data Protection Board.",
  active: true,
  publicBrand: {
    logoText: "BGL",
    primaryColor: "#1a1a17",
    accentColor: "#8a9a42",
    publicDomain: "rights.bombaygrooming.example",
  },
};

const obligations: ObligationBucket[] = [
  { id: "ob-01", title: "Data inventory", operationalLabel: "Metadata-first register", module: "register", readiness: 0, maturity: 0, ownerPresent: false, evidencePresent: false, status: "NEEDS_ACTION" },
  { id: "ob-02", title: "Privacy notice", operationalLabel: "Versioned transparency", module: "notices", readiness: 0, maturity: 0, ownerPresent: false, evidencePresent: false, status: "NEEDS_ACTION" },
  { id: "ob-03", title: "Rights request handling", operationalLabel: "Case SLA discipline", module: "rights", readiness: 0, maturity: 0, ownerPresent: false, evidencePresent: false, status: "NEEDS_ACTION" },
  { id: "ob-04", title: "Retention schedules", operationalLabel: "Tasked deletion control", module: "retention", readiness: 0, maturity: 0, ownerPresent: false, evidencePresent: false, status: "NEEDS_ACTION" },
  { id: "ob-05", title: "Breach readiness", operationalLabel: "Deadline-aware response", module: "incidents", readiness: 0, maturity: 0, ownerPresent: false, evidencePresent: false, status: "NEEDS_ACTION" },
  { id: "ob-06", title: "Processor governance", operationalLabel: "DPA + purge acknowledgement", module: "processors", readiness: 0, maturity: 0, ownerPresent: false, evidencePresent: false, status: "NEEDS_ACTION" },
  { id: "ob-07", title: "Evidence posture", operationalLabel: "Sealed proof archive", module: "evidence", readiness: 0, maturity: 0, ownerPresent: false, evidencePresent: false, status: "NEEDS_ACTION" },
  { id: "ob-08", title: "Consent proof", operationalLabel: "Evidence-oriented consent records", module: "rights", readiness: 0, maturity: 0, ownerPresent: false, evidencePresent: false, status: "NEEDS_ACTION" },
  { id: "ob-09", title: "Department ownership", operationalLabel: "Named obligation owners", module: "setup", readiness: 0, maturity: 0, ownerPresent: false, evidencePresent: false, status: "NEEDS_ACTION" },
  { id: "ob-10", title: "Source discovery", operationalLabel: "AI-assisted profiling queue", module: "sources", readiness: 0, maturity: 0, ownerPresent: false, evidencePresent: false, status: "NEEDS_ACTION" },
  { id: "ob-11", title: "Reportability", operationalLabel: "Compliance Pack readiness", module: "reports", readiness: 0, maturity: 0, ownerPresent: false, evidencePresent: false, status: "NEEDS_ACTION" },
  { id: "ob-12", title: "Public surface branding", operationalLabel: "Rights and notices with tenant identity", module: "notices", readiness: 0, maturity: 0, ownerPresent: false, evidencePresent: false, status: "NEEDS_ACTION" },
];

export const DPDP_MASTER_OBLIGATIONS = [
  { id: "dpdp-01", title: "Data inventory and mapping", operationalLabel: "Metadata-first register", dpdpSection: "Section 8", dpdpRule: "—", penaltyMax: "INR 50 crore", module: "register" },
  { id: "dpdp-02", title: "Consent management", operationalLabel: "Free, specific, informed consent", dpdpSection: "Section 6", dpdpRule: "Rule 3", penaltyMax: "INR 50 crore", module: "rights" },
  { id: "dpdp-03", title: "Privacy notice", operationalLabel: "Versioned transparency", dpdpSection: "Section 5", dpdpRule: "Rule 3", penaltyMax: "INR 50 crore", module: "notices" },
  { id: "dpdp-04", title: "Data principal rights", operationalLabel: "Access, correction, erasure, nomination", dpdpSection: "Sections 12-13", dpdpRule: "Rule 9", penaltyMax: "INR 50 crore", module: "rights" },
  { id: "dpdp-05", title: "Breach notification", operationalLabel: "72-hour Board + principal notification", dpdpSection: "Section 8(6)", dpdpRule: "Rule 7", penaltyMax: "INR 200 crore", module: "incidents" },
  { id: "dpdp-06", title: "Retention and erasure", operationalLabel: "Purpose-limited retention", dpdpSection: "Section 8(7)", dpdpRule: "Rule 8", penaltyMax: "INR 50 crore", module: "retention" },
  { id: "dpdp-07", title: "Processor governance", operationalLabel: "DPA + purge acknowledgement", dpdpSection: "Section 8", dpdpRule: "—", penaltyMax: "INR 50 crore", module: "processors" },
  { id: "dpdp-08", title: "Security safeguards", operationalLabel: "Reasonable security measures", dpdpSection: "Section 8(5)", dpdpRule: "Rule 6", penaltyMax: "INR 250 crore", module: "evidence" },
  { id: "dpdp-09", title: "Children's data protection", operationalLabel: "Verifiable parental consent", dpdpSection: "Section 9", dpdpRule: "Rules 10-12", penaltyMax: "INR 200 crore", module: "rights" },
  { id: "dpdp-10", title: "DPO appointment", operationalLabel: "Named Data Protection Officer", dpdpSection: "Section 8(9)", dpdpRule: "—", penaltyMax: "INR 50 crore", module: "setup" },
  { id: "dpdp-11", title: "Data accuracy", operationalLabel: "Complete and consistent data", dpdpSection: "Section 8", dpdpRule: "—", penaltyMax: "INR 50 crore", module: "register" },
  { id: "dpdp-12", title: "Significant Data Fiduciary obligations", operationalLabel: "Annual DPIA + independent audit", dpdpSection: "Section 10", dpdpRule: "Rule 13", penaltyMax: "INR 150 crore", module: "reports" },
  { id: "dpdp-13", title: "Cross-border data transfer", operationalLabel: "Restricted country compliance", dpdpSection: "Section 16", dpdpRule: "Rule 15", penaltyMax: "INR 50 crore", module: "processors" },
  { id: "dpdp-14", title: "Consent Manager integration", operationalLabel: "Registered interoperable platform", dpdpSection: "Section 6", dpdpRule: "Rule 4", penaltyMax: "INR 50 crore", module: "rights" },
  { id: "dpdp-15", title: "Grievance redressal", operationalLabel: "Published mechanism + DPO contact", dpdpSection: "Section 8(10)", dpdpRule: "—", penaltyMax: "INR 50 crore", module: "rights" },
  { id: "dpdp-16", title: "Evidence posture", operationalLabel: "Sealed proof archive", dpdpSection: "Section 8(5)", dpdpRule: "Rule 6", penaltyMax: "INR 250 crore", module: "evidence" },
  { id: "dpdp-17", title: "Reportability", operationalLabel: "Compliance Pack readiness", dpdpSection: "Section 10", dpdpRule: "Rule 13", penaltyMax: "INR 150 crore", module: "reports" },
];

const sources: DataSource[] = [
  { id: "src-shopify", name: "Shopify customer export", fileName: "customer_export.csv", profileMode: "MASKED_SAMPLE", status: "APPROVED", fields: 18, approvedFields: 16, warnings: [] },
  {
    id: "src-zoho",
    name: "Zoho CRM leads",
    fileName: "zoho_leads.xlsx",
    profileMode: "HEADER_ONLY",
    status: "IN_REVIEW",
    fields: 22,
    approvedFields: 11,
    warnings: ["Two marketing attribution columns require reviewer confirmation."],
    pushedToRegister: false,
    linkedRegisterEntryIds: [],
  },
  {
    id: "src-support",
    name: "Freshdesk tickets",
    fileName: "tickets_snapshot.xlsx",
    profileMode: "EPHEMERAL_FULL",
    status: "APPROVED",
    fields: 14,
    approvedFields: 14,
    warnings: ["Raw file already purged after profiling."],
    pushedToRegister: true,
    linkedRegisterEntryIds: ["reg-03"],
  },
];

const departments: Department[] = [
  { id: "dept-growth", name: "Growth Marketing", ownerTitle: "Growth Lead", obligationFocus: "Consent proof and attribution governance" },
  { id: "dept-support", name: "Customer Support", ownerTitle: "Support Manager", obligationFocus: "Grievance handling and ticket retention" },
  { id: "dept-people", name: "People Operations", ownerTitle: "HR Lead", obligationFocus: "Employee notice stewardship" },
];

const sourceSystems: SourceSystem[] = [
  { id: "sys-shopify", name: "Shopify", systemType: "Commerce", owner: "Revenue Operations", status: "LIVE" },
  { id: "sys-zoho", name: "Zoho CRM", systemType: "CRM", owner: "Growth Marketing", status: "LIVE" },
  { id: "sys-freshdesk", name: "Freshdesk", systemType: "Support", owner: "Customer Support", status: "REVIEW" },
];

const sourceProfiles: SourceFieldProfile[] = [
  { id: "p-1", sourceId: "src-shopify", fieldName: "customer_id", mappedCategory: "Customer profile", identifierType: "Operational attribute", confidence: 0.91, purpose: "Customer account operations", legalBasis: "Legitimate use", retentionLabel: "24 months", requiresReview: false, warnings: [] },
  { id: "p-2", sourceId: "src-shopify", fieldName: "full_name", mappedCategory: "Identity", identifierType: "Direct identifier", confidence: 0.96, purpose: "Customer account operations", legalBasis: "Legitimate use", retentionLabel: "24 months", requiresReview: false, warnings: [] },
  { id: "p-3", sourceId: "src-shopify", fieldName: "email_address", mappedCategory: "Contact", identifierType: "Direct identifier", confidence: 0.95, purpose: "Customer communications", legalBasis: "Legitimate use", retentionLabel: "24 months", requiresReview: false, warnings: [] },
  { id: "p-4", sourceId: "src-shopify", fieldName: "consent_timestamp", mappedCategory: "Preference", identifierType: "Operational attribute", confidence: 0.82, purpose: "Consent proof and outreach governance", legalBasis: "Consent", retentionLabel: "3 years from last interaction", requiresReview: false, warnings: [] },
  { id: "p-5", sourceId: "src-zoho", fieldName: "utm_campaign", mappedCategory: "Preference", identifierType: "Operational attribute", confidence: 0.61, purpose: "Consent proof and outreach governance", legalBasis: "Consent", retentionLabel: "3 years from last interaction", requiresReview: true, warnings: ["Attribution field needs department owner confirmation."] },
  { id: "p-6", sourceId: "src-zoho", fieldName: "फोन_नंबर", mappedCategory: "Contact", identifierType: "Direct identifier", confidence: 0.73, purpose: "Customer communications", legalBasis: "Legitimate use", retentionLabel: "24 months", requiresReview: true, warnings: ["Regional language header preserved for reviewer confirmation."] },
];

const notices: Notice[] = [
  {
    id: "notice-customer",
    title: "Customer privacy notice",
    audience: "Customers",
    language: "English",
    version: "v1.0",
    status: "DRAFT",
    content:
      "We collect account, order, support, and consent-related metadata to deliver service, respond to rights requests, and maintain security controls. Prooflyt in Phase 1 records workflow evidence and published notice history.",
    acknowledgements: 0,
  },
  {
    id: "notice-employee",
    title: "Employee privacy notice",
    audience: "Employees",
    language: "English",
    version: "v0.9",
    status: "DRAFT",
    content: "Employee data collection notice pending final HR approval.",
    acknowledgements: 0,
  },
];

const rightsCases: RightsCase[] = [
  { id: "RR-2026-014", type: "ACCESS", requestor: "nita.shah@example.com", status: "IN_PROGRESS", sla: "3 days remaining", evidenceLinked: true, linkedDeletionTaskId: null },
  { id: "RR-2026-015", type: "DELETION", requestor: "rahul.m@example.com", status: "AWAITING_PROOF", sla: "Overdue by 1 day", evidenceLinked: false, linkedDeletionTaskId: "DEL-22" },
  { id: "RR-2026-016", type: "GRIEVANCE", requestor: "aadya@example.com", status: "NEW", sla: "7 days remaining", evidenceLinked: false, linkedDeletionTaskId: null },
];

const deletionTasks: DeletionTask[] = [
  { id: "DEL-22", label: "Delete CRM lead after grievance resolution", system: "Zoho CRM", dueDate: "2026-04-10", status: "READY_FOR_PROOF", proofLinked: false, processorAcknowledged: true },
  { id: "DEL-23", label: "Purge support export under retention schedule", system: "Freshdesk", dueDate: "2026-04-12", status: "AWAITING_PROCESSOR", proofLinked: false, processorAcknowledged: false },
];

const incidents: Incident[] = [
  { id: "INC-402", title: "Misrouted support export", status: "ASSESSMENT", severity: "CRITICAL", boardDeadline: "42h 15m remaining", remediationOwner: "Rohan Iyer", evidenceLinked: true },
];

const processors: Processor[] = [
  { id: "proc-01", name: "Zoho", service: "CRM and sales workflow", dpaStatus: "SIGNED", purgeAckStatus: "ACKNOWLEDGED", subProcessorCount: 2 },
  { id: "proc-02", name: "Freshdesk", service: "Support ticketing", dpaStatus: "IN_REVIEW", purgeAckStatus: "PENDING", subProcessorCount: 1 },
  { id: "proc-03", name: "Shiprocket", service: "Order fulfilment", dpaStatus: "MISSING", purgeAckStatus: "PENDING", subProcessorCount: 3 },
];

const registerEntries: RegisterEntry[] = [
  { id: "reg-01", system: "Shopify", dataCategory: "Identity and contact", purpose: "Customer account operations", legalBasis: "Legitimate use", retentionLabel: "24 months", linkedNoticeId: "notice-customer", linkedProcessorIds: ["proc-03"], lifecycle: "APPROVED", sourceTrace: "src-shopify / approved mapping", completeness: "COMPLETE" },
  { id: "reg-02", system: "Zoho CRM", dataCategory: "Marketing and lead data", purpose: "Demand generation and conversion", legalBasis: "Consent", retentionLabel: "3 years from last interaction", linkedNoticeId: "notice-customer", linkedProcessorIds: ["proc-01"], lifecycle: "IN_REVIEW", sourceTrace: "src-zoho / review queue", completeness: "PARTIAL" },
  { id: "reg-03", system: "Freshdesk", dataCategory: "Support and grievance logs", purpose: "Support resolution and complaint handling", legalBasis: "Legitimate use", retentionLabel: "24 months", linkedNoticeId: "notice-customer", linkedProcessorIds: ["proc-02"], lifecycle: "APPROVED", sourceTrace: "src-support / approved mapping", completeness: "COMPLETE" },
];

const evidence: EvidenceArtifact[] = [
  { id: "ev-01", label: "Published notice snapshot", classification: "SYSTEM_DERIVED", linkedRecord: "notice-customer", createdAt: "2026-04-03T10:20:00.000Z", contentIndexed: false },
  { id: "ev-02", label: "Processor purge confirmation", classification: "UPLOADED", linkedRecord: "DEL-22", createdAt: "2026-04-08T08:15:00.000Z", contentIndexed: false },
  { id: "ev-03", label: "Board incident draft", classification: "ATTESTATION", linkedRecord: "INC-402", createdAt: "2026-04-10T14:45:00.000Z", contentIndexed: false },
];

const auditTrail = [
  {
    id: "audit-01",
    createdAt: "2026-04-03T10:20:00.000Z",
    actor: "Arjun Mehta",
    module: "notices" as const,
    action: "NOTICE_PUBLISHED",
    targetId: "notice-customer",
    summary: "Published customer privacy notice v1.4.",
  },
  {
    id: "audit-02",
    createdAt: "2026-04-08T08:15:00.000Z",
    actor: "Meera Kapoor",
    module: "retention" as const,
    action: "DELETION_TASK_UPDATED",
    targetId: "DEL-22",
    summary: "Marked deletion task ready for proof after processor acknowledgement.",
  },
  {
    id: "audit-03",
    createdAt: "2026-04-10T14:45:00.000Z",
    actor: "Rohan Iyer",
    module: "incidents" as const,
    action: "INCIDENT_EVIDENCE_ATTACHED",
    targetId: "INC-402",
    summary: "Attached incident draft for board notification review.",
  },
];

const agentActions: AgentAction[] = [
  // Breach Response Agent — triggered by INC-402
  {
    id: "agent-breach-1",
    agentId: "breach-response",
    triggerId: "INC-402",
    category: "DRAFT",
    state: "REVIEWED",
    label: "Severity assessment",
    contentType: "severity-assessment",
    body: "## Severity Assessment — INC-402\n**Incident:** Misrouted support export\n**Current severity:** CRITICAL\n**Remediation owner:** Rohan Iyer\n\n### Impact analysis\n- Register entries in scope: 3\n- Direct identifiers exposed: 3\n- Processors with pending DPA: 2\n\n### Severity rationale\nThis incident involves direct personal identifiers and is rated CRITICAL.\nUnder DPDP Section 29, the Data Protection Board must be notified within 72 hours.\nImmediate containment and parallel notification workflows are recommended.",
    createdAt: "2026-04-10T14:46:00.000Z",
    reviewedAt: "2026-04-10T15:30:00.000Z",
    reviewedBy: "Arjun Mehta",
  },
  {
    id: "agent-breach-2",
    agentId: "breach-response",
    triggerId: "INC-402",
    category: "DRAFT",
    state: "DRAFT",
    label: "Board notification (Section 29)",
    contentType: "board-notification",
    body: "## Section 29 Board Notification Draft\n\n**To:** Data Protection Board of India\n**From:** Bombay Grooming Labs (D2C / Personal Care)\n**Date:** 2026-04-10\n**Reference:** INC-402\n\n### Nature of breach\nMisrouted support export\n\n### Categories of personal data affected\n- Identity and contact (Shopify)\n- Marketing and lead data (Zoho CRM)\n- Support and grievance logs (Freshdesk)\n\n### Estimated data principals affected\nAssessment pending. Initial scope based on register entries above.\n\n### Measures taken\n- Incident triaged and assigned to Rohan Iyer\n- Containment measures initiated\n- Processor notification queue activated\n\n### Contact\nDPO Lead, Bombay Grooming Labs\n\n---\n*This is an AI-drafted notification. It must be reviewed and approved by the Compliance Manager before submission.*",
    createdAt: "2026-04-10T14:46:00.000Z",
  },
  {
    id: "agent-breach-3",
    agentId: "breach-response",
    triggerId: "INC-402",
    category: "RECOMMEND",
    state: "DRAFT",
    label: "Processor notifications",
    contentType: "processor-notification",
    body: "## Processor Notification Queue — INC-402\n\n### Zoho\n**Service:** CRM and sales workflow\n**DPA status:** Active DPA\n\nDear Zoho Privacy Team,\n\nWe are writing to inform you of a personal data breach (INC-402: Misrouted support export) that may involve data processed under our agreement.\n\nPlease confirm within 48 hours:\n1. Whether any personal data under your processing was affected\n2. Containment measures applied on your side\n3. Estimated scope of affected records\n\n---\n\n### Freshdesk\n**Service:** Support ticketing\n**DPA status:** DPA IN_REVIEW\n\nDear Freshdesk Privacy Team,\n\nWe are writing to inform you of a personal data breach (INC-402: Misrouted support export) that may involve data processed under our agreement.\n\nPlease confirm within 48 hours:\n1. Whether any personal data under your processing was affected\n2. Containment measures applied on your side\n3. Estimated scope of affected records\n\n---\n\n*Each notification must be individually approved before sending.*",
    createdAt: "2026-04-10T14:46:00.000Z",
  },
  {
    id: "agent-breach-4",
    agentId: "breach-response",
    triggerId: "INC-402",
    category: "DRAFT",
    state: "APPROVED",
    label: "Investigation checklist",
    contentType: "investigation-checklist",
    body: "## Investigation Checklist — INC-402\n\n### Immediate (0-4 hours)\n- [x] Confirm scope of affected systems\n- [x] Isolate affected data flows\n- [ ] Preserve forensic evidence (logs, access records)\n- [x] Notify internal security team\n\n### Short-term (4-24 hours)\n- [ ] Complete root cause analysis\n- [ ] Document timeline of events\n- [ ] Assess whether data principals need notification\n- [ ] Verify processor containment confirmation\n\n### Medium-term (24-72 hours)\n- [ ] Finalize Board notification\n- [ ] Draft data principal communication\n- [ ] Update remediation plan\n- [ ] Attach all investigation artifacts to evidence library",
    createdAt: "2026-04-10T14:46:00.000Z",
    reviewedAt: "2026-04-10T15:35:00.000Z",
    reviewedBy: "Rohan Iyer",
    approvalNote: "Checklist approved with initial items marked complete.",
  },
  {
    id: "agent-breach-5",
    agentId: "breach-response",
    triggerId: "INC-402",
    category: "EXECUTE",
    state: "DRAFT",
    label: "Data principal communication",
    contentType: "principal-communication",
    body: "## Data Principal Communication Draft — INC-402\n\n**Subject:** Important notice about your personal data — Bombay Grooming Labs\n\nDear Customer,\n\nWe are writing to inform you about a data security incident that may have affected your personal information held by Bombay Grooming Labs.\n\n**What happened:** Misrouted support export\n\n**What we are doing:**\n- We have contained the incident and are conducting a thorough investigation\n- We have notified the Data Protection Board as required under the DPDP Act\n- We are strengthening our safeguards to prevent recurrence\n\n**What you can do:**\n- Monitor your accounts for unusual activity\n- Exercise your data rights at: rights.bombaygrooming.example\n\nRegards,\nPrivacy Team, Bombay Grooming Labs\n\n---\n*This communication must be reviewed and approved before distribution.*",
    createdAt: "2026-04-10T14:46:00.000Z",
  },
  {
    id: "agent-breach-6",
    agentId: "breach-response",
    triggerId: "INC-402",
    category: "RECOMMEND",
    state: "DRAFT",
    label: "72-hour countdown",
    contentType: "countdown-timer",
    body: "## 72-Hour Board Notification Countdown\n\n**Incident:** INC-402 — Misrouted support export\n**Severity:** CRITICAL\n**Current deadline:** 42h 15m remaining\n\n### Timeline\n| Milestone | Target | Status |\n|-----------|--------|--------|\n| Incident triaged | T+0h | Complete |\n| Severity assessed | T+2h | Complete |\n| Board draft prepared | T+12h | Pending |\n| Board notification sent | T+72h | Pending approval |\n| Processor notifications sent | T+48h | Pending approval |\n| Data principal communication | T+96h | Pending assessment |",
    createdAt: "2026-04-10T14:46:00.000Z",
  },
  // Rights Request Orchestrator — triggered by RR-2026-016 (NEW grievance)
  {
    id: "agent-rights-1",
    agentId: "rights-orchestrator",
    triggerId: "RR-2026-016",
    category: "DRAFT",
    state: "DRAFT",
    label: "Data principal mapping",
    contentType: "data-map",
    body: "## Data Principal Mapping — RR-2026-016\n\n**Requestor:** aadya@example.com\n**Request type:** GRIEVANCE\n\n### Systems holding data for this principal\n- **Shopify**: Identity and contact (Legitimate use, retention: 24 months)\n- **Zoho CRM**: Marketing and lead data (Consent, retention: 3 years from last interaction)\n- **Freshdesk**: Support and grievance logs (Legitimate use, retention: 24 months)\n\n### Processors involved\n- **Zoho**: CRM and sales workflow — DPA: SIGNED, Purge: ACKNOWLEDGED\n- **Freshdesk**: Support ticketing — DPA: IN_REVIEW, Purge: PENDING\n- **Shiprocket**: Order fulfilment — DPA: MISSING, Purge: PENDING\n\n### Coverage summary\n- Register entries mapped: 3\n- Processors requiring coordination: 3\n- Sources with direct identifiers: 3",
    createdAt: "2026-04-12T09:00:00.000Z",
  },
  {
    id: "agent-rights-2",
    agentId: "rights-orchestrator",
    triggerId: "RR-2026-016",
    category: "DRAFT",
    state: "DRAFT",
    label: "SLA calculation",
    contentType: "sla-calculation",
    body: "## SLA Calculation — RR-2026-016\n\n**Request type:** GRIEVANCE\n**Legal basis:** DPDP Section 15 — Grievance redressal\n**SLA window:** 30 calendar days\n**Current status:** NEW\n\n### Milestone targets\n| Phase | Target | Owner |\n|-------|--------|-------|\n| Acknowledgment sent | Day 1 | Case Handler |\n| Data mapping complete | Day 3 | Privacy Ops |\n| Investigation complete | Day 15 | Case Handler |\n| Response assembled | Day 25 | Case Handler |\n| Final response sent | Day 30 | Compliance Manager |",
    createdAt: "2026-04-12T09:00:00.000Z",
  },
  {
    id: "agent-rights-3",
    agentId: "rights-orchestrator",
    triggerId: "RR-2026-016",
    category: "EXECUTE",
    state: "DRAFT",
    label: "Acknowledgment email",
    contentType: "acknowledgment-draft",
    body: "## Acknowledgment Email Draft — RR-2026-016\n\n**To:** aadya@example.com\n**From:** Privacy Team, Bombay Grooming Labs\n**Subject:** Your grievance request has been received — RR-2026-016\n\nDear Data Principal,\n\nThank you for submitting your grievance request to Bombay Grooming Labs.\n\n**Reference number:** RR-2026-016\n**Request type:** GRIEVANCE\n**Received on:** 2026-04-12\n\nWe have initiated processing of your request and will respond within the timeframe prescribed under the Digital Personal Data Protection Act, 2023.\n\nRegards,\nPrivacy Team\nBombay Grooming Labs\n\n---\n*This acknowledgment must be approved before sending to the data principal.*",
    createdAt: "2026-04-12T09:00:00.000Z",
  },
];

const team: User[] = [
  { id: "user-arjun", tenantSlug: tenant.slug, email: "arjun@bombaygrooming.com", name: "Arjun Mehta", password: "ProoflytDemo!2026", roles: ["TENANT_ADMIN", "COMPLIANCE_MANAGER"], title: "DPO Lead" },
  { id: "user-meera", tenantSlug: tenant.slug, email: "meera@bombaygrooming.com", name: "Meera Kapoor", password: "ProoflytDemo!2026", roles: ["CASE_HANDLER", "REVIEWER"], title: "Privacy Operations Manager" },
  { id: "user-rohan", tenantSlug: tenant.slug, email: "rohan@bombaygrooming.com", name: "Rohan Iyer", password: "ProoflytDemo!2026", roles: ["SECURITY_OWNER"], title: "Security & IT Owner" },
  { id: "user-auditor", tenantSlug: tenant.slug, email: "audit@bombaygrooming.com", name: "Nisha Bhatt", password: "ProoflytDemo!2026", roles: ["AUDITOR"], title: "External Auditor" },
  { id: "ops-user", tenantSlug: null, email: "ops@prooflyt.com", name: "Platform Ops", password: "ProoflytOps!2026", roles: ["TENANT_ADMIN"], title: "Internal Ops Lead", internalAdmin: true },
];

const invites: Invite[] = [
  { token: "invite-bgl-reviewer", email: "reviewer@bombaygrooming.com", tenantSlug: tenant.slug, roles: ["REVIEWER"], title: "Review Desk" },
];

const resets: PasswordReset[] = [
  { token: "reset-arjun-demo", email: "arjun@bombaygrooming.com" },
];

const sessions: SessionRecord[] = [
  {
    token: "session-user-arjun-boot",
    userId: "user-arjun",
    tenantSlug: tenant.slug,
    createdAt: "2026-04-11T08:00:00.000Z",
  },
  {
    token: "session-ops-boot",
    userId: "ops-user",
    tenantSlug: null,
    createdAt: "2026-04-11T08:00:00.000Z",
  },
];

export function createTenantWorkspace(tenantObj: Tenant): TenantWorkspace {
  return {
    tenant: tenantObj,
    team: [],
    departments: [],
    sourceSystems: [],
    obligations: DPDP_MASTER_OBLIGATIONS.map((o) => ({
      id: o.id,
      title: o.title,
      operationalLabel: o.operationalLabel,
      module: o.module as any,
      readiness: 0,
      maturity: 0,
      ownerPresent: false,
      evidencePresent: false,
      status: "NEEDS_ACTION" as const,
    })),
    sources: [],
    sourceProfiles: [],
    registerEntries: [],
    notices: [],
    rightsCases: [],
    deletionTasks: [],
    incidents: [],
    processors: [],
    evidence: [],
    auditTrail: [],
    agentActions: [],
    metrics: {
      readinessScore: 0,
      ownerCoverage: 0,
      evidenceCoverage: 0,
      openGaps: 0,
      openRights: 0,
      overdueDeletions: 0,
      activeIncidents: 0,
    },
  };
}

export function createSeedWorkspace(): TenantWorkspace {
  const workspace = createTenantWorkspace(tenant);
  workspace.team = team.filter((user) => user.tenantSlug === tenant.slug);
  workspace.notices = notices;
  workspace.processors = processors;
  workspace.incidents = [
    { id: "INC-501", title: "Misrouted support export", status: "ASSESSMENT", severity: "CRITICAL", boardDeadline: "42h 15m remaining", remediationOwner: "Rohan Iyer", evidenceLinked: false },
  ];
  workspace.metrics.activeIncidents = 1;
  return workspace;
}

export function createSeedState(): AppState {
  return {
    tenants: [tenant],
    users: team,
    invites,
    resets,
    sessions,
    workspaces: {
      [tenant.slug]: createSeedWorkspace(),
    } as Record<string, TenantWorkspace>,
  };
}
