import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { memoryStorage } from "multer";
import { AppDataService } from "../data/app-data.service.js";
import type { ModuleId, SmartMappingMode } from "../domain/types.js";

@Controller("api/portal/:tenantSlug")
export class PortalController {
  constructor(@Inject(AppDataService) private readonly data: AppDataService) {}

  @Get("bootstrap")
  bootstrap(@Param("tenantSlug") tenantSlug: string, @Headers("authorization") authHeader?: string) {
    return this.data.getPortalBootstrap(tenantSlug, authHeader);
  }

  @Get("module/:moduleId")
  module(
    @Param("tenantSlug") tenantSlug: string,
    @Param("moduleId") moduleId: ModuleId,
    @Headers("authorization") authHeader?: string,
  ) {
    return this.data.getModuleSnapshot(tenantSlug, moduleId, authHeader);
  }

  @Post("sources/profile")
  async profileSource(
    @Param("tenantSlug") tenantSlug: string,
    @Headers("authorization") authHeader: string | undefined,
    @Body() body: { fileName: string; mode: SmartMappingMode; headers: string[] },
  ) {
    return this.data.profileSource(tenantSlug, body, authHeader);
  }

  @Post("setup/profile")
  updateTenantProfile(
    @Param("tenantSlug") tenantSlug: string,
    @Headers("authorization") authHeader: string | undefined,
    @Body()
    body: {
      descriptor: string;
      operationalStory: string;
      publicDomain: string;
      primaryColor: string;
      accentColor: string;
    },
  ) {
    return this.data.updateTenantProfile(tenantSlug, body, authHeader);
  }

  @Post("setup/departments")
  addDepartment(
    @Param("tenantSlug") tenantSlug: string,
    @Headers("authorization") authHeader: string | undefined,
    @Body() body: { name: string; ownerTitle: string; obligationFocus: string },
  ) {
    return this.data.addDepartment(tenantSlug, body, authHeader);
  }

  @Post("setup/source-systems")
  addSourceSystem(
    @Param("tenantSlug") tenantSlug: string,
    @Headers("authorization") authHeader: string | undefined,
    @Body() body: { name: string; systemType: string; owner: string; status: "LIVE" | "REVIEW" | "PLANNED" },
  ) {
    return this.data.addSourceSystem(tenantSlug, body, authHeader);
  }

  @Post("setup/invite")
  inviteTenantUser(
    @Param("tenantSlug") tenantSlug: string,
    @Headers("authorization") authHeader: string | undefined,
    @Body() body: { email: string; role: "TENANT_ADMIN" | "COMPLIANCE_MANAGER" | "DEPARTMENT_OWNER" | "REVIEWER" | "CASE_HANDLER" | "SECURITY_OWNER" | "AUDITOR"; title: string },
  ) {
    return this.data.inviteTenantUser(tenantSlug, body, authHeader);
  }

  @Post("sources/upload")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  async uploadSource(
    @Param("tenantSlug") tenantSlug: string,
    @Headers("authorization") authHeader: string | undefined,
    @Body() body: { mode?: SmartMappingMode },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException("Source upload requires a file.");
    }
    const mode = body.mode || "MASKED_SAMPLE";
    return this.data.uploadSource(tenantSlug, file, mode, authHeader);
  }

  @Post("sources/:sourceId/approve")
  approveSource(
    @Param("tenantSlug") tenantSlug: string,
    @Param("sourceId") sourceId: string,
    @Headers("authorization") authHeader: string | undefined,
  ) {
    return this.data.approveSourceToRegister(tenantSlug, sourceId, authHeader);
  }

  @Post("register/:entryId/lifecycle")
  updateRegisterLifecycle(
    @Param("tenantSlug") tenantSlug: string,
    @Param("entryId") entryId: string,
    @Headers("authorization") authHeader: string | undefined,
    @Body() body: { lifecycle: "DRAFT" | "IN_REVIEW" | "APPROVED" | "ARCHIVED" },
  ) {
    return this.data.updateRegisterLifecycle(tenantSlug, entryId, body.lifecycle, authHeader);
  }

  @Post("notices/:noticeId/status")
  updateNoticeStatus(
    @Param("tenantSlug") tenantSlug: string,
    @Param("noticeId") noticeId: string,
    @Headers("authorization") authHeader: string | undefined,
    @Body() body: { status: "DRAFT" | "IN_REVIEW" | "APPROVED" | "PUBLISHED" | "RETIRED" },
  ) {
    return this.data.updateNoticeStatus(tenantSlug, noticeId, body.status, authHeader);
  }

  @Post("rights/:caseId/update")
  updateRightsCase(
    @Param("tenantSlug") tenantSlug: string,
    @Param("caseId") caseId: string,
    @Headers("authorization") authHeader: string | undefined,
    @Body() body: { status: "NEW" | "IN_PROGRESS" | "AWAITING_PROOF" | "CLOSED"; evidenceLinked?: boolean; refusalNote?: string },
  ) {
    return this.data.updateRightsCase(tenantSlug, caseId, body, authHeader);
  }

  @Post("retention/:taskId/update")
  updateDeletionTask(
    @Param("tenantSlug") tenantSlug: string,
    @Param("taskId") taskId: string,
    @Headers("authorization") authHeader: string | undefined,
    @Body()
    body: {
      status: "OPEN" | "LEGAL_HOLD" | "AWAITING_PROCESSOR" | "READY_FOR_PROOF" | "CLOSED";
      proofLinked?: boolean;
      processorAcknowledged?: boolean;
      exceptionNote?: string;
    },
  ) {
    return this.data.updateDeletionTask(tenantSlug, taskId, body, authHeader);
  }

  @Post("incidents/:incidentId/update")
  updateIncident(
    @Param("tenantSlug") tenantSlug: string,
    @Param("incidentId") incidentId: string,
    @Headers("authorization") authHeader: string | undefined,
    @Body() body: { status: "TRIAGE" | "ASSESSMENT" | "CONTAINMENT" | "CLOSED"; evidenceLinked?: boolean; remediationOwner?: string },
  ) {
    return this.data.updateIncident(tenantSlug, incidentId, body, authHeader);
  }

  @Post("processors/:processorId/update")
  updateProcessor(
    @Param("tenantSlug") tenantSlug: string,
    @Param("processorId") processorId: string,
    @Headers("authorization") authHeader: string | undefined,
    @Body() body: { dpaStatus: "SIGNED" | "IN_REVIEW" | "MISSING"; purgeAckStatus: "ACKNOWLEDGED" | "PENDING" | "REFUSED" },
  ) {
    return this.data.updateProcessor(tenantSlug, processorId, body, authHeader);
  }

  /* ── Agentic AI ────────────────────────────────────────────── */

  @Post("agents/breach/:incidentId/trigger")
  triggerBreachAgent(
    @Param("tenantSlug") tenantSlug: string,
    @Param("incidentId") incidentId: string,
    @Headers("authorization") authHeader: string | undefined,
  ) {
    return this.data.triggerBreachAgent(tenantSlug, incidentId, authHeader);
  }

  @Post("agents/rights/:caseId/trigger")
  triggerRightsAgent(
    @Param("tenantSlug") tenantSlug: string,
    @Param("caseId") caseId: string,
    @Headers("authorization") authHeader: string | undefined,
  ) {
    return this.data.triggerRightsAgent(tenantSlug, caseId, authHeader);
  }

  @Post("agents/actions/:actionId/review")
  reviewAgentAction(
    @Param("tenantSlug") tenantSlug: string,
    @Param("actionId") actionId: string,
    @Headers("authorization") authHeader: string | undefined,
    @Body() body: { state: "REVIEWED" | "APPROVED" | "REJECTED"; editedBody?: string; approvalNote?: string },
  ) {
    return this.data.reviewAgentAction(tenantSlug, actionId, body, authHeader);
  }

  @Get("agents/actions")
  getAgentActions(
    @Param("tenantSlug") tenantSlug: string,
    @Headers("authorization") authHeader: string | undefined,
  ) {
    return this.data.getAgentActions(tenantSlug, authHeader);
  }

  @Post("evidence/upload")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  async uploadEvidence(
    @Param("tenantSlug") tenantSlug: string,
    @Headers("authorization") authHeader: string | undefined,
    @Body()
    body: { linkedRecord: string; classification?: "SYSTEM_DERIVED" | "UPLOADED" | "ATTESTATION"; label?: string },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException("Evidence upload requires a file.");
    }
    if (!body.linkedRecord?.trim()) {
      throw new BadRequestException("Evidence upload requires a linked record.");
    }
    return this.data.uploadEvidence(tenantSlug, body, file, authHeader);
  }

  @Get("evidence/:evidenceId/download")
  async downloadEvidence(
    @Param("tenantSlug") tenantSlug: string,
    @Param("evidenceId") evidenceId: string,
    @Headers("authorization") authHeader: string | undefined,
    @Res() res: Response,
  ) {
    const file = await this.data.downloadEvidence(tenantSlug, evidenceId, authHeader);
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`);
    res.send(file.buffer);
  }

  @Get("export/compliance-pack")
  async exportCompliancePack(
    @Param("tenantSlug") tenantSlug: string,
    @Headers("authorization") authHeader: string | undefined,
    @Res() res: Response,
  ) {
    const bundle = await this.data.exportCompliancePack(tenantSlug, authHeader);
    res.setHeader("Content-Type", bundle.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${bundle.fileName}"`);
    res.send(bundle.buffer);
  }
}
