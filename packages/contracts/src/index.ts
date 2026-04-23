export type Role =
  | "TENANT_ADMIN"
  | "COMPLIANCE_MANAGER"
  | "DEPARTMENT_OWNER"
  | "REVIEWER"
  | "CASE_HANDLER"
  | "SECURITY_OWNER"
  | "AUDITOR"
  | "PLATFORM_ADMIN";

export type SmartMappingMode = "HEADER_ONLY" | "MASKED_SAMPLE" | "EPHEMERAL_FULL";

export type ModuleId =
  | "dashboard"
  | "setup"
  | "sources"
  | "register"
  | "notices"
  | "rights"
  | "retention"
  | "incidents"
  | "processors"
  | "evidence"
  | "reports"
  | "dpdp-reference";

export interface PublicBrand {
  logoText: string;
  primaryColor: string;
  accentColor: string;
  publicDomain: string;
}

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  industry: string;
  descriptor: string;
  operationalStory: string;
  active: boolean;
  publicBrand: PublicBrand;
}

export interface User {
  id: string;
  tenantSlug: string | null;
  email: string;
  name: string;
  password: string;
  roles: Role[];
  title: string;
  internalAdmin?: boolean;
}

export interface Department {
  id: string;
  name: string;
  ownerTitle: string;
  obligationFocus: string;
}

export interface SourceSystem {
  id: string;
  name: string;
  systemType: string;
  owner: string;
  status: "LIVE" | "REVIEW" | "PLANNED";
}

export interface Invite {
  token: string;
  email: string;
  tenantSlug: string;
  roles: Role[];
  title: string;
}

export interface PasswordReset {
  token: string;
  email: string;
}

export interface SessionRecord {
  token: string;
  userId: string;
  tenantSlug: string | null;
  createdAt: string;
}

export interface ObligationBucket {
  id: string;
  title: string;
  operationalLabel: string;
  module: ModuleId;
  readiness: number;
  maturity: number;
  ownerPresent: boolean;
  evidencePresent: boolean;
  status: "STRONG" | "UPDATING" | "NEEDS_ACTION" | "REVIEWING";
}

export interface DataSource {
  id: string;
  name: string;
  fileName: string;
  profileMode: SmartMappingMode;
  status: "INGESTED" | "IN_REVIEW" | "APPROVED";
  fields: number;
  approvedFields: number;
  warnings: string[];
  uploadedAt?: string;
  sheetName?: string;
  pushedToRegister?: boolean;
  linkedRegisterEntryIds?: string[];
}

export interface SourceFieldProfile {
  id: string;
  sourceId: string;
  fieldName: string;
  mappedCategory: string;
  identifierType: string;
  confidence: number;
  purpose: string;
  legalBasis: string;
  retentionLabel: string;
  requiresReview: boolean;
  warnings: string[];
}

export interface RegisterEntry {
  id: string;
  system: string;
  dataCategory: string;
  purpose: string;
  legalBasis: string;
  retentionLabel: string;
  linkedNoticeId: string | null;
  linkedProcessorIds: string[];
  lifecycle: "DRAFT" | "IN_REVIEW" | "APPROVED" | "ARCHIVED";
  sourceTrace: string;
  completeness: "COMPLETE" | "PARTIAL" | "MISSING";
}

export interface Notice {
  id: string;
  title: string;
  audience: string;
  language: string;
  version: string;
  status: "DRAFT" | "IN_REVIEW" | "APPROVED" | "PUBLISHED" | "RETIRED";
  content: string;
  acknowledgements: number;
  publishedAt?: string;
}

export interface RightsCase {
  id: string;
  type: "ACCESS" | "CORRECTION" | "DELETION" | "GRIEVANCE" | "WITHDRAWAL";
  requestor: string;
  status: "NEW" | "IN_PROGRESS" | "AWAITING_PROOF" | "CLOSED";
  sla: string;
  evidenceLinked: boolean;
  linkedDeletionTaskId?: string | null;
}

export interface DeletionTask {
  id: string;
  label: string;
  system: string;
  dueDate: string;
  status: "OPEN" | "LEGAL_HOLD" | "AWAITING_PROCESSOR" | "READY_FOR_PROOF" | "CLOSED";
  proofLinked: boolean;
  processorAcknowledged: boolean;
}

export interface Incident {
  id: string;
  title: string;
  status: "TRIAGE" | "ASSESSMENT" | "CONTAINMENT" | "CLOSED";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  boardDeadline: string;
  remediationOwner: string;
  evidenceLinked: boolean;
}

export interface Processor {
  id: string;
  name: string;
  service: string;
  dpaStatus: "SIGNED" | "IN_REVIEW" | "MISSING";
  purgeAckStatus: "ACKNOWLEDGED" | "PENDING" | "REFUSED";
  subProcessorCount: number;
}

export interface AuditEvent {
  id: string;
  createdAt: string;
  actor: string;
  module: ModuleId;
  action: string;
  targetId: string;
  summary: string;
}

export interface EvidenceArtifact {
  id: string;
  label: string;
  classification: "SYSTEM_DERIVED" | "UPLOADED" | "ATTESTATION";
  linkedRecord: string;
  createdAt: string;
  contentIndexed: false;
  fileName?: string;
  contentType?: string;
  sizeBytes?: number;
  storageKey?: string;
}

export interface MetricSummary {
  readinessScore: number;
  ownerCoverage: number;
  evidenceCoverage: number;
  openGaps: number;
  openRights: number;
  overdueDeletions: number;
  activeIncidents: number;
}

export interface TenantWorkspace {
  tenant: Tenant;
  team: User[];
  departments: Department[];
  sourceSystems: SourceSystem[];
  obligations: ObligationBucket[];
  sources: DataSource[];
  sourceProfiles: SourceFieldProfile[];
  registerEntries: RegisterEntry[];
  notices: Notice[];
  rightsCases: RightsCase[];
  deletionTasks: DeletionTask[];
  incidents: Incident[];
  processors: Processor[];
  evidence: EvidenceArtifact[];
  auditTrail: AuditEvent[];
  agentActions: AgentAction[];
  metrics: MetricSummary;
}

export interface SourceProfileRequest {
  fileName: string;
  mode: SmartMappingMode;
  headers: string[];
}

export interface WorkspaceResponse {
  workspace: TenantWorkspace;
  operator: {
    name: string;
    email: string;
    title: string;
    roles: string[];
  };
  moduleAccess: Record<string, boolean>;
}

export interface PublicRightsResponse {
  tenant: TenantWorkspace["tenant"];
  notice: TenantWorkspace["notices"][number] | null;
  queueSummary: {
    openRights: number;
    overdueDeletions: number;
  };
}

export interface PublicNoticeResponse {
  tenant: TenantWorkspace["tenant"];
  notice: TenantWorkspace["notices"][number] | null;
}

/* ── Agentic AI ─────────────────────────────────────────────── */

export type AgentActionCategory = "DRAFT" | "RECOMMEND" | "EXECUTE";
export type AgentActionState = "DRAFT" | "REVIEWED" | "APPROVED" | "REJECTED";

export interface AgentAction {
  id: string;
  agentId: "breach-response" | "rights-orchestrator";
  triggerId: string;           // INC-xxx or RR-xxx
  category: AgentActionCategory;
  state: AgentActionState;
  label: string;               // Short human label
  contentType: "severity-assessment" | "board-notification" | "processor-notification"
    | "investigation-checklist" | "principal-communication" | "countdown-timer"
    | "data-map" | "sla-calculation" | "acknowledgment-draft" | "purge-request"
    | "escalation-notice" | "response-assembly";
  body: string;                // The drafted text / structured content
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  editedBody?: string;         // If reviewer modified before approving
  approvalNote?: string;
}

export interface AdminBootstrapResponse {
  operator: { name: string; email: string; title: string };
  tenants: Array<{
    slug: string;
    name: string;
    industry: string;
    active: boolean;
    teamCount: number;
    metrics: {
      readinessScore: number;
      ownerCoverage: number;
      evidenceCoverage: number;
      openGaps: number;
    };
  }>;
  masterLibrary: string[];
}
