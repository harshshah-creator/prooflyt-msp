import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const SESSION_COOKIE = "prooflyt_session";

export async function getSessionToken() {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value || null;
}

export async function requireSession() {
  const token = await getSessionToken();
  if (!token) {
    redirect("/login");
  }
  return token;
}

export async function getOptionalSession() {
  return getSessionToken();
}
