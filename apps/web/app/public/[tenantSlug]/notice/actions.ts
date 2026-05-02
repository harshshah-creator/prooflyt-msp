"use server";

import { redirect } from "next/navigation";
import { API_BASE } from "../../../../lib/api";
import { normaliseLocale } from "../../../../lib/i18n";

export async function acknowledgeNoticeAction(tenantSlug: string, langRaw: string | undefined) {
  const lang = normaliseLocale(langRaw);
  const response = await fetch(`${API_BASE}/public/${tenantSlug}/notice/acknowledge`, {
    method: "POST",
    cache: "no-store",
  });

  const params = new URLSearchParams({ lang });
  if (!response.ok) {
    params.set("error", "ack");
    redirect(`/public/${tenantSlug}/notice?${params.toString()}`);
  }
  params.set("ack", "1");
  redirect(`/public/${tenantSlug}/notice?${params.toString()}`);
}
