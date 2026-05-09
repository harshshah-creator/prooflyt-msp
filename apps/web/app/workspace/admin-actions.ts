"use server";

/**
 * Admin server actions for the Phase-3 admin UIs.
 *
 * These are the *mutation* endpoints — read endpoints are called directly
 * by the page server-components via lib/api.ts. Each action:
 *   - reads the session bearer (redirects to /login if missing)
 *   - calls the worker
 *   - revalidates the affected module path so SSR refresh pulls fresh data
 *   - redirects back with ?ok / ?err query strings the page can flash
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { API_BASE } from "../../lib/api";
import { getSessionToken } from "../../lib/session";

async function authedFetch(path: string, init: RequestInit = {}) {
  const token = await getSessionToken();
  if (!token) redirect("/login");
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
}

/* ------------------------------------------------------------------ */
/*  SIEM export keys                                                    */
/* ------------------------------------------------------------------ */

export async function createSiemKeyAction(tenantSlug: string, formData: FormData) {
  const label = String(formData.get("label") || "").trim();
  if (!label) redirect(`/workspace/${tenantSlug}/setup?siemErr=Label%20required`);
  const res = await authedFetch(`/portal/${tenantSlug}/audit-export/keys`, {
    method: "POST",
    body: JSON.stringify({ label }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    redirect(`/workspace/${tenantSlug}/setup?siemErr=${encodeURIComponent(body.error || "Failed")}`);
  }
  const json = (await res.json()) as { rawKey?: string; key?: { id: string } };
  revalidatePath(`/workspace/${tenantSlug}/setup`);
  // The raw key is shown ONCE — flash it through the URL so the page can
  // present a one-time-copy modal. Browser history may retain the key
  // until the operator copies it; same constraint as Stripe / GitHub.
  redirect(
    `/workspace/${tenantSlug}/setup?siemNew=${encodeURIComponent(json.rawKey ?? "")}&siemKeyId=${encodeURIComponent(json.key?.id ?? "")}`,
  );
}

export async function revokeSiemKeyAction(tenantSlug: string, keyId: string) {
  await authedFetch(`/portal/${tenantSlug}/audit-export/keys/${keyId}`, { method: "DELETE" });
  revalidatePath(`/workspace/${tenantSlug}/setup`);
  redirect(`/workspace/${tenantSlug}/setup?siemRevoked=${encodeURIComponent(keyId)}`);
}

/* ------------------------------------------------------------------ */
/*  Webhook subscriptions                                               */
/* ------------------------------------------------------------------ */

export async function createWebhookAction(tenantSlug: string, formData: FormData) {
  const url = String(formData.get("url") || "").trim();
  const eventFilter = String(formData.get("eventFilter") || "*").trim();
  const secret = String(formData.get("secret") || "").trim();
  const description = String(formData.get("description") || "").trim();
  if (!url || !secret) {
    redirect(`/workspace/${tenantSlug}/setup?whErr=URL%20and%20secret%20are%20required`);
  }
  const res = await authedFetch(`/portal/${tenantSlug}/webhooks/subscriptions`, {
    method: "POST",
    body: JSON.stringify({ url, eventFilter, secret, description }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    redirect(`/workspace/${tenantSlug}/setup?whErr=${encodeURIComponent(body.error || "Failed")}`);
  }
  revalidatePath(`/workspace/${tenantSlug}/setup`);
  redirect(`/workspace/${tenantSlug}/setup?whOk=1`);
}

export async function deleteWebhookAction(tenantSlug: string, id: string) {
  await authedFetch(`/portal/${tenantSlug}/webhooks/subscriptions/${id}`, { method: "DELETE" });
  revalidatePath(`/workspace/${tenantSlug}/setup`);
  redirect(`/workspace/${tenantSlug}/setup?whDeleted=${encodeURIComponent(id)}`);
}

export async function pauseWebhookAction(tenantSlug: string, id: string) {
  await authedFetch(`/portal/${tenantSlug}/webhooks/subscriptions/${id}/pause`, { method: "POST" });
  revalidatePath(`/workspace/${tenantSlug}/setup`);
  redirect(`/workspace/${tenantSlug}/setup?whPaused=${encodeURIComponent(id)}`);
}

export async function resumeWebhookAction(tenantSlug: string, id: string) {
  await authedFetch(`/portal/${tenantSlug}/webhooks/subscriptions/${id}/resume`, { method: "POST" });
  revalidatePath(`/workspace/${tenantSlug}/setup`);
  redirect(`/workspace/${tenantSlug}/setup?whResumed=${encodeURIComponent(id)}`);
}

/* ------------------------------------------------------------------ */
/*  Anomaly scan                                                        */
/* ------------------------------------------------------------------ */

export async function runAnomalyScanAction(tenantSlug: string) {
  await authedFetch(`/portal/${tenantSlug}/anomalies/scan`, { method: "POST" });
  revalidatePath(`/workspace/${tenantSlug}/incidents`);
  redirect(`/workspace/${tenantSlug}/incidents?anomalyScanned=1`);
}

/* ------------------------------------------------------------------ */
/*  SLA escalation                                                      */
/* ------------------------------------------------------------------ */

export async function escalateRightsSlaAction(tenantSlug: string) {
  await authedFetch(`/portal/${tenantSlug}/rights/sla/escalate`, { method: "POST" });
  revalidatePath(`/workspace/${tenantSlug}/rights`);
  redirect(`/workspace/${tenantSlug}/rights?slaEscalated=1`);
}

/* ------------------------------------------------------------------ */
/*  Notice Rule 3 analysis                                              */
/* ------------------------------------------------------------------ */

export async function analyzeNoticeAction(tenantSlug: string, noticeId: string) {
  const res = await authedFetch(`/portal/${tenantSlug}/notices/${noticeId}/analyze`, { method: "POST" });
  if (!res.ok) {
    redirect(`/workspace/${tenantSlug}/notices?ruleErr=Analyze%20failed`);
  }
  // The page reloads with the analysis cached server-side via revalidate.
  revalidatePath(`/workspace/${tenantSlug}/notices`);
  redirect(`/workspace/${tenantSlug}/notices?rule3=${encodeURIComponent(noticeId)}`);
}

/* ------------------------------------------------------------------ */
/*  DPIA                                                                */
/* ------------------------------------------------------------------ */

export async function runDpiaAction(tenantSlug: string, formData: FormData) {
  const payload = {
    activityName: String(formData.get("activityName") || "").trim(),
    activityDescription: String(formData.get("activityDescription") || "").trim(),
    conductedBy: String(formData.get("conductedBy") || "").trim(),
    dataCategories: String(formData.get("dataCategories") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    estimatedDataPrincipals: Number(formData.get("estimatedDataPrincipals") || 0),
    involvesChildrenData: formData.get("involvesChildrenData") === "on",
    involvesSensitiveIdentifiers: formData.get("involvesSensitiveIdentifiers") === "on",
    crossBorderTransfer: formData.get("crossBorderTransfer") === "on",
    automatedDecisionMaking: formData.get("automatedDecisionMaking") === "on",
    largeScaleProfiling: formData.get("largeScaleProfiling") === "on",
    linkedProcessorIds: [],
    linkedRegisterEntryIds: [],
    mitigations: String(formData.get("mitigations") || "").trim(),
  };
  if (!payload.activityName || !payload.conductedBy) {
    redirect(`/workspace/${tenantSlug}/reports?dpiaErr=Activity%20+%20Owner%20required`);
  }
  const res = await authedFetch(`/portal/${tenantSlug}/dpia/run`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    redirect(`/workspace/${tenantSlug}/reports?dpiaErr=${encodeURIComponent(body.error || "Failed")}`);
  }
  const result = (await res.json()) as { id: string; riskLevel: string };
  revalidatePath(`/workspace/${tenantSlug}/reports`);
  redirect(`/workspace/${tenantSlug}/reports?dpiaOk=${encodeURIComponent(result.id)}&dpiaRisk=${encodeURIComponent(result.riskLevel)}`);
}
