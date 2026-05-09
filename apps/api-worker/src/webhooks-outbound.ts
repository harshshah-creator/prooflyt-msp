/**
 * Outbound webhook hub.
 *
 * Why: every Indian DPDP team already lives in Slack / PagerDuty / Datadog
 * / Opsgenie — they don't want yet another notification surface. Building
 * one bespoke integration per tool is a slog. A signed-webhook hub gets
 * us into all of them with a single primitive: tenants register an HTTPS
 * URL, pick events, get HMAC-signed POSTs.
 *
 * The natural emit point is appendAudit() — every state-changing
 * operation flows through it, so wiring webhook fan-out there means
 * every interesting event (incident opened, DSR submitted, retention
 * enforced, AA consent revoked, …) is delivered without changing the
 * call sites that already log audit entries.
 *
 * Delivery model:
 *  - Event emitted -> matching subscriptions -> per-subscription delivery
 *    record (PENDING) -> ctx.waitUntil(send + retry).
 *  - Signature: hex(HMAC-SHA256(secret, body)) in `x-prooflyt-signature`,
 *    plus `x-prooflyt-timestamp` to defeat replay. Subscribers verify by
 *    re-computing.
 *  - Per-subscription circuit breaker: 5 consecutive failures auto-pauses
 *    the subscription so a dead URL doesn't pile up infinite retries.
 *  - Last-N delivery records persisted on workspace.webhookDeliveries
 *    (capped at 100) for debugging.
 *
 * Subscription is idempotent on (tenantSlug + url + eventFilter) so the
 * UI's "Save webhook" button can re-POST without duplicating.
 */

import type { TenantWorkspace, User } from "@prooflyt/contracts";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

/**
 *  Event match grammar:
 *   - "*"                  every audit event
 *   - "incidents.*"        any audit action in the incidents module
 *   - "rights.RIGHTS_CASE_OPENED"   exact module.action match
 *   - "retention.*,incidents.*"     comma-separated alternatives
 */
export interface WebhookSubscription {
  id: string;
  tenantSlug: string;
  url: string;
  secretSealed: string;          // PBKDF2-AES-GCM sealed; never returned in list responses
  eventFilter: string;           // grammar above
  description?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  failureStreak: number;
  pausedReason?: string;
}

export interface WebhookDelivery {
  id: string;
  subscriptionId: string;
  eventType: string;             // module.action
  payloadSha256: string;
  status: "PENDING" | "SUCCESS" | "FAILED" | "CIRCUIT_OPEN";
  httpStatus?: number;
  attempts: number;
  lastError?: string;
  createdAt: string;
  deliveredAt?: string;
}

export type WebhookBearingWorkspace = TenantWorkspace & {
  webhookSubscriptions?: WebhookSubscription[];
  webhookDeliveries?: WebhookDelivery[];
};

/* ------------------------------------------------------------------ */
/*  Workspace shape helpers                                             */
/* ------------------------------------------------------------------ */

export function ensureWebhookArrays(workspace: TenantWorkspace): {
  subs: WebhookSubscription[];
  deliveries: WebhookDelivery[];
} {
  const ws = workspace as WebhookBearingWorkspace;
  if (!ws.webhookSubscriptions) ws.webhookSubscriptions = [];
  if (!ws.webhookDeliveries) ws.webhookDeliveries = [];
  return { subs: ws.webhookSubscriptions!, deliveries: ws.webhookDeliveries! };
}

const MAX_DELIVERY_LOG = 100;
const FAILURE_STREAK_THRESHOLD = 5;
const TIMEOUT_MS = 5_000;

/* ------------------------------------------------------------------ */
/*  Subscription CRUD                                                   */
/* ------------------------------------------------------------------ */

export interface RegisterInput {
  url: string;
  eventFilter: string;
  description?: string;
  rawSecret: string;
  masterSecret: string;
}

export async function registerSubscription(
  workspace: TenantWorkspace,
  input: RegisterInput,
  user: User,
): Promise<WebhookSubscription> {
  validateUrl(input.url);
  if (!input.rawSecret || input.rawSecret.length < 16) {
    throw new Error("Webhook secret must be at least 16 characters.");
  }
  if (!input.eventFilter.trim()) {
    throw new Error("eventFilter is required (use \"*\" to subscribe to everything).");
  }

  const { subs } = ensureWebhookArrays(workspace);
  const now = new Date().toISOString();
  const sealed = await sealSecret(input.rawSecret, input.masterSecret);

  // Idempotent: replace if (url, eventFilter) already exists for this tenant.
  const existing = subs.find(
    (s) => s.url === input.url && s.eventFilter === input.eventFilter,
  );
  if (existing) {
    existing.secretSealed = sealed;
    existing.description = input.description;
    existing.active = true;
    existing.failureStreak = 0;
    existing.pausedReason = undefined;
    existing.updatedAt = now;
    return existing;
  }

  const sub: WebhookSubscription = {
    id: `wh-${Math.random().toString(36).slice(2, 10)}`,
    tenantSlug: workspace.tenant.slug,
    url: input.url,
    secretSealed: sealed,
    eventFilter: input.eventFilter,
    description: input.description,
    active: true,
    createdAt: now,
    updatedAt: now,
    failureStreak: 0,
  };
  subs.unshift(sub);
  // Audit annotation in caller — we don't want this module pulling appendAudit.
  void user;
  return sub;
}

export function listSubscriptionsPublic(workspace: TenantWorkspace) {
  const { subs } = ensureWebhookArrays(workspace);
  return subs.map((s) => ({
    id: s.id,
    url: s.url,
    eventFilter: s.eventFilter,
    description: s.description,
    active: s.active,
    failureStreak: s.failureStreak,
    pausedReason: s.pausedReason,
    lastSuccessAt: s.lastSuccessAt,
    lastFailureAt: s.lastFailureAt,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }));
}

export function deleteSubscription(workspace: TenantWorkspace, id: string): boolean {
  const ws = workspace as WebhookBearingWorkspace;
  const before = (ws.webhookSubscriptions ?? []).length;
  ws.webhookSubscriptions = (ws.webhookSubscriptions ?? []).filter((s) => s.id !== id);
  return (ws.webhookSubscriptions.length ?? 0) < before;
}

export function pauseSubscription(
  workspace: TenantWorkspace,
  id: string,
  reason: string,
): WebhookSubscription | undefined {
  const sub = ensureWebhookArrays(workspace).subs.find((s) => s.id === id);
  if (!sub) return undefined;
  sub.active = false;
  sub.pausedReason = reason;
  sub.updatedAt = new Date().toISOString();
  return sub;
}

export function resumeSubscription(workspace: TenantWorkspace, id: string): WebhookSubscription | undefined {
  const sub = ensureWebhookArrays(workspace).subs.find((s) => s.id === id);
  if (!sub) return undefined;
  sub.active = true;
  sub.failureStreak = 0;
  sub.pausedReason = undefined;
  sub.updatedAt = new Date().toISOString();
  return sub;
}

/* ------------------------------------------------------------------ */
/*  Event matching                                                      */
/* ------------------------------------------------------------------ */

export function matchesFilter(eventType: string, filter: string): boolean {
  if (!filter || filter === "*") return true;
  const tokens = filter.split(",").map((s) => s.trim()).filter(Boolean);
  for (const token of tokens) {
    if (token === "*") return true;
    if (token === eventType) return true;
    if (token.endsWith(".*")) {
      const prefix = token.slice(0, -2);
      const eventPrefix = eventType.split(".")[0];
      if (eventPrefix === prefix) return true;
    }
  }
  return false;
}

/* ------------------------------------------------------------------ */
/*  Delivery                                                            */
/* ------------------------------------------------------------------ */

export interface DeliveryEnv {
  masterSecret: string;
  fetchImpl?: typeof fetch;
}

export interface FireOptions {
  eventType: string;       // "module.action"
  body: unknown;
  env: DeliveryEnv;
}

/**
 *  Synchronously fans out an event to all matching subscriptions, returning
 *  the list of in-flight Promises so the caller can `ctx.waitUntil` them
 *  without blocking the request.
 */
export function fireWebhooks(
  workspace: TenantWorkspace,
  options: FireOptions,
): Promise<void>[] {
  const { subs, deliveries } = ensureWebhookArrays(workspace);
  const promises: Promise<void>[] = [];
  for (const sub of subs) {
    if (!sub.active) continue;
    if (!matchesFilter(options.eventType, sub.eventFilter)) continue;
    promises.push(deliverOne(workspace, sub, options, deliveries));
  }
  return promises;
}

async function deliverOne(
  workspace: TenantWorkspace,
  sub: WebhookSubscription,
  options: FireOptions,
  deliveries: WebhookDelivery[],
): Promise<void> {
  const f = options.env.fetchImpl ?? fetch;
  const ts = new Date().toISOString();
  const bodyJson = JSON.stringify({
    eventType: options.eventType,
    tenantSlug: workspace.tenant.slug,
    occurredAt: ts,
    data: options.body,
  });
  const sha = await sha256Hex(bodyJson);

  const delivery: WebhookDelivery = {
    id: `whd-${Math.random().toString(36).slice(2, 10)}`,
    subscriptionId: sub.id,
    eventType: options.eventType,
    payloadSha256: sha,
    status: "PENDING",
    attempts: 0,
    createdAt: ts,
  };
  deliveries.unshift(delivery);
  // Cap log size.
  if (deliveries.length > MAX_DELIVERY_LOG) deliveries.length = MAX_DELIVERY_LOG;

  let secret: string;
  try {
    secret = await openSecretLocal(sub.secretSealed, options.env.masterSecret);
  } catch (err) {
    delivery.status = "FAILED";
    delivery.lastError = `Secret unsealing failed: ${(err as Error).message}`;
    sub.failureStreak += 1;
    sub.lastFailureAt = ts;
    return;
  }

  const sig = await hmacHex(secret, bodyJson);

  // Two attempts: original + one retry. Cloudflare Workers don't have
  // native job queues here; longer retries belong in a Durable Object alarm
  // (next iteration). Two attempts catches transient blips without piling
  // up sockets.
  for (let attempt = 1; attempt <= 2; attempt++) {
    delivery.attempts = attempt;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const res = await f(sub.url, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          "user-agent": "Prooflyt-Webhook/1",
          "x-prooflyt-event": options.eventType,
          "x-prooflyt-timestamp": ts,
          "x-prooflyt-signature": `sha256=${sig}`,
          "x-prooflyt-delivery": delivery.id,
        },
        body: bodyJson,
      });
      clearTimeout(timer);
      delivery.httpStatus = res.status;
      if (res.ok) {
        delivery.status = "SUCCESS";
        delivery.deliveredAt = new Date().toISOString();
        sub.failureStreak = 0;
        sub.lastSuccessAt = delivery.deliveredAt;
        return;
      }
      delivery.lastError = `HTTP ${res.status}`;
    } catch (err) {
      delivery.lastError = (err as Error).message || "fetch failed";
    }
    // brief inter-attempt pause
    if (attempt === 1) await sleep(750);
  }

  delivery.status = "FAILED";
  sub.failureStreak += 1;
  sub.lastFailureAt = new Date().toISOString();
  if (sub.failureStreak >= FAILURE_STREAK_THRESHOLD) {
    sub.active = false;
    sub.pausedReason = `Auto-paused after ${sub.failureStreak} consecutive failures.`;
    delivery.status = "CIRCUIT_OPEN";
  }
}

/* ------------------------------------------------------------------ */
/*  Crypto helpers                                                      */
/* ------------------------------------------------------------------ */

const PBKDF_ITERATIONS = 100_000;

async function deriveKey(masterSecret: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(masterSecret),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations: PBKDF_ITERATIONS, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function sealSecret(plaintext: string, masterSecret: string): Promise<string> {
  if (!masterSecret) throw new Error("CONNECTORS_MASTER_SECRET (or webhook master secret) is not set.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(masterSecret, salt);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as unknown as BufferSource }, key, new TextEncoder().encode(plaintext)),
  );
  return [base64Encode(salt), base64Encode(iv), base64Encode(ct)].join(".");
}

async function openSecretLocal(sealed: string, masterSecret: string): Promise<string> {
  if (!masterSecret) throw new Error("master secret is not set");
  const [saltB64, ivB64, ctB64] = sealed.split(".");
  if (!saltB64 || !ivB64 || !ctB64) throw new Error("malformed sealed secret");
  const salt = base64Decode(saltB64);
  const iv = base64Decode(ivB64);
  const ct = base64Decode(ctB64);
  const key = await deriveKey(masterSecret, salt);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as unknown as BufferSource }, key, ct as unknown as BufferSource);
  return new TextDecoder().decode(pt);
}

async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  return Array.from(sig).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(s: string): Promise<string> {
  const buf = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  return Array.from(buf).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function base64Encode(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function base64Decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 *  SSRF defence. Webhook URLs are tenant-supplied and we POST signed
 *  payloads to them, so a permissive validator is the difference between
 *  "tenants can hit Slack" and "tenants can pivot to our cloud's
 *  instance-metadata service and steal credentials".
 *
 *  We block:
 *   - Localhost / loopback (4 + 6)
 *   - RFC1918 private space (10/8, 172.16/12, 192.168/16)
 *   - Link-local 169.254/16 — covers AWS IMDS (169.254.169.254)
 *   - Azure Instance Metadata (168.63.129.16, fixed IP)
 *   - Cloud-metadata HOSTNAMES that resolve to those IPs even if the
 *     attacker uses the friendly name
 *   - mDNS .local
 *   - IPv6 loopback + link-local (fe80::/10)
 *
 *  Anything else (any public hostname/IP) is allowed — we trust DNS to
 *  not resolve to private space, but explicitly listing the fixed cloud
 *  metadata hostnames is the belt-and-braces step that defends against a
 *  malicious tenant who pastes a metadata URL directly.
 */
const SSRF_BLOCKED_HOSTNAMES = new Set([
  "metadata.google.internal",
  "metadata.goog",
  "metadata",
  "metadata.azure.com",
  "metadata.platformequinix.com",
  "instance-data",
  "instance-data.ec2.internal",
]);

function validateUrl(raw: string) {
  const url = new URL(raw); // throws on garbage
  if (url.protocol !== "https:") {
    throw new Error("Webhook URL must be HTTPS.");
  }
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host === "[::1]" ||
    host.startsWith("fe80:") ||              // IPv6 link-local
    host.startsWith("[fe80:") ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||              // AWS IMDS + general link-local v4
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === "168.63.129.16" ||              // Azure Instance Metadata fixed IP
    host === "100.100.100.200" ||            // Alibaba Cloud metadata
    SSRF_BLOCKED_HOSTNAMES.has(host) ||
    host.endsWith(".internal")               // *.internal catch-all (GCE/AWS/etc.)
  ) {
    throw new Error("Webhook URL points at a private/internal host or cloud metadata service.");
  }
}
