"use server";

import { redirect } from "next/navigation";
import { API_BASE } from "../../../../lib/api";
import { normaliseLocale } from "../../../../lib/i18n";

export async function submitPublicRightAction(
  tenantSlug: string,
  langRaw: string | undefined,
  formData: FormData,
) {
  const lang = normaliseLocale(langRaw);
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const type = String(formData.get("type") || "DELETION").trim();
  const message = String(formData.get("message") || "").trim();

  const params = new URLSearchParams({ lang });
  if (!name || !email || !message) {
    params.set("error", "missing");
    redirect(`/public/${tenantSlug}/rights?${params.toString()}`);
  }

  const response = await fetch(`${API_BASE}/public/${tenantSlug}/rights`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, type, message }),
    cache: "no-store",
  });

  if (!response.ok) {
    params.set("error", "submit");
    redirect(`/public/${tenantSlug}/rights?${params.toString()}`);
  }

  const payload = (await response.json()) as { rightsCase: { id: string } };
  params.set("submitted", payload.rightsCase.id);
  redirect(`/public/${tenantSlug}/rights?${params.toString()}`);
}
