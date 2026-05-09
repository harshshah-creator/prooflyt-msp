/**
 *  AI PII discovery in unstructured documents.
 *
 *  Scans free-text (extracted from Excel cells, CSV rows, PDF text, email
 *  bodies, etc.) for India-specific PII patterns + a tunable LLM pass that
 *  catches the long tail. Two modes:
 *
 *    fast    — regex matrix only. Deterministic, runs inside the worker
 *              with zero network. Catches 80%+ of Indian SMB cases:
 *              Aadhaar, PAN, GSTIN, voter id, driving licence, passport,
 *              IFSC, Indian phone numbers, emails, bank-account-like
 *              digit clusters.
 *
 *    smart   — regex first, then a Groq pass on documents the regex
 *              flagged with low confidence. Useful for NLP-style PII
 *              like "my Aadhaar is twelve thirty four…" or names buried
 *              in narrative paragraphs.
 *
 *  Each detection is returned with:
 *    - the matched text (truncated/masked if sensitive)
 *    - the field-classification category (Identity, Contact, Financial…)
 *    - the DPDP citation that makes it sensitive
 *    - confidence score
 *
 *  This module is read-only: callers can take the result and create
 *  RegisterEntry rows or auto-quarantine the document.
 */

export type PiiCategory =
  | "Identity"
  | "Contact"
  | "Financial"
  | "Sensitive"
  | "Government";

export interface PiiHit {
  category: PiiCategory;
  /** Short label shown to the operator */
  label: string;
  /** DPDP / Indian-law citation explaining why this is sensitive */
  citation: string;
  /** Matched text (masked if sensitive) */
  match: string;
  /** Position in the source for UI highlighting */
  start: number;
  end: number;
  confidence: number;     // 0–1
  /** Operator action recommendation */
  recommendation: string;
}

interface DetectorRule {
  id: string;
  category: PiiCategory;
  label: string;
  citation: string;
  pattern: RegExp;
  confidence: number;
  recommendation: string;
  /** Function to mask the matched value before returning */
  mask?: (raw: string) => string;
}

function mask(raw: string, keepStart = 2, keepEnd = 4): string {
  if (raw.length <= keepStart + keepEnd) return "*".repeat(raw.length);
  return raw.slice(0, keepStart) + "*".repeat(raw.length - keepStart - keepEnd) + raw.slice(-keepEnd);
}

/**
 *  India-specific detector matrix. Each rule is conservative — false
 *  positives are worse than false negatives because they pollute the
 *  Register with bogus entries.
 */
const RULES: DetectorRule[] = [
  {
    id: "aadhaar",
    category: "Sensitive",
    label: "Aadhaar number",
    citation: "Aadhaar Act §8 (sensitive identifier; UIDAI handling rules apply)",
    // 12-digit Aadhaar; allow XXXX XXXX XXXX or XXXX-XXXX-XXXX or run-on
    pattern: /\b[2-9]\d{3}[ -]?\d{4}[ -]?\d{4}\b/g,
    confidence: 0.92,
    recommendation:
      "Move to UIDAI-grade vault or hash. Mask in logs and analytics. Restrict access via Section 7 review.",
    mask: (s) => mask(s.replace(/[ -]/g, ""), 4, 0),
  },
  {
    id: "pan",
    category: "Government",
    label: "PAN (Permanent Account Number)",
    citation: "Income Tax Act + DPDP §8 sensitive identifier",
    // 5 letters, 4 digits, 1 letter
    pattern: /\b[A-Z]{5}\d{4}[A-Z]\b/g,
    confidence: 0.95,
    recommendation: "Restrict to KYC-only flows. Mask in CRM exports.",
    mask: (s) => mask(s, 3, 1),
  },
  {
    id: "gstin",
    category: "Government",
    label: "GSTIN (Goods & Services Tax Identification Number)",
    citation: "CGST Act + DPDP cross-reference",
    // 2 digits state + 10 char PAN + 1 entity + 1 Z + 1 checksum
    pattern: /\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]\b/g,
    confidence: 0.93,
    recommendation: "Lower-sensitivity than PAN but still personal; retain per CGST Act 8-year floor.",
  },
  {
    id: "passport",
    category: "Government",
    label: "Indian passport number",
    citation: "Passports Act + DPDP §8 sensitive identifier",
    pattern: /\b[A-Z]\d{7}\b/g,
    confidence: 0.78,
    recommendation: "Treat as Sensitive PII. Encrypt at rest. Restrict analytics.",
    mask: (s) => mask(s, 1, 1),
  },
  {
    id: "voter-id",
    category: "Government",
    label: "Voter ID (EPIC)",
    citation: "RPA + DPDP §8",
    pattern: /\b[A-Z]{3}\d{7}\b/g,
    confidence: 0.72,
    recommendation: "Do not use for marketing. Retention bound by KYC schedule.",
    mask: (s) => mask(s, 3, 1),
  },
  {
    id: "driving-licence",
    category: "Government",
    label: "Driving licence (DL) number",
    citation: "MV Act + DPDP §8",
    pattern: /\b[A-Z]{2}\d{2}[ -]?\d{4}[ -]?\d{7}\b/g,
    confidence: 0.7,
    recommendation: "Only for KYC. Mask in support tools.",
    mask: (s) => mask(s.replace(/[ -]/g, ""), 4, 2),
  },
  {
    id: "ifsc",
    category: "Financial",
    label: "IFSC code",
    citation: "RBI banking standard",
    // 4 alpha + 0 + 6 alphanumeric
    pattern: /\b[A-Z]{4}0[A-Z\d]{6}\b/g,
    confidence: 0.92,
    recommendation: "By itself low risk; combine-with-account becomes Sensitive.",
  },
  {
    id: "indian-mobile",
    category: "Contact",
    label: "Indian mobile number",
    citation: "TRAI + DPDP §8 contact identifier",
    // +91 / 91 / 0 prefix or bare 10 digit starting 6-9
    pattern: /(?:\+?91[ -]?|0?)([6-9]\d{9})\b/g,
    confidence: 0.86,
    recommendation: "Tag as Direct identifier. Subject to TRAI 6-month DLR retention floor.",
    mask: (s) => mask(s.replace(/[\s+-]/g, ""), 2, 4),
  },
  {
    id: "email",
    category: "Contact",
    label: "Email address",
    citation: "DPDP §8 contact identifier",
    pattern: /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi,
    confidence: 0.97,
    recommendation: "Tag as Direct identifier. Honour suppression on consent withdrawal.",
  },
  {
    id: "bank-account",
    category: "Financial",
    label: "Bank account number (likely)",
    citation: "RBI + DPDP §8 + financial-data sensitivity",
    // 9–18 digit cluster — over-broad, low default confidence
    pattern: /\b\d{9,18}\b/g,
    confidence: 0.6,
    recommendation:
      "Combine with IFSC nearby for higher confidence. Subject to RBI 5–10y retention. Mask in support tooling.",
    mask: (s) => mask(s, 2, 4),
  },
  {
    id: "credit-card",
    category: "Financial",
    label: "Credit / debit card-like digits",
    citation: "PCI-DSS + DPDP §8",
    pattern: /\b(?:\d[ -]?){13,19}\b/g,
    confidence: 0.65,
    recommendation:
      "PCI-DSS forbids storing PAN unless tokenised. Quarantine the document and tokenise at source.",
    mask: (s) => {
      const digits = s.replace(/\D/g, "");
      return digits.length >= 13 ? mask(digits, 0, 4) : "****";
    },
  },
];

export interface ScanResult {
  totalLength: number;
  hits: PiiHit[];
  /** Severity: max of all hits' severity buckets */
  severity: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  /** Suggested action for the operator */
  suggestedAction: "INDEX" | "REVIEW" | "QUARANTINE";
  /** Categories present in the document, for register linking */
  categoriesPresent: PiiCategory[];
}

const CRITICAL_CATEGORIES: PiiCategory[] = ["Sensitive", "Government", "Financial"];

/**
 *  Run the regex matrix. Pure, deterministic, safe inside the DO request
 *  path. Caps `text` size at 1 MB to avoid memory blowups.
 */
export function scanForPii(text: string, options: { maxLength?: number } = {}): ScanResult {
  const maxLen = Math.min(options.maxLength ?? 1_000_000, 1_000_000);
  const truncated = text.slice(0, maxLen);
  const hits: PiiHit[] = [];

  for (const rule of RULES) {
    rule.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = rule.pattern.exec(truncated)) !== null) {
      const raw = match[0];
      hits.push({
        category: rule.category,
        label: rule.label,
        citation: rule.citation,
        match: rule.mask ? rule.mask(raw) : raw,
        start: match.index,
        end: match.index + raw.length,
        confidence: rule.confidence,
        recommendation: rule.recommendation,
      });
      // Cap to avoid pathological inputs.
      if (hits.length > 500) break;
    }
    if (hits.length > 500) break;
  }

  // Adjacency boost: bank-account + IFSC within 80 chars → bump confidence.
  for (let i = 0; i < hits.length; i++) {
    if (hits[i].label.startsWith("Bank account")) {
      const nearIfsc = hits.find(
        (h) => h.label === "IFSC code" && Math.abs(h.start - hits[i].start) < 80,
      );
      if (nearIfsc) hits[i].confidence = Math.min(0.95, hits[i].confidence + 0.25);
    }
  }

  const categoriesPresent = Array.from(new Set(hits.map((h) => h.category)));
  const severity: ScanResult["severity"] = hits.length === 0
    ? "NONE"
    : hits.some((h) => CRITICAL_CATEGORIES.includes(h.category) && h.confidence >= 0.85)
    ? "CRITICAL"
    : hits.some((h) => CRITICAL_CATEGORIES.includes(h.category))
    ? "HIGH"
    : hits.length >= 5
    ? "MEDIUM"
    : "LOW";

  const suggestedAction: ScanResult["suggestedAction"] = severity === "CRITICAL"
    ? "QUARANTINE"
    : severity === "HIGH" || severity === "MEDIUM"
    ? "REVIEW"
    : "INDEX";

  return {
    totalLength: text.length,
    hits,
    severity,
    suggestedAction,
    categoriesPresent,
  };
}

/**
 *  Optional Groq enhancement: when GROQ_API_KEY is set + the document is
 *  short (<8 KB), ask the LLM to spot PII the regex matrix missed (named
 *  individuals, narrative Aadhaar mentions, KYC summaries). Returns an
 *  augmented ScanResult; falls back to the regex-only result on any error.
 */
export async function scanForPiiSmart(
  text: string,
  env: { GROQ_API_KEY?: string; GROQ_MODEL?: string },
): Promise<ScanResult> {
  const baseline = scanForPii(text);
  if (!env.GROQ_API_KEY || text.length > 8000) return baseline;

  // 8-second hard timeout so a slow/failing Groq call cannot hold the
  // entire worker request open. Cloudflare's wall-clock cap is 30s; we
  // want plenty of headroom for the rest of the request to complete and
  // the regex baseline to still be returned.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: env.GROQ_MODEL || "llama-3.3-70b-versatile",
        temperature: 0.05,
        max_tokens: 800,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are an Indian-law DPIA helper. Given an unstructured document, return JSON with a `hits` array of PII you find. Each hit: { label, category (Identity/Contact/Financial/Sensitive/Government), reason, confidence (0–1) }. Focus on India-specific items (Aadhaar narrative, PAN narrative, named individuals with role context, KYC summaries) the regex layer missed. JSON only, no commentary.",
          },
          { role: "user", content: text },
        ],
      }),
    });
    clearTimeout(timeoutId);
    if (!r.ok) return baseline;
    const j = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = j.choices?.[0]?.message?.content;
    if (!content) return baseline;
    const parsed = JSON.parse(content) as { hits?: Array<{ label: string; category: PiiCategory; reason?: string; confidence?: number }> };
    if (!parsed.hits) return baseline;
    for (const h of parsed.hits) {
      baseline.hits.push({
        category: h.category,
        label: h.label,
        citation: "Inferred (LLM): " + (h.reason || "context-derived PII"),
        match: "[narrative]",
        start: 0,
        end: 0,
        confidence: typeof h.confidence === "number" ? Math.max(0, Math.min(1, h.confidence)) : 0.6,
        recommendation: "Operator review — LLM-inferred match, no exact span.",
      });
    }
    baseline.categoriesPresent = Array.from(new Set(baseline.hits.map((h) => h.category)));
    return baseline;
  } catch {
    // Includes AbortError (timeout) — fall back to regex-only baseline so
    // a slow Groq round-trip never breaks the scan.
    return baseline;
  } finally {
    clearTimeout(timeoutId);
  }
}
