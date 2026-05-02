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
