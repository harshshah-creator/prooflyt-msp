import type { SourceFieldProfile, SourceProfileRequest, SmartMappingMode } from "../../contracts/dist/index.js";

export interface AiMappingStatus {
  provider: "openai" | "gemini" | "groq" | "heuristic";
  model: string;
  configured: boolean;
}

export interface AiMappingProvider {
  isEnabled(): boolean;
  getStatus(): AiMappingStatus;
  classifyHeaders(request: SourceProfileRequest): Promise<SourceFieldProfile[] | null>;
}

export interface StructuredMappingItem {
  field_name: string;
  mapped_category: string;
  identifier_type: string;
  purpose: string;
  legal_basis: string;
  retention_label: string;
  confidence: number;
  requires_review: boolean;
  warnings: string[];
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, "_");
}

export function pickPurpose(header: string): string {
  if (/(email|phone|contact|address)/.test(header)) return "Customer communications";
  if (/(device|ip|browser|session)/.test(header)) return "Security and fraud monitoring";
  if (/(order|payment|invoice|billing)/.test(header)) return "Order fulfilment and accounting";
  if (/(consent|preference|marketing)/.test(header)) return "Consent proof and outreach governance";
  if (/(city|state|country|location)/.test(header)) return "Regional service operations";
  return "Customer account operations";
}

export function pickCategory(header: string): string {
  if (/(name|first|last)/.test(header)) return "Identity";
  if (/(email|phone|address)/.test(header)) return "Contact";
  if (/(device|ip|browser|session)/.test(header)) return "Device";
  if (/(order|payment|invoice|billing)/.test(header)) return "Transactional";
  if (/(city|state|country|location)/.test(header)) return "Location";
  if (/(consent|preference|marketing)/.test(header)) return "Preference";
  return "Customer profile";
}

export function pickIdentifierType(header: string): string {
  if (/(email)/.test(header)) return "Direct identifier";
  if (/(phone)/.test(header)) return "Direct identifier";
  if (/(name)/.test(header)) return "Direct identifier";
  if (/(device|session|browser|ip)/.test(header)) return "Persistent identifier";
  if (/(city|state|country)/.test(header)) return "Contextual attribute";
  return "Operational attribute";
}

export function pickLegalBasis(header: string): string {
  if (/(consent|marketing|preference)/.test(header)) return "Consent";
  if (/(order|payment|invoice|billing)/.test(header)) return "Performance of service";
  if (/(device|ip|browser|session)/.test(header)) return "Security and fraud prevention";
  return "Legitimate use";
}

export function pickRetention(header: string): string {
  if (/(payment|invoice|billing)/.test(header)) return "8 years";
  if (/(consent|preference|marketing)/.test(header)) return "3 years from last interaction";
  if (/(device|session|ip)/.test(header)) return "12 months";
  return "24 months";
}

export function confidenceForHeader(header: string, mode: SmartMappingMode): number {
  const weighted =
    /(email|phone|name|device|ip|order|payment|invoice|consent|city|country)/.test(header) ? 0.89 : 0.66;
  if (mode === "HEADER_ONLY") return Math.max(0.52, weighted - 0.12);
  if (mode === "MASKED_SAMPLE") return weighted;
  return Math.min(0.97, weighted + 0.05);
}

export function buildPrompt(request: SourceProfileRequest) {
  return [
    "Classify privacy-related spreadsheet headers for a DPDP compliance mapping workflow.",
    "Be conservative. Infer only from the header names and profiling mode.",
    "Return one item for every header in the same order.",
    "No prose. No markdown. Structured JSON only.",
    `Profiling mode: ${request.mode}.`,
    `File name: ${request.fileName}.`,
    `Headers: ${request.headers.join(" | ")}`,
  ].join("\n");
}

export function toProfile(item: StructuredMappingItem, index: number): SourceFieldProfile {
  return {
    id: `profile-ai-${index + 1}`,
    sourceId: "live-profile",
    fieldName: item.field_name,
    mappedCategory: item.mapped_category,
    identifierType: item.identifier_type,
    confidence: item.confidence,
    purpose: item.purpose,
    legalBasis: item.legal_basis,
    retentionLabel: item.retention_label,
    requiresReview: item.requires_review,
    warnings: item.warnings,
  };
}

export function parseStructuredProfiles(textBlock: string | undefined, expectedCount: number): SourceFieldProfile[] | null {
  if (!textBlock) return null;

  try {
    const parsed = JSON.parse(textBlock);

    // Format 1: { profiles: [ { field_name, mapped_category, ... }, ... ] }
    if (Array.isArray(parsed.profiles) && parsed.profiles.length === expectedCount) {
      return parsed.profiles.map(toProfile);
    }

    // Format 2: top-level array [ { field_name, ... }, ... ]
    if (Array.isArray(parsed) && parsed.length === expectedCount) {
      return parsed.map((item: Record<string, unknown>, index: number) => toProfile(
        {
          field_name: String(item.field_name || item.fieldName || `field_${index + 1}`),
          mapped_category: String(item.mapped_category || item.category || "Customer profile"),
          identifier_type: String(item.identifier_type || "Operational attribute"),
          purpose: String(item.purpose || "Customer account operations"),
          legal_basis: String(item.legal_basis || "Legitimate use"),
          retention_label: String(item.retention_label || item.retention || "24 months"),
          confidence: Number(item.confidence) || 0.75,
          requires_review: Boolean(item.requires_review),
          warnings: Array.isArray(item.warnings) ? item.warnings.map(String) : [],
        },
        index,
      ));
    }

    // Format 3: { field_name: { mapped_category, ... }, field_name2: { ... } }
    const keys = Object.keys(parsed).filter((k) => k !== "profiles");
    if (keys.length === expectedCount && typeof parsed[keys[0]] === "object" && !Array.isArray(parsed[keys[0]])) {
      return keys.map((key, index) => {
        const item = parsed[key] as Record<string, unknown>;
        return toProfile(
          {
            field_name: key,
            mapped_category: String(item.mapped_category || item.category || "Customer profile"),
            identifier_type: String(item.identifier_type || "Operational attribute"),
            purpose: String(item.purpose || "Customer account operations"),
            legal_basis: String(item.legal_basis || "Legitimate use"),
            retention_label: String(item.retention_label || item.retention || "24 months"),
            confidence: Number(item.confidence) || 0.75,
            requires_review: Boolean(item.requires_review),
            warnings: Array.isArray(item.warnings) ? item.warnings.map(String) : [],
          },
          index,
        );
      });
    }

    return null;
  } catch {
    return null;
  }
}

export function buildHeuristicProfiles(request: SourceProfileRequest): SourceFieldProfile[] {
  const seen = new Map<string, number>();

  return request.headers.map((header: string, index: number) => {
    const normalized = normalizeHeader(header || `unnamed_column_${index + 1}`);
    const duplicateCount = (seen.get(normalized) || 0) + 1;
    seen.set(normalized, duplicateCount);

    const uniqueName = duplicateCount > 1 ? `${normalized}_${duplicateCount}` : normalized;
    const warnings: string[] = [];

    if (!header?.trim()) warnings.push("Missing header name; manual classification required.");
    if (duplicateCount > 1) warnings.push("Duplicate header detected; suffixed for deterministic review.");
    if (/[\u0900-\u097F]/.test(header || "")) warnings.push("Regional language header preserved for reviewer confirmation.");
    if (request.headers.length > 180) warnings.push("Wide file detected; batch review is recommended.");
    if (uniqueName.startsWith("unnamed_column_")) warnings.push("Unnamed field will not be pushed until reviewer approval.");

    const confidence = confidenceForHeader(uniqueName, request.mode);

    return {
      id: `profile-${index + 1}`,
      sourceId: "live-profile",
      fieldName: uniqueName,
      mappedCategory: pickCategory(uniqueName),
      identifierType: pickIdentifierType(uniqueName),
      confidence,
      purpose: pickPurpose(uniqueName),
      legalBasis: pickLegalBasis(uniqueName),
      retentionLabel: pickRetention(uniqueName),
      requiresReview: confidence < 0.7 || warnings.length > 0,
      warnings,
    };
  });
}
