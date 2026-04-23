"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { API_BASE } from "../../lib/api";
import { SESSION_COOKIE } from "../../lib/session";

export interface LoginState {
  error?: string;
}

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");

  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  if (!response.ok) {
    return { error: "Login failed. Check the demo credentials and try again." };
  }

  const payload = (await response.json()) as {
    session: { token: string };
    user: { internalAdmin?: boolean };
    tenant: { slug: string } | null;
  };

  const store = await cookies();
  store.set(SESSION_COOKIE, payload.session.token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  if (payload.user.internalAdmin) {
    redirect("/admin");
  }

  redirect(`/workspace/${payload.tenant?.slug || "bombay-grooming-labs"}/dashboard`);
}

export async function logoutAction() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
