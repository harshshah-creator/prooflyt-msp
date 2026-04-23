import { Injectable, Logger } from "@nestjs/common";
import type { SourceProfileRequest } from "../domain/types.js";
import type { AiMappingProvider } from "./provider-types.js";
import { buildPrompt, parseStructuredProfiles } from "./shared.js";

interface OpenAIResponseShape {
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
}

@Injectable()
export class OpenAiMappingProvider implements AiMappingProvider {
  private readonly logger = new Logger(OpenAiMappingProvider.name);

  isEnabled() {
    return Boolean(process.env.OPENAI_API_KEY);
  }

  getStatus() {
    return {
      provider: "openai" as const,
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      configured: this.isEnabled(),
    };
  }

  async classifyHeaders(request: SourceProfileRequest) {
    if (!this.isEnabled()) {
      return null;
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        input: [
          { role: "system", content: "Return structured privacy-field classifications as JSON." },
          { role: "user", content: buildPrompt(request) },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "mapping_result",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["profiles"],
              properties: {
                profiles: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
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
                      field_name: { type: "string" },
                      mapped_category: { type: "string" },
                      identifier_type: { type: "string" },
                      purpose: { type: "string" },
                      legal_basis: { type: "string" },
                      retention_label: { type: "string" },
                      confidence: { type: "number" },
                      requires_review: { type: "boolean" },
                      warnings: {
                        type: "array",
                        items: { type: "string" },
                      },
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
      this.logger.warn(`OpenAI mapping failed with ${response.status}`);
      return null;
    }

    const payload = (await response.json()) as OpenAIResponseShape;
    const textBlock = payload.output
      ?.flatMap((item) => item.content || [])
      .find((item) => item.type === "output_text" && item.text)?.text;

    const parsed = parseStructuredProfiles(textBlock, request.headers.length);
    if (!parsed) {
      this.logger.warn("OpenAI mapping returned invalid structured output.");
    }
    return parsed;
  }
}
