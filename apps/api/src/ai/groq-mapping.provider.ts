import { Injectable, Logger } from "@nestjs/common";
import type { SourceProfileRequest } from "../domain/types.js";
import type { AiMappingProvider } from "./provider-types.js";
import { buildPrompt, parseStructuredProfiles } from "./shared.js";

interface GroqChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

@Injectable()
export class GroqMappingProvider implements AiMappingProvider {
  private readonly logger = new Logger(GroqMappingProvider.name);

  isEnabled() {
    return Boolean(process.env.GROQ_API_KEY);
  }

  getStatus() {
    return {
      provider: "groq" as const,
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      configured: this.isEnabled(),
    };
  }

  async classifyHeaders(request: SourceProfileRequest) {
    if (!this.isEnabled()) {
      return null;
    }

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
          messages: [
            {
              role: "system",
              content:
                "You are a DPDP compliance data classifier. Return structured privacy-field classifications as JSON only. " +
                "For each header, classify: mapped_category (Identity, Contact, Device, Transactional, Location, Preference, " +
                "Sensitive identifier, Government ID, Financial, Customer profile), identifier_type (Direct identifier, " +
                "Persistent identifier, Contextual attribute, Operational attribute, Sensitive identifier), purpose, " +
                "legal_basis (Consent, Performance of service, Security and fraud prevention, Legitimate use, Legal obligation), " +
                "retention_label, confidence (0-1), requires_review (boolean), warnings (array of strings). " +
                "Pay special attention to Indian identifiers: Aadhaar, PAN, UPI IDs are Sensitive/Government IDs requiring review.",
            },
            { role: "user", content: buildPrompt(request) },
          ],
          response_format: {
            type: "json_object",
          },
          temperature: 0.1,
          max_tokens: 4096,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        this.logger.warn(`Groq mapping failed with ${response.status}: ${errorText.slice(0, 200)}`);
        return null;
      }

      const payload = (await response.json()) as GroqChatResponse;
      const textBlock = payload.choices?.[0]?.message?.content;

      const parsed = parseStructuredProfiles(textBlock, request.headers.length);
      if (!parsed) {
        this.logger.warn("Groq mapping returned invalid structured output.");
        this.logger.debug(`Raw Groq response: ${textBlock?.slice(0, 500)}`);
      }
      return parsed;
    } catch (error) {
      this.logger.warn(`Groq mapping error: ${error instanceof Error ? error.message : "Unknown"}`);
      return null;
    }
  }
}
