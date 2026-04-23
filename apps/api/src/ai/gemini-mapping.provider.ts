import { Injectable, Logger } from "@nestjs/common";
import type { SourceProfileRequest } from "../domain/types.js";
import type { AiMappingProvider } from "./provider-types.js";
import { buildPrompt, parseStructuredProfiles } from "./shared.js";

interface GeminiResponseShape {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

@Injectable()
export class GeminiMappingProvider implements AiMappingProvider {
  private readonly logger = new Logger(GeminiMappingProvider.name);

  isEnabled() {
    return Boolean(process.env.GEMINI_API_KEY);
  }

  getStatus() {
    return {
      provider: "gemini" as const,
      model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
      configured: this.isEnabled(),
    };
  }

  async classifyHeaders(request: SourceProfileRequest) {
    if (!this.isEnabled()) {
      return null;
    }

    const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: buildPrompt(request) }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            required: ["profiles"],
            properties: {
              profiles: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  required: [
                    "field_name",
                    "mapped_category",
                    "identifier_type",
                    "purpose",
                    "legal_basis",
                    "retention_label",
                    "confidence",
                    "requires_review",
                    "warnings",
                  ],
                  properties: {
                    field_name: { type: "STRING" },
                    mapped_category: { type: "STRING" },
                    identifier_type: { type: "STRING" },
                    purpose: { type: "STRING" },
                    legal_basis: { type: "STRING" },
                    retention_label: { type: "STRING" },
                    confidence: { type: "NUMBER" },
                    requires_review: { type: "BOOLEAN" },
                    warnings: {
                      type: "ARRAY",
                      items: { type: "STRING" },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    });

    if (!response.ok) {
      this.logger.warn(`Gemini mapping failed with ${response.status}`);
      return null;
    }

    const payload = (await response.json()) as GeminiResponseShape;
    const textBlock = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("");
    const parsed = parseStructuredProfiles(textBlock, request.headers.length);
    if (!parsed) {
      this.logger.warn("Gemini mapping returned invalid structured output.");
    }
    return parsed;
  }
}
