"use server";

import { redirect } from "next/navigation";
import { API_BASE } from "../../../../lib/api";

export async function submitPublicRightAction(tenantSlug: string, formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const type = String(formData.get("type") || "DELETION").trim();
  const message = String(formData.get("message") || "").trim();

  if (!name || !email || !message) {
    redirect(`/public/${tenantSlug}/rights?error=missing`);
  }

  const response = await fetch(`${API_BASE}/public/${tenantSlug}/rights`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, type, message }),
    cache: "no-store",
  });

  if (!response.ok) {
    redirect(`/public/${tenantSlug}/rights?error=submit`);
  }

  const payload = (await response.json()) as { rightsCase: { id: string } };
  redirect(`/public/${tenantSlug}/rights?submitted=${payload.rightsCase.id}`);
}
