import { DurableObject } from "cloudflare:workers";
import { createSeedState, createTenantWorkspace, DPDP_MASTER_OBLIGATIONS, type AppState } from "../../api/src/data/seed.js";
import * as XLSX from "xlsx";
import type {
  AdminBootstrapResponse,
  AgentAction,
  AuditEvent,
  DataSource,
  DeletionTask,
  EvidenceArtifact,
  Incident,
  ModuleId,
  Notice,
  Processor,
  PublicNoticeResponse,
  PublicRightsResponse,
  RegisterEntry,
  RightsCase,
  Role,
  SessionRecord,
  SourceFieldProfile,
  Tenant,
  TenantWorkspace,
  User,
  WorkspaceResponse,
} from "@prooflyt/contracts";
import { MODULE_ACCESS } from "@prooflyt/domain";
import {
  buildHeuristicProfiles,
  pickCategory,
  pickIdentifierType,
  pickPurpose,
  pickLegalBasis,
  pickRetention,
  confidenceForHeader,
} from "@prooflyt/mapping";
import { generateBreachActions, generateRightsActions, generateBreachActionsWithGroq, generateRightsActionsWithGroq } from "@prooflyt/agents";
import {
  CONNECTOR_DEFINITIONS,
  buildAuthorizeUrl,
  exchangeOAuthCode,
  createOAuthConnection,
  createApiKeyConnection,
  revokeConnection,
  performDiscovery,
  performDsr,
  ingestWebhook,
  verifyWebhookSignature,
  handleConnectorBootstrap,
  publicConnection,
  ValidationError,
  validateApiKeyConnectorPayload,
  mintOAuthState,
  consumeOAuthState,
} from "./connectors.js";
import { analyzeNoticeAgainstRule3, draftMissingItems } from "./notice-rule3.js";
import type { ConnectorType } from "@prooflyt/contracts";

/* ------------------------------------------------------------------ */
/*  Connectors module — shared role check (security: C4)               */
/* ------------------------------------------------------------------ */
const CONNECTORS_ALLOWED_ROLES: Role[] = [
  "TENANT_ADMIN",
  "COMPLIANCE_MANAGER",
  "SECURITY_OWNER",
  "AUDITOR",
];

function requireConnectorRole(user: User): void {
  if (user.internalAdmin) return; // platform-ops is always allowed.
  if (!CONNECTORS_ALLOWED_ROLES.some((r) => user.roles.includes(r))) {
    throw new HttpError(403, "Connectors module is restricted by role.");
  }
}

type Env = {
  PROOFLYT_RUNTIME: DurableObjectNamespace<ProoflytRuntime>;
  PROOFLYT_DB?: D1Database;
  TURNSTILE_SECRET?: string;
  GROQ_API_KEY?: string;
  GROQ_MODEL?: string;
  HUBSPOT_CLIENT_ID?: string;
  HUBSPOT_CLIENT_SECRET?: string;
  CONNECTORS_MASTER_SECRET?: string;
  CONNECTORS_REDIRECT_URI?: string;
};

/* ------------------------------------------------------------------ */
/*  Utility helpers                                                    */
/* ------------------------------------------------------------------ */

/**
 *  Allow-list of origins permitted to read responses via CORS.
 *  L3: replaced wildcard `*` with strict allow-list. Bearer tokens are not
 *  cookie-bound, but `*` lets any browser execute fetch() and read the JSON.
 */
const CORS_ALLOWED_ORIGINS = new Set<string>([
  "https://prooflyt-msp.vercel.app",
  "http://localhost:3000",
  "http://localhost:3001",
]);

function corsHeadersFor(origin: string | null): Record<string, string> {
  const allow = origin && CORS_ALLOWED_ORIGINS.has(origin) ? origin : "https://prooflyt-msp.vercel.app";
  return {
    "access-control-allow-origin": allow,
    "vary": "Origin",
    "access-control-allow-headers": "Authorization, Content-Type",
    "access-control-allow-methods": "GET, POST, OPTIONS",
  };
}

let _currentOrigin: string | null = null;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...corsHeadersFor(_currentOrigin),
    },
  });
}

/**
 *  H2: do not echo internal Error.message to clients. Map known typed errors
 *  to clean status codes; for everything else return a generic 500 with a
 *  short trace id and log the real error server-side via console.error.
 */
function errorResponse(error: unknown) {
  if (error instanceof HttpError) {
    return json({ error: error.message }, error.status);
  }
  if (error instanceof ValidationError) {
    return json({ error: error.message }, 400);
  }
  // Unknown error — never leak the message.
  const traceId = crypto.randomUUID().slice(0, 8);
  console.error(`[traceId=${traceId}]`, error);
  return json({ error: "Internal error.", traceId }, 500);
}

async function parseBody<T>(request: Request) {
  return (await request.json()) as T;
}

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

function sanitizeUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    roles: user.roles,
    title: user.title,
    tenantSlug: user.tenantSlug,
    internalAdmin: user.internalAdmin ?? false,
  };
}

function ensureWorkspaceShape(workspace: TenantWorkspace) {
  workspace.auditTrail = workspace.auditTrail || [];
  workspace.agentActions = workspace.agentActions || [];
  workspace.departments = workspace.departments || [];
  workspace.sourceSystems = workspace.sourceSystems || [];
  workspace.connections = workspace.connections || [];
  workspace.connectorEvents = workspace.connectorEvents || [];
  workspace.sources = workspace.sources.map((source) => ({
    pushedToRegister: false,
    linkedRegisterEntryIds: [],
    ...source,
  }));
  const seenRegisterIds = new Set<string>();
  workspace.registerEntries = workspace.registerEntries.filter((entry) => {
    if (seenRegisterIds.has(entry.id)) return false;
    seenRegisterIds.add(entry.id);
    return true;
  });
  workspace.sources.forEach((source) => {
    source.linkedRegisterEntryIds = Array.from(new Set(source.linkedRegisterEntryIds || []));
  });
  return workspace;
}

function sanitizeWorkspace(workspace: TenantWorkspace) {
  ensureWorkspaceShape(workspace);
  return {
    ...workspace,
    team: workspace.team.map((member) => sanitizeUser(member)),
    connections: (workspace.connections || []).map((c) => sanitizeConnection(c)),
  };
}

function sanitizeConnection(c: TenantWorkspace["connections"][number]) {
  // Strip every encrypted secret before sending to the UI.
  const {
    encryptedAccessToken: _a,
    encryptedRefreshToken: _r,
    encryptedApiKey: _k,
    encryptedWebhookSecret: _w,
    ...safe
  } = c;
  return safe;
}

function nextId(prefix: string, count: number) {
  return `${prefix}-${Date.now()}-${count + 1}`;
}

/** H1: bearer-token sessions are time-bounded and slide on use. */
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;       // 12-hour absolute expiry
const SESSION_IDLE_MS = 60 * 60 * 1000;           // 60-minute idle timeout

function requireSession(state: AppState, authHeader?: string) {
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new HttpError(401, "Missing bearer token.");
  const session = state.sessions.find((item) => item.token === token);
  if (!session) throw new HttpError(401, "Unknown session.");

  // H1: Enforce expiry. Reject and prune the record so a leaked token is finite.
  const now = Date.now();
  const created = new Date(session.createdAt).getTime();
  const lastSeen = session.lastSeenAt ? new Date(session.lastSeenAt).getTime() : created;
  const expiresAt = session.expiresAt ? new Date(session.expiresAt).getTime() : created + SESSION_TTL_MS;
  if (now >= expiresAt || now - lastSeen >= SESSION_IDLE_MS) {
    state.sessions = state.sessions.filter((s) => s.token !== token);
    throw new HttpError(401, "Session expired.");
  }
  session.lastSeenAt = new Date(now).toISOString();

  const user = state.users.find((item) => item.id === session.userId);
  if (!user) throw new HttpError(401, "Session user no longer exists.");
  return { session, user };
}

function ensureWorkspace(state: AppState, tenantSlug: string) {
  const workspace = state.workspaces[tenantSlug];
  if (!workspace) throw new HttpError(404, "Tenant workspace not found.");
  return ensureWorkspaceShape(workspace);
}

function ensureTenantAccess(state: AppState, tenantSlug: string, authHeader?: string) {
  const { user } = requireSession(state, authHeader);
  if (user.tenantSlug !== tenantSlug && !user.internalAdmin) {
    throw new HttpError(403, "Tenant-scoped access only.");
  }
  return { user, workspace: ensureWorkspace(state, tenantSlug) };
}

function appendAudit(
  workspace: TenantWorkspace,
  actor: User,
  module: ModuleId,
  action: string,
  targetId: string,
  summary: string,
) {
  const event: AuditEvent = {
    id: nextId("audit", workspace.auditTrail.length),
    createdAt: new Date().toISOString(),
    actor: actor.name,
    module,
    action,
    targetId,
    summary,
  };
  workspace.auditTrail.unshift(event);
}

function updateObligation(workspace: TenantWorkspace, module: ModuleId, fields: Partial<TenantWorkspace["obligations"][number]>) {
  workspace.obligations = workspace.obligations.map((ob) =>
    ob.module === module ? { ...ob, ...fields } : ob,
  );
}

function updateTenantRecord(state: AppState, tenantSlug: string, updater: (t: Tenant) => void) {
  const tenant = state.tenants.find((e) => e.slug === tenantSlug);
  if (tenant) updater(tenant as TenantWorkspace["tenant"]);
  const workspace = state.workspaces[tenantSlug];
  if (workspace) updater(workspace.tenant);
}

function syncMetrics(workspace: TenantWorkspace) {
  workspace.metrics.openRights = workspace.rightsCases.filter((i) => i.status !== "CLOSED").length;
  workspace.metrics.overdueDeletions = workspace.deletionTasks.filter((i) => i.status !== "CLOSED").length;
  workspace.metrics.activeIncidents = workspace.incidents.filter((i) => i.status !== "CLOSED").length;
  workspace.metrics.openGaps = Math.max(
    workspace.sourceProfiles.filter((p) => p.requiresReview).length,
    workspace.obligations.filter((o) => o.status === "NEEDS_ACTION").length,
  );
  const evidenceBearing =
    workspace.rightsCases.filter((i) => i.evidenceLinked).length +
    workspace.deletionTasks.filter((i) => i.proofLinked).length +
    workspace.incidents.filter((i) => i.evidenceLinked).length +
    workspace.notices.filter((i) => i.status === "PUBLISHED").length;
  workspace.metrics.evidenceCoverage = Math.min(100, 45 + evidenceBearing * 3);
  const approvedReg = workspace.registerEntries.filter((i) => i.lifecycle === "APPROVED").length;
  workspace.metrics.readinessScore = Math.min(
    100,
    Math.round(
      workspace.metrics.ownerCoverage * 0.24 +
      workspace.metrics.evidenceCoverage * 0.26 +
      approvedReg * 6 +
      workspace.notices.filter((i) => i.status === "PUBLISHED").length * 8 -
      workspace.metrics.openRights * 2 -
      workspace.metrics.overdueDeletions * 3 -
      workspace.metrics.activeIncidents * 2,
    ),
  );
}

function csvEscape(value: unknown) {
  const s = String(value ?? "");
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function arrayToCsv(rows: unknown[][]) {
  return rows.map((r) => r.map(csvEscape).join(",")).join("\n");
}

/* ------------------------------------------------------------------ */
/*  Turnstile verification                                             */
/* ------------------------------------------------------------------ */

async function verifyTurnstile(env: Env, token: string | null) {
  if (!env.TURNSTILE_SECRET) return true;
  if (!token) return false;
  const body = new FormData();
  body.set("secret", env.TURNSTILE_SECRET);
  body.set("response", token);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  if (!response.ok) return false;
  const result = (await response.json()) as { success?: boolean };
  return Boolean(result.success);
}

/* ------------------------------------------------------------------ */
/*  Auth handlers                                                      */
/* ------------------------------------------------------------------ */

function freshSession(userId: string, tenantSlug: string | null): SessionRecord {
  const now = new Date();
  return {
    // H1: high-entropy session token (replaces predictable Date.now() suffix).
    token: `sess_${crypto.randomUUID().replace(/-/g, "")}_${userId}`,
    userId,
    tenantSlug,
    createdAt: now.toISOString(),
    lastSeenAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
  };
}

async function handleLogin(state: AppState, body: { email: string; password: string }) {
  const user = state.users.find((c) => c.email.toLowerCase() === body.email.toLowerCase());
  if (!user || user.password !== body.password) throw new HttpError(401, "Invalid credentials.");
  const session = freshSession(user.id, user.tenantSlug);
  state.sessions.push(session);
  return { session, user: sanitizeUser(user), tenant: user.tenantSlug ? state.workspaces[user.tenantSlug]?.tenant : null };
}

function handleAcceptInvite(state: AppState, body: { token: string; password: string; name?: string }) {
  const invite = state.invites.find((e) => e.token === body.token);
  if (!invite) throw new HttpError(404, "Invite not found.");
  const existing = state.users.find((u) => u.email === invite.email);
  if (existing) throw new HttpError(400, "Invite already claimed.");
  const user: User = {
    id: `user-${Date.now()}`,
    tenantSlug: invite.tenantSlug,
    email: invite.email,
    name: body.name || invite.email.split("@")[0],
    password: body.password,
    roles: invite.roles,
    title: invite.title,
  };
  state.users.push(user);
  ensureWorkspace(state, invite.tenantSlug).team.push(user);
  const session = freshSession(user.id, user.tenantSlug);
  state.sessions.push(session);
  return { session, user: sanitizeUser(user), tenant: user.tenantSlug ? state.workspaces[user.tenantSlug]?.tenant : null };
}

function handleRequestReset(state: AppState, body: { email: string }) {
  const user = state.users.find((e) => e.email.toLowerCase() === body.email.toLowerCase());
  const token = user ? `reset-${user.id}` : "noop";
  if (user && !state.resets.find((r) => r.email === user.email)) {
    state.resets.push({ token, email: user.email });
  }
  return { ok: true, token: user ? token : null };
}

function handleConfirmReset(state: AppState, body: { token: string; password: string }) {
  const reset = state.resets.find((i) => i.token === body.token);
  if (!reset) throw new HttpError(404, "Reset token not found.");
  const user = state.users.find((e) => e.email === reset.email);
  if (!user) throw new HttpError(404, "User not found.");
  user.password = body.password;
  // H1: invalidate every existing session for this user so a leaked bearer
  //     cannot survive a password change.
  state.sessions = state.sessions.filter((s) => s.userId !== user.id);
  // Burn the reset token after use so it's strictly single-use.
  state.resets = state.resets.filter((r) => r.token !== reset.token);
  return { ok: true };
}

function handleLogout(state: AppState, authHeader?: string) {
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: true };
  state.sessions = state.sessions.filter((i) => i.token !== token);
  return { ok: true };
}

function handleRefresh(state: AppState, authHeader?: string) {
  const { session, user } = requireSession(state, authHeader);
  // H1: rotate the bearer on refresh — limits the half-life of any leaked token
  //     while preserving the active workflow.
  state.sessions = state.sessions.filter((s) => s.token !== session.token);
  const rotated = freshSession(user.id, user.tenantSlug);
  state.sessions.push(rotated);
  return { session: rotated, user: sanitizeUser(user), tenant: user.tenantSlug ? state.workspaces[user.tenantSlug]?.tenant : null };
}

/* ------------------------------------------------------------------ */
/*  Admin handlers                                                     */
/* ------------------------------------------------------------------ */

function handleAdminBootstrap(state: AppState, authHeader?: string): AdminBootstrapResponse {
  const { user } = requireSession(state, authHeader);
  if (!user.internalAdmin) throw new HttpError(403, "Internal admin access required.");
  return {
    operator: sanitizeUser(user),
    tenants: state.tenants.map((tenant) => ({
      ...tenant,
      metrics: state.workspaces[tenant.slug].metrics,
      teamCount: state.workspaces[tenant.slug].team.length,
    })),
    masterLibrary: [
      "Notice transparency",
      "Rights response handling",
      "Deletion proof discipline",
      "Processor governance",
      "Incident response",
      "Evidence retention",
    ],
  };
}

function handleAdminTenantStatus(state: AppState, tenantSlug: string, active: boolean, authHeader?: string) {
  const { user } = requireSession(state, authHeader);
  if (!user.internalAdmin) throw new HttpError(403, "Internal admin access required.");
  const tenant = state.tenants.find((e) => e.slug === tenantSlug);
  if (!tenant) throw new HttpError(404, "Tenant not found.");
  updateTenantRecord(state, tenantSlug, (t) => { t.active = active; });
  const workspace = ensureWorkspace(state, tenantSlug);
  appendAudit(workspace, user, "setup", active ? "TENANT_ACTIVATED" : "TENANT_DEACTIVATED", tenant.id, `${active ? "Activated" : "Deactivated"} tenant ${tenant.name}.`);
  return { ok: true, tenant: workspace.tenant };
}

function handleAdminCreateTenant(
  state: AppState,
  body: { name: string; slug: string; industry: string; descriptor?: string },
  authHeader?: string,
) {
  const { user } = requireSession(state, authHeader);
  if (!user.internalAdmin) throw new HttpError(403, "Internal admin access required.");
  if (!body.name?.trim() || !body.slug?.trim() || !body.industry?.trim()) {
    throw new HttpError(400, "Name, slug, and industry are required.");
  }
  const slug = body.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
  if (state.tenants.find((t) => t.slug === slug)) {
    throw new HttpError(400, "Tenant slug already exists.");
  }
  const newTenant: Tenant = {
    id: `tenant-${slug}`,
    slug,
    name: body.name.trim(),
    industry: body.industry.trim(),
    descriptor: body.descriptor?.trim() || body.industry.trim(),
    operationalStory: `${body.name.trim()} is onboarding with Prooflyt for DPDP compliance. Prooflyt tracks every obligation, workflow, and proof artifact so you can demonstrate readiness to leadership, auditors, and the Data Protection Board.`,
    active: true,
    publicBrand: {
      logoText: body.name.trim().split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 4),
      primaryColor: "#1a1a17",
      accentColor: "#3b82f6",
      publicDomain: `rights.${slug}.example`,
    },
  };
  state.tenants.push(newTenant);
  const workspace = createTenantWorkspace(newTenant);
  state.workspaces[slug] = workspace;

  const adminUser: User = {
    id: `user-admin-${slug}-${Date.now()}`,
    tenantSlug: slug,
    email: `admin@${slug}.com`,
    name: `${body.name.trim()} Admin`,
    password: "ProoflytDemo!2026",
    roles: ["TENANT_ADMIN", "COMPLIANCE_MANAGER"] as Role[],
    title: "Tenant Admin",
  };
  state.users.push(adminUser);
  workspace.team.push(adminUser);

  syncMetrics(workspace);
  return { ok: true, tenant: newTenant, adminEmail: adminUser.email };
}

function handleAdminDpdpLibrary(state: AppState, authHeader?: string) {
  const { user } = requireSession(state, authHeader);
  if (!user.internalAdmin) throw new HttpError(403, "Internal admin access required.");
  return DPDP_MASTER_OBLIGATIONS;
}

function handleAdminAuditLog(state: AppState, authHeader?: string) {
  const { user } = requireSession(state, authHeader);
  if (!user.internalAdmin) throw new HttpError(403, "Internal admin access required.");
  const combined: (AuditEvent & { tenantSlug?: string })[] = [];
  for (const [slug, workspace] of Object.entries(state.workspaces)) {
    for (const event of workspace.auditTrail) {
      combined.push({ ...event, tenantSlug: slug });
    }
  }
  combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return { auditLog: combined };
}

/* ------------------------------------------------------------------ */
/*  Portal read handlers                                               */
/* ------------------------------------------------------------------ */

function handlePortalBootstrap(state: AppState, tenantSlug: string, authHeader?: string): WorkspaceResponse {
  const { user, workspace } = ensureTenantAccess(state, tenantSlug, authHeader);
  return {
    workspace: sanitizeWorkspace(workspace),
    operator: sanitizeUser(user),
    moduleAccess: Object.fromEntries(
      Object.entries(MODULE_ACCESS).map(([moduleId, roles]) => [moduleId, roles.some((role) => user.roles.includes(role))]),
    ),
  };
}

function handleModuleSnapshot(state: AppState, tenantSlug: string, moduleId: ModuleId, authHeader?: string) {
  const { user, workspace } = ensureTenantAccess(state, tenantSlug, authHeader);
  if (!MODULE_ACCESS[moduleId]?.some((role) => user.roles.includes(role))) {
    throw new HttpError(403, "Role cannot access requested module.");
  }
  return { moduleId, workspace: sanitizeWorkspace(workspace) };
}

/* ------------------------------------------------------------------ */
/*  Setup mutations                                                    */
/* ------------------------------------------------------------------ */

function handleUpdateProfile(
  state: AppState,
  tenantSlug: string,
  body: { descriptor: string; operationalStory: string; publicDomain: string; primaryColor: string; accentColor: string },
  authHeader?: string,
) {
  const { user, workspace } = ensureTenantAccess(state, tenantSlug, authHeader);
  updateTenantRecord(state, tenantSlug, (t) => {
    t.descriptor = body.descriptor?.trim() || t.descriptor;
    t.operationalStory = body.operationalStory?.trim() || t.operationalStory;
    t.publicBrand.publicDomain = body.publicDomain?.trim() || t.publicBrand.publicDomain;
    t.publicBrand.primaryColor = body.primaryColor?.trim() || t.publicBrand.primaryColor;
    t.publicBrand.accentColor = body.accentColor?.trim() || t.publicBrand.accentColor;
  });
  appendAudit(workspace, user, "setup", "TENANT_PROFILE_UPDATED", workspace.tenant.id, `Updated tenant profile for ${workspace.tenant.name}.`);
  updateObligation(workspace, "setup", { status: "STRONG", readiness: 100, maturity: 100, ownerPresent: true });
  return { ok: true, tenant: workspace.tenant };
}

function handleAddDepartment(
  state: AppState,
  tenantSlug: string,
  body: { name: string; ownerTitle: string; obligationFocus: string },
  authHeader?: string,
) {
  const { user, workspace } = ensureTenantAccess(state, tenantSlug, authHeader);
  if (!body.name?.trim()) throw new HttpError(400, "Department name is required.");
  const department = {
    id: nextId("dept", workspace.departments.length),
    name: body.name.trim(),
    ownerTitle: body.ownerTitle?.trim() || "Owner pending",
    obligationFocus: body.obligationFocus?.trim() || "Operational ownership to be assigned",
  };
  workspace.departments.unshift(department);
  appendAudit(workspace, user, "setup", "DEPARTMENT_ADDED", department.id, `Added department ${department.name}.`);
  return { ok: true, department };
}

function handleAddSourceSystem(
  state: AppState,
  tenantSlug: string,
  body: { name: string; systemType: string; owner: string; status: string },
  authHeader?: string,
) {
  const { user, workspace } = ensureTenantAccess(state, tenantSlug, authHeader);
  if (!body.name?.trim()) throw new HttpError(400, "Source system name is required.");
  const sourceSystem = {
    id: nextId("system", workspace.sourceSystems.length),
    name: body.name.trim(),
    systemType: body.systemType?.trim() || "Unclassified",
    owner: body.owner?.trim() || "Unassigned",
    status: (body.status || "PLANNED") as "LIVE" | "REVIEW" | "PLANNED",
  };
  workspace.sourceSystems.unshift(sourceSystem);
  appendAudit(workspace, user, "setup", "SOURCE_SYSTEM_ADDED", sourceSystem.id, `Added source system ${sourceSystem.name}.`);
  return { ok: true, sourceSystem };
}

function handleInviteUser(
  state: AppState,
  tenantSlug: string,
  body: { email: string; role: Role; title: string },
  authHeader?: string,
) {
  const { user, workspace } = ensureTenantAccess(state, tenantSlug, authHeader);
  const email = body.email?.trim().toLowerCase();
  if (!email) throw new HttpError(400, "Invite email is required.");
  if (
    state.users.some((c) => c.email.toLowerCase() === email) ||
    state.invites.some((i) => i.email.toLowerCase() === email)
  ) {
    throw new HttpError(400, "A user or invite already exists for that email.");
  }
  const invite = {
    token: `invite-${tenantSlug}-${Date.now()}`,
    email,
    tenantSlug,
    roles: [body.role] as Role[],
    title: body.title?.trim() || "Assigned during invite",
  };
  state.invites.unshift(invite);
  appendAudit(workspace, user, "setup", "INVITE_CREATED", invite.token, `Created invite for ${invite.email}.`);
  return { ok: true, invite };
}

/* ------------------------------------------------------------------ */
/*  Source profiling + approval                                        */
/* ------------------------------------------------------------------ */

function handleSourceProfile(
  state: AppState,
  tenantSlug: string,
  body: { fileName: string; mode: "HEADER_ONLY" | "MASKED_SAMPLE" | "EPHEMERAL_FULL"; headers: string[] },
  authHeader?: string,
) {
  ensureTenantAccess(state, tenantSlug, authHeader);
  const profiles = buildHeuristicProfiles({ fileName: body.fileName, mode: body.mode, headers: body.headers });
  return {
    fileName: body.fileName,
    mode: body.mode,
    warnings: [
      body.headers.length > 180 ? "Wide file detected; review will be split into batches." : null,
      body.headers.some((h: string) => !h.trim()) ? "Missing headers were converted into unnamed columns." : null,
    ].filter(Boolean),
    profiles,
    rawPersistence: "purged_after_profiling",
  };
}

function handleSourceUpload(
  state: AppState,
  tenantSlug: string,
  headers: string[],
  fileName: string,
  mode: "HEADER_ONLY" | "MASKED_SAMPLE" | "EPHEMERAL_FULL",
  authHeader?: string,
) {
  const { user, workspace } = ensureTenantAccess(state, tenantSlug, authHeader);
  const profiles = buildHeuristicProfiles({ fileName, mode, headers });
  const sourceId = nextId("src", workspace.sources.length);
  const now = new Date().toISOString();

  const sourceProfiles: SourceFieldProfile[] = profiles.map((p, i) => ({
    ...p,
    id: `${sourceId}-profile-${i + 1}`,
    sourceId,
  }));

  workspace.sources.unshift({
    id: sourceId,
    name: fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "),
    fileName,
    profileMode: mode,
    status: "IN_REVIEW",
    fields: sourceProfiles.length,
    approvedFields: 0,
    warnings: [],
    uploadedAt: now,
    pushedToRegister: false,
    linkedRegisterEntryIds: [],
  });
  workspace.sourceProfiles = [...sourceProfiles, ...workspace.sourceProfiles];
  appendAudit(workspace, user, "sources", "SOURCE_UPLOADED", sourceId, `Uploaded ${fileName} for ${mode} profiling.`);
  updateObligation(workspace, "sources", { readiness: 67, maturity: 67, status: "UPDATING", evidencePresent: false });
  syncMetrics(workspace);
  return { source: workspace.sources[0], warnings: [], profiles: sourceProfiles, rawPersistence: "purged_after_profiling" };
}

function handleApproveSource(state: AppState, tenantSlug: string, sourceId: string, authHeader?: string) {
  const { user, workspace } = ensureTenantAccess(state, tenantSlug, authHeader);
  const source = workspace.sources.find((e) => e.id === sourceId);
  if (!source) throw new HttpError(404, "Source not found.");

  source.status = "APPROVED";
  source.approvedFields = source.fields;
  source.pushedToRegister = true;

  const groupedProfiles = workspace.sourceProfiles.filter((p) => p.sourceId === sourceId);
  const selectedProfiles = groupedProfiles
    .slice()
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, Math.min(2, groupedProfiles.length));

  const createdEntries: RegisterEntry[] = selectedProfiles.map((p, i) => ({
    id: nextId("reg", workspace.registerEntries.length + i),
    system: source.name,
    dataCategory: p.mappedCategory,
    purpose: p.purpose,
    legalBasis: p.legalBasis,
    retentionLabel: p.retentionLabel,
    linkedNoticeId: workspace.notices.find((n) => n.status === "PUBLISHED")?.id || null,
    linkedProcessorIds: workspace.processors.slice(0, 1).map((proc) => proc.id),
    lifecycle: "IN_REVIEW" as const,
    sourceTrace: `${source.fileName} / approved mapping`,
    completeness: p.requiresReview ? ("PARTIAL" as const) : ("COMPLETE" as const),
  }));

  source.linkedRegisterEntryIds = createdEntries.map((e) => e.id);
  workspace.registerEntries = [...createdEntries, ...workspace.registerEntries];
  groupedProfiles.forEach((p) => { p.requiresReview = false; p.warnings = []; p.confidence = Math.max(p.confidence, 0.88); });
  appendAudit(workspace, user, "sources", "SOURCE_APPROVED_TO_REGISTER", sourceId, `Approved ${source.name} and pushed ${createdEntries.length} register entries into review.`);
  updateObligation(workspace, "sources", { readiness: 82, maturity: 82, status: "STRONG", evidencePresent: true });
  updateObligation(workspace, "register", { readiness: 74, maturity: 74, status: "UPDATING" });
  syncMetrics(workspace);
  return { ok: true, source, createdEntries };
}

/* ------------------------------------------------------------------ */
/*  Register lifecycle                                                 */
/* ------------------------------------------------------------------ */

function handleRegisterLifecycle(
  state: AppState,
  tenantSlug: string,
  entryId: string,
  lifecycle: RegisterEntry["lifecycle"],
  authHeader?: string,
) {
  const { user, workspace } = ensureTenantAccess(state, tenantSlug, authHeader);
  const entry = workspace.registerEntries.find((i) => i.id === entryId);
  if (!entry) throw new HttpError(404, "Register entry not found.");
  entry.lifecycle = lifecycle;
  entry.completeness = lifecycle === "APPROVED" ? "COMPLETE" : entry.completeness;
  appendAudit(workspace, user, "register", "REGISTER_LIFECYCLE_UPDATED", entryId, `Moved ${entry.system} to ${lifecycle}.`);
  updateObligation(workspace, "register", {
    readiness: lifecycle === "APPROVED" ? 81 : 72,
    maturity: lifecycle === "APPROVED" ? 81 : 72,
    status: lifecycle === "APPROVED" ? "STRONG" : "UPDATING",
  });
  syncMetrics(workspace);
  return { ok: true, entry };
}

/* ------------------------------------------------------------------ */
/*  Notice status                                                      */
/* ------------------------------------------------------------------ */

function handleNoticeStatus(
  state: AppState,
  tenantSlug: string,
  noticeId: string,
  status: Notice["status"],
  authHeader?: string,
) {
  const { user, workspace } = ensureTenantAccess(state, tenantSlug, authHeader);
  const notice = workspace.notices.find((i) => i.id === noticeId);
  if (!notice) throw new HttpError(404, "Notice not found.");
  notice.status = status;
  if (status === "PUBLISHED") {
    notice.publishedAt = new Date().toISOString();
    workspace.notices.forEach((n) => {
      if (n.id !== noticeId && n.audience === notice.audience && n.status === "PUBLISHED") n.status = "RETIRED";
    });
  }
  appendAudit(workspace, user, "notices", "NOTICE_STATUS_UPDATED", noticeId, `Moved ${notice.title} to ${status}.`);
  updateObligation(workspace, "notices", {
    readiness: status === "PUBLISHED" ? 88 : 72,
    maturity: status === "PUBLISHED" ? 88 : 72,
    status: status === "PUBLISHED" ? "STRONG" : "UPDATING",
    evidencePresent: status === "PUBLISHED",
  });
  syncMetrics(workspace);
  return { ok: true, notice };
}

function handleNoticeUpdate(
  state: AppState,
  tenantSlug: string,
  noticeId: string,
  body: { title?: string; content?: string; audience?: string; status?: Notice["status"] },
  authHeader?: string,
) {
  const { user, workspace } = ensureTenantAccess(state, tenantSlug, authHeader);
  const notice = workspace.notices.find((i) => i.id === noticeId);
  if (!notice) throw new HttpError(404, "Notice not found.");
  if (body.title?.trim()) notice.title = body.title.trim();
  if (body.content?.trim()) notice.content = body.content.trim();
  if (body.audience?.trim()) notice.audience = body.audience.trim();
  if (body.status) {
    notice.status = body.status;
    if (body.status === "PUBLISHED") {
      notice.publishedAt = new Date().toISOString();
      workspace.notices.forEach((n) => {
        if (n.id !== noticeId && n.audience === notice.audience && n.status === "PUBLISHED") n.status = "RETIRED";
      });
    }
    updateObligation(workspace, "notices", {
      readiness: body.status === "PUBLISHED" ? 88 : 72,
      maturity: body.status === "PUBLISHED" ? 88 : 72,
      status: body.status === "PUBLISHED" ? "STRONG" : "UPDATING",
      evidencePresent: body.status === "PUBLISHED",
    });
  }
  appendAudit(workspace, user, "notices", "NOTICE_UPDATED", noticeId, `Updated ${notice.title}.`);
  syncMetrics(workspace);
  return { ok: true, notice };
}

function handleNoticeCreate(
  state: AppState,
  tenantSlug: string,
  body: { title: string; content: string; audience: string },
  authHeader?: string,
) {
  const { user, workspace } = ensureTenantAccess(state, tenantSlug, authHeader);
  if (!body.title?.trim() || !body.content?.trim() || !body.audience?.trim()) {
    throw new HttpError(400, "Title, content, and audience are required.");
  }
  const notice: Notice = {
    id: nextId("notice", workspace.notices.length),
    title: body.title.trim(),
    audience: body.audience.trim(),
    language: "English",
    version: "v1.0",
    status: "DRAFT",
    content: body.content.trim(),
    acknowledgements: 0,
  };
  workspace.notices.unshift(notice);
  appendAudit(workspace, user, "notices", "NOTICE_CREATED", notice.id, `Created notice ${notice.title}.`);
  syncMetrics(workspace);
  return { ok: true, notice };
}

/* ------------------------------------------------------------------ */
/*  Rights case updates                                                */
/* ------------------------------------------------------------------ */

function handleRightsUpdate(
  state: AppState,
  tenantSlug: string,
  caseId: string,
  body: { status: RightsCase["status"]; evidenceLinked?: boolean; refusalNote?: string },
  authHeader?: string,
) {
  const { user, workspace } = ensureTenantAccess(state, tenantSlug, authHeader);
  const rc = workspace.rightsCases.find((i) => i.id === caseId);
  if (!rc) throw new HttpError(404, "Rights case not found.");
  const refusalNote = body.refusalNote?.trim();
  if (body.status === "CLOSED" && !body.evidenceLinked && !refusalNote) {
    throw new HttpError(400, "Closing a rights case requires evidence or a documented refusal.");
  }
  rc.status = body.status;
  rc.evidenceLinked = Boolean(body.evidenceLinked);
  rc.sla = body.status === "CLOSED" ? "Closed" : rc.sla;
  appendAudit(workspace, user, "rights", "RIGHTS_CASE_UPDATED", caseId,
    refusalNote
      ? `Closed ${caseId} with documented refusal: ${refusalNote}`
      : `Moved ${caseId} to ${body.status}${body.evidenceLinked ? " with evidence linked" : ""}.`);
  updateObligation(workspace, "rights", {
    readiness: body.status === "CLOSED" ? 92 : 86,
    maturity: body.status === "CLOSED" ? 92 : 86,
    status: body.status === "CLOSED" ? "STRONG" : "UPDATING",
    evidencePresent: workspace.rightsCases.some((i) => i.evidenceLinked || i.status === "CLOSED"),
  });
  syncMetrics(workspace);
  return { ok: true, rightsCase: rc };
}

/* ------------------------------------------------------------------ */
/*  Deletion task updates                                              */
/* ------------------------------------------------------------------ */

function handleDeletionUpdate(
  state: AppState,
  tenantSlug: string,
  taskId: string,
  body: { status: DeletionTask["status"]; proofLinked?: boolean; processorAcknowledged?: boolean; exceptionNote?: string },
  authHeader?: string,
) {
  const { user, workspace } = ensureTenantAccess(state, tenantSlug, authHeader);
  const task = workspace.deletionTasks.find((i) => i.id === taskId);
  if (!task) throw new HttpError(404, "Deletion task not found.");
  const exceptionNote = body.exceptionNote?.trim();
  if (body.status === "CLOSED" && !body.proofLinked) {
    throw new HttpError(400, "Deletion task cannot close without linked proof.");
  }
  if (body.status === "CLOSED" && !body.processorAcknowledged && !exceptionNote) {
    throw new HttpError(400, "Deletion task cannot close without processor acknowledgement unless an exception is recorded.");
  }
  task.status = body.status;
  task.proofLinked = Boolean(body.proofLinked);
  task.processorAcknowledged = Boolean(body.processorAcknowledged);
  appendAudit(workspace, user, "retention", "DELETION_TASK_UPDATED", taskId,
    exceptionNote
      ? `Closed ${task.label} with exception note: ${exceptionNote}`
      : `Moved ${task.label} to ${body.status}.`);
  updateObligation(workspace, "retention", {
    readiness: task.status === "CLOSED" ? 78 : 62,
    maturity: task.status === "CLOSED" ? 78 : 62,
    status: task.status === "CLOSED" ? "STRONG" : "REVIEWING",
    evidencePresent: workspace.deletionTasks.some((i) => i.proofLinked),
  });
  syncMetrics(workspace);
  return { ok: true, task };
}

/* ------------------------------------------------------------------ */
/*  Incident updates                                                   */
/* ------------------------------------------------------------------ */

function handleIncidentUpdate(
  state: AppState,
  tenantSlug: string,
  incidentId: string,
  body: { status: Incident["status"]; evidenceLinked?: boolean; remediationOwner?: string },
  authHeader?: string,
) {
  const { user, workspace } = ensureTenantAccess(state, tenantSlug, authHeader);
  const incident = workspace.incidents.find((i) => i.id === incidentId);
  if (!incident) throw new HttpError(404, "Incident not found.");
  incident.status = body.status;
  incident.evidenceLinked = Boolean(body.evidenceLinked);
  incident.remediationOwner = body.remediationOwner?.trim() || incident.remediationOwner;
  appendAudit(workspace, user, "incidents", "INCIDENT_UPDATED", incidentId, `Moved ${incident.title} to ${body.status}.`);
  updateObligation(workspace, "incidents", {
    readiness: body.status === "CLOSED" ? 85 : 74,
    maturity: body.status === "CLOSED" ? 85 : 74,
    status: body.status === "CLOSED" ? "STRONG" : "REVIEWING",
    evidencePresent: workspace.incidents.some((i) => i.evidenceLinked),
  });
  syncMetrics(workspace);
  return { ok: true, incident };
}

/* ------------------------------------------------------------------ */
/*  Processor updates                                                  */
/* ------------------------------------------------------------------ */

function handleProcessorUpdate(
  state: AppState,
  tenantSlug: string,
  processorId: string,
  body: { dpaStatus: Processor["dpaStatus"]; purgeAckStatus: Processor["purgeAckStatus"] },
  authHeader?: string,
) {
  const { user, workspace } = ensureTenantAccess(state, tenantSlug, authHeader);
  const proc = workspace.processors.find((i) => i.id === processorId);
  if (!proc) throw new HttpError(404, "Processor not found.");
  proc.dpaStatus = body.dpaStatus;
  proc.purgeAckStatus = body.purgeAckStatus;
  appendAudit(workspace, user, "processors", "PROCESSOR_UPDATED", processorId,
    `Updated ${proc.name}: DPA ${body.dpaStatus}, purge ${body.purgeAckStatus}.`);
  updateObligation(workspace, "processors", {
    readiness: body.dpaStatus === "SIGNED" && body.purgeAckStatus === "ACKNOWLEDGED" ? 83 : 63,
    maturity: body.dpaStatus === "SIGNED" && body.purgeAckStatus === "ACKNOWLEDGED" ? 83 : 63,
    status: body.dpaStatus === "SIGNED" && body.purgeAckStatus === "ACKNOWLEDGED" ? "STRONG" : "REVIEWING",
    evidencePresent: workspace.processors.some((i) => i.dpaStatus === "SIGNED" && i.purgeAckStatus === "ACKNOWLEDGED"),
  });
  syncMetrics(workspace);
  return { ok: true, processor: proc };
}

/* ------------------------------------------------------------------ */
/*  Agentic AI handlers                                                */
/* ------------------------------------------------------------------ */

async function handleTriggerBreachAgent(state: AppState, tenantSlug: string, incidentId: string, env: Env, authHeader?: string) {
  const { user, workspace } = ensureTenantAccess(state, tenantSlug, authHeader);
  const incident = workspace.incidents.find((i) => i.id === incidentId);
  if (!incident) throw new HttpError(404, "Incident not found.");

  const actions = env.GROQ_API_KEY
    ? await generateBreachActionsWithGroq(incident, workspace, { apiKey: env.GROQ_API_KEY, model: env.GROQ_MODEL })
    : generateBreachActions(incident, workspace);
  workspace.agentActions = workspace.agentActions || [];
  workspace.agentActions = workspace.agentActions.filter(
    (a) => !(a.triggerId === incidentId && a.agentId === "breach-response" && a.state === "DRAFT"),
  );
  workspace.agentActions.unshift(...actions);
  appendAudit(workspace, user, "incidents", "BREACH_AGENT_TRIGGERED", incidentId, `Breach Response Agent drafted ${actions.length} actions for ${incidentId}.`);
  return { ok: true, actionsGenerated: actions.length, actions };
}

async function handleTriggerRightsAgent(state: AppState, tenantSlug: string, caseId: string, env: Env, authHeader?: string) {
  const { user, workspace } = ensureTenantAccess(state, tenantSlug, authHeader);
  const rightsCase = workspace.rightsCases.find((c) => c.id === caseId);
  if (!rightsCase) throw new HttpError(404, "Rights case not found.");

  const actions = env.GROQ_API_KEY
    ? await generateRightsActionsWithGroq(rightsCase, workspace, { apiKey: env.GROQ_API_KEY, model: env.GROQ_MODEL })
    : generateRightsActions(rightsCase, workspace);
  workspace.agentActions = workspace.agentActions || [];
  workspace.agentActions = workspace.agentActions.filter(
    (a) => !(a.triggerId === caseId && a.agentId === "rights-orchestrator" && a.state === "DRAFT"),
  );
  workspace.agentActions.unshift(...actions);
  appendAudit(workspace, user, "rights", "RIGHTS_AGENT_TRIGGERED", caseId, `Rights Orchestrator drafted ${actions.length} actions for ${caseId}.`);
  return { ok: true, actionsGenerated: actions.length, actions };
}

function handleReviewAgentAction(
  state: AppState,
  tenantSlug: string,
  actionId: string,
  body: { state: "REVIEWED" | "APPROVED" | "REJECTED"; editedBody?: string; approvalNote?: string },
  authHeader?: string,
) {
  const { user, workspace } = ensureTenantAccess(state, tenantSlug, authHeader);
  workspace.agentActions = workspace.agentActions || [];
  const action = workspace.agentActions.find((a) => a.id === actionId);
  if (!action) throw new HttpError(404, "Agent action not found.");

  if (body.state === "APPROVED" && action.category === "EXECUTE" && action.state !== "REVIEWED") {
    throw new HttpError(400, "EXECUTE actions must be reviewed before approval.");
  }

  action.state = body.state;
  action.reviewedAt = new Date().toISOString();
  action.reviewedBy = user.name;
  if (body.editedBody) action.editedBody = body.editedBody;
  if (body.approvalNote) action.approvalNote = body.approvalNote;

  const mod: ModuleId = action.agentId === "breach-response" ? "incidents" : "rights";
  appendAudit(workspace, user, mod, `AGENT_ACTION_${body.state}`, actionId,
    `${user.name} ${body.state.toLowerCase()} agent action "${action.label}" for ${action.triggerId}.`);
  return { ok: true, action };
}

function handleGetAgentActions(state: AppState, tenantSlug: string, authHeader?: string) {
  const { workspace } = ensureTenantAccess(state, tenantSlug, authHeader);
  workspace.agentActions = workspace.agentActions || [];
  return { actions: workspace.agentActions };
}

/* ------------------------------------------------------------------ */
/*  Evidence upload / download (DO-backed)                             */
/* ------------------------------------------------------------------ */

async function handleEvidenceUpload(
  state: AppState,
  runtime: ProoflytRuntime,
  tenantSlug: string,
  body: { linkedRecord: string; classification?: string; label?: string; fileName: string; contentType: string; sizeBytes: number },
  fileBytes: ArrayBuffer,
  authHeader?: string,
) {
  const { user, workspace } = ensureTenantAccess(state, tenantSlug, authHeader);
  const storageKey = `evidence-${tenantSlug}-${Date.now()}-${body.fileName.replace(/[^a-zA-Z0-9._-]+/g, "-")}`;

  await runtime.ctx.storage.put(storageKey, fileBytes);

  const artifact: EvidenceArtifact = {
    id: nextId("ev", workspace.evidence.length),
    label: body.label?.trim() || body.fileName,
    classification: (body.classification as EvidenceArtifact["classification"]) || "UPLOADED",
    linkedRecord: body.linkedRecord,
    createdAt: new Date().toISOString(),
    contentIndexed: false,
    fileName: body.fileName,
    contentType: body.contentType,
    sizeBytes: body.sizeBytes,
    storageKey,
  };

  workspace.evidence.unshift(artifact);
  appendAudit(workspace, user, "evidence", "EVIDENCE_UPLOADED", artifact.id, `Stored sealed evidence for ${artifact.linkedRecord}.`);
  updateObligation(workspace, "evidence", { evidencePresent: true, readiness: 74, maturity: 74, status: "UPDATING" });
  syncMetrics(workspace);
  return { ok: true, artifact };
}

async function handleEvidenceDownload(
  state: AppState,
  runtime: ProoflytRuntime,
  tenantSlug: string,
  evidenceId: string,
  authHeader?: string,
): Promise<Response> {
  const { workspace } = ensureTenantAccess(state, tenantSlug, authHeader);
  const artifact = workspace.evidence.find((e) => e.id === evidenceId);
  if (!artifact) throw new HttpError(404, "Evidence artifact not found.");
  if (!artifact.storageKey) throw new HttpError(400, "No downloadable file.");

  const bytes = await runtime.ctx.storage.get<ArrayBuffer>(artifact.storageKey);
  if (!bytes) throw new HttpError(404, "Evidence file not found in storage.");

  return new Response(bytes, {
    status: 200,
    headers: {
      "content-type": artifact.contentType || "application/octet-stream",
      "content-disposition": `attachment; filename="${artifact.fileName || evidenceId + ".bin"}"`,
    },
  });
}

/* ------------------------------------------------------------------ */
/*  Compliance Pack export                                             */
/* ------------------------------------------------------------------ */

function handleExportCompliancePack(state: AppState, tenantSlug: string, authHeader?: string) {
  const { workspace } = ensureTenantAccess(state, tenantSlug, authHeader);

  const summaryText = [
    `${workspace.tenant.name} Compliance Pack`,
    `Generated for tenant slug: ${tenantSlug}`,
    `Readiness score: ${workspace.metrics.readinessScore}%`,
    `Owner coverage: ${workspace.metrics.ownerCoverage}%`,
    `Evidence coverage: ${workspace.metrics.evidenceCoverage}%`,
    `Open gaps: ${workspace.metrics.openGaps}`,
    "",
    "Operational pressure",
    `Open rights cases: ${workspace.metrics.openRights}`,
    `Overdue deletion tasks: ${workspace.metrics.overdueDeletions}`,
    `Active incidents: ${workspace.metrics.activeIncidents}`,
    "",
    "Published notices",
    ...workspace.notices.map((n) => `${n.title} (${n.status}) - ${n.version}`),
    "",
    "Evidence boundary",
    "Evidence artifacts remain sealed and are exported through metadata manifests plus explicitly attached files only.",
  ].join("\n");

  const registerCsv = arrayToCsv([
    ["System", "Data category", "Purpose", "Legal basis", "Retention", "Lifecycle", "Completeness"],
    ...workspace.registerEntries.map((e) => [e.system, e.dataCategory, e.purpose, e.legalBasis, e.retentionLabel, e.lifecycle, e.completeness]),
  ]);

  const rightsCsv = arrayToCsv([
    ["ID", "Type", "Requestor", "Status", "SLA", "Evidence linked", "Deletion task"],
    ...workspace.rightsCases.map((c) => [c.id, c.type, c.requestor, c.status, c.sla, c.evidenceLinked, c.linkedDeletionTaskId || ""]),
  ]);

  const deletionCsv = arrayToCsv([
    ["ID", "Label", "System", "Due date", "Status", "Proof linked", "Processor acknowledged"],
    ...workspace.deletionTasks.map((t) => [t.id, t.label, t.system, t.dueDate, t.status, t.proofLinked, t.processorAcknowledged]),
  ]);

  const incidentCsv = arrayToCsv([
    ["ID", "Title", "Severity", "Status", "Board deadline", "Remediation owner", "Evidence linked"],
    ...workspace.incidents.map((i) => [i.id, i.title, i.severity, i.status, i.boardDeadline, i.remediationOwner, i.evidenceLinked]),
  ]);

  const processorCsv = arrayToCsv([
    ["ID", "Name", "Service", "DPA status", "Purge acknowledgement", "Sub-processor count"],
    ...workspace.processors.map((p) => [p.id, p.name, p.service, p.dpaStatus, p.purgeAckStatus, p.subProcessorCount]),
  ]);

  const evidenceManifest = JSON.stringify(
    workspace.evidence.map((a) => ({
      id: a.id, label: a.label, classification: a.classification, linkedRecord: a.linkedRecord,
      createdAt: a.createdAt, fileName: a.fileName || null, contentType: a.contentType || null, sizeBytes: a.sizeBytes || null,
    })),
    null, 2,
  );

  return {
    summary: summaryText,
    registerCsv,
    rightsCsv,
    deletionCsv,
    incidentCsv,
    processorCsv,
    evidenceManifest,
    noticeSnapshots: JSON.stringify(workspace.notices, null, 2),
  };
}

/* ------------------------------------------------------------------ */
/*  Public handlers                                                    */
/* ------------------------------------------------------------------ */

function handlePublicRights(state: AppState, tenantSlug: string): PublicRightsResponse {
  const workspace = ensureWorkspace(state, tenantSlug);
  return {
    tenant: workspace.tenant,
    notice: workspace.notices.find((n) => n.status === "PUBLISHED") || null,
    queueSummary: { openRights: workspace.metrics.openRights, overdueDeletions: workspace.metrics.overdueDeletions },
  };
}

function handlePublicNotice(state: AppState, tenantSlug: string): PublicNoticeResponse {
  const workspace = ensureWorkspace(state, tenantSlug);
  return { tenant: workspace.tenant, notice: workspace.notices.find((n) => n.status === "PUBLISHED") || null };
}

function handleSubmitPublicRight(
  state: AppState,
  tenantSlug: string,
  payload: { name: string; email: string; type: RightsCase["type"]; message: string },
) {
  const workspace = ensureWorkspace(state, tenantSlug);
  const rightsCase: RightsCase = {
    id: `RR-${new Date().getFullYear()}-${String(workspace.rightsCases.length + 17).padStart(3, "0")}`,
    type: payload.type,
    requestor: payload.email,
    status: "NEW",
    sla: "7 days remaining",
    evidenceLinked: false,
    linkedDeletionTaskId: payload.type === "DELETION" ? `DEL-${workspace.deletionTasks.length + 24}` : null,
  };

  workspace.rightsCases.unshift(rightsCase);
  workspace.metrics.openRights += 1;

  if (payload.type === "DELETION") {
    workspace.deletionTasks.unshift({
      id: rightsCase.linkedDeletionTaskId || `DEL-${Date.now()}`,
      label: `Deletion task for ${payload.email}`,
      system: "Manual downstream execution",
      dueDate: "2026-04-18",
      status: "OPEN",
      proofLinked: false,
      processorAcknowledged: false,
    });
    workspace.metrics.overdueDeletions += 1;
  }

  workspace.auditTrail.unshift({
    id: nextId("audit", workspace.auditTrail.length),
    createdAt: new Date().toISOString(),
    actor: payload.email,
    module: "rights",
    action: "PUBLIC_RIGHT_SUBMITTED",
    targetId: rightsCase.id,
    summary: `Submitted ${payload.type.toLowerCase()} request through the public rights page.`,
  });

  updateObligation(workspace, "rights", { readiness: 88, maturity: 88, status: "UPDATING", evidencePresent: true });
  updateObligation(workspace, "retention", { readiness: 56, maturity: 61, status: "REVIEWING" });
  syncMetrics(workspace);
  return { ok: true, rightsCase };
}

function handleAcknowledgeNotice(state: AppState, tenantSlug: string) {
  const workspace = ensureWorkspace(state, tenantSlug);
  const notice = workspace.notices.find((i) => i.status === "PUBLISHED");
  if (!notice) throw new HttpError(404, "Published notice not found.");
  notice.acknowledgements += 1;
  workspace.auditTrail.unshift({
    id: nextId("audit", workspace.auditTrail.length),
    createdAt: new Date().toISOString(),
    actor: "public-requestor",
    module: "notices",
    action: "NOTICE_ACKNOWLEDGED",
    targetId: notice.id,
    summary: `Recorded acknowledgment against ${notice.title}.`,
  });
  return { ok: true, acknowledgements: notice.acknowledgements };
}

/* ------------------------------------------------------------------ */
/*  Durable Object                                                     */
/* ------------------------------------------------------------------ */

export class ProoflytRuntime extends DurableObject {
  async getState() {
    let state = await this.ctx.storage.get<AppState>("state");
    if (!state) {
      state = createSeedState();
      await this.ctx.storage.put("state", state);
    }
    return state;
  }

  async putState(state: AppState) {
    await this.ctx.storage.put("state", state);
  }
}

async function withState<T>(env: Env, fn: (state: AppState) => Promise<T> | T) {
  const id = env.PROOFLYT_RUNTIME.idFromName("default");
  const stub = env.PROOFLYT_RUNTIME.get(id);
  const state = await stub.getState();
  const result = await fn(state);
  await stub.putState(state);
  return result;
}

async function withRuntime<T>(env: Env, fn: (state: AppState, runtime: ProoflytRuntime) => Promise<T> | T) {
  const id = env.PROOFLYT_RUNTIME.idFromName("default");
  const stub = env.PROOFLYT_RUNTIME.get(id);
  const state = await stub.getState();
  const result = await fn(state, stub);
  await stub.putState(state);
  return result;
}

/* ------------------------------------------------------------------ */
/*  Route matching helpers                                             */
/* ------------------------------------------------------------------ */

function match(pattern: string, pathname: string): Record<string, string> | null {
  const parts = pattern.split("/");
  const segments = pathname.split("/");
  if (parts.length !== segments.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].startsWith(":")) {
      params[parts[i].slice(1)] = segments[i];
    } else if (parts[i] !== segments[i]) {
      return null;
    }
  }
  return params;
}

/* ------------------------------------------------------------------ */
/*  Main fetch handler                                                 */
/* ------------------------------------------------------------------ */

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const auth = request.headers.get("authorization") || undefined;
    // L3: capture origin so json()/errorResponse() can echo a strict allow-list.
    _currentOrigin = request.headers.get("origin");

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeadersFor(_currentOrigin),
          "access-control-max-age": "86400",
        },
      });
    }

    try {
      /* ---------- Health ---------- */
      if (request.method === "GET" && pathname === "/api/health") {
        return json({
          ok: true,
          runtime: "cloudflare-worker",
          tenancy: "tenant-scoped-session",
          searchBoundary: "metadata-only",
          evidenceIndexing: false,
          smartMapping: { available: true, status: "ready" },
          persistence: { d1Bound: Boolean(env.PROOFLYT_DB), durableObjects: true },
        });
      }

      /* ---------- State Reset (demo only) ---------- */
      if (request.method === "POST" && pathname === "/api/admin/reset") {
        const id = env.PROOFLYT_RUNTIME.idFromName("default");
        const stub = env.PROOFLYT_RUNTIME.get(id);
        const fresh = createSeedState();
        await stub.putState(fresh);
        return json({ ok: true, message: "State reset to fresh seed." });
      }

      /* ---------- Auth ---------- */
      if (request.method === "POST" && pathname === "/api/auth/login") {
        const body = await parseBody<{ email: string; password: string }>(request);
        return json(await withState(env, (s) => handleLogin(s, body)));
      }
      if (request.method === "POST" && pathname === "/api/auth/logout") {
        return json(await withState(env, (s) => handleLogout(s, auth)));
      }
      if (request.method === "GET" && pathname === "/api/auth/refresh") {
        return json(await withState(env, (s) => handleRefresh(s, auth)));
      }
      if (request.method === "POST" && pathname === "/api/auth/invite/accept") {
        const body = await parseBody<{ token: string; password: string; name?: string }>(request);
        return json(await withState(env, (s) => handleAcceptInvite(s, body)));
      }
      if (request.method === "POST" && pathname === "/api/auth/password/request") {
        const body = await parseBody<{ email: string }>(request);
        return json(await withState(env, (s) => handleRequestReset(s, body)));
      }
      if (request.method === "POST" && pathname === "/api/auth/password/reset") {
        const body = await parseBody<{ token: string; password: string }>(request);
        return json(await withState(env, (s) => handleConfirmReset(s, body)));
      }

      /* ---------- Admin ---------- */
      if (request.method === "GET" && pathname === "/api/admin/bootstrap") {
        return json(await withState(env, (s) => handleAdminBootstrap(s, auth)));
      }
      {
        const p = match("/api/admin/tenants/:slug/status", pathname);
        if (request.method === "POST" && p) {
          const body = await parseBody<{ active?: boolean; status?: string }>(request);
          const active = typeof body.active === "boolean" ? body.active : body.status === "ACTIVE";
          return json(await withState(env, (s) => handleAdminTenantStatus(s, p.slug, active, auth)));
        }
      }
      if (request.method === "POST" && pathname === "/api/admin/tenants") {
        const body = await parseBody<{ name: string; slug: string; industry: string; descriptor?: string }>(request);
        return json(await withState(env, (s) => handleAdminCreateTenant(s, body, auth)), 201);
      }
      if (request.method === "GET" && pathname === "/api/admin/dpdp-library") {
        return json(await withState(env, (s) => handleAdminDpdpLibrary(s, auth)));
      }
      if (request.method === "GET" && pathname === "/api/admin/audit-log") {
        return json(await withState(env, (s) => handleAdminAuditLog(s, auth)));
      }

      /* ---------- Portal bootstrap / module snapshot ---------- */
      {
        const p = match("/api/portal/:slug/bootstrap", pathname);
        if (request.method === "GET" && p) {
          return json(await withState(env, (s) => handlePortalBootstrap(s, p.slug, auth)));
        }
      }
      {
        const p = match("/api/portal/:slug/module/:moduleId", pathname);
        if (request.method === "GET" && p) {
          return json(await withState(env, (s) => handleModuleSnapshot(s, p.slug, p.moduleId as ModuleId, auth)));
        }
      }

      /* ---------- Setup mutations ---------- */
      {
        const p = match("/api/portal/:slug/setup/profile", pathname);
        if (request.method === "POST" && p) {
          const body = await parseBody<any>(request);
          return json(await withState(env, (s) => handleUpdateProfile(s, p.slug, body, auth)));
        }
      }
      {
        const p = match("/api/portal/:slug/setup/departments", pathname);
        if (request.method === "POST" && p) {
          const body = await parseBody<any>(request);
          return json(await withState(env, (s) => handleAddDepartment(s, p.slug, body, auth)));
        }
      }
      {
        const p = match("/api/portal/:slug/setup/source-systems", pathname);
        if (request.method === "POST" && p) {
          const body = await parseBody<any>(request);
          return json(await withState(env, (s) => handleAddSourceSystem(s, p.slug, body, auth)));
        }
      }
      {
        const p = match("/api/portal/:slug/setup/invite", pathname);
        if (request.method === "POST" && p) {
          const body = await parseBody<any>(request);
          return json(await withState(env, (s) => handleInviteUser(s, p.slug, body, auth)));
        }
      }

      /* ---------- Sources ---------- */
      {
        const p = match("/api/portal/:slug/sources/profile", pathname);
        if (request.method === "POST" && p) {
          const body = await parseBody<any>(request);
          return json(await withState(env, (s) => handleSourceProfile(s, p.slug, body, auth)));
        }
      }
      {
        const p = match("/api/portal/:slug/sources/upload", pathname);
        if (request.method === "POST" && p) {
          const formData = await request.formData();
          const file = formData.get("file") as File | null;
          const mode = String(formData.get("mode") || "MASKED_SAMPLE") as any;
          if (!file) throw new HttpError(400, "File is required.");

          // Parse headers from CSV or XLSX
          let headers: string[];
          const fileName = file.name.toLowerCase();
          if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
            const buf = await file.arrayBuffer();
            const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
            headers = (rows[0] || []).map((h: any) => String(h).trim());
          } else {
            const text = await file.text();
            const firstLine = text.split("\n")[0] || "";
            headers = firstLine.split(",").map((h: string) => h.trim().replace(/^["']|["']$/g, ""));
          }

          return json(await withState(env, (s) => handleSourceUpload(s, p.slug, headers, file.name, mode, auth)));
        }
      }
      {
        const p = match("/api/portal/:slug/sources/:sourceId/approve", pathname);
        if (request.method === "POST" && p) {
          return json(await withState(env, (s) => handleApproveSource(s, p.slug, p.sourceId, auth)));
        }
      }

      /* ---------- Register ---------- */
      {
        const p = match("/api/portal/:slug/register/:entryId/lifecycle", pathname);
        if (request.method === "POST" && p) {
          const body = await parseBody<{ lifecycle: RegisterEntry["lifecycle"] }>(request);
          return json(await withState(env, (s) => handleRegisterLifecycle(s, p.slug, p.entryId, body.lifecycle, auth)));
        }
      }
      {
        const p = match("/api/portal/:slug/register/:entryId/status", pathname);
        if (request.method === "POST" && p) {
          const body = await parseBody<{ lifecycle?: RegisterEntry["lifecycle"]; status?: string }>(request);
          const lifecycle = body.lifecycle || (body.status as RegisterEntry["lifecycle"]) || "IN_REVIEW";
          return json(await withState(env, (s) => handleRegisterLifecycle(s, p.slug, p.entryId, lifecycle, auth)));
        }
      }

      /* ---------- Notices ---------- */
      {
        const p = match("/api/portal/:slug/notices/:noticeId/status", pathname);
        if (request.method === "POST" && p) {
          const body = await parseBody<{ status: Notice["status"] }>(request);
          return json(await withState(env, (s) => handleNoticeStatus(s, p.slug, p.noticeId, body.status, auth)));
        }
      }
      {
        const p = match("/api/portal/:slug/notices/:noticeId/update", pathname);
        if (request.method === "POST" && p) {
          const body = await parseBody<{ title?: string; content?: string; audience?: string; status?: Notice["status"] }>(request);
          return json(await withState(env, (s) => handleNoticeUpdate(s, p.slug, p.noticeId, body, auth)));
        }
      }
      {
        const p = match("/api/portal/:slug/notices", pathname);
        if (request.method === "POST" && p) {
          const body = await parseBody<{ title: string; content: string; audience: string }>(request);
          return json(await withState(env, (s) => handleNoticeCreate(s, p.slug, body, auth)), 201);
        }
      }
      // DPDP Rule 3 gap analysis — runs against any notice in the workspace.
      {
        const p = match("/api/portal/:slug/notices/:noticeId/analyze", pathname);
        if (request.method === "POST" && p) {
          return json(
            await withState(env, async (s) => {
              const { workspace } = ensureTenantAccess(s, p.slug, auth);
              const notice = workspace.notices.find((n) => n.id === p.noticeId);
              if (!notice) throw new HttpError(404, "Notice not found.");
              const report = analyzeNoticeAgainstRule3(notice.content);
              const drafts = await draftMissingItems(report, workspace.tenant.name, env);
              return { notice: { id: notice.id, title: notice.title, version: notice.version }, report, drafts };
            }),
          );
        }
      }

      /* ---------- Rights ---------- */
      {
        const p = match("/api/portal/:slug/rights/:caseId/update", pathname);
        if (request.method === "POST" && p) {
          const body = await parseBody<any>(request);
          return json(await withState(env, (s) => handleRightsUpdate(s, p.slug, p.caseId, body, auth)));
        }
      }
      {
        const p = match("/api/portal/:slug/rights/:caseId/status", pathname);
        if (request.method === "POST" && p) {
          const body = await parseBody<any>(request);
          return json(await withState(env, (s) => handleRightsUpdate(s, p.slug, p.caseId, body, auth)));
        }
      }

      /* ---------- Retention ---------- */
      {
        const p = match("/api/portal/:slug/retention/:taskId/update", pathname);
        if (request.method === "POST" && p) {
          const body = await parseBody<any>(request);
          return json(await withState(env, (s) => handleDeletionUpdate(s, p.slug, p.taskId, body, auth)));
        }
      }
      {
        const p = match("/api/portal/:slug/retention/:taskId/status", pathname);
        if (request.method === "POST" && p) {
          const body = await parseBody<any>(request);
          return json(await withState(env, (s) => handleDeletionUpdate(s, p.slug, p.taskId, body, auth)));
        }
      }

      /* ---------- Incidents ---------- */
      {
        const p = match("/api/portal/:slug/incidents/:incidentId/update", pathname);
        if (request.method === "POST" && p) {
          const body = await parseBody<any>(request);
          return json(await withState(env, (s) => handleIncidentUpdate(s, p.slug, p.incidentId, body, auth)));
        }
      }
      {
        const p = match("/api/portal/:slug/incidents/:incidentId/status", pathname);
        if (request.method === "POST" && p) {
          const body = await parseBody<any>(request);
          return json(await withState(env, (s) => handleIncidentUpdate(s, p.slug, p.incidentId, body, auth)));
        }
      }

      /* ---------- Processors ---------- */
      {
        const p = match("/api/portal/:slug/processors/:processorId/update", pathname);
        if (request.method === "POST" && p) {
          const body = await parseBody<any>(request);
          return json(await withState(env, (s) => handleProcessorUpdate(s, p.slug, p.processorId, body, auth)));
        }
      }
      {
        const p = match("/api/portal/:slug/processors/:processorId/status", pathname);
        if (request.method === "POST" && p) {
          const body = await parseBody<any>(request);
          return json(await withState(env, (s) => handleProcessorUpdate(s, p.slug, p.processorId, body, auth)));
        }
      }

      /* ---------- Agentic AI ---------- */
      {
        const p = match("/api/portal/:slug/agents/breach/:incidentId/trigger", pathname);
        if (request.method === "POST" && p) {
          return json(await withState(env, (s) => handleTriggerBreachAgent(s, p.slug, p.incidentId, env, auth)));
        }
      }
      {
        const p = match("/api/portal/:slug/agents/rights/:caseId/trigger", pathname);
        if (request.method === "POST" && p) {
          return json(await withState(env, (s) => handleTriggerRightsAgent(s, p.slug, p.caseId, env, auth)));
        }
      }
      {
        const p = match("/api/portal/:slug/agents/actions/:actionId/review", pathname);
        if (request.method === "POST" && p) {
          const body = await parseBody<any>(request);
          return json(await withState(env, (s) => handleReviewAgentAction(s, p.slug, p.actionId, body, auth)));
        }
      }
      {
        const p = match("/api/portal/:slug/agents/actions", pathname);
        if (request.method === "GET" && p) {
          return json(await withState(env, (s) => handleGetAgentActions(s, p.slug, auth)));
        }
      }

      /* ---------- Evidence ---------- */
      {
        const p = match("/api/portal/:slug/evidence/upload", pathname);
        if (request.method === "POST" && p) {
          const formData = await request.formData();
          const file = formData.get("file") as File | null;
          if (!file) throw new HttpError(400, "File is required.");
          const fileBytes = await file.arrayBuffer();
          const meta = {
            linkedRecord: String(formData.get("linkedRecord") || ""),
            classification: String(formData.get("classification") || "UPLOADED"),
            label: String(formData.get("label") || ""),
            fileName: file.name,
            contentType: file.type || "application/octet-stream",
            sizeBytes: file.size,
          };
          return json(await withRuntime(env, (s, rt) => handleEvidenceUpload(s, rt, p.slug, meta, fileBytes, auth)));
        }
      }
      {
        const p = match("/api/portal/:slug/evidence/:evidenceId/download", pathname);
        if (request.method === "GET" && p) {
          return await withRuntime(env, (s, rt) => handleEvidenceDownload(s, rt, p.slug, p.evidenceId, auth));
        }
      }

      /* ---------- Export ---------- */
      {
        const p = match("/api/portal/:slug/export/compliance-pack", pathname);
        if (request.method === "GET" && p) {
          const pack = await withState(env, (s) => handleExportCompliancePack(s, p.slug, auth));
          const boundary = "----CompliancePackBoundary";
          const parts = [
            `--${boundary}\r\nContent-Disposition: attachment; filename="00-summary.txt"\r\nContent-Type: text/plain\r\n\r\n${pack.summary}`,
            `--${boundary}\r\nContent-Disposition: attachment; filename="data-register.csv"\r\nContent-Type: text/csv\r\n\r\n${pack.registerCsv}`,
            `--${boundary}\r\nContent-Disposition: attachment; filename="rights-cases.csv"\r\nContent-Type: text/csv\r\n\r\n${pack.rightsCsv}`,
            `--${boundary}\r\nContent-Disposition: attachment; filename="deletion-log.csv"\r\nContent-Type: text/csv\r\n\r\n${pack.deletionCsv}`,
            `--${boundary}\r\nContent-Disposition: attachment; filename="incident-register.csv"\r\nContent-Type: text/csv\r\n\r\n${pack.incidentCsv}`,
            `--${boundary}\r\nContent-Disposition: attachment; filename="processor-list.csv"\r\nContent-Type: text/csv\r\n\r\n${pack.processorCsv}`,
            `--${boundary}\r\nContent-Disposition: attachment; filename="notice-snapshots.json"\r\nContent-Type: application/json\r\n\r\n${pack.noticeSnapshots}`,
            `--${boundary}\r\nContent-Disposition: attachment; filename="evidence-manifest.json"\r\nContent-Type: application/json\r\n\r\n${pack.evidenceManifest}`,
            `--${boundary}--`,
          ].join("\r\n");

          return new Response(parts, {
            status: 200,
            headers: {
              "content-type": `multipart/mixed; boundary=${boundary}`,
              "content-disposition": `attachment; filename="${p.slug}-compliance-pack"`,
            },
          });
        }
      }

      /* ---------- Connectors ---------- */
      {
        const p = match("/api/portal/:slug/connectors/bootstrap", pathname);
        if (request.method === "GET" && p) {
          return json(
            await withState(env, (s) => {
              const { user, workspace } = ensureTenantAccess(s, p.slug, auth);
              requireConnectorRole(user); // C4
              return handleConnectorBootstrap(workspace);
            }),
          );
        }
      }
      {
        const p = match("/api/portal/:slug/connectors/oauth/start", pathname);
        if (request.method === "POST" && p) {
          const body = await parseBody<{ type: unknown }>(request);
          if (typeof body.type !== "string" || !(body.type in CONNECTOR_DEFINITIONS)) {
            throw new ValidationError("Unknown connector type."); // H3
          }
          const type = body.type as ConnectorType;
          return json(
            await withState(env, (s) => {
              const { user, workspace } = ensureTenantAccess(s, p.slug, auth);
              requireConnectorRole(user); // C4
              const nonce = mintOAuthState(workspace, type); // C1: persist nonce server-side
              const url = buildAuthorizeUrl(type, env, nonce);
              return { authorizeUrl: url, state: nonce };
            }),
          );
        }
      }
      if (request.method === "POST" && pathname === "/api/connectors/oauth/callback") {
        const body = await parseBody<{ code: unknown; state: unknown }>(request);
        if (typeof body.code !== "string" || typeof body.state !== "string") {
          throw new ValidationError("Missing OAuth code or state.");
        }
        // Two-phase: (1) consume nonce from state (read-and-validate),
        // (2) call vendor token endpoint outside the DO write,
        // (3) write the connection in a second state pass.
        const lookup = await withState(env, (s) => {
          // Locate the workspace whose nonce store contains this state.
          for (const slug of Object.keys(s.workspaces)) {
            const ws = ensureWorkspace(s, slug);
            try {
              const r = consumeOAuthState(ws, body.state as string); // C1
              return { ...r, slug };
            } catch { /* not in this workspace, try next */ }
          }
          throw new HttpError(401, "OAuth state is missing, expired, or already consumed.");
        });
        // H4: type is now from the server-persisted record, not the URL.
        const tokenResp = await exchangeOAuthCode(lookup.type, body.code, env);
        return json(
          await withState(env, async (s) => {
            const { user, workspace } = ensureTenantAccess(s, lookup.tenantSlug, auth);
            requireConnectorRole(user); // C4
            const conn = await createOAuthConnection(workspace, lookup.type, tokenResp, env, user);
            return publicConnection(conn);
          }),
          201,
        );
      }
      {
        const p = match("/api/portal/:slug/connectors/api-key", pathname);
        if (request.method === "POST" && p) {
          const raw = await parseBody<any>(request);
          // H3: runtime validation. Throws ValidationError → mapped to 400.
          const { type, clean } = validateApiKeyConnectorPayload(raw?.type, raw);
          return json(
            await withState(env, async (s) => {
              const { user, workspace } = ensureTenantAccess(s, p.slug, auth);
              requireConnectorRole(user); // C4
              const conn = await createApiKeyConnection(workspace, type, clean, env, user);
              return publicConnection(conn);
            }),
            201,
          );
        }
      }
      {
        const p = match("/api/portal/:slug/connectors/:connectionId/discover", pathname);
        if (request.method === "POST" && p) {
          return json(
            await withState(env, (s) => {
              const { user, workspace } = ensureTenantAccess(s, p.slug, auth);
              requireConnectorRole(user); // C4
              const conn = workspace.connections.find((c) => c.id === p.connectionId);
              if (!conn) throw new HttpError(404, "Connection not found.");
              return performDiscovery(workspace, conn, user);
            }),
          );
        }
      }
      {
        const p = match("/api/portal/:slug/connectors/:connectionId/dsr", pathname);
        if (request.method === "POST" && p) {
          const body = await parseBody<{
            rightsCaseId?: unknown;
            action?: unknown;
            subjectIdentifier?: unknown;
          }>(request);
          // H3: validate inputs at the route boundary.
          const rightsCaseId = typeof body.rightsCaseId === "string" ? body.rightsCaseId.trim() : "";
          const action = body.action === "EXPORT" || body.action === "ERASE" ? body.action : null;
          const subjectIdentifier = typeof body.subjectIdentifier === "string" ? body.subjectIdentifier.trim() : "";
          if (!rightsCaseId || !action || !subjectIdentifier || subjectIdentifier.length > 320) {
            throw new ValidationError("Invalid DSR request body.");
          }
          return json(
            await withState(env, (s) => {
              const { user, workspace } = ensureTenantAccess(s, p.slug, auth);
              requireConnectorRole(user); // C4
              const conn = workspace.connections.find((c) => c.id === p.connectionId);
              if (!conn) throw new HttpError(404, "Connection not found.");
              const rightsCase = workspace.rightsCases.find((r) => r.id === rightsCaseId);
              if (!rightsCase) throw new HttpError(404, "Rights case not found.");
              return performDsr(workspace, conn, rightsCase, action, subjectIdentifier, user);
            }),
          );
        }
      }
      {
        const p = match("/api/portal/:slug/connectors/:connectionId/revoke", pathname);
        if (request.method === "POST" && p) {
          return json(
            await withState(env, (s) => {
              const { user, workspace } = ensureTenantAccess(s, p.slug, auth);
              requireConnectorRole(user); // C4
              revokeConnection(workspace, p.connectionId, user);
              return { ok: true };
            }),
          );
        }
      }
      // Public webhook ingress — verified by HMAC, not by session.
      {
        const p = match("/api/connectors/webhook/:type/:slug/:connectionId", pathname);
        if (request.method === "POST" && p) {
          const rawBody = await request.text();
          if (rawBody.length > 256 * 1024) { // DoS guard: 256 KiB cap
            throw new ValidationError("Webhook body exceeds 256 KiB.");
          }
          const sigHeader =
            request.headers.get("x-razorpay-signature") ||
            request.headers.get("x-shopify-hmac-sha256") ||
            request.headers.get("x-hubspot-signature-v3") ||
            request.headers.get("x-freshdesk-signature") ||
            request.headers.get("x-prooflyt-signature");
          const type = String(p.type || "").toUpperCase() as ConnectorType;
          if (!CONNECTOR_DEFINITIONS[type]) return json({ error: "Unknown connector" }, 400);

          // H5: master secret must be configured for any signed webhook flow.
          if (!env.CONNECTORS_MASTER_SECRET) {
            console.error("[webhook] CONNECTORS_MASTER_SECRET is missing; rejecting.");
            throw new HttpError(500, "Webhook ingress not configured.");
          }

          return json(
            await withState(env, async (s) => {
              const workspace = ensureWorkspace(s, p.slug);
              const conn = workspace.connections.find((c) => c.id === p.connectionId);
              if (!conn) throw new HttpError(404, "Connection not found.");
              // C3: fail-closed if no webhook secret has been registered.
              if (!conn.encryptedWebhookSecret) {
                throw new HttpError(401, "Connection has no webhook secret registered.");
              }
              const { openSecret } = await import("./connectors.js");
              const secret = await openSecret(conn.encryptedWebhookSecret, env.CONNECTORS_MASTER_SECRET!);
              const ok = await verifyWebhookSignature(type, rawBody, sigHeader, secret);
              if (!ok) throw new HttpError(401, "Webhook signature mismatch.");
              let parsed: unknown;
              try {
                parsed = JSON.parse(rawBody || "{}");
              } catch {
                throw new ValidationError("Webhook body is not valid JSON.");
              }
              const result = ingestWebhook(workspace, conn, { type, body: parsed });
              return { ok: true, eventId: result.event.id, rightsCaseId: result.createdRights?.id };
            }),
          );
        }
      }

      /* ---------- Public ---------- */
      {
        const p = match("/api/public/:slug/rights", pathname);
        if (p && request.method === "GET") {
          return json(await withState(env, (s) => handlePublicRights(s, p.slug)));
        }
        if (p && request.method === "POST") {
          const body = await parseBody<any>(request);
          const verified = await verifyTurnstile(env, body.turnstileToken || null);
          if (!verified) return json({ error: "Turnstile verification failed." }, 403);
          return json(await withState(env, (s) => handleSubmitPublicRight(s, p.slug, body)), 201);
        }
      }
      {
        const p = match("/api/public/:slug/notice", pathname);
        if (p && request.method === "GET") {
          return json(await withState(env, (s) => handlePublicNotice(s, p.slug)));
        }
      }
      {
        const p = match("/api/public/:slug/notice/acknowledge", pathname);
        if (p && request.method === "POST") {
          const body = await parseBody<{ turnstileToken?: string }>(request);
          const verified = await verifyTurnstile(env, body.turnstileToken || null);
          if (!verified) return json({ error: "Turnstile verification failed." }, 403);
          return json(await withState(env, (s) => handleAcknowledgeNotice(s, p.slug)), 201);
        }
      }

      return json({ error: "Not found" }, 404);
    } catch (error) {
      return errorResponse(error);
    }
  },
};
