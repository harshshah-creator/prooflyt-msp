# Prooflyt MSP Rebuild

Production-oriented Phase 1 MSP rebuild of Prooflyt using:

- `Next.js + TypeScript` for the frontend
- `NestJS + TypeScript` for the API
- seed-backed runtime storage for development

This workspace is intentionally separate from the prototype in `prooflyt-phase1/`.

## What Exists Now

- `apps/api`
  - NestJS API with:
    - auth session endpoints
    - invite acceptance
    - password reset flow
    - tenant-scoped portal bootstrap
    - admin bootstrap
    - public rights and notice routes
    - Smart Mapping profiling endpoint
    - Compliance Pack manifest export
- `apps/web`
  - Next.js App Router frontend with:
    - showcase / product overview route
    - login / demo credentials route
    - internal admin route
    - tenant workspace shell
    - dashboard
    - module views for setup, sources, register, notices, rights, retention, incidents, processors, evidence, and reports
    - public rights page
    - public notice page

## Design Direction

The UI intentionally avoids generic SaaS card-mosaic patterns and decorative gradients. It uses:

- editorial spacing
- ruled ledgers and rails
- restrained glass/paper surfaces
- strong typography
- single-accent operational color language

## AI Scope Implemented

Smart Mapping is implemented with a provider layer:

- profiling modes:
  - `HEADER_ONLY`
  - `MASKED_SAMPLE`
  - `EPHEMERAL_FULL`
- output includes:
  - mapped category
  - identifier type
  - purpose
  - legal basis
  - retention label
  - confidence score
  - reviewer warnings
- raw profiling payloads are treated as ephemeral by design
- nothing reaches the register automatically

### AI Credentials

- Provider priority is:
  - `GEMINI_API_KEY`
  - `GROQ_API_KEY`
  - `OPENAI_API_KEY`
  - fallback heuristic rules engine
- If no provider key is set, the app still works through deterministic rules-based mapping.
- Current environment variables:
  - `GEMINI_API_KEY`
  - `GEMINI_MODEL` (default: `gemini-2.0-flash`)
  - `GROQ_API_KEY`
  - `GROQ_MODEL` (default: `openai/gpt-oss-20b`)
  - `OPENAI_API_KEY`
  - `OPENAI_MODEL` (default: `gpt-4o-mini`)

## Demo Credentials

- Tenant admin:
  - email: `arjun@bombaygrooming.com`
  - password: `ProoflytDemo!2026`
- Auditor:
  - email: `audit@bombaygrooming.com`
  - password: `ProoflytDemo!2026`
- Internal admin:
  - email: `ops@prooflyt.com`
  - password: `ProoflytOps!2026`

## Run

Install dependencies:

```bash
npm install
```

Run the API:

```bash
npm run dev:api
```

Run the web app:

```bash
npm run dev:web
```

Default local endpoints:

- API: `http://127.0.0.1:4010`
- Web: `http://127.0.0.1:3000`

Suggested routes:

- Showcase: `http://127.0.0.1:3000/`
- Admin: `http://127.0.0.1:3000/admin`
- Login / credentials: `http://127.0.0.1:3000/login`
- Tenant workspace: `http://127.0.0.1:3000/workspace/bombay-grooming-labs/dashboard`
- Public rights page: `http://127.0.0.1:3000/public/bombay-grooming-labs/rights`
- Public notice page: `http://127.0.0.1:3000/public/bombay-grooming-labs/notice`

## Verification

These commands currently pass:

```bash
npm run typecheck
npm run build
```

Runtime checks completed:

- protected workspace routes redirect to `/login` without a session cookie
- public rights route remains publicly accessible
- API login returns a real session token
- tenant bootstrap and public bootstrap both return seeded Phase 1 data
