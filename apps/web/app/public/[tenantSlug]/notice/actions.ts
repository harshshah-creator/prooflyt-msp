"use server";

import { redirect } from "next/navigation";
import { API_BASE } from "../../../../lib/api";

export async function acknowledgeNoticeAction(tenantSlug: string) {
  const response = await fetch(`${API_BASE}/public/${tenantSlug}/notice/acknowledge`, {
    method: "POST",
    cache: "no-store",
  });

  if (!response.ok) {
    redirect(`/public/${tenantSlug}/notice?error=ack`);
  }

  redirect(`/public/${tenantSlug}/notice?ack=1`);
}
