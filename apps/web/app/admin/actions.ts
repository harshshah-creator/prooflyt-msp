"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { API_BASE } from "../../lib/api";
import { getSessionToken } from "../../lib/session";

export async function setTenantStatusAction(tenantSlug: string, formData: FormData) {
  const token = await getSessionToken();
  if (!token) {
    redirect("/login");
  }

  const active = formData.get("active") === "true";
  const response = await fetch(`${API_BASE}/admin/tenants/${tenantSlug}/status`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ active }),
    cache: "no-store",
  });

  if (!response.ok) {
    redirect("/admin?error=tenant-status");
  }

  revalidatePath("/admin");
  revalidatePath(`/workspace/${tenantSlug}/setup`);
  redirect("/admin?updated=tenant-status");
}

export async function createTenantAction(formData: FormData) {
  const token = await getSessionToken();
  if (!token) {
    redirect("/login");
  }

  const name = String(formData.get("name") || "");
  const industry = String(formData.get("industry") || "Other");
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const response = await fetch(`${API_BASE}/admin/tenants`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, industry, slug }),
    cache: "no-store",
  });

  if (!response.ok) {
    redirect("/admin?error=tenant-create");
  }

  revalidatePath("/admin");
  redirect("/admin?updated=tenant-created");
}
