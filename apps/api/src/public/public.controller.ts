import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { AppDataService } from "../data/app-data.service.js";
import type { RightsCase } from "../domain/types.js";

@Controller("api/public/:tenantSlug")
export class PublicController {
  constructor(@Inject(AppDataService) private readonly data: AppDataService) {}

  @Get("rights")
  rightsPage(@Param("tenantSlug") tenantSlug: string) {
    return this.data.getPublicRightsPage(tenantSlug);
  }

  @Post("rights")
  submitRight(
    @Param("tenantSlug") tenantSlug: string,
    @Body() body: { name: string; email: string; type: RightsCase["type"]; message: string },
  ) {
    return this.data.submitPublicRight(tenantSlug, body);
  }

  @Get("notice")
  noticePage(@Param("tenantSlug") tenantSlug: string) {
    return this.data.getPublicNoticePage(tenantSlug);
  }

  @Post("notice/acknowledge")
  acknowledge(@Param("tenantSlug") tenantSlug: string) {
    return this.data.acknowledgeNotice(tenantSlug);
  }
}
