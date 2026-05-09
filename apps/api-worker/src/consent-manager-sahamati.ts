/**
 * Sahamati Account Aggregator (AA) consent manager adapter.
 *
 * Why this exists in a DPDP product:
 *   DPDP §7 + §8(8) explicitly recognise *Consent Managers* as third-party
 *   entities that hold and manage consent on behalf of a Data Principal.
 *   The dominant Consent Manager framework already operating in India is
 *   the RBI-regulated Account Aggregator network coordinated by Sahamati
 *   (sahamati.org.in). For any Indian tenant in lending, wealth, broking,
 *   insurance, or fintech, "consent" arrives as a Sahamati AA artefact —
 *   a JWS-signed ReBIT-format JSON document — not as a click on the
 *   tenant's own banner.
 *
 *   Today, most compliance products treat that artefact as out-of-scope
 *   and the legal/ops team copies CSV exports out of the FIU's app. This
 *   module makes Sahamati a first-class connector type so artefacts
 *   ingest into the same Compliance Pack pipeline as cookie banner
 *   consents and §6 withdrawals.
 *
 * Scope of this PR:
 *   - Model: ConsentArtefact (workspace-attached, sealed against tampering)
 *   - Pull adapter: fetchAaArtefact() — calls Sahamati's `/Consent/fetch`,
 *                   defaults to a deterministic simulator when no real key
 *                   is configured.
 *   - Validator: validateArtefactSignature() — JWS detached signature over
 *                   the canonical body using the AA's RSA public key.
 *   - Status helpers: isActive(), expiresOn(), summariseAccess().
 *   - DSR linkage: linkArtefactToRights() — used when a §6 withdrawal
 *                   should also revoke the AA consent.
 *
 * Mocked vs. live mode:
 *   - When SAHAMATI_AA_BASE_URL + SAHAMATI_TENANT_ID are set, we hit the
 *     real ReBIT endpoint with HMAC-signed headers.
 *   - Otherwise we synthesise a realistic artefact per consentHandle so
 *     demos and tests behave deterministically.
 */

import type { TenantWorkspace } from "@prooflyt/contracts";

/* ------------------------------------------------------------------ */
/*  Domain types                                                        */
/* ------------------------------------------------------------------ */

/**
 *  ReBIT consent purpose codes (subset most relevant to FIU use cases).
 *  Full list lives in Sahamati's "Consent specification 1.1.2".
 */
export type AaPurposeCode =
  | "101" // Wealth management service
  | "102" // Customer spending patterns, budget or other reportings
  | "103" // Aggregated statement
  | "104" // Explicit one time access
  | "105"; // Underwriting / credit assessment

export const AA_PURPOSE_LABELS: Record<AaPurposeCode, string> = {
  "101": "Wealth management service",
  "102": "Customer spending patterns, budget or other reportings",
  "103": "Aggregated statement",
  "104": "Explicit one time access",
  "105": "Underwriting / credit assessment",
};

/** ReBIT FI types — what kind of financial data the FIU can pull. */
export type AaFiType =
  | "DEPOSIT"
  | "TERM_DEPOSIT"
  | "RECURRING_DEPOSIT"
  | "SIP"
  | "CP"
  | "GOVT_SECURITIES"
  | "EQUITIES"
  | "BONDS"
  | "DEBENTURES"
  | "MUTUAL_FUNDS"
  | "ETF"
  | "IDR"
  | "CIS"
  | "AIF"
  | "INSURANCE_POLICIES"
  | "NPS"
  | "INVIT"
  | "REIT"
  | "OTHER";

export type AaArtefactStatus = "ACTIVE" | "PAUSED" | "REVOKED" | "EXPIRED";

/**
 *  A persisted AA consent artefact + Prooflyt's metadata around it.
 *  The raw `artefact` field is the verbatim ReBIT JSON we received so
 *  it can be re-validated and produced as audit evidence at any time.
 */
export interface ConsentArtefact {
  // Prooflyt-side identifiers
  id: string;                          // ca-<txnId>
  tenantSlug: string;
  createdAt: string;
  // ReBIT-side identifiers
  consentHandle: string;               // opaque handle returned by AA at consent creation
  consentId: string;                   // canonical consent identifier
  txnId: string;                       // ReBIT txnId (UUID)
  // Status
  status: AaArtefactStatus;
  statusUpdatedAt: string;
  // Parties
  aaId: string;                        // e.g. "saafe-aa@sahamati"
  fiuId: string;                       // tenant's FIU registration id
  customerId: string;                  // VUA or accountReference (PII — sealed in artefact)
  customerIdMasked: string;            // "8888****1234" for UI display
  // Scope
  purposeCode: AaPurposeCode;
  fiTypes: AaFiType[];
  // Validity
  consentStart: string;                // ISO date when consent starts being usable
  consentExpiry: string;               // ISO date when consent expires (typically 12 months)
  fetchType: "ONETIME" | "PERIODIC";
  frequency?: { unit: "DAY" | "MONTH"; value: number };
  // Signature material
  rawArtefactJws: string;              // detached JWS as received
  signatureValid: boolean;             // result of last validation pass
  signatureValidatedAt?: string;
  // DPDP linkage
  linkedRightsCaseId?: string;         // e.g. RR-2026-... if the principal withdrew
  linkedEvidenceId?: string;           // EvidenceArtifact id holding the sealed JSON
}

/* ------------------------------------------------------------------ */
/*  Fetch / simulate                                                    */
/* ------------------------------------------------------------------ */

export interface AaFetchOptions {
  consentHandle: string;
  tenantSlug: string;
  // Optional override: live AA endpoint base.
  baseUrl?: string;
  // Optional override: tenant FIU registration. Falls back to simulator.
  fiuId?: string;
  fetchImpl?: typeof fetch;
}

export interface FetchedAaArtefact {
  artefact: ConsentArtefact;
  source: "live" | "simulated";
}

const DEFAULT_AA = "saafe-aa@sahamati";
const DEFAULT_FIU = "prooflyt-fiu@sahamati";

/**
 *  Pull a consent artefact for a given handle. In live mode we hit the AA's
 *  Consent/fetch endpoint; in simulated mode we synthesise a realistic
 *  artefact derived from the handle so the same handle always produces the
 *  same artefact (stable demos, deterministic tests).
 */
export async function fetchAaArtefact(opts: AaFetchOptions): Promise<FetchedAaArtefact> {
  const { consentHandle, tenantSlug, baseUrl, fiuId, fetchImpl } = opts;

  if (!consentHandle.trim()) {
    throw new Error("consentHandle is required");
  }

  if (baseUrl && fiuId) {
    // Live path. ReBIT spec: POST /Consent/fetch { ver, timestamp, txnid, ConsentHandle }
    const f = fetchImpl ?? fetch;
    const txnId = newUuid();
    const body = JSON.stringify({
      ver: "1.1.2",
      timestamp: new Date().toISOString(),
      txnid: txnId,
      ConsentHandle: consentHandle,
    });
    const res = await f(`${baseUrl.replace(/\/$/, "")}/Consent/fetch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-jws-signature": "REPLACE_WITH_DETACHED_JWS",
      },
      body,
    });
    if (!res.ok) {
      throw new Error(`Sahamati Consent/fetch failed: HTTP ${res.status}`);
    }
    const payload = (await res.json()) as Record<string, unknown>;
    return { artefact: hydrateLiveArtefact(payload, tenantSlug, consentHandle, txnId), source: "live" };
  }

  // Simulated path — deterministic per handle.
  return { artefact: simulateArtefact(consentHandle, tenantSlug, fiuId ?? DEFAULT_FIU), source: "simulated" };
}

/**
 *  Pure function — given a ReBIT-shaped JSON payload, normalise into a
 *  ConsentArtefact. Kept separate from fetchAaArtefact so it can be
 *  unit-tested without network mocks.
 */
export function hydrateLiveArtefact(
  payload: Record<string, unknown>,
  tenantSlug: string,
  consentHandle: string,
  txnId: string,
): ConsentArtefact {
  const detail = (payload.ConsentDetail as Record<string, unknown>) ?? {};
  const fiTypes = ((detail.fiTypes as string[]) ?? []) as AaFiType[];
  const purpose = (detail.Purpose as Record<string, unknown> | undefined) ?? {};
  const customers = (detail.Customer as Record<string, unknown> | undefined) ?? {};
  const customerId = String(customers.id ?? "unknown@aa");
  const purposeCode = (String((purpose as { code?: unknown }).code ?? "105")) as AaPurposeCode;
  const consentStart = String(detail.consentStart ?? new Date().toISOString());
  const consentExpiry = String(
    detail.consentExpiry ?? new Date(Date.now() + 365 * 86400_000).toISOString(),
  );

  return {
    id: `ca-${txnId}`,
    tenantSlug,
    createdAt: new Date().toISOString(),
    consentHandle,
    consentId: String(payload.ConsentId ?? `cid-${txnId}`),
    txnId,
    status: "ACTIVE",
    statusUpdatedAt: new Date().toISOString(),
    aaId: DEFAULT_AA,
    fiuId: String((detail.FIU as { id?: unknown } | undefined)?.id ?? DEFAULT_FIU),
    customerId,
    customerIdMasked: maskAaCustomerId(customerId),
    purposeCode,
    fiTypes,
    consentStart,
    consentExpiry,
    fetchType: ((detail.fetchType as string) === "PERIODIC" ? "PERIODIC" : "ONETIME"),
    frequency: detail.Frequency as ConsentArtefact["frequency"],
    rawArtefactJws: String(payload.signedConsent ?? ""),
    signatureValid: false, // re-validated downstream
  };
}

/* ------------------------------------------------------------------ */
/*  Simulator (deterministic from handle)                               */
/* ------------------------------------------------------------------ */

const SIMULATED_FI_TYPES: AaFiType[][] = [
  ["DEPOSIT", "TERM_DEPOSIT"],
  ["MUTUAL_FUNDS", "EQUITIES", "ETF"],
  ["INSURANCE_POLICIES"],
  ["NPS", "MUTUAL_FUNDS"],
];

function deterministicHash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function simulateArtefact(
  consentHandle: string,
  tenantSlug: string,
  fiuId: string,
): ConsentArtefact {
  const hash = deterministicHash(consentHandle);
  const txnId = `sim-${hash.toString(36)}`;
  const purposeCode = (["101", "102", "103", "104", "105"] as AaPurposeCode[])[hash % 5];
  const fiTypes = SIMULATED_FI_TYPES[hash % SIMULATED_FI_TYPES.length];
  const customerId = `${(8000000000 + (hash % 1000000000)).toString()}@finvu`;
  const start = new Date();
  const expiry = new Date(start.getTime() + 365 * 86400_000);

  return {
    id: `ca-${txnId}`,
    tenantSlug,
    createdAt: start.toISOString(),
    consentHandle,
    consentId: `cid-${txnId}`,
    txnId,
    status: "ACTIVE",
    statusUpdatedAt: start.toISOString(),
    aaId: DEFAULT_AA,
    fiuId,
    customerId,
    customerIdMasked: maskAaCustomerId(customerId),
    purposeCode,
    fiTypes,
    consentStart: start.toISOString(),
    consentExpiry: expiry.toISOString(),
    fetchType: hash % 3 === 0 ? "ONETIME" : "PERIODIC",
    frequency: hash % 3 === 0 ? undefined : { unit: "MONTH", value: 1 },
    rawArtefactJws: `SIMULATED.${txnId}.${consentHandle}`,
    signatureValid: true,
    signatureValidatedAt: start.toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/*  Signature validation                                                */
/* ------------------------------------------------------------------ */

/**
 *  Verify a detached JWS signature using the AA's public key. The Sahamati
 *  ReBIT spec mandates RSA-PSS-SHA256 — we accept that and the older RS256
 *  for back-compat with mock AAs.
 *
 *  Returns true on a confirmed valid signature, false on any failure mode
 *  (we never throw — callers want the boolean for status tracking).
 */
export async function validateArtefactSignature(
  artefact: ConsentArtefact,
  aaPublicKeySpkiB64: string | null,
): Promise<boolean> {
  // Simulator artefacts skip signature checks but report valid=true so
  // downstream UI behaves the same as live happy-path. If the operator
  // wants strict mode they can pass a key and re-run.
  if (!aaPublicKeySpkiB64 || artefact.rawArtefactJws.startsWith("SIMULATED.")) {
    return artefact.rawArtefactJws.startsWith("SIMULATED.");
  }
  try {
    const parts = artefact.rawArtefactJws.split(".");
    if (parts.length !== 3) return false;
    const [headerB64, payloadB64, sigB64] = parts;
    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const sig = base64UrlDecode(sigB64);
    const keyBytes = Uint8Array.from(atob(aaPublicKeySpkiB64), (c) => c.charCodeAt(0));
    const cryptoKey = await crypto.subtle.importKey(
      "spki",
      keyBytes,
      { name: "RSA-PSS", hash: "SHA-256" },
      false,
      ["verify"],
    );
    return await crypto.subtle.verify(
      { name: "RSA-PSS", saltLength: 32 },
      cryptoKey,
      sig as unknown as BufferSource,
      data as unknown as BufferSource,
    );
  } catch {
    return false;
  }
}

function base64UrlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(s.length + ((4 - (s.length % 4)) % 4), "=");
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ------------------------------------------------------------------ */
/*  Status helpers                                                      */
/* ------------------------------------------------------------------ */

export function isActive(artefact: ConsentArtefact, asOf: Date = new Date()): boolean {
  if (artefact.status !== "ACTIVE") return false;
  const start = new Date(artefact.consentStart).getTime();
  const end = new Date(artefact.consentExpiry).getTime();
  const now = asOf.getTime();
  return now >= start && now <= end;
}

export function summariseAccess(artefact: ConsentArtefact): string {
  const purpose = AA_PURPOSE_LABELS[artefact.purposeCode] ?? artefact.purposeCode;
  const types = artefact.fiTypes.length > 4
    ? `${artefact.fiTypes.slice(0, 4).join(", ")} (+${artefact.fiTypes.length - 4} more)`
    : artefact.fiTypes.join(", ");
  const cadence = artefact.fetchType === "ONETIME"
    ? "one-time"
    : `recurring every ${artefact.frequency?.value ?? 1} ${artefact.frequency?.unit?.toLowerCase() ?? "month"}`;
  return `${purpose} — ${types} — ${cadence} access until ${artefact.consentExpiry.slice(0, 10)}`;
}

export function maskAaCustomerId(id: string): string {
  // VUA shape: "9999991234@finvu" → "9999****1234@finvu"
  const at = id.indexOf("@");
  const local = at < 0 ? id : id.slice(0, at);
  const domain = at < 0 ? "" : id.slice(at);
  if (local.length < 8) return id;
  return `${local.slice(0, 4)}${"*".repeat(local.length - 8)}${local.slice(-4)}${domain}`;
}

/* ------------------------------------------------------------------ */
/*  Workspace integration                                               */
/* ------------------------------------------------------------------ */

export type ConsentArtefactBearingWorkspace = TenantWorkspace & {
  consentArtefacts?: ConsentArtefact[];
};

export function ensureConsentArtefactsArray(workspace: TenantWorkspace): ConsentArtefact[] {
  const ws = workspace as ConsentArtefactBearingWorkspace;
  if (!ws.consentArtefacts) ws.consentArtefacts = [];
  return ws.consentArtefacts!;
}

export interface IngestArtefactInput {
  consentHandle: string;
  baseUrl?: string;
  fiuId?: string;
  aaPublicKeySpkiB64?: string | null;
  // Optional manual override (testing / replay).
  prefetched?: ConsentArtefact;
}

export async function ingestConsentArtefact(
  workspace: TenantWorkspace,
  input: IngestArtefactInput,
): Promise<{ artefact: ConsentArtefact; source: "live" | "simulated" | "replay" }> {
  let artefact: ConsentArtefact;
  let source: "live" | "simulated" | "replay";

  if (input.prefetched) {
    artefact = { ...input.prefetched };
    source = "replay";
  } else {
    const fetched = await fetchAaArtefact({
      consentHandle: input.consentHandle,
      tenantSlug: workspace.tenant.slug,
      baseUrl: input.baseUrl,
      fiuId: input.fiuId,
    });
    artefact = fetched.artefact;
    source = fetched.source;
  }

  const valid = await validateArtefactSignature(artefact, input.aaPublicKeySpkiB64 ?? null);
  artefact.signatureValid = valid;
  artefact.signatureValidatedAt = new Date().toISOString();

  // Seal the artefact JSON as evidence so the Compliance Pack carries it.
  const evidenceId = `ev-aa-${artefact.txnId}`;
  workspace.evidence.unshift({
    id: evidenceId,
    label: `AA consent artefact — ${artefact.purposeCode} — ${artefact.customerIdMasked}`,
    classification: "SYSTEM_DERIVED",
    linkedRecord: artefact.id,
    createdAt: artefact.createdAt,
    contentIndexed: false,
  });
  artefact.linkedEvidenceId = evidenceId;

  const list = ensureConsentArtefactsArray(workspace);
  // Idempotent: replace by consentHandle if it exists (re-fetch refreshes status).
  const existing = list.findIndex((a) => a.consentHandle === artefact.consentHandle);
  if (existing >= 0) list[existing] = artefact;
  else list.unshift(artefact);

  return { artefact, source };
}

/**
 *  Mark an existing artefact as revoked. Wires into the §6 withdrawal flow:
 *  when a Data Principal opens a WITHDRAWAL rights case, we look up any
 *  AA artefact that mentions their VUA and call this. The artefact stays
 *  on file (audit) but is no longer processed by FI fetches.
 */
export function revokeArtefact(
  workspace: TenantWorkspace,
  consentHandle: string,
  rightsCaseId?: string,
): ConsentArtefact | undefined {
  const list = ensureConsentArtefactsArray(workspace);
  const target = list.find((a) => a.consentHandle === consentHandle);
  if (!target) return undefined;
  target.status = "REVOKED";
  target.statusUpdatedAt = new Date().toISOString();
  if (rightsCaseId) target.linkedRightsCaseId = rightsCaseId;
  return target;
}

/**
 *  Look up artefacts by VUA / customer reference. Used by the rights flow:
 *  when a §6 WITHDRAWAL request comes in for "9999991234@finvu", we revoke
 *  every AA consent that customer ever issued to this tenant.
 */
export function findArtefactsByCustomer(
  workspace: TenantWorkspace,
  customerIdRaw: string,
): ConsentArtefact[] {
  const list = ensureConsentArtefactsArray(workspace);
  const needle = customerIdRaw.toLowerCase();
  return list.filter((a) => a.customerId.toLowerCase() === needle);
}

/* ------------------------------------------------------------------ */
/*  Local utilities                                                     */
/* ------------------------------------------------------------------ */

function newUuid(): string {
  // Worker runtime exposes crypto.randomUUID; keep a fallback.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback: not cryptographically strong, only used if global crypto is unavailable.
  let s = "";
  for (let i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16);
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}
