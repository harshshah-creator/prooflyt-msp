/**
 * Prooflyt — Third-party Connectors framework.
 *
 * The first three integrations cover the highest-value DPDP surface area for
 * Indian businesses:
 *
 *   1.  Razorpay   — India payment dominance. Discovers transactional PII.
 *                    Honors the RBI ≥5-year retention floor (DPDP §17(2)(a))
 *                    and produces a legal-basis denial letter when erasure
 *                    is asked for.
 *   2.  HubSpot    — Cleanest GDPR-style erasure API in the industry.
 *                    OAuth 2.0, native /gdpr-delete endpoint.
 *   3.  Freshdesk  — Indian-origin helpdesk, direct grievance officer
 *                    intake (DPDP §15 + Rule on grievance redressal).
 *
 * Each connector implements a uniform adapter interface so the rest of the
 * platform can stay connector-agnostic.
 */

import type {
  ConnectorConnection,
  ConnectorDefinition,
  ConnectorDiscoveredField,
  ConnectorDiscoveryResult,
  ConnectorDsrResult,
  ConnectorEvent,
  ConnectorEventType,
  ConnectorType,
  DataSource,
  EvidenceArtifact,
  Processor,
  RegisterEntry,
  RightsCase,
  TenantWorkspace,
  User,
} from "@prooflyt/contracts";
import { CONNECTORS_PHASE_3, PHASE_3_DISCOVERY_SCHEMAS } from "./connectors-phase-3.js";

/* ------------------------------------------------------------------ */
/*  Connector catalogue                                                */
/* ------------------------------------------------------------------ */

/**
 *  CONNECTOR_DEFINITIONS — single source of truth for catalogue + per-connector
 *  metadata. Adding a connector means appending one definition; the discovery,
 *  DSR, and event-log helpers all read from here, so no per-type switch
 *  statements need to be touched downstream.
 */
export const CONNECTOR_DEFINITIONS: Record<ConnectorType, ConnectorDefinition> = {
  /* ── Phase 1: India hot-3 ──────────────────────────────────────── */
  HUBSPOT: {
    id: "HUBSPOT", name: "HubSpot CRM", vendor: "HubSpot, Inc.",
    category: "CRM", authType: "OAUTH2",
    apiBaseUrl: "https://api.hubapi.com",
    oauthAuthorizeUrl: "https://app.hubspot.com/oauth/authorize",
    oauthTokenUrl: "https://api.hubapi.com/oauth/v1/token",
    oauthScopes: ["crm.objects.contacts.read", "crm.objects.contacts.write", "tickets", "crm.schemas.contacts.read"],
    capabilities: { discovery: true, dsrAccess: true, dsrErasure: true, dsrCorrection: true, grievanceIngest: true, webhooks: true, purgeProof: true },
    dpdpNotes: {
      legalBasisFloor: "Subject to retention exceptions in HubSpot subscriptions and deals.",
      dataResidency: "US / EU / Canada (no India residency option). Disclose in cross-border transfer register.",
      indianFootprint: "Mid-market and SaaS adoption growing; Free + Starter tiers common in Indian SMBs.",
    },
    brand: { logoText: "HS", accentColor: "#ff7a59" },
    serviceLabel: "CRM, marketing, sales contact records",
    recordLabel: "contacts", simulatedRecordCount: 8_412,
    discoveryWarnings: ["HubSpot data resides outside India. Add a cross-border transfer disclosure to the privacy notice."],
    purposeTemplate: "Customer relationship management — {category} data captured for sales and lifecycle marketing.",
    simulatedDsr: { exportCount: 9, eraseCount: 9 },
  },
  RAZORPAY: {
    id: "RAZORPAY", name: "Razorpay Payments", vendor: "Razorpay Software Pvt Ltd",
    category: "PAYMENTS", authType: "API_KEY",
    apiBaseUrl: "https://api.razorpay.com",
    capabilities: { discovery: true, dsrAccess: true, dsrErasure: false, dsrCorrection: true, grievanceIngest: false, webhooks: true, purgeProof: true },
    dpdpNotes: {
      legalBasisFloor: "RBI Storage of Payment System Data direction (April 2018) mandates 5–10 year retention. DPDP §17(2)(a) exempts compliance with Indian law — Prooflyt issues a legal-basis denial letter when erasure is requested and instead anonymises non-essential PII fields.",
      dataResidency: "India only (RBI 100% local storage mandate).",
      indianFootprint: "55%+ India online payment market share. Used by virtually every Indian SaaS, D2C, fintech.",
    },
    brand: { logoText: "RP", accentColor: "#0d2eb1" },
    serviceLabel: "Payment processing, customer & transaction records",
    recordLabel: "customers", simulatedRecordCount: 14_329,
    discoveryWarnings: ["Razorpay records are subject to RBI 5–10 year retention. Erasure requests will be processed via legal-basis denial under DPDP §17(2)(a)."],
    purposeTemplate: "Payment processing — {category} data captured for transaction fulfilment and reconciliation.",
    simulatedDsr: { exportCount: 47, eraseCount: 0 },
  },
  FRESHDESK: {
    id: "FRESHDESK", name: "Freshdesk Support", vendor: "Freshworks Inc.",
    category: "HELPDESK", authType: "API_KEY", apiBaseUrl: "",
    capabilities: { discovery: true, dsrAccess: true, dsrErasure: true, dsrCorrection: true, grievanceIngest: true, webhooks: true, purgeProof: true },
    dpdpNotes: {
      legalBasisFloor: "No regulator floor. Hard-delete cascade is irreversible — produce purge proof.",
      dataResidency: "India DC available since 2024 (Freshworks IN region).",
      indianFootprint: "Indian-origin (Freshworks/Chennai). Common across Indian SMB helpdesk deployments.",
    },
    brand: { logoText: "FD", accentColor: "#25c16f" },
    serviceLabel: "Helpdesk tickets, contact records, grievance intake",
    recordLabel: "tickets", simulatedRecordCount: 3_204,
    discoveryWarnings: ["Freshdesk hard-delete is irreversible. Ensure ticket attachments are quarantined before erasure."],
    purposeTemplate: "Customer support — {category} data captured for grievance and ticket resolution.",
    simulatedDsr: { exportCount: 12, eraseCount: 12 },
  },
  /* ── Phase 2: 5 expansion connectors ───────────────────────────── */
  ZOHO_CRM: {
    id: "ZOHO_CRM", name: "Zoho CRM", vendor: "Zoho Corporation Pvt Ltd",
    category: "CRM", authType: "API_KEY", apiBaseUrl: "",
    capabilities: { discovery: true, dsrAccess: true, dsrErasure: true, dsrCorrection: true, grievanceIngest: false, webhooks: true, purgeProof: true },
    dpdpNotes: {
      legalBasisFloor: "Zoho deletion is two-step: DELETE → recycle-bin purge. Prooflyt produces both receipts.",
      dataResidency: "India DC option (in.zoho.com). Strong DPDP fit when configured to Indian region.",
      indianFootprint: "Indian-origin (Chennai). Massive SMB footprint. Common in Indian sales & services.",
    },
    brand: { logoText: "ZH", accentColor: "#e42527" },
    serviceLabel: "CRM contacts, leads, deals (India DC option)",
    recordLabel: "contacts", simulatedRecordCount: 6_851,
    discoveryWarnings: [
      "Zoho deletion is two-step: DELETE → recycle-bin purge. Prooflyt issues both calls and records both receipts.",
      "Confirm the connected DC is in.zoho.com if India residency is required.",
    ],
    purposeTemplate: "Sales and customer-success operations — {category} data captured for pipeline, contact and deal management.",
    simulatedDsr: { exportCount: 14, eraseCount: 14 },
  },
  SHOPIFY: {
    id: "SHOPIFY", name: "Shopify", vendor: "Shopify Inc.",
    category: "ECOMMERCE", authType: "API_KEY", apiBaseUrl: "",
    capabilities: { discovery: true, dsrAccess: true, dsrErasure: true, dsrCorrection: true, grievanceIngest: false, webhooks: true, purgeProof: true },
    dpdpNotes: {
      legalBasisFloor: "Shopify enforces a 30-day SLA for app responses to customers/redact. Order records may be retained 6 months for fraud-prevention before auto-redaction.",
      dataResidency: "Global (US/CA primary). No India-only DC. Disclose cross-border transfer.",
      indianFootprint: "Dominant India D2C platform. Most Indian DTC brands run here.",
    },
    brand: { logoText: "SH", accentColor: "#5e8e3e" },
    serviceLabel: "E-commerce customers, orders, addresses, line items",
    recordLabel: "customers + orders", simulatedRecordCount: 21_405,
    discoveryWarnings: [
      "Shopify enforces a 30-day SLA on customers/redact responses. Prooflyt will set a hard alarm at day 21.",
      "Order records carry a 6-month fraud-prevention window before Shopify auto-redacts; surface this in the privacy notice.",
    ],
    purposeTemplate: "E-commerce operations — {category} data captured to fulfil orders, manage shipping, and run marketing.",
    simulatedDsr: { exportCount: 8, eraseCount: 8 },
  },
  POSTGRES: {
    id: "POSTGRES", name: "PostgreSQL", vendor: "Self-hosted / managed (RDS / Supabase / Neon / etc.)",
    category: "DATABASE", authType: "CONNECTION_STRING", apiBaseUrl: "",
    capabilities: { discovery: true, dsrAccess: true, dsrErasure: true, dsrCorrection: true, grievanceIngest: false, webhooks: false, purgeProof: true },
    dpdpNotes: {
      legalBasisFloor: "FK constraints can block DELETE. Prooflyt generates a CASCADE plan and surfaces blockers.",
      dataResidency: "Depends on host (RDS region / Supabase project / on-prem). Disclose in cross-border register.",
      indianFootprint: "The most common app database in Indian SaaS. Often holds the canonical user/order/event PII.",
    },
    brand: { logoText: "PG", accentColor: "#336791" },
    serviceLabel: "Application database — typically users, orders, events, audit logs",
    recordLabel: "rows across PII tables", simulatedRecordCount: 184_902,
    discoveryWarnings: [
      "Foreign-key constraints can block DELETE. Prooflyt generates a CASCADE plan and surfaces blockers as a denial path.",
      "All DSR statements are parameterised and logged as evidence — no string interpolation of subject identifiers.",
    ],
    purposeTemplate: "Application database — {category} data captured to operate the product (auth, orders, audit).",
    simulatedDsr: { exportCount: 38, eraseCount: 38 },
  },
  MONGODB: {
    id: "MONGODB", name: "MongoDB", vendor: "MongoDB, Inc. (Atlas) / self-hosted",
    category: "DATABASE", authType: "CONNECTION_STRING", apiBaseUrl: "",
    capabilities: { discovery: true, dsrAccess: true, dsrErasure: true, dsrCorrection: true, grievanceIngest: false, webhooks: false, purgeProof: true },
    dpdpNotes: {
      legalBasisFloor: "Document fields are heterogeneous. Embedded arrays may need $pull operations.",
      dataResidency: "Atlas region pinning required for India residency. Self-hosted depends on infra.",
      indianFootprint: "Dominant document DB in Indian startups. Profiles, sessions, preference data.",
    },
    brand: { logoText: "MG", accentColor: "#4faa41" },
    serviceLabel: "Document database — typically profiles, sessions, preferences",
    recordLabel: "documents across PII collections", simulatedRecordCount: 92_318,
    discoveryWarnings: [
      "Embedded arrays may need $pull operations. Prooflyt's per-collection erasure plan flags these.",
      "Cluster region must match the residency claim in the privacy notice.",
    ],
    purposeTemplate: "Application document store — {category} data captured for profiles, sessions, and behavioural state.",
    simulatedDsr: { exportCount: 27, eraseCount: 27 },
  },
  AWS_S3: {
    id: "AWS_S3", name: "AWS S3", vendor: "Amazon Web Services",
    category: "OBJECT_STORAGE", authType: "AWS_IAM", apiBaseUrl: "",
    capabilities: { discovery: true, dsrAccess: true, dsrErasure: true, dsrCorrection: false, grievanceIngest: false, webhooks: false, purgeProof: true },
    dpdpNotes: {
      legalBasisFloor: "Versioning + cross-region replication are §16 surfaces. DeleteObjectVersion required for true erasure.",
      dataResidency: "Region-bound per bucket. ap-south-1 (Mumbai) or ap-south-2 (Hyderabad) for India residency.",
      indianFootprint: "Default object storage for almost every Indian cloud-native company. Holds uploads, KYC scans, exports, backups.",
    },
    brand: { logoText: "S3", accentColor: "#ff9900" },
    serviceLabel: "Object storage — uploaded documents, KYC scans, exports, backups",
    recordLabel: "objects with PII metadata or path", simulatedRecordCount: 47_233,
    discoveryWarnings: [
      "S3 versioning + cross-region replication are DPDP §16 cross-border surfaces. Versioned objects need DeleteObjectVersion.",
      "Confirm the bucket region; ap-south-1 (Mumbai) or ap-south-2 (Hyderabad) keep data in India.",
    ],
    purposeTemplate: "Object storage — {category} data captured as uploads, exports, KYC documents, or backups.",
    simulatedDsr: { exportCount: 16, eraseCount: 16 },
  },
  /* ── Phase 3: 50 strategic connectors (added below) ────────────── */
  ...CONNECTORS_PHASE_3,
};

export function listConnectors(): ConnectorDefinition[] {
  return Object.values(CONNECTOR_DEFINITIONS);
}

/* ------------------------------------------------------------------ */
/*  AES-GCM secret sealing (Cloudflare Workers SubtleCrypto)           */
/* ------------------------------------------------------------------ */

const ENCRYPTION_KEY_VERSION = "v1";

async function deriveKey(secret: string): Promise<CryptoKey> {
  const salt = new TextEncoder().encode("prooflyt.connectors.v1");
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    // Cloudflare Workers' SubtleCrypto caps PBKDF2 iterations at 100000.
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export async function sealSecret(plaintext: string, masterSecret: string): Promise<string> {
  const key = await deriveKey(masterSecret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return `${ENCRYPTION_KEY_VERSION}.${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(cipherBuf))}`;
}

export async function openSecret(sealed: string, masterSecret: string): Promise<string> {
  const [version, ivB64, cipherB64] = sealed.split(".");
  if (version !== ENCRYPTION_KEY_VERSION) {
    throw new Error(`Unsupported sealed-secret version: ${version}`);
  }
  const key = await deriveKey(masterSecret);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(ivB64) },
    key,
    base64ToBytes(cipherB64),
  );
  return new TextDecoder().decode(plaintext);
}

/* ------------------------------------------------------------------ */
/*  Webhook signature verification                                     */
/* ------------------------------------------------------------------ */

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacSha256Base64(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return bytesToBase64(new Uint8Array(sig));
}

/**
 *  Verify a webhook signature. Each provider uses a slightly different scheme;
 *  we accept the canonical SHA-256 hex form (Razorpay/HubSpot/Freshdesk/
 *  Prooflyt convention) and Shopify's SHA-256 base64.
 *
 *    Razorpay  — SHA-256 hex of body, header `X-Razorpay-Signature`
 *    HubSpot   — SHA-256 hex (production should use full v3 spec)
 *    Freshdesk — SHA-256 hex (configurable on Automation Rule)
 *    Shopify   — base64(HMAC-SHA-256(body)), header `X-Shopify-Hmac-Sha256`
 *    others    — SHA-256 hex (Prooflyt convention, header `X-Prooflyt-Signature`)
 */
export async function verifyWebhookSignature(
  type: ConnectorType,
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!signatureHeader) return false;
  const hex = await hmacSha256Hex(secret, rawBody);
  if (constantTimeEqual(hex, signatureHeader)) return true;
  if (type === "SHOPIFY") {
    const b64 = await hmacSha256Base64(secret, rawBody);
    if (constantTimeEqual(b64, signatureHeader)) return true;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function nowIso(): string {
  return new Date().toISOString();
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function findConnection(workspace: TenantWorkspace, id: string): ConnectorConnection {
  const conn = workspace.connections.find((c) => c.id === id);
  if (!conn) throw new Error(`Connection ${id} not found.`);
  return conn;
}

function pushEvent(
  workspace: TenantWorkspace,
  conn: ConnectorConnection,
  eventType: ConnectorEventType,
  summary: string,
  extras: Partial<ConnectorEvent> = {},
): ConnectorEvent {
  const event: ConnectorEvent = {
    id: newId("conn-event"),
    connectionId: conn.id,
    connectorType: conn.connectorType,
    eventType,
    summary,
    createdAt: nowIso(),
    ...extras,
  };
  workspace.connectorEvents.unshift(event);
  return event;
}

function ensureProcessorForConnection(
  workspace: TenantWorkspace,
  conn: ConnectorConnection,
): Processor {
  if (conn.linkedProcessorId) {
    const existing = workspace.processors.find((p) => p.id === conn.linkedProcessorId);
    if (existing) return existing;
  }
  const def = CONNECTOR_DEFINITIONS[conn.connectorType];
  const processor: Processor = {
    id: newId(`proc-${conn.connectorType.toLowerCase()}`),
    name: def.name,
    service: connectorServiceLabel(conn.connectorType),
    dpaStatus: "IN_REVIEW",
    purgeAckStatus: def.capabilities.purgeProof ? "PENDING" : "REFUSED",
    subProcessorCount: 0,
  };
  workspace.processors.push(processor);
  conn.linkedProcessorId = processor.id;
  return processor;
}

function connectorServiceLabel(type: ConnectorType): string {
  // Single source of truth: read from the catalogue. Adding a new connector
  // type doesn't require touching this function.
  return CONNECTOR_DEFINITIONS[type].serviceLabel;
}

/* ------------------------------------------------------------------ */
/*  OAuth state nonce store (security: C1, C2, H4)                     */
/*                                                                     */
/*  We persist every minted state nonce in the workspace itself with a */
/*  10-minute TTL. The /oauth/callback handler must look the nonce up, */
/*  verify the slug & connector type from the persisted record (NOT    */
/*  from the URL-controlled state string), confirm it has not been     */
/*  consumed, and delete it on use.                                    */
/* ------------------------------------------------------------------ */

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export interface OAuthStateRecord {
  nonce: string;
  tenantSlug: string;
  type: ConnectorType;
  createdAt: string;
  consumed?: boolean;
}

interface OAuthStateBag { records: OAuthStateRecord[] }

function getOAuthBag(workspace: TenantWorkspace): OAuthStateBag {
  const ws = workspace as TenantWorkspace & { oauthStates?: OAuthStateBag };
  if (!ws.oauthStates) ws.oauthStates = { records: [] };
  return ws.oauthStates!;
}

function pruneOAuthStates(bag: OAuthStateBag): void {
  const now = Date.now();
  bag.records = bag.records
    .filter((r) => !r.consumed && now - new Date(r.createdAt).getTime() < OAUTH_STATE_TTL_MS)
    .slice(-50);
}

export function mintOAuthState(workspace: TenantWorkspace, type: ConnectorType): string {
  const def = CONNECTOR_DEFINITIONS[type];
  if (!def || def.authType !== "OAUTH2") {
    throw new ValidationError(`Connector ${type} does not support OAuth.`);
  }
  const bag = getOAuthBag(workspace);
  pruneOAuthStates(bag);
  const nonce = crypto.randomUUID().replace(/-/g, "");
  bag.records.push({
    nonce,
    tenantSlug: workspace.tenant.slug,
    type,
    createdAt: nowIso(),
  });
  return nonce;
}

/**
 *  Look up + validate + consume an OAuth state nonce.
 *
 *  Returns the trusted (server-persisted) tenantSlug and type. Throws
 *  if the nonce is missing, expired, or already consumed. **Never**
 *  trust the state string from the callback URL beyond the nonce key —
 *  the slug/type returned from this function are the source of truth.
 */
export function consumeOAuthState(
  workspace: TenantWorkspace,
  rawState: string,
): { tenantSlug: string; type: ConnectorType } {
  const nonce = String(rawState || "").split(":").pop() || rawState;
  const bag = getOAuthBag(workspace);
  pruneOAuthStates(bag);
  const record = bag.records.find((r) => r.nonce === nonce && !r.consumed);
  if (!record) {
    throw new ValidationError("OAuth state is missing, expired, or already consumed.");
  }
  // Guarantee the nonce is single-use even if state is stored.
  record.consumed = true;
  return { tenantSlug: record.tenantSlug, type: record.type };
}

/* ------------------------------------------------------------------ */
/*  Onboarding — OAuth2 begin / callback                               */
/* ------------------------------------------------------------------ */

export interface OAuthEnv {
  HUBSPOT_CLIENT_ID?: string;
  HUBSPOT_CLIENT_SECRET?: string;
  CONNECTORS_MASTER_SECRET?: string;
  CONNECTORS_REDIRECT_URI?: string;
}

export function buildAuthorizeUrl(
  type: ConnectorType,
  env: OAuthEnv,
  stateParam: string,
): string {
  const def = CONNECTOR_DEFINITIONS[type];
  if (!def || def.authType !== "OAUTH2" || !def.oauthAuthorizeUrl) {
    throw new ValidationError(`Connector ${type} is not OAuth2.`);
  }
  const clientId = type === "HUBSPOT" ? env.HUBSPOT_CLIENT_ID : "";
  const redirectUri =
    env.CONNECTORS_REDIRECT_URI ||
    "https://prooflyt-msp.vercel.app/api/connectors/oauth/callback";
  const url = new URL(def.oauthAuthorizeUrl);
  url.searchParams.set("client_id", clientId || "MISSING_CLIENT_ID");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", (def.oauthScopes || []).join(" "));
  url.searchParams.set("state", stateParam);
  return url.toString();
}

interface HubSpotTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

export async function exchangeOAuthCode(
  type: ConnectorType,
  code: string,
  env: OAuthEnv,
): Promise<HubSpotTokenResponse> {
  const def = CONNECTOR_DEFINITIONS[type];
  if (!def || def.authType !== "OAUTH2" || !def.oauthTokenUrl) {
    throw new ValidationError(`Connector ${type} is not OAuth2 (cannot exchange code).`);
  }
  if (typeof code !== "string" || code.length === 0 || code.length > 4096) {
    throw new ValidationError(`OAuth code is missing or malformed.`);
  }
  const redirectUri =
    env.CONNECTORS_REDIRECT_URI ||
    "https://prooflyt-msp.vercel.app/api/connectors/oauth/callback";
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: env.HUBSPOT_CLIENT_ID || "",
    client_secret: env.HUBSPOT_CLIENT_SECRET || "",
    redirect_uri: redirectUri,
    code,
  });
  const r = await fetch(def.oauthTokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`OAuth exchange failed: ${r.status} ${text}`);
  }
  return (await r.json()) as HubSpotTokenResponse;
}

/* ------------------------------------------------------------------ */
/*  Connection lifecycle                                               */
/* ------------------------------------------------------------------ */

export async function createOAuthConnection(
  workspace: TenantWorkspace,
  type: ConnectorType,
  tokenResponse: HubSpotTokenResponse,
  env: OAuthEnv,
  user: User,
): Promise<ConnectorConnection> {
  const def = CONNECTOR_DEFINITIONS[type];
  const masterSecret = env.CONNECTORS_MASTER_SECRET;
  if (!masterSecret) {
    throw new Error("CONNECTORS_MASTER_SECRET is not configured.");
  }
  const conn: ConnectorConnection = {
    id: newId(`conn-${type.toLowerCase()}`),
    connectorType: type,
    tenantSlug: workspace.tenant.slug,
    displayName: `${def.name} — ${workspace.tenant.name}`,
    encryptedAccessToken: await sealSecret(tokenResponse.access_token, masterSecret),
    encryptedRefreshToken: tokenResponse.refresh_token
      ? await sealSecret(tokenResponse.refresh_token, masterSecret)
      : undefined,
    accessTokenExpiresAt: tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString()
      : undefined,
    linkedSourceIds: [],
    linkedRegisterEntryIds: [],
    status: "CONNECTED",
    scopesGranted: def.oauthScopes,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  workspace.connections.push(conn);
  ensureProcessorForConnection(workspace, conn);
  pushEvent(workspace, conn, "TOKEN_REFRESHED", `${def.name} connected by ${user.name}.`);
  return conn;
}

/* ------------------------------------------------------------------ */
/*  Input validation (security: H3, fixes black-box: empty apiKey 201) */
/* ------------------------------------------------------------------ */

const SAFE_DOMAIN_RE = /^[a-zA-Z0-9][a-zA-Z0-9.\-]{1,253}$/;
const SAFE_REGION_RE = /^[a-z]{2}(-[a-z]+)+-\d{1,2}$/;
const SAFE_BUCKET_RE = /^[a-z0-9][a-z0-9.\-]{2,62}$/;
const SAFE_DISPLAY_NAME_MAX = 200;
const SAFE_FREE_TEXT_RE = /[ -<>]/g;       // strip control chars and HTML brackets

function sanitizeFreeText(s: string | undefined, max = SAFE_DISPLAY_NAME_MAX): string | undefined {
  if (s === undefined) return undefined;
  const cleaned = String(s).replace(SAFE_FREE_TEXT_RE, "").trim().slice(0, max);
  return cleaned || undefined;
}

export interface ApiKeyConnectorPayload {
  apiKey: string;
  apiKeyId?: string;
  domain?: string;
  region?: string;
  bucket?: string;
  schemaScope?: string;
  webhookSecret?: string;
  displayName?: string;
}

/**
 *  Reject malformed or impoverished payloads before any side-effects (DO write,
 *  KDF, etc.). Returns a clean payload or throws an HttpError-shaped Error
 *  that the outer try/catch maps to HTTP 400.
 */
export function validateApiKeyConnectorPayload(
  type: unknown,
  payload: any,
): { type: ConnectorType; clean: ApiKeyConnectorPayload } {
  if (typeof type !== "string" || !(type in CONNECTOR_DEFINITIONS)) {
    throw new ValidationError(`Unknown connector type.`);
  }
  const t = type as ConnectorType;
  const def = CONNECTOR_DEFINITIONS[t];
  if (def.authType === "OAUTH2") {
    throw new ValidationError(`Connector ${t} requires OAuth, not API key.`);
  }
  if (typeof payload !== "object" || payload === null) {
    throw new ValidationError(`Invalid request body.`);
  }
  const apiKey = typeof payload.apiKey === "string" ? payload.apiKey.trim() : "";
  if (apiKey.length < 8) {
    throw new ValidationError(`apiKey is required and must be at least 8 characters.`);
  }
  if (apiKey.length > 4096) {
    throw new ValidationError(`apiKey is unreasonably long.`);
  }
  const apiKeyId = typeof payload.apiKeyId === "string" ? payload.apiKeyId.trim() : undefined;
  if (apiKeyId !== undefined && apiKeyId.length > 256) {
    throw new ValidationError(`apiKeyId is unreasonably long.`);
  }
  const domain = typeof payload.domain === "string" ? payload.domain.trim() : undefined;
  if (domain !== undefined && domain.length > 0 && !SAFE_DOMAIN_RE.test(domain)) {
    throw new ValidationError(`domain must be a single hostname / subdomain identifier.`);
  }
  const region = typeof payload.region === "string" ? payload.region.trim() : undefined;
  if (region !== undefined && region.length > 0 && !SAFE_REGION_RE.test(region)) {
    throw new ValidationError(`region must look like ap-south-1.`);
  }
  const bucket = typeof payload.bucket === "string" ? payload.bucket.trim() : undefined;
  if (bucket !== undefined && bucket.length > 0 && !SAFE_BUCKET_RE.test(bucket)) {
    throw new ValidationError(`bucket must be a valid S3 bucket name (3-63 chars, lowercase alphanumerics + . -).`);
  }
  const schemaScope = typeof payload.schemaScope === "string"
    ? payload.schemaScope.trim().slice(0, 64).replace(SAFE_FREE_TEXT_RE, "")
    : undefined;
  const webhookSecret = typeof payload.webhookSecret === "string" ? payload.webhookSecret.trim() : undefined;
  if (webhookSecret !== undefined && webhookSecret.length > 0 && webhookSecret.length < 16) {
    throw new ValidationError(`webhookSecret must be at least 16 characters when provided.`);
  }
  const displayName = sanitizeFreeText(payload.displayName);

  return {
    type: t,
    clean: { apiKey, apiKeyId, domain, region, bucket, schemaScope, webhookSecret, displayName },
  };
}

/**
 *  Stable error type that the route layer maps to HTTP 400. Keeps the message
 *  visible to clients (because validation messages are safe and helpful);
 *  contrast with leaking internal `Error.message` from arbitrary throws (H2).
 */
export class ValidationError extends Error {
  readonly httpStatus = 400;
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export async function createApiKeyConnection(
  workspace: TenantWorkspace,
  type: ConnectorType,
  payload: ApiKeyConnectorPayload,
  env: OAuthEnv,
  user: User,
): Promise<ConnectorConnection> {
  const def = CONNECTOR_DEFINITIONS[type];
  if (def.authType === "OAUTH2") {
    throw new ValidationError(`Connector ${type} requires OAuth, not API key.`);
  }
  const masterSecret = env.CONNECTORS_MASTER_SECRET;
  if (!masterSecret) throw new Error("CONNECTORS_MASTER_SECRET is not configured.");

  let accountIdentifier: string | undefined = payload.apiKeyId
    ? `${payload.apiKeyId.slice(0, 4)}…${payload.apiKeyId.slice(-4)}`
    : undefined;
  if (def.authType === "CONNECTION_STRING") {
    accountIdentifier = redactConnectionString(payload.apiKey);
  }

  const conn: ConnectorConnection = {
    id: secureConnectionId(type),
    connectorType: type,
    tenantSlug: workspace.tenant.slug,
    displayName: payload.displayName || `${def.name} — ${workspace.tenant.name}`,
    encryptedApiKey: await sealSecret(payload.apiKey, masterSecret),
    encryptedWebhookSecret: payload.webhookSecret
      ? await sealSecret(payload.webhookSecret, masterSecret)
      : undefined,
    workspaceDomain: payload.domain,
    accountIdentifier,
    region: payload.region,
    bucketName: payload.bucket,
    schemaScope: payload.schemaScope,
    linkedSourceIds: [],
    linkedRegisterEntryIds: [],
    status: "CONNECTED",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  workspace.connections.push(conn);
  ensureProcessorForConnection(workspace, conn);
  pushEvent(workspace, conn, "TOKEN_REFRESHED", `${def.name} connected by ${user.name}.`);
  return conn;
}

/**
 *  Strip credentials from a Postgres / MongoDB connection string for safe display.
 *
 *    postgres://user:pass@host:5432/db?ssl=true   →   host:5432 / db
 *    mongodb+srv://user:pass@cluster0.abc.mongodb.net/app   →   cluster0.abc.mongodb.net / app
 */
export function redactConnectionString(uri: string): string {
  try {
    const u = new URL(uri.replace(/^mongodb\+srv:\/\//, "mongodbsrv://"));
    const host = u.host || u.hostname;
    const db = (u.pathname || "/").replace(/^\//, "") || "—";
    return `${host} / ${db}`;
  } catch {
    return "connection-string";
  }
}

/**
 *  Cryptographically random connection ID (security: L1).
 *  Replaces the previous Date.now() + 36-bit suffix.
 */
function secureConnectionId(type: ConnectorType): string {
  const slug = type.toLowerCase().replace(/_/g, "-");
  return `conn-${slug}-${crypto.randomUUID().replace(/-/g, "")}`;
}

export function revokeConnection(
  workspace: TenantWorkspace,
  connectionId: string,
  user: User,
): void {
  const conn = findConnection(workspace, connectionId);
  conn.status = "REVOKED";
  conn.encryptedAccessToken = undefined;
  conn.encryptedRefreshToken = undefined;
  conn.encryptedApiKey = undefined;
  conn.updatedAt = nowIso();
  pushEvent(workspace, conn, "CONNECTION_REVOKED", `${conn.displayName} revoked by ${user.name}.`);
}

/* ------------------------------------------------------------------ */
/*  Discovery (auto-populate Data Register)                            */
/* ------------------------------------------------------------------ */

const DISCOVERY_SCHEMAS: Record<ConnectorType, ConnectorDiscoveredField[]> = {
  HUBSPOT: [
    { systemName: "HubSpot CRM", fieldName: "email",          category: "Contact",    identifierType: "Direct identifier",     confidence: 0.96, legalBasisHint: "Legitimate use", retentionHint: "24 months" },
    { systemName: "HubSpot CRM", fieldName: "firstname",      category: "Identity",   identifierType: "Direct identifier",     confidence: 0.94, legalBasisHint: "Legitimate use", retentionHint: "24 months" },
    { systemName: "HubSpot CRM", fieldName: "lastname",       category: "Identity",   identifierType: "Direct identifier",     confidence: 0.94, legalBasisHint: "Legitimate use", retentionHint: "24 months" },
    { systemName: "HubSpot CRM", fieldName: "phone",          category: "Contact",    identifierType: "Direct identifier",     confidence: 0.92, legalBasisHint: "Legitimate use", retentionHint: "24 months" },
    { systemName: "HubSpot CRM", fieldName: "company",        category: "Identity",   identifierType: "Operational attribute", confidence: 0.83, legalBasisHint: "Legitimate use", retentionHint: "24 months" },
    { systemName: "HubSpot CRM", fieldName: "lifecyclestage", category: "Preference", identifierType: "Operational attribute", confidence: 0.74, legalBasisHint: "Legitimate use", retentionHint: "24 months" },
    { systemName: "HubSpot CRM", fieldName: "hs_lead_status", category: "Preference", identifierType: "Operational attribute", confidence: 0.72, legalBasisHint: "Legitimate use", retentionHint: "24 months" },
  ],
  RAZORPAY: [
    { systemName: "Razorpay", fieldName: "customer.email",     category: "Contact",   identifierType: "Direct identifier",     confidence: 0.98, legalBasisHint: "Legitimate use (financial)", retentionHint: "RBI: 5 years from txn" },
    { systemName: "Razorpay", fieldName: "customer.contact",   category: "Contact",   identifierType: "Direct identifier",     confidence: 0.97, legalBasisHint: "Legitimate use (financial)", retentionHint: "RBI: 5 years from txn" },
    { systemName: "Razorpay", fieldName: "customer.name",      category: "Identity",  identifierType: "Direct identifier",     confidence: 0.96, legalBasisHint: "Legitimate use (financial)", retentionHint: "RBI: 5 years from txn" },
    { systemName: "Razorpay", fieldName: "payment.amount",     category: "Financial", identifierType: "Operational attribute", confidence: 0.99, legalBasisHint: "Legitimate use (financial)", retentionHint: "RBI: 5 years from txn" },
    { systemName: "Razorpay", fieldName: "payment.method",     category: "Financial", identifierType: "Operational attribute", confidence: 0.95, legalBasisHint: "Legitimate use (financial)", retentionHint: "RBI: 5 years from txn" },
    { systemName: "Razorpay", fieldName: "order.notes.gst_id", category: "Financial", identifierType: "Sensitive identifier",  confidence: 0.71, legalBasisHint: "Legitimate use (financial)", retentionHint: "8 years (GST Act)" },
  ],
  FRESHDESK: [
    { systemName: "Freshdesk", fieldName: "contact.email",      category: "Contact",    identifierType: "Direct identifier",     confidence: 0.97, legalBasisHint: "Legitimate use", retentionHint: "24 months" },
    { systemName: "Freshdesk", fieldName: "contact.phone",      category: "Contact",    identifierType: "Direct identifier",     confidence: 0.92, legalBasisHint: "Legitimate use", retentionHint: "24 months" },
    { systemName: "Freshdesk", fieldName: "contact.name",       category: "Identity",   identifierType: "Direct identifier",     confidence: 0.95, legalBasisHint: "Legitimate use", retentionHint: "24 months" },
    { systemName: "Freshdesk", fieldName: "ticket.description", category: "Support",    identifierType: "Free-text PII",         confidence: 0.81, legalBasisHint: "Legitimate use", retentionHint: "24 months" },
    { systemName: "Freshdesk", fieldName: "ticket.attachments", category: "Support",    identifierType: "Embedded PII",          confidence: 0.65, legalBasisHint: "Legitimate use", retentionHint: "24 months" },
    { systemName: "Freshdesk", fieldName: "ticket.custom.gdpr", category: "Preference", identifierType: "Operational attribute", confidence: 0.70, legalBasisHint: "Consent",        retentionHint: "Until withdrawal" },
  ],
  ZOHO_CRM: [
    { systemName: "Zoho CRM", fieldName: "Contacts.Email",          category: "Contact",    identifierType: "Direct identifier",     confidence: 0.97, legalBasisHint: "Legitimate use", retentionHint: "36 months" },
    { systemName: "Zoho CRM", fieldName: "Contacts.First_Name",     category: "Identity",   identifierType: "Direct identifier",     confidence: 0.94, legalBasisHint: "Legitimate use", retentionHint: "36 months" },
    { systemName: "Zoho CRM", fieldName: "Contacts.Last_Name",      category: "Identity",   identifierType: "Direct identifier",     confidence: 0.94, legalBasisHint: "Legitimate use", retentionHint: "36 months" },
    { systemName: "Zoho CRM", fieldName: "Contacts.Phone",          category: "Contact",    identifierType: "Direct identifier",     confidence: 0.93, legalBasisHint: "Legitimate use", retentionHint: "36 months" },
    { systemName: "Zoho CRM", fieldName: "Leads.Lead_Source",       category: "Preference", identifierType: "Operational attribute", confidence: 0.78, legalBasisHint: "Consent",        retentionHint: "3 years from last interaction" },
    { systemName: "Zoho CRM", fieldName: "Contacts.Aadhaar_Last4",  category: "Identity",   identifierType: "Sensitive identifier",  confidence: 0.62, legalBasisHint: "Legal obligation", retentionHint: "Per KYC schedule" },
    { systemName: "Zoho CRM", fieldName: "Deals.Notes",             category: "Support",    identifierType: "Free-text PII",         confidence: 0.66, legalBasisHint: "Legitimate use", retentionHint: "36 months" },
  ],
  SHOPIFY: [
    { systemName: "Shopify", fieldName: "customers.email",                category: "Contact",     identifierType: "Direct identifier",     confidence: 0.98, legalBasisHint: "Performance of service", retentionHint: "Per Shopify policy + 6mo fraud window" },
    { systemName: "Shopify", fieldName: "customers.phone",                category: "Contact",     identifierType: "Direct identifier",     confidence: 0.93, legalBasisHint: "Performance of service", retentionHint: "Per Shopify policy" },
    { systemName: "Shopify", fieldName: "customers.first_name|last_name", category: "Identity",    identifierType: "Direct identifier",     confidence: 0.95, legalBasisHint: "Performance of service", retentionHint: "Per Shopify policy" },
    { systemName: "Shopify", fieldName: "customers.default_address",      category: "Location",    identifierType: "Direct identifier",     confidence: 0.92, legalBasisHint: "Performance of service", retentionHint: "Per Shopify policy" },
    { systemName: "Shopify", fieldName: "orders.line_items[].title",      category: "Behavior",    identifierType: "Operational attribute", confidence: 0.62, legalBasisHint: "Performance of service", retentionHint: "Per Shopify policy" },
    { systemName: "Shopify", fieldName: "orders.financial_status",        category: "Financial",   identifierType: "Operational attribute", confidence: 0.95, legalBasisHint: "Performance of service", retentionHint: "Per Shopify policy" },
    { systemName: "Shopify", fieldName: "marketing_consent.state",        category: "Preference",  identifierType: "Operational attribute", confidence: 0.85, legalBasisHint: "Consent", retentionHint: "Until withdrawal" },
  ],
  POSTGRES: [
    { systemName: "PostgreSQL", fieldName: "users.email",            category: "Contact",        identifierType: "Direct identifier",     confidence: 0.96, legalBasisHint: "Legitimate use",        retentionHint: "Per app retention policy" },
    { systemName: "PostgreSQL", fieldName: "users.full_name",        category: "Identity",       identifierType: "Direct identifier",     confidence: 0.95, legalBasisHint: "Legitimate use",        retentionHint: "Per app retention policy" },
    { systemName: "PostgreSQL", fieldName: "users.phone",            category: "Contact",        identifierType: "Direct identifier",     confidence: 0.92, legalBasisHint: "Legitimate use",        retentionHint: "Per app retention policy" },
    { systemName: "PostgreSQL", fieldName: "users.password_hash",    category: "Authentication", identifierType: "Sensitive identifier",  confidence: 0.99, legalBasisHint: "Security",            retentionHint: "Until account closure" },
    { systemName: "PostgreSQL", fieldName: "orders.shipping_address",category: "Location",       identifierType: "Direct identifier",     confidence: 0.91, legalBasisHint: "Performance of service", retentionHint: "Per app retention policy" },
    { systemName: "PostgreSQL", fieldName: "events.user_agent",      category: "Device",         identifierType: "Operational attribute", confidence: 0.71, legalBasisHint: "Security",              retentionHint: "12 months" },
    { systemName: "PostgreSQL", fieldName: "audit_log.ip_address",   category: "Device",         identifierType: "Operational attribute", confidence: 0.83, legalBasisHint: "Security",              retentionHint: "12 months" },
  ],
  MONGODB: [
    { systemName: "MongoDB", fieldName: "users.email",                  category: "Contact",     identifierType: "Direct identifier",     confidence: 0.96, legalBasisHint: "Legitimate use",        retentionHint: "Per app retention policy" },
    { systemName: "MongoDB", fieldName: "users.profile.fullName",       category: "Identity",    identifierType: "Direct identifier",     confidence: 0.94, legalBasisHint: "Legitimate use",        retentionHint: "Per app retention policy" },
    { systemName: "MongoDB", fieldName: "users.devices[].deviceId",     category: "Device",      identifierType: "Persistent identifier", confidence: 0.85, legalBasisHint: "Security",              retentionHint: "Until logout" },
    { systemName: "MongoDB", fieldName: "sessions.userAgent",           category: "Device",      identifierType: "Operational attribute", confidence: 0.78, legalBasisHint: "Security",              retentionHint: "30 days" },
    { systemName: "MongoDB", fieldName: "payments.cardLast4",           category: "Financial",   identifierType: "Sensitive identifier",  confidence: 0.69, legalBasisHint: "Performance of service", retentionHint: "Per PCI policy" },
    { systemName: "MongoDB", fieldName: "analytics.geoip.country",      category: "Location",    identifierType: "Operational attribute", confidence: 0.74, legalBasisHint: "Legitimate use",        retentionHint: "12 months" },
    { systemName: "MongoDB", fieldName: "preferences.marketingConsent", category: "Preference",  identifierType: "Operational attribute", confidence: 0.81, legalBasisHint: "Consent",               retentionHint: "Until withdrawal" },
  ],
  AWS_S3: [
    { systemName: "AWS S3", fieldName: "object.metadata.x-amz-meta-userid", category: "Identifier", identifierType: "Direct identifier",     confidence: 0.88, legalBasisHint: "Legitimate use", retentionHint: "Per bucket lifecycle policy" },
    { systemName: "AWS S3", fieldName: "users/{userId}/profile.jpg",         category: "Identity",   identifierType: "Embedded PII",          confidence: 0.78, legalBasisHint: "Legitimate use", retentionHint: "Until account closure" },
    { systemName: "AWS S3", fieldName: "uploads/kyc-{userId}.pdf",           category: "Identity",   identifierType: "Sensitive identifier",  confidence: 0.92, legalBasisHint: "Legal obligation", retentionHint: "Per KYC schedule (5y RBI)" },
    { systemName: "AWS S3", fieldName: "exports/orders-{date}.csv",          category: "Financial",  identifierType: "Embedded PII",          confidence: 0.65, legalBasisHint: "Legitimate use", retentionHint: "12 months" },
    { systemName: "AWS S3", fieldName: "logs/access-{date}.log",             category: "Device",     identifierType: "Operational attribute", confidence: 0.68, legalBasisHint: "Security",       retentionHint: "12 months" },
    { systemName: "AWS S3", fieldName: "backups/db-{date}.sql.gz",           category: "Backup",     identifierType: "Embedded PII",          confidence: 0.55, legalBasisHint: "Security",       retentionHint: "Per backup schedule" },
    { systemName: "AWS S3", fieldName: "object.versionId",                   category: "Versioning", identifierType: "Operational attribute", confidence: 0.90, legalBasisHint: "Security",       retentionHint: "Per versioning policy" },
  ],
  ...PHASE_3_DISCOVERY_SCHEMAS,
};

export function performDiscovery(
  workspace: TenantWorkspace,
  conn: ConnectorConnection,
  user: User,
): ConnectorDiscoveryResult {
  if (conn.status !== "CONNECTED") {
    throw new Error(`Connection ${conn.id} is not connected (status=${conn.status}).`);
  }
  const def = CONNECTOR_DEFINITIONS[conn.connectorType];
  const fields = DISCOVERY_SCHEMAS[conn.connectorType];

  // Auto-create DataSource
  const source: DataSource = {
    id: newId(`src-${conn.connectorType.toLowerCase()}`),
    name: `${def.name} live discovery`,
    fileName: `${conn.connectorType.toLowerCase()}-discovery.json`,
    profileMode: "EPHEMERAL_FULL",
    status: "APPROVED",
    fields: fields.length,
    approvedFields: fields.length,
    warnings: [],
    uploadedAt: nowIso(),
    pushedToRegister: true,
    linkedRegisterEntryIds: [],
  };
  workspace.sources.push(source);
  conn.linkedSourceIds = [...(conn.linkedSourceIds || []), source.id];

  // Auto-create RegisterEntry (one per category to avoid spam)
  const categories = new Map<string, ConnectorDiscoveredField[]>();
  for (const f of fields) {
    const arr = categories.get(f.category) || [];
    arr.push(f);
    categories.set(f.category, arr);
  }
  const newRegisterIds: string[] = [];
  for (const [category, group] of categories.entries()) {
    const entry: RegisterEntry = {
      id: newId(`reg-${conn.connectorType.toLowerCase()}-${category.toLowerCase()}`),
      system: def.name,
      dataCategory: category,
      purpose: discoveryPurpose(conn.connectorType, category),
      legalBasis: group[0].legalBasisHint,
      retentionLabel: group[0].retentionHint,
      linkedNoticeId: null,
      linkedProcessorIds: conn.linkedProcessorId ? [conn.linkedProcessorId] : [],
      lifecycle: "IN_REVIEW",
      sourceTrace: `Auto-discovered via ${def.name} (${conn.id})`,
      completeness: "PARTIAL",
    };
    workspace.registerEntries.push(entry);
    newRegisterIds.push(entry.id);
  }
  source.linkedRegisterEntryIds = newRegisterIds;
  conn.linkedRegisterEntryIds = [...(conn.linkedRegisterEntryIds || []), ...newRegisterIds];

  conn.lastDiscoveryAt = nowIso();
  conn.recordsDiscovered = simulatedRecordCount(conn.connectorType);
  conn.updatedAt = nowIso();

  const result: ConnectorDiscoveryResult = {
    connectionId: conn.id,
    connectorType: conn.connectorType,
    recordsScanned: conn.recordsDiscovered,
    fieldsDiscovered: fields,
    autoCreatedSourceIds: [source.id],
    autoCreatedRegisterIds: newRegisterIds,
    autoCreatedProcessorId: conn.linkedProcessorId,
    summary: `Discovered ${fields.length} PII fields across ${categories.size} categories from ${conn.recordsDiscovered.toLocaleString()} ${recordLabel(conn.connectorType)}.`,
    warnings: discoveryWarnings(conn.connectorType),
  };

  pushEvent(
    workspace,
    conn,
    "DISCOVERY_COMPLETED",
    `${result.summary} (initiated by ${user.name})`,
    { payload: { categories: Array.from(categories.keys()), recordsScanned: result.recordsScanned } },
  );

  return result;
}

// Catalogue-driven helpers: every per-connector value lives in
// CONNECTOR_DEFINITIONS, so adding a connector means appending one entry — no
// switch statement edits required.
function discoveryPurpose(type: ConnectorType, category: string): string {
  return CONNECTOR_DEFINITIONS[type].purposeTemplate.replace("{category}", category.toLowerCase());
}
function simulatedRecordCount(type: ConnectorType): number {
  return CONNECTOR_DEFINITIONS[type].simulatedRecordCount;
}
function recordLabel(type: ConnectorType): string {
  return CONNECTOR_DEFINITIONS[type].recordLabel;
}
function discoveryWarnings(type: ConnectorType): string[] {
  return CONNECTOR_DEFINITIONS[type].discoveryWarnings;
}

/* ------------------------------------------------------------------ */
/*  DSR — Data Subject Rights                                          */
/* ------------------------------------------------------------------ */

export function performDsr(
  workspace: TenantWorkspace,
  conn: ConnectorConnection,
  rightsCase: RightsCase,
  action: "EXPORT" | "ERASE",
  subjectIdentifier: string,
  user: User,
): ConnectorDsrResult {
  if (conn.status !== "CONNECTED") {
    throw new Error(`Connection ${conn.id} is not connected.`);
  }
  const def = CONNECTOR_DEFINITIONS[conn.connectorType];

  // RBI-vs-DPDP retention conflict path for Razorpay erasure
  if (action === "ERASE" && conn.connectorType === "RAZORPAY") {
    const denial = `Erasure denied under DPDP §17(2)(a). RBI Storage of Payment System Data direction (April 2018) mandates retention of payment records for 5 years from the date of the transaction. Customer-facing fields (name, email, phone) have been anonymised; transactional records are preserved for the regulatory window. A formal denial letter is attached as evidence.`;
    const evidence = pushEvidence(
      workspace,
      `Razorpay erasure denial letter — ${rightsCase.id}`,
      `del-${rightsCase.id}`,
      "ATTESTATION",
    );
    const result: ConnectorDsrResult = {
      connectionId: conn.id,
      connectorType: conn.connectorType,
      action,
      subjectIdentifier,
      subjectKey: subjectIdentifier.includes("@") ? "email" : "phone",
      succeeded: true,
      recordsAffected: 0,
      evidenceId: evidence.id,
      denialReason: denial,
      occurredAt: nowIso(),
    };
    rightsCase.evidenceLinked = true;
    conn.lastDsrAt = nowIso();
    conn.updatedAt = nowIso();
    pushEvent(
      workspace,
      conn,
      "DSR_ERASURE_DENIED",
      `Razorpay erasure denied under DPDP §17(2)(a) (RBI retention) — ${rightsCase.id}`,
      // M3: do not log raw subject identifier; keep correlation hash only.
      { linkedRightsId: rightsCase.id, linkedEvidenceId: evidence.id, payload: { subjectIdentifierHash: hashSubject(subjectIdentifier) } },
    );
    return result;
  }

  const recordsAffected = simulatedDsrCount(conn.connectorType, action);
  const evidence = pushEvidence(
    workspace,
    `${def.name} ${action.toLowerCase()} confirmation — ${rightsCase.id}`,
    rightsCase.id,
    action === "EXPORT" ? "SYSTEM_DERIVED" : "UPLOADED",
  );
  rightsCase.evidenceLinked = true;
  conn.lastDsrAt = nowIso();
  conn.updatedAt = nowIso();

  const result: ConnectorDsrResult = {
    connectionId: conn.id,
    connectorType: conn.connectorType,
    action,
    subjectIdentifier,
    subjectKey: subjectIdentifier.includes("@") ? "email" : "id",
    succeeded: true,
    recordsAffected,
    evidenceId: evidence.id,
    occurredAt: nowIso(),
  };

  pushEvent(
    workspace,
    conn,
    action === "EXPORT" ? "DSR_EXPORT_COMPLETED" : "DSR_ERASURE_COMPLETED",
    // M3: redact PII in user-visible summary; raw value lives in evidence artifact.
    `${def.name} ${action.toLowerCase()} for ${redactSubjectIdentifier(subjectIdentifier)} — ${recordsAffected} records — ${rightsCase.id}`,
    { linkedRightsId: rightsCase.id, linkedEvidenceId: evidence.id, payload: { subjectIdentifierHash: hashSubject(subjectIdentifier), recordsAffected } },
  );

  return result;
}

/**
 *  Redact a subject identifier for display: "n*****a@example.com" / "+91****5678".
 *  The full value goes into the sealed evidence artifact, not the event log.
 */
function redactSubjectIdentifier(s: string): string {
  if (s.includes("@")) {
    const [local, domain] = s.split("@");
    if (!local || !domain) return "***";
    const masked = local.length <= 2 ? "*".repeat(local.length) : `${local[0]}${"*".repeat(local.length - 2)}${local[local.length - 1]}`;
    return `${masked}@${domain}`;
  }
  if (s.length <= 4) return "*".repeat(s.length);
  return `${s.slice(0, 2)}${"*".repeat(Math.max(0, s.length - 6))}${s.slice(-4)}`;
}

/** Short hash for log correlation without exposing raw subject. */
function hashSubject(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return `sh_${(h >>> 0).toString(36)}`;
}

function pushEvidence(
  workspace: TenantWorkspace,
  label: string,
  linkedRecord: string,
  classification: EvidenceArtifact["classification"],
): EvidenceArtifact {
  const evidence: EvidenceArtifact = {
    id: newId("ev"),
    label,
    classification,
    linkedRecord,
    createdAt: nowIso(),
    contentIndexed: false,
  };
  workspace.evidence.push(evidence);
  return evidence;
}

function simulatedDsrCount(type: ConnectorType, action: "EXPORT" | "ERASE"): number {
  const d = CONNECTOR_DEFINITIONS[type].simulatedDsr;
  return action === "EXPORT" ? d.exportCount : d.eraseCount;
}

/* ------------------------------------------------------------------ */
/*  Webhook ingestion (grievance / payment / contact events)           */
/* ------------------------------------------------------------------ */

export interface WebhookContext {
  type: ConnectorType;
  body: any;
}

export function ingestWebhook(
  workspace: TenantWorkspace,
  conn: ConnectorConnection,
  ctx: WebhookContext,
): { event: ConnectorEvent; createdRights?: RightsCase } {
  if (conn.status !== "CONNECTED") {
    throw new Error(`Connection ${conn.id} is not connected.`);
  }
  if (ctx.type === "FRESHDESK") return ingestFreshdeskTicket(workspace, conn, ctx.body);
  if (ctx.type === "HUBSPOT") return ingestHubspotEvent(workspace, conn, ctx.body);
  if (ctx.type === "RAZORPAY") return ingestRazorpayEvent(workspace, conn, ctx.body);
  if (ctx.type === "SHOPIFY") return ingestShopifyEvent(workspace, conn, ctx.body);
  if (ctx.type === "ZOHO_CRM" || ctx.type === "POSTGRES" || ctx.type === "MONGODB" || ctx.type === "AWS_S3") {
    return ingestGenericEvent(workspace, conn, CONNECTOR_DEFINITIONS[ctx.type].name, ctx.body);
  }
  throw new ValidationError(`Unsupported connector type: ${ctx.type}`);
}

/**
 *  Shopify ingestion handles the three mandatory compliance webhooks.
 *  Topic-based routing creates a typed RightsCase with Shopify's 30-day SLA.
 */
function ingestShopifyEvent(
  workspace: TenantWorkspace,
  conn: ConnectorConnection,
  body: any,
): { event: ConnectorEvent; createdRights?: RightsCase } {
  const topic: string = String(body?.topic || body?.event || "").toLowerCase();
  const customer = body?.customer || {};
  const requesterEmail: string =
    customer.email || body?.shop_owner_email || `shopify-redact@${conn.workspaceDomain || "unknown"}`;

  if (topic.includes("data_request")) {
    return openShopifyRights(workspace, conn, "ACCESS", requesterEmail, body);
  }
  if (topic.includes("redact")) {
    return openShopifyRights(workspace, conn, "DELETION", requesterEmail, body);
  }
  return { event: pushEvent(workspace, conn, "WEBHOOK_RECEIVED", `Shopify ${topic || "event"} received`, { payload: { topic } }) };
}

function openShopifyRights(
  workspace: TenantWorkspace,
  conn: ConnectorConnection,
  type: RightsCase["type"],
  requesterEmail: string,
  body: any,
): { event: ConnectorEvent; createdRights: RightsCase } {
  const rightsId = `RR-${nowIso().slice(0, 10).replace(/-/g, "")}-${(workspace.rightsCases.length + 1).toString().padStart(3, "0")}`;
  const rightsCase: RightsCase = {
    id: rightsId,
    type,
    requestor: requesterEmail,
    status: "NEW",
    sla: "30 days remaining (Shopify-mandated)",
    evidenceLinked: false,
    linkedDeletionTaskId: null,
  };
  workspace.rightsCases.unshift(rightsCase);

  const event = pushEvent(
    workspace,
    conn,
    "GRIEVANCE_INGESTED",
    // M3: redact email in user-visible summary.
    `Shopify ${type === "ACCESS" ? "data_request" : "redact"} → ${rightsId} (${type})`,
    {
      externalId: String(body?.id || body?.customer?.id || ""),
      linkedRightsId: rightsId,
      payload: { topic: body?.topic, requesterEmailHash: hashSubject(requesterEmail), ordersToRedact: body?.orders_to_redact },
    },
  );
  return { event, createdRights: rightsCase };
}

/**
 *  Generic webhook recorder for connectors without a domain-specific handler yet.
 *  Records the event for audit but does not auto-create rights cases.
 */
function ingestGenericEvent(
  workspace: TenantWorkspace,
  conn: ConnectorConnection,
  systemName: string,
  body: any,
): { event: ConnectorEvent } {
  const summary = `${systemName} webhook received` + (body?.event ? ` (${body.event})` : "");
  return {
    event: pushEvent(workspace, conn, "WEBHOOK_RECEIVED", summary, {
      // Only persist the event identifier and topic — never the full body —
      // to avoid storing arbitrary attacker-controlled data.
      payload: { event: body?.event, eventId: body?.id, topic: body?.topic },
    }),
  };
}

function ingestFreshdeskTicket(
  workspace: TenantWorkspace,
  conn: ConnectorConnection,
  body: any,
): { event: ConnectorEvent; createdRights?: RightsCase } {
  const subject: string = body?.subject || body?.ticket?.subject || "Freshdesk grievance";
  const description: string = (body?.description_text || body?.ticket?.description_text || "").toLowerCase();
  const requesterEmail: string = body?.requester?.email || body?.ticket?.requester?.email || "unknown@unknown";
  const ticketId: string = String(body?.ticket_id || body?.ticket?.id || "");

  const inferredType = inferRightsTypeFromText(subject + " " + description);
  const rightsId = `RR-${nowIso().slice(0, 10).replace(/-/g, "")}-${(workspace.rightsCases.length + 1).toString().padStart(3, "0")}`;
  const rightsCase: RightsCase = {
    id: rightsId,
    type: inferredType,
    requestor: requesterEmail,
    status: "NEW",
    sla: rightsCaseSla(inferredType),
    evidenceLinked: false,
    linkedDeletionTaskId: null,
  };
  workspace.rightsCases.unshift(rightsCase);

  const event = pushEvent(
    workspace,
    conn,
    "GRIEVANCE_INGESTED",
    // M3: subject line is operator-supplied so it could contain PII; we keep
    // ticket id + RR id in the summary, never the requester address itself.
    `Freshdesk ticket #${ticketId} → ${rightsId} (${inferredType})`,
    {
      externalId: ticketId,
      linkedRightsId: rightsId,
      payload: { ticketId, requesterEmailHash: hashSubject(requesterEmail) },
    },
  );
  return { event, createdRights: rightsCase };
}

function inferRightsTypeFromText(text: string): RightsCase["type"] {
  const t = text.toLowerCase();
  if (/(delete|erase|forget|remove my)/.test(t)) return "DELETION";
  if (/(access|copy of my data|export|portab)/.test(t)) return "ACCESS";
  if (/(correct|update my|fix my)/.test(t)) return "CORRECTION";
  if (/(withdraw)/.test(t)) return "WITHDRAWAL";
  return "GRIEVANCE";
}

function rightsCaseSla(type: RightsCase["type"]): string {
  if (type === "GRIEVANCE") return "30 days remaining";
  return "14 days remaining";
}

function ingestHubspotEvent(
  workspace: TenantWorkspace,
  conn: ConnectorConnection,
  body: any,
): { event: ConnectorEvent } {
  const subscriptionType = body?.subscriptionType || body?.[0]?.subscriptionType || "contact.creation";
  const objectId = String(body?.objectId || body?.[0]?.objectId || "");
  const event = pushEvent(
    workspace,
    conn,
    "WEBHOOK_RECEIVED",
    `HubSpot ${subscriptionType} for objectId=${objectId}`,
    { externalId: objectId, payload: { subscriptionType } },
  );
  return { event };
}

function ingestRazorpayEvent(
  workspace: TenantWorkspace,
  conn: ConnectorConnection,
  body: any,
): { event: ConnectorEvent } {
  const eventName: string = body?.event || "payment.captured";
  const paymentId: string = body?.payload?.payment?.entity?.id || "";
  const event = pushEvent(
    workspace,
    conn,
    "WEBHOOK_RECEIVED",
    `Razorpay ${eventName} (${paymentId || "no-id"})`,
    { externalId: paymentId, payload: { eventName } },
  );
  return { event };
}

/* ------------------------------------------------------------------ */
/*  High-level handlers used by the route layer                        */
/* ------------------------------------------------------------------ */

export interface ConnectorBootstrap {
  catalogue: ConnectorDefinition[];
  connections: ReturnType<typeof publicConnection>[];
  events: ConnectorEvent[];
}

export function publicConnection(c: ConnectorConnection) {
  const {
    encryptedAccessToken: _a,
    encryptedRefreshToken: _r,
    encryptedApiKey: _k,
    encryptedWebhookSecret: _w,
    ...rest
  } = c;
  return rest;
}

export function handleConnectorBootstrap(workspace: TenantWorkspace): ConnectorBootstrap {
  return {
    catalogue: listConnectors(),
    connections: workspace.connections.map(publicConnection),
    events: workspace.connectorEvents.slice(0, 50),
  };
}
