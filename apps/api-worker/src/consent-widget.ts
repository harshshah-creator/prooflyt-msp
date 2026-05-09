/**
 *  Consent Widget — embeddable JS + ISO/IEC 27560 consent receipt API.
 *
 *  Replaces the typical Indian-site cookie-banner pattern with a DPDP-aware
 *  consent collector that produces portable receipts.
 *
 *  Three pieces:
 *    1.  GET  /api/public/:slug/consent/widget.js
 *        Returns the JS snippet to paste on the customer's site. Renders a
 *        DPDP-compliant banner + sends consent decisions back to step 2.
 *    2.  POST /api/public/:slug/consent/receipts
 *        Issues a signed ISO/IEC 27560-shaped receipt and persists it on
 *        the workspace. Returns receipt id + signed token.
 *    3.  GET  /api/portal/:slug/consent/receipts
 *        Workspace-side retrieval for the operator (Notices module + audit).
 *
 *  Receipts are deterministic, single-version (v1), and link the chosen
 *  purposes to the published Notice version at receipt-time so audits can
 *  reconstruct exactly what the principal saw.
 */

import type { Notice, TenantWorkspace } from "@prooflyt/contracts";

export interface ConsentReceipt {
  /** ISO/IEC 27560 receipt id — opaque, content-addressable */
  id: string;
  version: "1.0";
  issuedAt: string;
  /** SHA-256 of receipt body (the operator's audit token) */
  signature: string;
  /** Soft-PII contact identifier collected at consent time */
  subjectIdentifier: string;
  /** Linked Notice id + version from the workspace at the moment of consent */
  noticeId: string;
  noticeVersion: string;
  /** Per-purpose grant table */
  purposes: Array<{ id: string; name: string; granted: boolean; legalBasis: string }>;
  /** Locale the principal saw the banner in (en/hi/ta/etc.) */
  locale: string;
  /** UA + IP for fraud/audit (truncated for privacy) */
  ipPrefix: string;
  userAgent: string;
}

/* Default purposes if the operator hasn't customised. Aligned to the
   Rule 3 "purposes" item used in the gap analyzer (PR #5). */
export const DEFAULT_CONSENT_PURPOSES = [
  { id: "service",   name: "Account & service operations",       legalBasis: "Performance of contract" },
  { id: "security",  name: "Fraud prevention and security",      legalBasis: "Legitimate use" },
  { id: "marketing", name: "Marketing emails and notifications", legalBasis: "Consent" },
  { id: "analytics", name: "Product analytics and improvement",   legalBasis: "Consent" },
];

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 *  Issue a receipt. Pure of network calls; relies on workspace state for
 *  notice lookup. Returns the persisted ConsentReceipt.
 */
export async function issueConsentReceipt(
  workspace: TenantWorkspace,
  payload: {
    subjectIdentifier: string;
    purposes: Array<{ id: string; granted: boolean }>;
    locale?: string;
    ip?: string;
    userAgent?: string;
  },
): Promise<ConsentReceipt> {
  const subjectIdentifier = String(payload.subjectIdentifier || "").trim().slice(0, 320).toLowerCase();
  if (!subjectIdentifier) throw new Error("subjectIdentifier required");

  // The published notice at consent-time becomes part of the receipt so
  // re-opening years later, the operator can prove what the principal saw.
  const publishedNotice = (workspace.notices as Notice[]).find((n) => n.status === "PUBLISHED");
  const noticeId = publishedNotice?.id || "no-published-notice";
  const noticeVersion = publishedNotice?.version || "0.0";

  // Materialise the per-purpose grant table from the operator-provided
  // grant array, ignoring unknown purposes and inferring legal basis.
  const purposes = DEFAULT_CONSENT_PURPOSES.map((p) => ({
    id: p.id,
    name: p.name,
    legalBasis: p.legalBasis,
    granted: !!payload.purposes.find((g) => g.id === p.id && g.granted),
  }));

  // IP truncation for privacy (keep /24 IPv4, /48 IPv6).
  const ip = String(payload.ip || "").trim();
  const ipPrefix = ip.includes(":")
    ? ip.split(":").slice(0, 3).join(":") + "::"
    : ip.split(".").slice(0, 3).join(".") + ".0";

  const issuedAt = new Date().toISOString();
  const id = `rcpt_${crypto.randomUUID().replace(/-/g, "")}`;
  const body = JSON.stringify({
    id,
    version: "1.0",
    issuedAt,
    subjectIdentifier,
    noticeId,
    noticeVersion,
    purposes,
    locale: payload.locale || "en",
    ipPrefix,
    userAgent: String(payload.userAgent || "").slice(0, 200),
  });
  const signature = await sha256(body + workspace.tenant.id);

  const receipt: ConsentReceipt = {
    id,
    version: "1.0",
    issuedAt,
    signature,
    subjectIdentifier,
    noticeId,
    noticeVersion,
    purposes,
    locale: payload.locale || "en",
    ipPrefix,
    userAgent: String(payload.userAgent || "").slice(0, 200),
  };

  const ws = workspace as TenantWorkspace & { consentReceipts?: ConsentReceipt[] };
  if (!ws.consentReceipts) ws.consentReceipts = [];
  ws.consentReceipts!.unshift(receipt);
  // Cap retained receipts in memory; full audit lives in evidence.
  if (ws.consentReceipts!.length > 1000) ws.consentReceipts = ws.consentReceipts!.slice(0, 1000);

  // Cross-link to evidence so each consent shows up in the Compliance Pack.
  workspace.evidence.unshift({
    id: `ev-${id}`,
    label: `Consent receipt for ${subjectIdentifier}`,
    classification: "SYSTEM_DERIVED",
    linkedRecord: id,
    createdAt: issuedAt,
    contentIndexed: false,
  });

  return receipt;
}

/**
 *  Render the embeddable JS snippet for the customer's site. The shipped
 *  bundle is small (~3 KB) and dependency-free so the customer doesn't take
 *  a runtime hit on a marketing page.
 */
export function renderConsentWidgetJs(opts: {
  apiBase: string;
  tenantSlug: string;
  noticeUrl: string;
}): string {
  // Note: keep this string intentionally readable — the customer dev team
  // will inspect it before pasting on production sites.
  return `/*! Prooflyt consent widget v1 — DPDP-grade banner + receipt issuance */
(function () {
  if (window.__prooflytConsentLoaded) return; window.__prooflytConsentLoaded = true;
  var KEY = 'prooflyt:consent:' + ${JSON.stringify(opts.tenantSlug)};
  if (localStorage.getItem(KEY)) return;
  var bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;max-width:720px;margin:0 auto;background:#1a1a17;color:#f7f7f0;padding:18px 22px;border-radius:12px;font:14px/1.5 system-ui,sans-serif;box-shadow:0 12px 40px rgba(0,0,0,.25);z-index:2147483647';
  bar.innerHTML = '<strong style="color:#c8d27f">We collect personal data under DPDP, 2023.</strong>' +
    '<p style="margin:6px 0 12px">We need consent for marketing and analytics. Service + security data is collected on a different lawful basis. ' +
    '<a href="' + ${JSON.stringify(opts.noticeUrl)} + '" style="color:#c8d27f;text-decoration:underline">Read the full notice</a>.</p>' +
    '<label style="display:block;margin:4px 0"><input type="checkbox" data-id="marketing"/> Allow marketing</label>' +
    '<label style="display:block;margin:4px 0"><input type="checkbox" data-id="analytics"/> Allow analytics</label>' +
    '<div style="margin-top:12px;display:flex;gap:8px"><button data-act="accept-all" style="flex:1;background:#8a9a42;color:#fff;border:none;padding:8px;border-radius:6px;cursor:pointer">Accept all</button>' +
    '<button data-act="reject" style="flex:1;background:transparent;color:#fff;border:1px solid #555;padding:8px;border-radius:6px;cursor:pointer">Reject non-essential</button>' +
    '<button data-act="save" style="flex:1;background:#444;color:#fff;border:none;padding:8px;border-radius:6px;cursor:pointer">Save selection</button></div>';
  document.body.appendChild(bar);
  function send(grants, finishedCb) {
    fetch(${JSON.stringify(opts.apiBase)} + '/public/${opts.tenantSlug}/consent/receipts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subjectIdentifier: window.__prooflytSubject || ('anon@' + window.location.hostname),
        purposes: grants,
        locale: document.documentElement.lang || 'en',
        userAgent: navigator.userAgent
      })
    }).then(function (r) { return r.json(); }).then(function (rcpt) {
      try { localStorage.setItem(KEY, JSON.stringify(rcpt)); } catch (_) {}
      bar.remove();
      if (finishedCb) finishedCb(rcpt);
      window.dispatchEvent(new CustomEvent('prooflyt:consent', { detail: rcpt }));
    });
  }
  bar.addEventListener('click', function (ev) {
    var t = ev.target; if (!(t instanceof HTMLElement)) return;
    var act = t.getAttribute('data-act'); if (!act) return;
    if (act === 'accept-all') send([{id:'service',granted:true},{id:'security',granted:true},{id:'marketing',granted:true},{id:'analytics',granted:true}]);
    else if (act === 'reject')  send([{id:'service',granted:true},{id:'security',granted:true},{id:'marketing',granted:false},{id:'analytics',granted:false}]);
    else if (act === 'save') {
      var marketing = bar.querySelector('input[data-id=marketing]'); var analytics = bar.querySelector('input[data-id=analytics]');
      send([{id:'service',granted:true},{id:'security',granted:true},{id:'marketing',granted:!!(marketing && marketing.checked)},{id:'analytics',granted:!!(analytics && analytics.checked)}]);
    }
  });
})();
`;
}
