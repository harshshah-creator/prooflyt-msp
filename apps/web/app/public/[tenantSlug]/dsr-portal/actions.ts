"use server";

import { redirect } from "next/navigation";
import { API_BASE } from "../../../../lib/api";

export async function requestDsrOtpAction(tenantSlug: string, formData: FormData) {
  const contact = String(formData.get("contact") || "").trim();
  if (!contact) {
    redirect(`/public/${tenantSlug}/dsr-portal?error=Email%20or%20phone%20required`);
  }

  const response = await fetch(`${API_BASE}/public/${tenantSlug}/dsr/otp/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: contact.includes("@") ? contact : "", phone: contact.includes("@") ? "" : contact }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    redirect(`/public/${tenantSlug}/dsr-portal?error=${encodeURIComponent(body.error || "Could not issue OTP")}`);
  }

  // The worker returns devOtp in non-production deployments so testers can
  // complete the flow without wiring a real SMS/email gateway. In production
  // the OTP is dispatched via the customer's connected channel and devOtp
  // would be omitted/null.
  const payload = (await response.json()) as { devOtp?: string };
  const params = new URLSearchParams({ step: "verify", contact });
  if (payload.devOtp) params.set("devOtp", payload.devOtp);
  redirect(`/public/${tenantSlug}/dsr-portal?${params.toString()}`);
}

export async function verifyDsrOtpAction(tenantSlug: string, formData: FormData) {
  const contact = String(formData.get("contact") || "").trim();
  const otp = String(formData.get("otp") || "").trim();
  const type = String(formData.get("type") || "GRIEVANCE").trim();
  const details = String(formData.get("details") || "").trim();
  if (!contact || !otp || !details) {
    redirect(`/public/${tenantSlug}/dsr-portal?step=verify&contact=${encodeURIComponent(contact)}&error=Missing%20fields`);
  }

  const response = await fetch(`${API_BASE}/public/${tenantSlug}/dsr/otp/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contact, otp, type, details }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    redirect(
      `/public/${tenantSlug}/dsr-portal?step=verify&contact=${encodeURIComponent(contact)}&error=${encodeURIComponent(body.error || "Verification failed")}`,
    );
  }

  const payload = (await response.json()) as { rightsCase: { id: string } };
  redirect(`/public/${tenantSlug}/dsr-portal?rr=${payload.rightsCase.id}`);
}
