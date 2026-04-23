import { Module } from "@nestjs/common";
import { AuthController } from "./auth/auth.controller.js";
import { AdminController } from "./admin/admin.controller.js";
import { PortalController } from "./portal/portal.controller.js";
import { PublicController } from "./public/public.controller.js";
import { AppDataService } from "./data/app-data.service.js";
import { MappingService } from "./ai/mapping.service.js";
import { OpenAiMappingProvider } from "./ai/openai-mapping.provider.js";
import { GeminiMappingProvider } from "./ai/gemini-mapping.provider.js";
import { GroqMappingProvider } from "./ai/groq-mapping.provider.js";
import { HealthController } from "./health/health.controller.js";

@Module({
  controllers: [AuthController, AdminController, PortalController, PublicController, HealthController],
  providers: [AppDataService, MappingService, OpenAiMappingProvider, GeminiMappingProvider, GroqMappingProvider],
})
export class AppModule {}
