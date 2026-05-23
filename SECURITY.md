# Security policy

## Reporting a vulnerability

If you discover a security issue, please **do not open a public GitHub
issue**. Instead, email the maintainers at `security@prooflyt.com` with:

- A description of the issue
- Steps to reproduce
- The repository (`prooflyt-msp` or `prooflyt-jva-spec`) and commit SHA
- Your name + how you want to be credited (optional)

We aim to respond within 2 business days and ship a fix within
30 days for High/Critical (CVSS 7+) findings, per the JVA Schedule 1
§S1.8 / §A13 SLAs.

## Credential handling

### What's safe to commit

- Public configuration (e.g. `wrangler.toml`, `vercel.json`)
- Example env files (`.env.example`)
- Code that *reads* env vars via `process.env.X` or `env.X`

### What's **never** safe to commit

- Plain-text passwords (even demo / seed values)
- API keys, OAuth client secrets, JWT signing keys
- Personal-data CSVs, screenshots showing real PII
- `.env` files with real values

The demo + ops passwords used by this app come from runtime env bindings,
not source code:

| Variable | Where to set | Used by |
|---|---|---|
| `DEMO_PASSWORD` | Cloudflare Workers secret (`wrangler secret put DEMO_PASSWORD`); Vercel env | Bombay Grooming Labs demo users |
| `OPS_PASSWORD`  | same | Internal cross-tenant ops admin |
| `CONNECTORS_MASTER_SECRET` | Cloudflare Workers secret | Connector token sealing |
| `WEBHOOK_HMAC_SECRET`      | Cloudflare Workers secret | Outbound webhook signing |
| `GROQ_API_KEY`             | Cloudflare Workers secret | AI Smart Mapping (Groq) |
| `TURNSTILE_SECRET`         | Cloudflare Workers secret | Public form bot protection |

Operators store their own copy of the live values in a **local-only**
`credentials.md` file that is **never committed**. This repo's `.gitignore`
defensively excludes any path matching `credentials*.md` so that even an
accidental `git add .` will not include it.

## What to do if a secret leaks

1. **Rotate immediately.**
   ```bash
   wrangler secret put DEMO_PASSWORD --name prooflyt-jva-spec-api
   vercel env rm DEMO_PASSWORD production && vercel env add DEMO_PASSWORD production
   ```
2. Redeploy worker (`wrangler deploy`) and web (`vercel deploy --prod`).
3. Update the operator's local `credentials.md`.
4. **Scrub git history.** A leaked value remains in `git log` even after
   you edit it. Use `git filter-repo` to remove it, or force-push a
   squashed branch over `main`.
5. Notify anyone who held the old credential.
6. If `ops@prooflyt.com` or any real corporate email is involved, also
   check the mailbox's sign-in logs for unauthorised access.

## Architecture safeguards

- **Tenant isolation** — every API endpoint is gated by
  `ensureTenantAccess(state, tenantSlug, authHeader)` which checks the
  session token's `tenantSlug` matches the requested tenant.
- **Session lifecycle** — bearer tokens expire after 60-min idle / 12-h
  absolute. Token format: `sess_<128-bit-uuid>_<userId>`.
- **Audit trail immutability** — JVA §A9.8: all state changes append to
  the audit trail; no endpoint or UI permits editing/deleting entries.
- **AI privacy** — JVA §S1.2: LLM never receives raw PII. Regex masking
  for Aadhaar / PAN / phone / email before any LLM call. Self-hosted /
  air-gapped LLM mode supported.

## Out-of-scope (Phase 2 per §S1.12)

These items will get their own threat model when implemented:

- Native connector OAuth flows (Salesforce, HubSpot, etc.)
- Sahamati AA consent fetch
- DPO Portal / white-label
- Keycloak SSO

Reports against Phase-2 surfaces are still welcome — file them anyway
and we will triage them as the surfaces ship.
