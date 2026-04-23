import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { MODULE_ACCESS } from "@prooflyt/domain";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import JSZip from "jszip";
import PDFDocument from "pdfkit";
import * as XLSX from "xlsx";
import { generateBreachActions, generateRightsActions, generateBreachActionsWithGroq, generateRightsActionsWithGroq } from "@prooflyt/agents";
import { MappingService } from "../ai/mapping.service.js";
import type {
  AuditEvent,
  ModuleId,
  PasswordReset,
  Processor,
  Role,
  RightsCase,
  SessionRecord,
  SourceFieldProfile,
  SourceProfileRequest,
  SmartMappingMode,
  TenantWorkspace,
  User,
} from "../domain/types.js";
import { RuntimeStore } from "./runtime-store.js";

function csvEscape(value: unknown) {
  const stringValue = String(value ?? "");
  if (/[,"\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function arrayToCsv(rows: unknown[][]) {
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

function safeName(input: string) {
  return input.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

@Injectable()
export class AppDataService {
  private readonly store = new RuntimeStore();

  constructor(@Inject(MappingService) private readonly mappingService: MappingService) {}

  private get state() {
    return this.store.getState();
  }

  private persist() {
    this.store.save(this.state);
  }

  private sanitizeUser(user: User) {
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

  private sanitizeWorkspace(workspace: TenantWorkspace) {
    this.ensureWorkspaceShape(workspace);
    return {
      ...workspace,
      team: workspace.team.map((user) => this.sanitizeUser(user)),
    };
  }

  private ensureWorkspaceShape(workspace: TenantWorkspace) {
    workspace.auditTrail = workspace.auditTrail || [];
    workspace.agentActions = workspace.agentActions || [];
    workspace.departments = workspace.departments || [];
    workspace.sourceSystems = workspace.sourceSystems || [];
    workspace.sources = workspace.sources.map((source) => ({
      pushedToRegister: false,
      linkedRegisterEntryIds: [],
      ...source,
    }));
    const seenRegisterIds = new Set<string>();
    workspace.registerEntries = workspace.registerEntries.filter((entry) => {
      if (seenRegisterIds.has(entry.id)) {
        return false;
      }
      seenRegisterIds.add(entry.id);
      return true;
    });
    workspace.sources.forEach((source) => {
      source.linkedRegisterEntryIds = Array.from(new Set(source.linkedRegisterEntryIds || []));
    });
    return workspace;
  }

  private ensureWorkspace(tenantSlug: string) {
    const workspace = this.state.workspaces[tenantSlug];
    if (!workspace) {
      throw new NotFoundException("Tenant workspace not found.");
    }
    return this.ensureWorkspaceShape(workspace);
  }

  private ensureTenantAccess(tenantSlug: string, authHeader?: string) {
    const { user } = this.requireSession(authHeader);
    if (user.tenantSlug !== tenantSlug && !user.internalAdmin) {
      throw new ForbiddenException("Tenant-scoped access only.");
    }
    return {
      user,
      workspace: this.ensureWorkspace(tenantSlug),
    };
  }

  private nextId(prefix: string, currentSize: number) {
    return `${prefix}-${Date.now()}-${currentSize + 1}`;
  }

  private appendAudit(
    workspace: TenantWorkspace,
    actor: User,
    module: ModuleId,
    action: string,
    targetId: string,
    summary: string,
  ) {
    const event: AuditEvent = {
      id: this.nextId("audit", workspace.auditTrail.length),
      createdAt: new Date().toISOString(),
      actor: actor.name,
      module,
      action,
      targetId,
      summary,
    };
    workspace.auditTrail.unshift(event);
  }

  private syncMetrics(workspace: TenantWorkspace) {
    workspace.metrics.openRights = workspace.rightsCases.filter((item) => item.status !== "CLOSED").length;
    workspace.metrics.overdueDeletions = workspace.deletionTasks.filter((item) => item.status !== "CLOSED").length;
    workspace.metrics.activeIncidents = workspace.incidents.filter((item) => item.status !== "CLOSED").length;
    workspace.metrics.openGaps = Math.max(
      workspace.sourceProfiles.filter((profile) => profile.requiresReview).length,
      workspace.obligations.filter((obligation) => obligation.status === "NEEDS_ACTION").length,
    );
    const evidenceBearingRecords = workspace.rightsCases.filter((item) => item.evidenceLinked).length
      + workspace.deletionTasks.filter((item) => item.proofLinked).length
      + workspace.incidents.filter((item) => item.evidenceLinked).length
      + workspace.notices.filter((item) => item.status === "PUBLISHED").length;
    workspace.metrics.evidenceCoverage = Math.min(100, 45 + evidenceBearingRecords * 3);
    const approvedRegisterEntries = workspace.registerEntries.filter((item) => item.lifecycle === "APPROVED").length;
    workspace.metrics.readinessScore = Math.min(
      100,
      Math.round(
        workspace.metrics.ownerCoverage * 0.24
          + workspace.metrics.evidenceCoverage * 0.26
          + approvedRegisterEntries * 6
          + workspace.notices.filter((item) => item.status === "PUBLISHED").length * 8
          - workspace.metrics.openRights * 2
          - workspace.metrics.overdueDeletions * 3
          - workspace.metrics.activeIncidents * 2,
      ),
    );
  }

  private updateObligation(workspace: TenantWorkspace, module: ModuleId, fields: Partial<TenantWorkspace["obligations"][number]>) {
    workspace.obligations = workspace.obligations.map((obligation) =>
      obligation.module === module ? { ...obligation, ...fields } : obligation,
    );
  }

  private updateTenantRecord(tenantSlug: string, updater: (tenant: TenantWorkspace["tenant"]) => void) {
    const tenant = this.state.tenants.find((entry) => entry.slug === tenantSlug);
    if (tenant) {
      updater(tenant as TenantWorkspace["tenant"]);
    }
    const workspace = this.state.workspaces[tenantSlug];
    if (workspace) {
      updater(workspace.tenant);
    }
  }

  private workbookHeaders(fileName: string, buffer: Buffer) {
    const workbook = XLSX.read(buffer, { type: "buffer", dense: true });
    if (!workbook.SheetNames.length) {
      throw new BadRequestException("Workbook did not contain any sheets.");
    }

    const firstSheetName = workbook.SheetNames[0];
    const firstSheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    });

    const firstFilledRow = rows.find((row) => Array.isArray(row) && row.some((cell) => String(cell ?? "").trim().length > 0));
    if (!firstFilledRow || !Array.isArray(firstFilledRow)) {
      throw new BadRequestException(`Could not detect a header row in ${fileName}.`);
    }

    const headers = firstFilledRow.map((cell, index) => {
      const value = String(cell ?? "").trim();
      return value || `unnamed_column_${index + 1}`;
    });

    return {
      headers,
      sheetName: firstSheetName,
      workbookWarnings: workbook.SheetNames.length > 1 ? [`Multiple sheets detected; using ${firstSheetName} for profiling.`] : [],
    };
  }

  private async createSummaryPdf(tenantSlug: string, workspace: TenantWorkspace) {
    return new Promise<Buffer>((resolve, reject) => {
      const document = new PDFDocument({ margin: 48 });
      const chunks: Buffer[] = [];

      document.on("data", (chunk: Buffer) => chunks.push(chunk));
      document.on("end", () => resolve(Buffer.concat(chunks)));
      document.on("error", reject);

      document.fontSize(22).text(`${workspace.tenant.name} Compliance Pack`, { underline: true });
      document.moveDown(0.5);
      document.fontSize(11).text(`Generated for tenant slug: ${tenantSlug}`);
      document.text(`Readiness score: ${workspace.metrics.readinessScore}%`);
      document.text(`Owner coverage: ${workspace.metrics.ownerCoverage}%`);
      document.text(`Evidence coverage: ${workspace.metrics.evidenceCoverage}%`);
      document.text(`Open gaps: ${workspace.metrics.openGaps}`);
      document.moveDown();
      document.fontSize(15).text("Operational pressure");
      document.fontSize(11).text(`Open rights cases: ${workspace.metrics.openRights}`);
      document.text(`Overdue deletion tasks: ${workspace.metrics.overdueDeletions}`);
      document.text(`Active incidents: ${workspace.metrics.activeIncidents}`);
      document.moveDown();
      document.fontSize(15).text("Published notices");
      workspace.notices.forEach((notice) => {
        document.fontSize(11).text(`${notice.title} (${notice.status}) - ${notice.version}`);
      });
      document.moveDown();
      document.fontSize(15).text("Evidence boundary");
      document.fontSize(11).text(
        "Evidence artifacts remain sealed and are exported through metadata manifests plus explicitly attached files only.",
      );
      document.end();
    });
  }

  getHealth() {
    const mappingStatus = this.mappingService.getStatus();
    return {
      ok: true,
      runtime: "persistent-runtime",
      tenancy: "tenant-scoped-session",
      searchBoundary: "metadata-only",
      evidenceIndexing: false,
      smartMapping: {
        available: mappingStatus.configured,
        status: mappingStatus.configured ? "ready" : "unavailable",
      },
    };
  }

  login(email: string, password: string) {
    const user = this.state.users.find((candidate) => candidate.email.toLowerCase() === email.toLowerCase());
    if (!user || user.password !== password) {
      throw new UnauthorizedException("Invalid credentials.");
    }

    const session: SessionRecord = {
      token: `session-${user.id}-${Date.now()}`,
      userId: user.id,
      tenantSlug: user.tenantSlug,
      createdAt: new Date().toISOString(),
    };

    this.state.sessions.push(session);
    this.persist();

    return {
      session,
      user: this.sanitizeUser(user),
      tenant: user.tenantSlug ? this.state.workspaces[user.tenantSlug]?.tenant : null,
    };
  }

  logout(token: string) {
    const idx = this.state.sessions.findIndex((session) => session.token === token);
    if (idx >= 0) {
      this.state.sessions.splice(idx, 1);
      this.persist();
    }
    return { ok: true };
  }

  refresh(token: string) {
    const session = this.state.sessions.find((item) => item.token === token);
    if (!session) throw new UnauthorizedException("Unknown session.");
    const user = this.state.users.find((item) => item.id === session.userId);
    if (!user) throw new UnauthorizedException("Session user no longer exists.");
    return {
      session,
      user: this.sanitizeUser(user),
      tenant: session.tenantSlug ? this.state.workspaces[session.tenantSlug].tenant : null,
    };
  }

  acceptInvite(token: string, password: string, name?: string) {
    const invite = this.state.invites.find((entry) => entry.token === token);
    if (!invite) throw new NotFoundException("Invite not found.");
    const existing = this.state.users.find((user) => user.email === invite.email);
    if (existing) throw new BadRequestException("Invite already claimed.");

    const user: User = {
      id: `user-${Date.now()}`,
      tenantSlug: invite.tenantSlug,
      email: invite.email,
      name: name || invite.email.split("@")[0],
      password,
      roles: invite.roles,
      title: invite.title,
    };
    this.state.users.push(user);
    this.ensureWorkspace(invite.tenantSlug).team.push(user);
    this.persist();

    return this.login(user.email, password);
  }

  requestReset(email: string) {
    const user = this.state.users.find((entry) => entry.email.toLowerCase() === email.toLowerCase());
    const token = user ? `reset-${user.id}` : "noop";
    if (user && !this.state.resets.find((reset) => reset.email === user.email)) {
      this.state.resets.push({ token, email: user.email });
      this.persist();
    }
    return { ok: true, token: user ? token : null };
  }

  confirmReset(token: string, password: string) {
    const reset = this.state.resets.find((item) => item.token === token);
    if (!reset) throw new NotFoundException("Reset token not found.");
    const user = this.state.users.find((entry) => entry.email === reset.email);
    if (!user) throw new NotFoundException("User not found.");
    user.password = password;
    this.persist();
    return { ok: true };
  }

  requireSession(authHeader?: string) {
    const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
    if (!token) throw new UnauthorizedException("Missing bearer token.");
    const session = this.state.sessions.find((item) => item.token === token);
    if (!session) throw new UnauthorizedException("Unknown session.");
    const user = this.state.users.find((item) => item.id === session.userId);
    if (!user) throw new UnauthorizedException("Session user no longer exists.");
    return { session, user };
  }

  getAdminBootstrap(authHeader?: string) {
    const { user } = this.requireSession(authHeader);
    if (!user.internalAdmin) throw new ForbiddenException("Internal admin access required.");

    return {
      operator: this.sanitizeUser(user),
      tenants: this.state.tenants.map((tenant) => ({
        ...tenant,
        metrics: this.state.workspaces[tenant.slug].metrics,
        teamCount: this.state.workspaces[tenant.slug].team.length,
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

  updateTenantProfile(
    tenantSlug: string,
    body: {
      descriptor: string;
      operationalStory: string;
      publicDomain: string;
      primaryColor: string;
      accentColor: string;
    },
    authHeader?: string,
  ) {
    const { user, workspace } = this.ensureTenantAccess(tenantSlug, authHeader);
    this.updateTenantRecord(tenantSlug, (tenant) => {
      tenant.descriptor = body.descriptor.trim() || tenant.descriptor;
      tenant.operationalStory = body.operationalStory.trim() || tenant.operationalStory;
      tenant.publicBrand.publicDomain = body.publicDomain.trim() || tenant.publicBrand.publicDomain;
      tenant.publicBrand.primaryColor = body.primaryColor.trim() || tenant.publicBrand.primaryColor;
      tenant.publicBrand.accentColor = body.accentColor.trim() || tenant.publicBrand.accentColor;
    });

    this.appendAudit(
      workspace,
      user,
      "setup",
      "TENANT_PROFILE_UPDATED",
      workspace.tenant.id,
      `Updated tenant profile for ${workspace.tenant.name}.`,
    );
    this.updateObligation(workspace, "setup", { status: "STRONG", readiness: 100, maturity: 100, ownerPresent: true });
    this.persist();

    return { ok: true, tenant: workspace.tenant };
  }

  addDepartment(
    tenantSlug: string,
    body: { name: string; ownerTitle: string; obligationFocus: string },
    authHeader?: string,
  ) {
    const { user, workspace } = this.ensureTenantAccess(tenantSlug, authHeader);
    if (!body.name.trim()) {
      throw new BadRequestException("Department name is required.");
    }

    const department = {
      id: this.nextId("dept", workspace.departments.length),
      name: body.name.trim(),
      ownerTitle: body.ownerTitle.trim() || "Owner pending",
      obligationFocus: body.obligationFocus.trim() || "Operational ownership to be assigned",
    };

    workspace.departments.unshift(department);
    this.appendAudit(workspace, user, "setup", "DEPARTMENT_ADDED", department.id, `Added department ${department.name}.`);
    this.persist();
    return { ok: true, department };
  }

  addSourceSystem(
    tenantSlug: string,
    body: { name: string; systemType: string; owner: string; status: "LIVE" | "REVIEW" | "PLANNED" },
    authHeader?: string,
  ) {
    const { user, workspace } = this.ensureTenantAccess(tenantSlug, authHeader);
    if (!body.name.trim()) {
      throw new BadRequestException("Source system name is required.");
    }

    const sourceSystem = {
      id: this.nextId("system", workspace.sourceSystems.length),
      name: body.name.trim(),
      systemType: body.systemType.trim() || "Unclassified",
      owner: body.owner.trim() || "Unassigned",
      status: body.status || "PLANNED",
    };

    workspace.sourceSystems.unshift(sourceSystem);
    this.appendAudit(workspace, user, "setup", "SOURCE_SYSTEM_ADDED", sourceSystem.id, `Added source system ${sourceSystem.name}.`);
    this.persist();
    return { ok: true, sourceSystem };
  }

  inviteTenantUser(
    tenantSlug: string,
    body: { email: string; role: Role; title: string },
    authHeader?: string,
  ) {
    const { user, workspace } = this.ensureTenantAccess(tenantSlug, authHeader);
    const email = body.email.trim().toLowerCase();
    if (!email) {
      throw new BadRequestException("Invite email is required.");
    }
    if (this.state.users.some((candidate) => candidate.email.toLowerCase() === email) || this.state.invites.some((invite) => invite.email.toLowerCase() === email)) {
      throw new BadRequestException("A user or invite already exists for that email.");
    }

    const invite = {
      token: `invite-${tenantSlug}-${Date.now()}`,
      email,
      tenantSlug,
      roles: [body.role],
      title: body.title.trim() || "Assigned during invite",
    };

    this.state.invites.unshift(invite);
    this.appendAudit(workspace, user, "setup", "INVITE_CREATED", invite.token, `Created invite for ${invite.email}.`);
    this.persist();
    return { ok: true, invite };
  }

  setTenantActive(tenantSlug: string, active: boolean, authHeader?: string) {
    const { user } = this.requireSession(authHeader);
    if (!user.internalAdmin) {
      throw new ForbiddenException("Internal admin access required.");
    }

    const tenant = this.state.tenants.find((entry) => entry.slug === tenantSlug);
    if (!tenant) {
      throw new NotFoundException("Tenant not found.");
    }

    const workspace = this.ensureWorkspace(tenantSlug);
    this.updateTenantRecord(tenantSlug, (record) => {
      record.active = active;
    });
    this.appendAudit(
      workspace,
      user,
      "setup",
      active ? "TENANT_ACTIVATED" : "TENANT_DEACTIVATED",
      tenant.id,
      `${active ? "Activated" : "Deactivated"} tenant ${tenant.name}.`,
    );
    this.persist();
    return { ok: true, tenant: workspace.tenant };
  }

  getPortalBootstrap(tenantSlug: string, authHeader?: string) {
    const { user, workspace } = this.ensureTenantAccess(tenantSlug, authHeader);
    return {
      workspace: this.sanitizeWorkspace(workspace),
      operator: this.sanitizeUser(user),
      moduleAccess: Object.fromEntries(
        Object.entries(MODULE_ACCESS).map(([moduleId, roles]) => [moduleId, roles.some((role) => user.roles.includes(role))]),
      ),
    };
  }

  getModuleSnapshot(tenantSlug: string, moduleId: ModuleId, authHeader?: string) {
    const { user, workspace } = this.ensureTenantAccess(tenantSlug, authHeader);
    if (!MODULE_ACCESS[moduleId].some((role) => user.roles.includes(role))) {
      throw new ForbiddenException("Role cannot access requested module.");
    }

    return {
      moduleId,
      workspace: this.sanitizeWorkspace(workspace),
    };
  }

  approveSourceToRegister(tenantSlug: string, sourceId: string, authHeader?: string) {
    const { user, workspace } = this.ensureTenantAccess(tenantSlug, authHeader);
    const source = workspace.sources.find((entry) => entry.id === sourceId);
    if (!source) throw new NotFoundException("Source not found.");

    source.status = "APPROVED";
    source.approvedFields = source.fields;
    source.pushedToRegister = true;

    const groupedProfiles = workspace.sourceProfiles.filter((profile) => profile.sourceId === sourceId);
    const selectedProfiles = groupedProfiles
      .slice()
      .sort((left, right) => right.confidence - left.confidence)
      .slice(0, Math.min(2, groupedProfiles.length));
    const createdEntries: TenantWorkspace["registerEntries"] = selectedProfiles.map((profile, index) => ({
      id: this.nextId("reg", workspace.registerEntries.length + index),
      system: source.name,
      dataCategory: profile.mappedCategory,
      purpose: profile.purpose,
      legalBasis: profile.legalBasis,
      retentionLabel: profile.retentionLabel,
      linkedNoticeId: workspace.notices.find((notice) => notice.status === "PUBLISHED")?.id || null,
      linkedProcessorIds: workspace.processors.slice(0, 1).map((processor) => processor.id),
      lifecycle: "IN_REVIEW" as const,
      sourceTrace: `${source.fileName} / approved mapping`,
      completeness: profile.requiresReview ? "PARTIAL" : "COMPLETE",
    }));

    source.linkedRegisterEntryIds = createdEntries.map((entry) => entry.id);
    workspace.registerEntries = [...createdEntries, ...workspace.registerEntries];
    groupedProfiles.forEach((profile) => {
      profile.requiresReview = false;
      profile.warnings = [];
      profile.confidence = Math.max(profile.confidence, 0.88);
    });
    this.appendAudit(
      workspace,
      user,
      "sources",
      "SOURCE_APPROVED_TO_REGISTER",
      sourceId,
      `Approved ${source.name} and pushed ${createdEntries.length} register entries into review.`,
    );
    this.updateObligation(workspace, "sources", { readiness: 82, maturity: 82, status: "STRONG", evidencePresent: true });
    this.updateObligation(workspace, "register", { readiness: 74, maturity: 74, status: "UPDATING" });
    this.syncMetrics(workspace);
    this.persist();
    return { ok: true, source, createdEntries };
  }

  updateRegisterLifecycle(
    tenantSlug: string,
    entryId: string,
    lifecycle: TenantWorkspace["registerEntries"][number]["lifecycle"],
    authHeader?: string,
  ) {
    const { user, workspace } = this.ensureTenantAccess(tenantSlug, authHeader);
    const entry = workspace.registerEntries.find((item) => item.id === entryId);
    if (!entry) throw new NotFoundException("Register entry not found.");
    entry.lifecycle = lifecycle;
    entry.completeness = lifecycle === "APPROVED" ? "COMPLETE" : entry.completeness;
    this.appendAudit(workspace, user, "register", "REGISTER_LIFECYCLE_UPDATED", entryId, `Moved ${entry.system} to ${lifecycle}.`);
    this.updateObligation(workspace, "register", {
      readiness: lifecycle === "APPROVED" ? 81 : 72,
      maturity: lifecycle === "APPROVED" ? 81 : 72,
      status: lifecycle === "APPROVED" ? "STRONG" : "UPDATING",
    });
    this.syncMetrics(workspace);
    this.persist();
    return { ok: true, entry };
  }

  updateNoticeStatus(
    tenantSlug: string,
    noticeId: string,
    status: TenantWorkspace["notices"][number]["status"],
    authHeader?: string,
  ) {
    const { user, workspace } = this.ensureTenantAccess(tenantSlug, authHeader);
    const notice = workspace.notices.find((item) => item.id === noticeId);
    if (!notice) throw new NotFoundException("Notice not found.");
    notice.status = status;
    if (status === "PUBLISHED") {
      notice.publishedAt = new Date().toISOString();
      workspace.notices.forEach((entry) => {
        if (entry.id !== noticeId && entry.audience === notice.audience && entry.status === "PUBLISHED") {
          entry.status = "RETIRED";
        }
      });
    }
    this.appendAudit(workspace, user, "notices", "NOTICE_STATUS_UPDATED", noticeId, `Moved ${notice.title} to ${status}.`);
    this.updateObligation(workspace, "notices", {
      readiness: status === "PUBLISHED" ? 88 : 72,
      maturity: status === "PUBLISHED" ? 88 : 72,
      status: status === "PUBLISHED" ? "STRONG" : "UPDATING",
      evidencePresent: status === "PUBLISHED",
    });
    this.syncMetrics(workspace);
    this.persist();
    return { ok: true, notice };
  }

  updateRightsCase(
    tenantSlug: string,
    caseId: string,
    body: { status: RightsCase["status"]; evidenceLinked?: boolean; refusalNote?: string },
    authHeader?: string,
  ) {
    const { user, workspace } = this.ensureTenantAccess(tenantSlug, authHeader);
    const rightsCase = workspace.rightsCases.find((item) => item.id === caseId);
    if (!rightsCase) throw new NotFoundException("Rights case not found.");
    const refusalNote = body.refusalNote?.trim();
    if (body.status === "CLOSED" && !body.evidenceLinked && !refusalNote) {
      throw new BadRequestException("Closing a rights case requires evidence or a documented refusal.");
    }
    rightsCase.status = body.status;
    rightsCase.evidenceLinked = Boolean(body.evidenceLinked);
    rightsCase.sla = body.status === "CLOSED" ? "Closed" : rightsCase.sla;
    this.appendAudit(
      workspace,
      user,
      "rights",
      "RIGHTS_CASE_UPDATED",
      caseId,
      refusalNote
        ? `Closed ${caseId} with documented refusal: ${refusalNote}`
        : `Moved ${caseId} to ${body.status}${body.evidenceLinked ? " with evidence linked" : ""}.`,
    );
    this.updateObligation(workspace, "rights", {
      readiness: body.status === "CLOSED" ? 92 : 86,
      maturity: body.status === "CLOSED" ? 92 : 86,
      status: body.status === "CLOSED" ? "STRONG" : "UPDATING",
      evidencePresent: workspace.rightsCases.some((item) => item.evidenceLinked || item.status === "CLOSED"),
    });
    this.syncMetrics(workspace);
    this.persist();
    return { ok: true, rightsCase };
  }

  updateDeletionTask(
    tenantSlug: string,
    taskId: string,
    body: {
      status: TenantWorkspace["deletionTasks"][number]["status"];
      proofLinked?: boolean;
      processorAcknowledged?: boolean;
      exceptionNote?: string;
    },
    authHeader?: string,
  ) {
    const { user, workspace } = this.ensureTenantAccess(tenantSlug, authHeader);
    const task = workspace.deletionTasks.find((item) => item.id === taskId);
    if (!task) throw new NotFoundException("Deletion task not found.");
    const exceptionNote = body.exceptionNote?.trim();
    if (body.status === "CLOSED" && !body.proofLinked) {
      throw new BadRequestException("Deletion task cannot close without linked proof.");
    }
    if (body.status === "CLOSED" && !body.processorAcknowledged && !exceptionNote) {
      throw new BadRequestException("Deletion task cannot close without processor acknowledgement unless an exception is recorded.");
    }
    task.status = body.status;
    task.proofLinked = Boolean(body.proofLinked);
    task.processorAcknowledged = Boolean(body.processorAcknowledged);
    this.appendAudit(
      workspace,
      user,
      "retention",
      "DELETION_TASK_UPDATED",
      taskId,
      exceptionNote
        ? `Closed ${task.label} with exception note: ${exceptionNote}`
        : `Moved ${task.label} to ${body.status}.`,
    );
    this.updateObligation(workspace, "retention", {
      readiness: task.status === "CLOSED" ? 78 : 62,
      maturity: task.status === "CLOSED" ? 78 : 62,
      status: task.status === "CLOSED" ? "STRONG" : "REVIEWING",
      evidencePresent: workspace.deletionTasks.some((item) => item.proofLinked),
    });
    this.syncMetrics(workspace);
    this.persist();
    return { ok: true, task };
  }

  updateIncident(
    tenantSlug: string,
    incidentId: string,
    body: { status: TenantWorkspace["incidents"][number]["status"]; evidenceLinked?: boolean; remediationOwner?: string },
    authHeader?: string,
  ) {
    const { user, workspace } = this.ensureTenantAccess(tenantSlug, authHeader);
    const incident = workspace.incidents.find((item) => item.id === incidentId);
    if (!incident) throw new NotFoundException("Incident not found.");
    incident.status = body.status;
    incident.evidenceLinked = Boolean(body.evidenceLinked);
    incident.remediationOwner = body.remediationOwner?.trim() || incident.remediationOwner;
    this.appendAudit(workspace, user, "incidents", "INCIDENT_UPDATED", incidentId, `Moved ${incident.title} to ${body.status}.`);
    this.updateObligation(workspace, "incidents", {
      readiness: body.status === "CLOSED" ? 85 : 74,
      maturity: body.status === "CLOSED" ? 85 : 74,
      status: body.status === "CLOSED" ? "STRONG" : "REVIEWING",
      evidencePresent: workspace.incidents.some((item) => item.evidenceLinked),
    });
    this.syncMetrics(workspace);
    this.persist();
    return { ok: true, incident };
  }

  updateProcessor(
    tenantSlug: string,
    processorId: string,
    body: { dpaStatus: Processor["dpaStatus"]; purgeAckStatus: Processor["purgeAckStatus"] },
    authHeader?: string,
  ) {
    const { user, workspace } = this.ensureTenantAccess(tenantSlug, authHeader);
    const processor = workspace.processors.find((item) => item.id === processorId);
    if (!processor) throw new NotFoundException("Processor not found.");
    processor.dpaStatus = body.dpaStatus;
    processor.purgeAckStatus = body.purgeAckStatus;
    this.appendAudit(
      workspace,
      user,
      "processors",
      "PROCESSOR_UPDATED",
      processorId,
      `Updated ${processor.name}: DPA ${body.dpaStatus}, purge ${body.purgeAckStatus}.`,
    );
    this.updateObligation(workspace, "processors", {
      readiness: body.dpaStatus === "SIGNED" && body.purgeAckStatus === "ACKNOWLEDGED" ? 83 : 63,
      maturity: body.dpaStatus === "SIGNED" && body.purgeAckStatus === "ACKNOWLEDGED" ? 83 : 63,
      status: body.dpaStatus === "SIGNED" && body.purgeAckStatus === "ACKNOWLEDGED" ? "STRONG" : "REVIEWING",
      evidencePresent: workspace.processors.some(
        (item) => item.dpaStatus === "SIGNED" && item.purgeAckStatus === "ACKNOWLEDGED",
      ),
    });
    this.syncMetrics(workspace);
    this.persist();
    return { ok: true, processor };
  }

  /* ── Agentic AI ────────────────────────────────────────────── */

  async triggerBreachAgent(tenantSlug: string, incidentId: string, authHeader?: string) {
    const { user, workspace } = this.ensureTenantAccess(tenantSlug, authHeader);
    const incident = workspace.incidents.find((item) => item.id === incidentId);
    if (!incident) throw new NotFoundException("Incident not found.");

    const groqKey = process.env.GROQ_API_KEY;
    const actions = groqKey
      ? await generateBreachActionsWithGroq(incident, workspace, { apiKey: groqKey, model: process.env.GROQ_MODEL })
      : generateBreachActions(incident, workspace);

    workspace.agentActions = workspace.agentActions || [];
    // Remove old drafts for same trigger (re-trigger replaces)
    workspace.agentActions = workspace.agentActions.filter(
      (a) => !(a.triggerId === incidentId && a.agentId === "breach-response" && a.state === "DRAFT"),
    );
    workspace.agentActions.unshift(...actions);
    this.appendAudit(workspace, user, "incidents", "BREACH_AGENT_TRIGGERED", incidentId, `Breach Response Agent drafted ${actions.length} actions for ${incidentId}.`);
    this.persist();
    return { ok: true, actionsGenerated: actions.length, actions };
  }

  async triggerRightsAgent(tenantSlug: string, caseId: string, authHeader?: string) {
    const { user, workspace } = this.ensureTenantAccess(tenantSlug, authHeader);
    const rightsCase = workspace.rightsCases.find((item) => item.id === caseId);
    if (!rightsCase) throw new NotFoundException("Rights case not found.");

    const groqKey = process.env.GROQ_API_KEY;
    const actions = groqKey
      ? await generateRightsActionsWithGroq(rightsCase, workspace, { apiKey: groqKey, model: process.env.GROQ_MODEL })
      : generateRightsActions(rightsCase, workspace);

    workspace.agentActions = workspace.agentActions || [];
    workspace.agentActions = workspace.agentActions.filter(
      (a) => !(a.triggerId === caseId && a.agentId === "rights-orchestrator" && a.state === "DRAFT"),
    );
    workspace.agentActions.unshift(...actions);
    this.appendAudit(workspace, user, "rights", "RIGHTS_AGENT_TRIGGERED", caseId, `Rights Orchestrator drafted ${actions.length} actions for ${caseId}.`);
    this.persist();
    return { ok: true, actionsGenerated: actions.length, actions };
  }

  reviewAgentAction(
    tenantSlug: string,
    actionId: string,
    body: { state: "REVIEWED" | "APPROVED" | "REJECTED"; editedBody?: string; approvalNote?: string },
    authHeader?: string,
  ) {
    const { user, workspace } = this.ensureTenantAccess(tenantSlug, authHeader);
    workspace.agentActions = workspace.agentActions || [];
    const action = workspace.agentActions.find((a) => a.id === actionId);
    if (!action) throw new NotFoundException("Agent action not found.");

    if (body.state === "APPROVED" && action.category === "EXECUTE" && action.state !== "REVIEWED") {
      throw new BadRequestException("EXECUTE actions must be reviewed before approval.");
    }

    action.state = body.state;
    action.reviewedAt = new Date().toISOString();
    action.reviewedBy = user.name;
    if (body.editedBody) action.editedBody = body.editedBody;
    if (body.approvalNote) action.approvalNote = body.approvalNote;

    const module: ModuleId = action.agentId === "breach-response" ? "incidents" : "rights";
    this.appendAudit(
      workspace,
      user,
      module,
      `AGENT_ACTION_${body.state}`,
      actionId,
      `${user.name} ${body.state.toLowerCase()} agent action "${action.label}" for ${action.triggerId}.`,
    );
    this.persist();
    return { ok: true, action };
  }

  getAgentActions(tenantSlug: string, authHeader?: string) {
    const { workspace } = this.ensureTenantAccess(tenantSlug, authHeader);
    workspace.agentActions = workspace.agentActions || [];
    return { actions: workspace.agentActions };
  }

  async profileSource(tenantSlug: string, request: SourceProfileRequest, authHeader?: string) {
    this.ensureTenantAccess(tenantSlug, authHeader);
    const result = await this.mappingService.profileSource(request);
    return {
      fileName: request.fileName,
      mode: request.mode,
      warnings: [
        request.headers.length > 180 ? "Wide file detected; review will be split into batches." : null,
        request.headers.some((header) => !header.trim()) ? "Missing headers were converted into unnamed columns." : null,
      ].filter(Boolean),
      profiles: result.profiles,
      rawPersistence: "purged_after_profiling",
    };
  }

  async uploadSource(
    tenantSlug: string,
    file: Express.Multer.File,
    mode: SmartMappingMode,
    authHeader?: string,
  ) {
    const { workspace, user } = this.ensureTenantAccess(tenantSlug, authHeader);
    const { headers, sheetName, workbookWarnings } = this.workbookHeaders(file.originalname, file.buffer);
    const result = await this.mappingService.profileSource({
      fileName: file.originalname,
      mode,
      headers,
    });

    const sourceId = this.nextId("src", workspace.sources.length);
    const now = new Date().toISOString();
    const warnings = [...workbookWarnings];
    const profiles: SourceFieldProfile[] = result.profiles.map((profile, index) => ({
      ...profile,
      id: `${sourceId}-profile-${index + 1}`,
      sourceId,
    }));

    workspace.sources.unshift({
      id: sourceId,
      name: file.originalname.replace(extname(file.originalname), "").replace(/[_-]+/g, " "),
      fileName: file.originalname,
      profileMode: mode,
      status: "IN_REVIEW",
      fields: profiles.length,
      approvedFields: 0,
      warnings,
      uploadedAt: now,
      sheetName,
      pushedToRegister: false,
      linkedRegisterEntryIds: [],
    });
    workspace.sourceProfiles = [...profiles, ...workspace.sourceProfiles];
    this.appendAudit(workspace, user, "sources", "SOURCE_UPLOADED", sourceId, `Uploaded ${file.originalname} for ${mode} profiling.`);
    this.updateObligation(workspace, "sources", { readiness: 67, maturity: 67, status: "UPDATING", evidencePresent: false });
    this.syncMetrics(workspace);
    this.persist();

    return {
      source: workspace.sources[0],
      warnings,
      profiles,
      rawPersistence: "purged_after_profiling",
    };
  }

  async uploadEvidence(
    tenantSlug: string,
    body: { linkedRecord: string; classification?: "SYSTEM_DERIVED" | "UPLOADED" | "ATTESTATION"; label?: string },
    file: Express.Multer.File,
    authHeader?: string,
  ) {
    const { workspace, user } = this.ensureTenantAccess(tenantSlug, authHeader);
    const directory = join(this.store.getEvidenceRoot(), tenantSlug);
    await mkdir(directory, { recursive: true });

    const storageKey = join(directory, `${Date.now()}-${safeName(file.originalname)}`);
    await writeFile(storageKey, file.buffer);

    const artifact = {
      id: this.nextId("ev", workspace.evidence.length),
      label: body.label?.trim() || file.originalname,
      classification: body.classification || "UPLOADED",
      linkedRecord: body.linkedRecord,
      createdAt: new Date().toISOString(),
      contentIndexed: false as const,
      fileName: file.originalname,
      contentType: file.mimetype,
      sizeBytes: file.size,
      storageKey,
    };

    workspace.evidence.unshift(artifact);
    this.appendAudit(workspace, user, "evidence", "EVIDENCE_UPLOADED", artifact.id, `Stored sealed evidence for ${artifact.linkedRecord}.`);
    this.updateObligation(workspace, "evidence", { evidencePresent: true, readiness: 74, maturity: 74, status: "UPDATING" });
    this.syncMetrics(workspace);
    this.persist();

    return {
      ok: true,
      artifact,
    };
  }

  async downloadEvidence(tenantSlug: string, evidenceId: string, authHeader?: string) {
    const { workspace } = this.ensureTenantAccess(tenantSlug, authHeader);
    const artifact = workspace.evidence.find((entry) => entry.id === evidenceId);
    if (!artifact) {
      throw new NotFoundException("Evidence artifact not found.");
    }
    if (!artifact.storageKey) {
      throw new BadRequestException("This evidence artifact does not have a downloadable file.");
    }

    const buffer = await readFile(artifact.storageKey);
    return {
      fileName: artifact.fileName || `${evidenceId}.bin`,
      contentType: artifact.contentType || "application/octet-stream",
      buffer,
    };
  }

  getPublicRightsPage(tenantSlug: string) {
    const workspace = this.ensureWorkspace(tenantSlug);
    return {
      tenant: workspace.tenant,
      notice: workspace.notices.find((notice) => notice.status === "PUBLISHED") || null,
      queueSummary: {
        openRights: workspace.metrics.openRights,
        overdueDeletions: workspace.metrics.overdueDeletions,
      },
    };
  }

  submitPublicRight(
    tenantSlug: string,
    payload: { name: string; email: string; type: RightsCase["type"]; message: string },
  ) {
    const workspace = this.ensureWorkspace(tenantSlug);

    const rightsCase = {
      id: `RR-${new Date().getFullYear()}-${String(workspace.rightsCases.length + 17).padStart(3, "0")}`,
      type: payload.type,
      requestor: payload.email,
      status: "NEW" as const,
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
      id: this.nextId("audit", workspace.auditTrail.length),
      createdAt: new Date().toISOString(),
      actor: payload.email,
      module: "rights",
      action: "PUBLIC_RIGHT_SUBMITTED",
      targetId: rightsCase.id,
      summary: `Submitted ${payload.type.toLowerCase()} request through the public rights page.`,
    });
    this.updateObligation(workspace, "rights", { readiness: 88, maturity: 88, status: "UPDATING", evidencePresent: true });
    this.updateObligation(workspace, "retention", { readiness: 56, maturity: 61, status: "REVIEWING" });
    this.syncMetrics(workspace);
    this.persist();

    return { ok: true, rightsCase };
  }

  getPublicNoticePage(tenantSlug: string) {
    const workspace = this.ensureWorkspace(tenantSlug);
    return {
      tenant: workspace.tenant,
      notice: workspace.notices.find((notice) => notice.status === "PUBLISHED") || null,
    };
  }

  acknowledgeNotice(tenantSlug: string) {
    const workspace = this.ensureWorkspace(tenantSlug);
    const notice = workspace.notices.find((entry) => entry.status === "PUBLISHED");
    if (!notice) throw new NotFoundException("Published notice not found.");
    notice.acknowledgements += 1;
    workspace.auditTrail.unshift({
      id: this.nextId("audit", workspace.auditTrail.length),
      createdAt: new Date().toISOString(),
      actor: "public-requestor",
      module: "notices",
      action: "NOTICE_ACKNOWLEDGED",
      targetId: notice.id,
      summary: `Recorded acknowledgment against ${notice.title}.`,
    });
    this.persist();
    return { ok: true, acknowledgements: notice.acknowledgements };
  }

  async exportCompliancePack(tenantSlug: string, authHeader?: string) {
    const { workspace } = this.ensureTenantAccess(tenantSlug, authHeader);
    const zip = new JSZip();

    const summaryPdf = await this.createSummaryPdf(tenantSlug, workspace);
    zip.file("00-summary.pdf", summaryPdf);

    zip.file(
      "data-register.csv",
      arrayToCsv([
        ["System", "Data category", "Purpose", "Legal basis", "Retention", "Lifecycle", "Completeness"],
        ...workspace.registerEntries.map((entry) => [
          entry.system,
          entry.dataCategory,
          entry.purpose,
          entry.legalBasis,
          entry.retentionLabel,
          entry.lifecycle,
          entry.completeness,
        ]),
      ]),
    );

    zip.file(
      "rights-cases.csv",
      arrayToCsv([
        ["ID", "Type", "Requestor", "Status", "SLA", "Evidence linked", "Deletion task"],
        ...workspace.rightsCases.map((caseItem) => [
          caseItem.id,
          caseItem.type,
          caseItem.requestor,
          caseItem.status,
          caseItem.sla,
          caseItem.evidenceLinked,
          caseItem.linkedDeletionTaskId || "",
        ]),
      ]),
    );

    zip.file(
      "deletion-log.csv",
      arrayToCsv([
        ["ID", "Label", "System", "Due date", "Status", "Proof linked", "Processor acknowledged"],
        ...workspace.deletionTasks.map((task) => [
          task.id,
          task.label,
          task.system,
          task.dueDate,
          task.status,
          task.proofLinked,
          task.processorAcknowledged,
        ]),
      ]),
    );

    zip.file(
      "incident-register.csv",
      arrayToCsv([
        ["ID", "Title", "Severity", "Status", "Board deadline", "Remediation owner", "Evidence linked"],
        ...workspace.incidents.map((incident) => [
          incident.id,
          incident.title,
          incident.severity,
          incident.status,
          incident.boardDeadline,
          incident.remediationOwner,
          incident.evidenceLinked,
        ]),
      ]),
    );

    zip.file(
      "processor-list.csv",
      arrayToCsv([
        ["ID", "Name", "Service", "DPA status", "Purge acknowledgement", "Sub-processor count"],
        ...workspace.processors.map((processor) => [
          processor.id,
          processor.name,
          processor.service,
          processor.dpaStatus,
          processor.purgeAckStatus,
          processor.subProcessorCount,
        ]),
      ]),
    );

    zip.file("notice-snapshots.json", JSON.stringify(workspace.notices, null, 2));
    zip.file(
      "evidence-manifest.json",
      JSON.stringify(
        workspace.evidence.map((artifact) => ({
          id: artifact.id,
          label: artifact.label,
          classification: artifact.classification,
          linkedRecord: artifact.linkedRecord,
          createdAt: artifact.createdAt,
          fileName: artifact.fileName || null,
          contentType: artifact.contentType || null,
          sizeBytes: artifact.sizeBytes || null,
        })),
        null,
        2,
      ),
    );

    for (const artifact of workspace.evidence) {
      if (!artifact.storageKey || !artifact.fileName) continue;
      try {
        const buffer = await readFile(artifact.storageKey);
        zip.file(`evidence/${artifact.fileName}`, buffer);
      } catch {
        // Skip missing artifacts while keeping the manifest authoritative.
      }
    }

    return {
      fileName: `${tenantSlug}-compliance-pack.zip`,
      contentType: "application/zip",
      buffer: await zip.generateAsync({ type: "nodebuffer" }),
    };
  }
}
