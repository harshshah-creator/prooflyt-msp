import { NextRequest, NextResponse } from "next/server";
import { API_BASE } from "../../../../../lib/api";
import { getSessionToken } from "../../../../../lib/session";

/**
 *  OAuth callback for third-party connector providers (HubSpot today).
 *
 *  The provider redirects the browser here with `?code` and `?state`. We
 *  forward both to the worker, which:
 *    1. Looks up the persisted state nonce (mint at /oauth/start)
 *    2. Validates the connector type is OAuth2
 *    3. Exchanges code → tokens with the vendor
 *    4. Encrypts tokens and creates the ConnectorConnection
 *
 *  Defence-in-depth on the C2 finding: even though the worker's nonce store
 *  prevents replay/forgery, we also enforce that the request originates from
 *  a trusted vendor by checking the `Referer` header.
 */
const TRUSTED_OAUTH_REFERERS = [
  "https://app.hubspot.com",
  "https://app-eu1.hubspot.com",
  "https://accounts.zoho.com",
  "https://accounts.zoho.in",
  "https://accounts.shopify.com",
];

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (!code || !stateParam) {
    return NextResponse.redirect(
      new URL("/login?error=oauth-missing-code", request.url),
    );
  }

  // Defence-in-depth: only trusted OAuth providers should be sending us here.
  // Same-origin and missing Referer pass through (vendor browsers strip Referer
  // in some configurations); cross-origin from anywhere else is blocked.
  const referer = request.headers.get("referer") || "";
  const ok =
    !referer ||
    referer.startsWith(new URL(request.url).origin) ||
    TRUSTED_OAUTH_REFERERS.some((t) => referer.startsWith(t));
  if (!ok) {
    return NextResponse.redirect(
      new URL("/login?error=oauth-untrusted-referer", request.url),
    );
  }

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=oauth-${encodeURIComponent(error)}`, request.url),
    );
  }

  const token = await getSessionToken();
  if (!token) {
    return NextResponse.redirect(new URL("/login?next=connectors", request.url));
  }

  // Forward to the worker. The worker's nonce store decides which tenant the
  // state belongs to — we never trust a tenantSlug parsed from the URL string.
  const response = await fetch(`${API_BASE}/connectors/oauth/callback`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code, state: stateParam }),
    cache: "no-store",
  });

  if (!response.ok) {
    return NextResponse.redirect(
      new URL("/login?error=oauth-exchange-failed", request.url),
    );
  }

  // The worker tells us which tenant slug the persisted nonce mapped to; the
  // response is { id, connectorType, tenantSlug, ... }.
  const conn = (await response.json()) as { tenantSlug?: string };
  const slug = conn.tenantSlug || "";
  return NextResponse.redirect(
    new URL(
      `/workspace/${encodeURIComponent(slug)}/connectors?updated=connector-connected`,
      request.url,
    ),
  );
}
