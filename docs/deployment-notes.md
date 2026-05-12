# Prooflyt — Deployment Notes

_JVA Schedule 2 §S2.4 + Annexure A §A13 — Operator deployment + day-1 setup._

Audience: **PLATFORM_ADMIN** and DevOps engineers commissioning a new
Prooflyt tenant. Once the platform is live and the first tenant is healthy,
hand the keys over to the **TENANT_ADMIN** who follows the **Admin Guide**.

---

## 1. Architecture summary

```
                      ┌─────────────────────────────┐
                      │   Browser (Next.js client)  │
                      └──────────────┬──────────────┘
                                     │ TLS
                                     ▼
                      ┌─────────────────────────────┐
                      │  Next.js 15 app (apps/web)  │  ← rendered by
                      │  - Server Components        │    Cloudflare Pages
                      │  - Server Actions           │
                      └──────────────┬──────────────┘
                                     │ fetch /api/*
                                     ▼
                      ┌─────────────────────────────┐
                      │  Cloudflare Worker          │  ← apps/api-worker
                      │  - Durable Object: state    │
                      │  - Crons: retention, sweep  │
                      │  - Bindings: KV, R2, secrets│
                      └──────────────┬──────────────┘
                                     │ HTTPS
                                     ▼
                  ┌─────────────┬────┴─────┬──────────────┐
                  ▼             ▼          ▼              ▼
              Salesforce    HubSpot    Stripe       Sahamati AA
              (OAuth)       (OAuth)    (API key)    (consent flow)
```

The **Durable Object** (`PROOFLYT_RUNTIME`) holds tenant state in-memory and
persists to Cloudflare Storage. There is no external database in Phase-1;
all state is in the DO storage with a JSON-shape mirror in the seed
package (`apps/api/src/data/seed.ts`).

For SIEM streaming we rely on **outbound HTTPS** from the worker; no
inbound SIEM connection is needed.

---

## 2. Prerequisites

| Thing | Why |
|-------|-----|
| Cloudflare account | Workers + Pages + Durable Objects |
| Wrangler ≥ 4.11 | Worker deploy CLI |
| Node 20+ | Build the Next.js app |
| Domain | Custom hostname for the portal |
| Groq API key (optional) | Cloud LLM for AI smart-mapping |
| Turnstile site key (optional) | Bot protection on `/public/*` |

You do **not** need a separate database server. State lives in DO storage.

---

## 3. First-time deploy

### 3.1 Clone and install

```bash
git clone <your-fork-url> prooflyt
cd prooflyt
npm install
```

### 3.2 Build the type packages

The repo is a monorepo. Build the contracts/domain/mapping/agents packages
before the apps:

```bash
npm run typecheck            # sanity-check everything compiles
npm run build                # produces dist/ for each package + the apps
```

### 3.3 Configure the worker

Edit `apps/api-worker/wrangler.toml`:

```toml
name = "prooflyt-api"
main = "src/index.ts"
compatibility_date = "2025-11-13"

[[durable_objects.bindings]]
name = "PROOFLYT_RUNTIME"
class_name = "ProoflytRuntime"

[[migrations]]
tag = "v1"
new_classes = ["ProoflytRuntime"]

# Required secrets — set via `wrangler secret put`
# - CONNECTORS_MASTER_SECRET       # 32-byte hex, seals connector tokens
# - WEBHOOK_HMAC_SECRET            # 32-byte hex, signs outbound webhooks
# - GROQ_API_KEY                   # optional — for AI smart-mapping
# - TURNSTILE_SECRET               # optional — bot protection
```

Set required secrets:

```bash
wrangler secret put CONNECTORS_MASTER_SECRET --name prooflyt-api
wrangler secret put WEBHOOK_HMAC_SECRET --name prooflyt-api
wrangler secret put GROQ_API_KEY --name prooflyt-api          # optional
wrangler secret put TURNSTILE_SECRET --name prooflyt-api      # optional
```

Generate the master secrets:

```bash
openssl rand -hex 32   # paste into CONNECTORS_MASTER_SECRET
openssl rand -hex 32   # paste into WEBHOOK_HMAC_SECRET
```

**Do not commit secrets.** Wrangler stores them in Cloudflare; they're
injected as env vars at runtime.

### 3.4 Deploy the worker

```bash
cd apps/api-worker
wrangler deploy
```

This deploys to `prooflyt-api.<account>.workers.dev`. Note the URL.

### 3.5 Configure cron triggers

In `wrangler.toml`:

```toml
[triggers]
crons = [
  "0 2 * * *",        # 02:00 UTC daily — retention enforcement
  "0 * * * *",        # hourly — incident escalation sweep
  "15 3 * * 1",       # 03:15 UTC Mondays — readiness recomputation
]
```

Re-deploy: `wrangler deploy`.

### 3.6 Configure the web app

Edit `apps/web/.env.local`:

```env
# Public API base — your Worker URL from §3.4
NEXT_PUBLIC_API_BASE=https://prooflyt-api.<account>.workers.dev/api

# LLM residency (one of: MANAGED, SELF_HOSTED, AIR_GAPPED)
PROOFLYT_LLM_RESIDENCY=MANAGED

# Optional — self-hosted LLM endpoint (only if residency = SELF_HOSTED)
PROOFLYT_LLM_ENDPOINT=https://your-llm-endpoint.example.com/v1
```

### 3.7 Deploy the web app

Cloudflare Pages:

```bash
cd apps/web
npx wrangler pages deploy .next
```

Or via the Pages dashboard: connect the repo, set build command
`npm run build -w @prooflyt/web`, output `apps/web/.next`, root `/`.

### 3.8 Set up the custom domain

In Cloudflare Pages → custom domains, add `app.your-domain.com`. Add a
CNAME pointing to the Pages hostname. SSL is auto-issued.

For the worker, you usually keep the `workers.dev` URL (the web app
proxies via `/api/*` rewrites in `next.config.js`).

---

## 4. Creating the first tenant

The seed package creates a demo tenant (`bombay-grooming-labs`) on first
DO instantiation. To onboard a real tenant:

1. Log into the platform as the **PLATFORM_ADMIN** (default credentials in
   the seed for demo; **rotate immediately in production**).
2. Go to the **Platform Admin** panel → New Tenant.
3. Fill: name, slug (URL-safe), industry, default language.
4. Save. The tenant gets a fresh workspace with no team members yet.
5. Invite the **TENANT_ADMIN** by email. They claim the invite at
   `/accept-invite?token=<token>` and become the first authoritative user.

From there, the TENANT_ADMIN follows the **Admin Guide** §3 to add team,
configure SSO, mint SIEM keys, register webhook subscribers, etc.

---

## 5. Backups and disaster recovery

### 5.1 Durable Object storage

DO storage replicates within a Cloudflare region by default. There is **no
automatic cross-region replication** in Phase-1. To protect against region
loss:

1. Run the daily compliance-pack export to a separate Cloudflare R2 bucket
   (or S3) — that's a full state snapshot in JSON+CSV form.
2. Stream the audit trail to an external SIEM (Splunk, Sentinel, Wazuh)
   via SIEM export keys — independent durability.

### 5.2 Restore from compliance pack

To restore a tenant from a snapshot:

1. Deploy a fresh worker.
2. Use the **Platform Admin → Import Tenant** endpoint (`POST
   /api/admin/tenants/import`) with the JSON file from the compliance pack.
3. Verify readiness score matches the pre-disaster value.

### 5.3 Connector tokens

OAuth tokens are sealed with `CONNECTORS_MASTER_SECRET`. If you rotate that
secret you **must** re-authorize every connector. There is currently no
key-versioning support — Phase-2 will add a HSM-backed key ring.

---

## 6. Monitoring and SLOs

### 6.1 What to monitor

| Metric | Target | Alert at |
|--------|--------|----------|
| Worker p99 latency | < 250 ms | > 500 ms for 5 min |
| Worker error rate | < 0.5% | > 2% for 1 min |
| DSR portal availability | 99.9% | < 99% in any 24h window |
| Cron success rate | 100% | any failure |
| Audit-export delivery | 100% | any failure |

### 6.2 Cloudflare Analytics

Workers analytics gives you the latency + error metrics out of the box.
Wire a webhook to PagerDuty / Slack from the Cloudflare alerting console.

### 6.3 Audit-export to SIEM

Each SIEM export key streams events in NDJSON to your SIEM via:

```
GET /api/portal/<slug>/audit-export/stream?since=<ISO_DATE>
Authorization: Bearer <ak-...>
```

The cursor + `?since=` make the stream resumable. Set your SIEM to poll
every 60s; the worker rate-limits at 10 req/min per key.

---

## 7. Compliance regimes

### 7.1 DPDP Act 2023 + Rules 2025

The platform is built to JVA Schedule 1 (FRD v2.0). Key dates:

| Date | What happens |
|------|---------------|
| 11 Aug 2023 | Act passed |
| 13 Nov 2025 | Rules notified — commencement of provisions on Consent, DPB, definitions |
| 13 Nov 2026 | SDF (Significant Data Fiduciary) crystallisation date |
| 13 May 2027 | Full enforcement — penalties up to ₹250 cr |

### 7.2 Other regimes touched

- **RBI** — payment data retention floor of 5 years (§17(2)(a) exemption)
- **GST / CGST §36** — transactional records 8-year retention
- **MeitY cross-border notified list** — drives §16 disclosures

### 7.3 Out of scope (Phase-1)

- **GDPR** — overlapping but separate; the platform's data model is
  structurally compatible but does not ship a GDPR-mode UI in Phase-1.
- **HIPAA / PCI-DSS** — domain-specific overlays; build via the
  obligation framework in Phase-2.

---

## 8. Security hardening

### 8.1 Session management

- Bearer tokens: 1-hour idle TTL, 12-hour absolute TTL.
- High-entropy: `sess_<uuid-no-dashes>_<user-id>` (≥ 128 bits).
- Stored in HTTP-only cookies in the web app; not accessible to JS.
- Logout invalidates server-side.

### 8.2 Connector token storage

- Sealed via AES-GCM with `CONNECTORS_MASTER_SECRET`.
- Never returned in API responses (only the sealed envelope ID).
- Rotated on each OAuth refresh.

### 8.3 Webhook signing

Outbound webhooks are HMAC-SHA256 signed over the request body. Header:
`x-prooflyt-signature: sha256=<hex>`. Verify on your side before acting.

### 8.4 LLM data exposure

Per JVA §S1.8(f), AI is **opt-out per tenant** and **privacy-first by
default**:

- HEADER_ONLY mode (default) sends only column names to the LLM
- MASKED_SAMPLE applies regex masking to the sample row
- EPHEMERAL_FULL is blocked unless `DPO_OPT_IN_FULL_SAMPLE=true` is set

The LLM provider (Groq) is given a `data_request: zero-retention` flag.

### 8.5 Audit trail integrity

Each audit event includes a SHA-256 link to the previous event's hash,
forming a chain. To verify integrity, walk the chain from the most recent
event back to the seed event. The Reports → audit-extract export includes
the hash chain in the PDF/XLSX so external auditors can verify offline.

---

## 9. Common deployment gotchas

| Symptom | Cause | Fix |
|---------|-------|-----|
| Worker errors with "DO class not found" | Migration not applied | Re-run `wrangler deploy` after editing `[[migrations]]` |
| Web app shows 502 on /api/* | `NEXT_PUBLIC_API_BASE` not set or worker not deployed | Confirm worker URL and env var |
| OAuth callback loops | Worker URL differs from registered redirect URI | Update redirect URIs at provider |
| LLM calls timeout | Groq region restrictions or quota | Switch residency to AIR_GAPPED or self-host |
| Cron not firing | `crons` array empty or syntax error | Validate with `wrangler triggers list` |
| Storage quota exceeded | Audit trail grew unbounded | Export + truncate older-than-90-days events via admin tool |
| Tenant accidentally deleted | No soft-delete in Phase-1 | Restore from latest compliance-pack snapshot |

---

## 10. Upgrade procedure

For minor releases (patch + minor):

1. Pull the new tag.
2. `npm install`
3. `npm run typecheck` (must pass)
4. `npm run build`
5. `wrangler deploy` (worker)
6. `wrangler pages deploy` (web)

For major releases (breaking changes to the DO state shape):

1. **Schedule a maintenance window** — DO state migrations are not online.
2. Export the latest compliance pack for each tenant.
3. Deploy the new worker with a migration handler that reshapes state on
   first DO read.
4. Verify each tenant's readiness score is unchanged.

---

## 11. Decommissioning

When a customer leaves:

1. Final compliance-pack export to their nominated archive bucket.
2. Notify all connected processors to purge tenant data (use the
   processor purge-ack endpoint).
3. Schedule deletion of DO storage after the contractual retention window.
4. Issue a signed certificate of deletion to the customer.

The certificate is generated from the Reports module as a PDF and signed
with the platform's deletion-attestation key.

---

## 12. Support and escalation

- **Operational issues** — file a ticket with the audit event ID
- **Security incidents** — `security@prooflyt.com` (PGP key in `/SECURITY.md`)
- **Compliance / regulatory questions** — escalate via the Confluence
  knowledge base; do not rely on support-channel responses for legal advice

---

## Appendix A — Reference URLs

| What | Where |
|------|-------|
| OpenAPI spec | `/docs/openapi.yaml` in this repo |
| Admin Guide | `/docs/admin-guide.md` |
| User Guide | `/docs/user-guide.md` |
| DPDP Act 2023 | https://www.meity.gov.in/data-protection-framework |
| DPDP Rules 2025 | (linked from MeitY portal) |
| Data Protection Board | https://dpb.gov.in/ (placeholder until full enforcement) |
| Sahamati AA | https://sahamati.org.in/ |
