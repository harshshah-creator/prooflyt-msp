import "server-only";
import type {
  AdminBootstrapResponse,
  ConnectorConnectionPublic,
  ConnectorDefinition,
  ConnectorEvent,
  PublicNoticeResponse,
  PublicRightsResponse,
  WorkspaceResponse,
} from "@prooflyt/contracts";

export interface ConnectorBootstrap {
  catalogue: ConnectorDefinition[];
  connections: ConnectorConnectionPublic[];
  events: ConnectorEvent[];
}

export const API_BASE = process.env.PROOFLYT_API_BASE || "https://prooflyt-msp-api.harshshah-5d8.workers.dev/api";
export const DEMO_TOKEN = process.env.PROOFLYT_DEMO_TOKEN || "session-user-arjun-boot";
export const ADMIN_TOKEN = process.env.PROOFLYT_ADMIN_TOKEN || "session-ops-boot";

async function apiFetch<T>(path: string, init?: RequestInit, token?: string | null): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  if (response.status === 401 || response.status === 403) {
    const { redirect } = await import("next/navigation");
    redirect("/login");
  }

  if (!response.ok) {
    throw new Error(`API ${path} failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function getWorkspace(tenantSlug = "bombay-grooming-labs", token?: string | null) {
  return apiFetch<WorkspaceResponse>(`/portal/${tenantSlug}/bootstrap`, undefined, token || DEMO_TOKEN);
}

export async function getConnectorBootstrap(tenantSlug: string, token?: string | null) {
  return apiFetch<ConnectorBootstrap>(`/portal/${tenantSlug}/connectors/bootstrap`, undefined, token || DEMO_TOKEN);
}

export async function getPublicRights(tenantSlug = "bombay-grooming-labs") {
  return apiFetch<PublicRightsResponse>(`/public/${tenantSlug}/rights`);
}

export async function getPublicNotice(tenantSlug = "bombay-grooming-labs") {
  return apiFetch<PublicNoticeResponse>(`/public/${tenantSlug}/notice`);
}

export async function getAdminBootstrap(token?: string | null) {
  const response = await fetch(`${API_BASE}/admin/bootstrap`, {
    headers: {
      Authorization: `Bearer ${token || ADMIN_TOKEN}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`API /admin/bootstrap failed with ${response.status}`);
  }

  return response.json() as Promise<AdminBootstrapResponse>;
}

/* ================================================================== */
/*  Phase-3 admin endpoints (server-only, all auth-bearer wrappers).    */
/*  Each wrapper is a thin pass-through to the worker; the page-side    */
/*  component is responsible for surfacing the result.                  */
/* ================================================================== */

/* — DPO inbox + pulse score (PR #7) — */
export async function getDpoInbox(tenantSlug: string, token?: string | null) {
  return apiFetch<{
    generatedAt: string;
    counts: Record<string, number>;
    totalOpen: number;
    pulseScore: number;
    items: Array<{
      id: string;
      priority: "URGENT" | "BLOCKING" | "REVIEW" | "INFO";
      module: string;
      title: string;
      body: string;
      dueAt?: string;
      targetId?: string;
    }>;
  }>(`/portal/${tenantSlug}/dpo/inbox`, undefined, token || DEMO_TOKEN);
}

/* — DSR SLA clock (PR #15) — */
export async function getRightsSla(tenantSlug: string, token?: string | null) {
  return apiFetch<{
    ok: boolean;
    summary: {
      total: number;
      overdue: number;
      atRisk: number;
      onTrack: number;
      closed: number;
      worstCase?: { id: string; daysRemaining: number; type: string };
    };
    cases: Array<{
      id: string;
      type: string;
      requestor: string;
      status: string;
      slaInfo?: {
        state: "ON_TRACK" | "AT_RISK" | "OVERDUE" | "CLOSED";
        deadline: string;
        msRemaining: number;
        daysRemaining: number;
        humanLabel: string;
        citation: string;
      };
    }>;
    statutoryWindows: Record<string, { days: number; citation: string }>;
  }>(`/portal/${tenantSlug}/rights/sla`, undefined, token || DEMO_TOKEN);
}

export async function escalateRightsSla(tenantSlug: string, token?: string | null) {
  return apiFetch<{ ok: boolean; outcomes: unknown[] }>(
    `/portal/${tenantSlug}/rights/sla/escalate`,
    { method: "POST" },
    token || DEMO_TOKEN,
  );
}

/* — Audit-trail anomaly detection (PR #17) — */
export async function getAnomalyAlerts(tenantSlug: string, token?: string | null) {
  return apiFetch<{
    ok: boolean;
    count: number;
    alerts: Array<{
      id: string;
      kind: string;
      severity: "URGENT" | "REVIEW" | "INFO";
      actor: string;
      detectedAt: string;
      windowStart: string;
      windowEnd: string;
      count: number;
      detail: string;
    }>;
  }>(`/portal/${tenantSlug}/anomalies`, undefined, token || DEMO_TOKEN);
}

export async function runAnomalyScan(tenantSlug: string, token?: string | null) {
  return apiFetch<{ ok: boolean; freshAlertCount: number }>(
    `/portal/${tenantSlug}/anomalies/scan`,
    { method: "POST" },
    token || DEMO_TOKEN,
  );
}

/* — Audit-log SIEM export keys (PR #16) — */
export async function listAuditExportKeys(tenantSlug: string, token?: string | null) {
  return apiFetch<{
    ok: boolean;
    keys: Array<{
      id: string;
      label: string;
      active: boolean;
      createdAt: string;
      keyHint: string;
      lastUsedAt?: string;
      lastUsedFromIp?: string;
    }>;
  }>(`/portal/${tenantSlug}/audit-export/keys`, undefined, token || DEMO_TOKEN);
}

export async function createAuditExportKey(
  tenantSlug: string,
  label: string,
  token?: string | null,
) {
  return apiFetch<{
    ok: boolean;
    key: { id: string; label: string; createdAt: string };
    rawKey: string;
    integrationHints: { splunkHec: string; datadog: string; curl: string };
  }>(
    `/portal/${tenantSlug}/audit-export/keys`,
    { method: "POST", body: JSON.stringify({ label }) },
    token || DEMO_TOKEN,
  );
}

export async function revokeAuditExportKey(
  tenantSlug: string,
  keyId: string,
  token?: string | null,
) {
  return apiFetch<{ ok: boolean }>(
    `/portal/${tenantSlug}/audit-export/keys/${keyId}`,
    { method: "DELETE" },
    token || DEMO_TOKEN,
  );
}

/* — Outbound webhooks (PR #14) — */
export async function listWebhookSubscriptions(tenantSlug: string, token?: string | null) {
  return apiFetch<{
    ok: boolean;
    subscriptions: Array<{
      id: string;
      url: string;
      eventFilter: string;
      description?: string;
      active: boolean;
      failureStreak: number;
      pausedReason?: string;
      createdAt: string;
      updatedAt: string;
    }>;
  }>(`/portal/${tenantSlug}/webhooks/subscriptions`, undefined, token || DEMO_TOKEN);
}

export async function createWebhookSubscription(
  tenantSlug: string,
  body: { url: string; eventFilter: string; secret: string; description?: string },
  token?: string | null,
) {
  return apiFetch<{
    ok: boolean;
    subscription: { id: string; url: string; active: boolean; eventFilter: string };
  }>(
    `/portal/${tenantSlug}/webhooks/subscriptions`,
    { method: "POST", body: JSON.stringify(body) },
    token || DEMO_TOKEN,
  );
}

export async function deleteWebhookSubscription(
  tenantSlug: string,
  id: string,
  token?: string | null,
) {
  return apiFetch<{ ok: boolean }>(
    `/portal/${tenantSlug}/webhooks/subscriptions/${id}`,
    { method: "DELETE" },
    token || DEMO_TOKEN,
  );
}

export async function pauseWebhookSubscription(
  tenantSlug: string,
  id: string,
  token?: string | null,
) {
  return apiFetch<{ ok: boolean }>(
    `/portal/${tenantSlug}/webhooks/subscriptions/${id}/pause`,
    { method: "POST" },
    token || DEMO_TOKEN,
  );
}

export async function resumeWebhookSubscription(
  tenantSlug: string,
  id: string,
  token?: string | null,
) {
  return apiFetch<{ ok: boolean }>(
    `/portal/${tenantSlug}/webhooks/subscriptions/${id}/resume`,
    { method: "POST" },
    token || DEMO_TOKEN,
  );
}

export async function listWebhookDeliveries(tenantSlug: string, token?: string | null) {
  return apiFetch<{
    ok: boolean;
    count: number;
    deliveries: Array<{
      id: string;
      subscriptionId: string;
      eventType: string;
      status: "PENDING" | "DELIVERED" | "FAILED";
      httpStatus?: number;
      attempts: number;
      lastError?: string;
      createdAt: string;
      deliveredAt?: string;
      payloadSha256: string;
    }>;
  }>(`/portal/${tenantSlug}/webhooks/deliveries`, undefined, token || DEMO_TOKEN);
}

/* — Compliance Pack firms list (PR #19) — */
export async function listCompliancePackFirms(token?: string | null) {
  return apiFetch<{ ok: boolean; firms: string[] }>(
    `/portal/compliance-pack/firms`,
    undefined,
    token || DEMO_TOKEN,
  );
}

/* — Notice Rule 3 analyzer (PR #5) — */
export async function analyzeNotice(
  tenantSlug: string,
  noticeId: string,
  token?: string | null,
) {
  return apiFetch<{
    ok: boolean;
    notice: { id: string; title: string; version: string };
    report: {
      totalItems: number;
      coverageScore: number;
      appearsDpdpAware: boolean;
      presentItems: Array<{ id: string; label: string; citation: string }>;
      missingItems: Array<{ id: string; label: string; citation: string; draftTemplate: string }>;
    };
    drafts: { provider: "groq" | "template"; draft: string };
  }>(
    `/portal/${tenantSlug}/notices/${noticeId}/analyze`,
    { method: "POST" },
    token || DEMO_TOKEN,
  );
}

/* — DPIA (PR #6) — */
export interface DpiaResultRow {
  id: string;
  activityName: string;
  conductedAt: string;
  conductedBy: string;
  riskScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  recommendations: string[];
  markdownReport?: string;
}
export async function listDpiaResults(tenantSlug: string, token?: string | null) {
  return apiFetch<{ dpiaResults: DpiaResultRow[] }>(
    `/portal/${tenantSlug}/dpia/list`,
    undefined,
    token || DEMO_TOKEN,
  );
}

export interface RunDpiaInput {
  activityName: string;
  activityDescription: string;
  conductedBy: string;
  dataCategories: string[];
  estimatedDataPrincipals: number;
  involvesChildrenData: boolean;
  involvesSensitiveIdentifiers: boolean;
  crossBorderTransfer: boolean;
  automatedDecisionMaking: boolean;
  largeScaleProfiling: boolean;
  linkedProcessorIds: string[];
  linkedRegisterEntryIds: string[];
  mitigations: string;
}

export async function runDpia(
  tenantSlug: string,
  input: RunDpiaInput,
  token?: string | null,
) {
  return apiFetch<DpiaResultRow>(
    `/portal/${tenantSlug}/dpia/run`,
    { method: "POST", body: JSON.stringify(input) },
    token || DEMO_TOKEN,
  );
}
