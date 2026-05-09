/**
 * Audit-log SIEM export.
 *
 * The single most-asked-for enterprise integration. Splunk, Datadog Logs,
 * Elastic SIEM, Sumo Logic, Chronicle — every one of them wants the same
 * thing: a long-lived bearer-authed HTTP endpoint that streams
 * newline-delimited JSON. Splunk HEC and Datadog Logs' HTTP intake both
 * speak this format natively, and Elastic's ingest pipelines accept it
 * via Filebeat's HTTP input.
 *
 * Design choices:
 *
 *  - **Long-lived API keys**, not session bearers. SIEM pollers don't
 *    refresh. We mint per-tenant, per-purpose keys with a SHA-256
 *    fingerprint persisted in the workspace; the raw key is shown once
 *    at creation and never retrievable afterwards.
 *
 *  - **Cursor-based pagination by createdAt**, not offset. The audit log
 *    is append-only (unshift on the client side, but a true sort by
 *    createdAt is the underlying order). A poller passes the last seen
 *    timestamp; we return everything strictly after it. No off-by-one,
 *    no missed events on reordering.
 *
 *  - **NDJSON content type** so curl/jq/Splunk forwarders can pipe the
 *    response directly. We deliberately do NOT wrap in a JSON array
 *    (would force the client to buffer the whole window in memory).
 *
 *  - **Per-key throttling.** Each key has a rolling 60-second window.
 *    1 request/sec is enough for any SIEM poller; abuse trips a 429.
 *
 *  - **Scope: read-only audit trail only.** Keys are NOT a substitute
 *    for session bearers. They CAN'T mutate state, log in users, or read
 *    other modules. This is the cleanest least-privilege footprint.
 */

import type { AuditEvent, TenantWorkspace } from "@prooflyt/contracts";

/* ------------------------------------------------------------------ */
/*  API key model                                                       */
/* ------------------------------------------------------------------ */

export interface AuditExportKey {
  id: string;                  // ak-...
  tenantSlug: string;
  label: string;               // "Splunk HEC", "Datadog logs poller"
  // Fingerprint = SHA-256(rawKey). The raw key is shown once at creation;
  // afterwards we only store the fingerprint so we can verify presented
  // keys without ever holding the plaintext.
  keyFingerprint: string;
  // Rolling rate-limit bucket; reset_at + count form a cheap leaky bucket.
  rateLimitWindowStart: number;
  rateLimitCount: number;
  active: boolean;
  createdAt: string;
  createdByUserId: string;
  lastUsedAt?: string;
  lastUsedFromIp?: string;
  // Cursor: clients SHOULD persist this, but we also remember the
  // server-side high-water-mark for safety nets.
  serverHighWaterCreatedAt?: string;
}

export type ExportKeyBearingWorkspace = TenantWorkspace & {
  auditExportKeys?: AuditExportKey[];
};

export function ensureAuditExportKeys(workspace: TenantWorkspace): AuditExportKey[] {
  const ws = workspace as ExportKeyBearingWorkspace;
  if (!ws.auditExportKeys) ws.auditExportKeys = [];
  return ws.auditExportKeys!;
}

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_PER_WINDOW = 60;     // 1/sec average
const KEY_PREFIX = "pflyt_ak_";            // visible discriminator
const KEY_BYTES = 32;                       // 256-bit raw

/* ------------------------------------------------------------------ */
/*  Key creation + revocation                                           */
/* ------------------------------------------------------------------ */

export interface CreateKeyResult {
  /** Full key (only returned at creation time). */
  rawKey: string;
  key: AuditExportKey;
}

export async function createAuditExportKey(
  workspace: TenantWorkspace,
  label: string,
  createdByUserId: string,
): Promise<CreateKeyResult> {
  const trimmed = label.trim();
  if (!trimmed) throw new Error("label is required.");
  if (trimmed.length > 80) throw new Error("label must be 80 chars or fewer.");
  const list = ensureAuditExportKeys(workspace);
  if (list.length >= 10) {
    throw new Error("Maximum of 10 audit-export keys per tenant. Revoke an unused one first.");
  }
  const rawKey = await generateRawKey();
  const fingerprint = await sha256Hex(rawKey);
  const key: AuditExportKey = {
    id: `ak-${Math.random().toString(36).slice(2, 10)}`,
    tenantSlug: workspace.tenant.slug,
    label: trimmed,
    keyFingerprint: fingerprint,
    rateLimitWindowStart: 0,
    rateLimitCount: 0,
    active: true,
    createdAt: new Date().toISOString(),
    createdByUserId,
  };
  list.unshift(key);
  return { rawKey, key };
}

export function revokeAuditExportKey(
  workspace: TenantWorkspace,
  id: string,
): boolean {
  const list = ensureAuditExportKeys(workspace);
  const target = list.find((k) => k.id === id);
  if (!target) return false;
  target.active = false;
  return true;
}

export function listAuditExportKeysPublic(workspace: TenantWorkspace) {
  const list = ensureAuditExportKeys(workspace);
  return list.map((k) => ({
    id: k.id,
    label: k.label,
    active: k.active,
    createdAt: k.createdAt,
    createdByUserId: k.createdByUserId,
    lastUsedAt: k.lastUsedAt,
    lastUsedFromIp: k.lastUsedFromIp,
    keyHint: `${KEY_PREFIX}…${k.keyFingerprint.slice(-8)}`,
  }));
}

/* ------------------------------------------------------------------ */
/*  Auth                                                                */
/* ------------------------------------------------------------------ */

export interface AuthResult {
  ok: true;
  key: AuditExportKey;
  workspace: TenantWorkspace;
}

export interface AuthFailure {
  ok: false;
  status: number;
  reason: string;
}

/**
 *  Resolve a bearer key against every workspace. We don't index keys by
 *  fingerprint at the AppState level today — the linear scan is fine for
 *  early-stage tenancy and avoids a separate map that can drift. Worth
 *  optimising once we have >1000 tenants.
 */
export async function authenticateExportKey(
  workspaces: Record<string, TenantWorkspace>,
  rawKey: string,
  fromIp: string | undefined,
): Promise<AuthResult | AuthFailure> {
  if (!rawKey || !rawKey.startsWith(KEY_PREFIX)) {
    return { ok: false, status: 401, reason: "Missing or malformed audit-export key." };
  }
  const fingerprint = await sha256Hex(rawKey);
  const now = Date.now();
  for (const slug of Object.keys(workspaces)) {
    const ws = workspaces[slug];
    if (!ws) continue;
    const list = (ws as ExportKeyBearingWorkspace).auditExportKeys ?? [];
    for (const k of list) {
      if (!constantTimeEqual(k.keyFingerprint, fingerprint)) continue;
      if (!k.active) {
        return { ok: false, status: 401, reason: "Key revoked." };
      }
      // Rate limit: reset window if expired.
      if (now - k.rateLimitWindowStart > RATE_LIMIT_WINDOW_MS) {
        k.rateLimitWindowStart = now;
        k.rateLimitCount = 0;
      }
      k.rateLimitCount += 1;
      if (k.rateLimitCount > RATE_LIMIT_MAX_PER_WINDOW) {
        return { ok: false, status: 429, reason: "Rate limit exceeded for this key." };
      }
      k.lastUsedAt = new Date(now).toISOString();
      if (fromIp) k.lastUsedFromIp = fromIp;
      return { ok: true, key: k, workspace: ws };
    }
  }
  return { ok: false, status: 401, reason: "Unknown audit-export key." };
}

/* ------------------------------------------------------------------ */
/*  NDJSON streaming                                                    */
/* ------------------------------------------------------------------ */

export interface ExportRequest {
  /** ISO timestamp; server returns events strictly after this. */
  since?: string;
  /** Cap the response — protects laggy collectors from blowing up. */
  limit?: number;
}

export interface ExportResult {
  body: string;          // NDJSON payload
  count: number;
  nextCursor?: string;   // pass back as ?since= on next call
  exhausted: boolean;    // true when no events remain after this batch
}

export const DEFAULT_LIMIT = 1000;
export const MAX_LIMIT = 5000;

export function exportAuditWindow(
  workspace: TenantWorkspace,
  request: ExportRequest,
  key: AuditExportKey,
): ExportResult {
  const limit = clamp(request.limit ?? DEFAULT_LIMIT, 1, MAX_LIMIT);
  const since = request.since ? new Date(request.since) : undefined;
  // workspace.auditTrail is unshift-ordered (newest first). Sort
  // ascending by createdAt so cursor pagination works monotonically.
  const sorted = workspace.auditTrail
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const filtered = since
    ? sorted.filter((e) => new Date(e.createdAt).getTime() > since.getTime())
    : sorted;
  const slice = filtered.slice(0, limit);
  const body = slice
    .map((e) => JSON.stringify(toSiemRecord(e, workspace.tenant.slug)))
    .join("\n");
  const exhausted = filtered.length <= limit;
  const nextCursor = slice.length > 0 ? slice[slice.length - 1].createdAt : request.since;
  // Update server-side high-water mark for diagnostics.
  if (nextCursor) key.serverHighWaterCreatedAt = nextCursor;
  return { body, count: slice.length, nextCursor, exhausted };
}

/**
 *  Stable, SIEM-friendly shape. We deliberately flatten and add a few
 *  fields (tenant, source) that every SIEM dashboard wants but the
 *  internal AuditEvent doesn't carry.
 */
function toSiemRecord(e: AuditEvent, tenantSlug: string) {
  return {
    "@timestamp": e.createdAt,
    source: "prooflyt",
    tenantSlug,
    auditId: e.id,
    actor: e.actor,
    module: e.module,
    action: e.action,
    targetId: e.targetId,
    summary: e.summary,
  };
}

/* ------------------------------------------------------------------ */
/*  Crypto + helpers                                                    */
/* ------------------------------------------------------------------ */

async function sha256Hex(s: string): Promise<string> {
  const buf = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  return Array.from(buf).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function generateRawKey(): Promise<string> {
  const rand = new Uint8Array(KEY_BYTES);
  crypto.getRandomValues(rand);
  let hex = "";
  for (const b of rand) hex += b.toString(16).padStart(2, "0");
  return `${KEY_PREFIX}${hex}`;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function clamp(n: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, n)); }
