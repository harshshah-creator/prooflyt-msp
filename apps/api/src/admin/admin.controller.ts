import { Body, Controller, Get, Headers, Inject, Param, Post } from "@nestjs/common";
import { AppDataService } from "../data/app-data.service.js";

@Controller("api/admin")
export class AdminController {
  constructor(@Inject(AppDataService) private readonly data: AppDataService) {}

  @Get("bootstrap")
  bootstrap(@Headers("authorization") authHeader?: string) {
    return this.data.getAdminBootstrap(authHeader);
  }

  @Post("tenants/:tenantSlug/status")
  setTenantStatus(
    @Param("tenantSlug") tenantSlug: string,
    @Headers("authorization") authHeader: string | undefined,
    @Body() body: { active: boolean },
  ) {
    return this.data.setTenantActive(tenantSlug, Boolean(body.active), authHeader);
  }
}
