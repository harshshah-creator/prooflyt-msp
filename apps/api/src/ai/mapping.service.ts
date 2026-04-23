import { Inject, Injectable } from "@nestjs/common";
import type { SourceFieldProfile, SourceProfileRequest } from "../domain/types.js";
import { buildHeuristicProfiles } from "@prooflyt/mapping";
import { OpenAiMappingProvider } from "./openai-mapping.provider.js";
import { GeminiMappingProvider } from "./gemini-mapping.provider.js";
import { GroqMappingProvider } from "./groq-mapping.provider.js";

@Injectable()
export class MappingService {
  constructor(
    @Inject(OpenAiMappingProvider) private readonly openAiMapping: OpenAiMappingProvider,
    @Inject(GeminiMappingProvider) private readonly geminiMapping: GeminiMappingProvider,
    @Inject(GroqMappingProvider) private readonly groqMapping: GroqMappingProvider,
  ) {}

  getStatus() {
    if (this.geminiMapping.isEnabled()) return this.geminiMapping.getStatus();
    if (this.groqMapping.isEnabled()) return this.groqMapping.getStatus();
    if (this.openAiMapping.isEnabled()) return this.openAiMapping.getStatus();
    return {
      provider: "heuristic" as const,
      model: "rules-engine",
      configured: true,
    };
  }

  async profileSource(request: SourceProfileRequest): Promise<{ provider: string; profiles: SourceFieldProfile[] }> {
    const providerChain = [
      { id: "gemini", profiles: await this.geminiMapping.classifyHeaders(request) },
      { id: "groq", profiles: await this.groqMapping.classifyHeaders(request) },
      { id: "openai", profiles: await this.openAiMapping.classifyHeaders(request) },
    ];

    const firstProvider = providerChain.find((entry) => entry.profiles);
    if (firstProvider?.profiles) {
      return {
        provider: firstProvider.id,
        profiles: firstProvider.profiles,
      };
    }

    return {
      provider: "heuristic",
      profiles: buildHeuristicProfiles(request),
    };
  }
}
