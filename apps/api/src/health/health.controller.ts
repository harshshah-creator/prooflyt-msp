import { Controller, Get, Inject } from "@nestjs/common";
import { AppDataService } from "../data/app-data.service.js";

@Controller("api/health")
export class HealthController {
  constructor(@Inject(AppDataService) private readonly data: AppDataService) {}

  @Get()
  getHealth() {
    return this.data.getHealth();
  }
}
