# Prooflyt — Admin Guide

_JVA Schedule 1 §S1.4 + Annexure A §A11 — Operator-facing administrative procedures._

Audience: **TENANT_ADMIN** and **COMPLIANCE_MANAGER** roles. This is the day-2
runbook for keeping the DPDP control plane healthy after Phase-1 setup is done.
For first-day setup, see the **Deployment Notes** (`deployment-notes.md`); for
end-user (data principal) flows see the **User Guide** (`user-guide.md`).

---

## 1. Workspace overview

The platform is organised into **10 modules**, each a separate page in the
admin shell:

| # | Module | Citation | What it owns |
|---|--------|----------|---------------|
| 1 | Setup | §S1.4 M1 | Tenancy, roles, SSO, SIEM keys, webhooks, LLM residency |
| 2 | Sources | §S1.4 M2 | Discovery — connectors, file uploads, AI mapping |
| 3 | Register | §S1.4 M3 | Records of processing (§5 + §8) |
| 4 | Dashboard | §S1.4 M4 | Readiness score, regulatory calendar, KPIs |
| 5 | Notices | §S1.4 M5 | Privacy notices, block editor, Rule 3 analyzer |
| 6 | Rights | §S1.4 M6 | DSR cases (§11–§15), SLA tracking |
| 7 | Retention | §S1.4 M7 | Deletion tasks, enforcement schedules |
| 8 | Incidents | §S1.4 M8 | Breach register, 72h timer, anomaly scan |
| 9 | Processors | §S1.4 M9 | Vendors, DPAs, sub-processor inventory |
| 10 | Reports | §S1.4 M10 | Compliance Pack, 6 named reports, audit trail |

Two cross-cutting surfaces sit alongside:

- **Connectors** — OAuth + API-key integrations that feed Sources and DSR cases
- **DPDP Reference** — non-interactive index of the Act + Rules with citations

---

## 2. Daily operator checklist (5 min)

1. **Dashboard** → glance at the readiness score and the four counters
   (open rights, overdue deletions, active incidents, owner coverage). Any
   counter trending up by more than +1 over 24h needs a triage decision.
2. **Rights** → click the **SLA snapshot** tile. Cases tinted amber (>50%
   window consumed) or red (>80%) need an owner action _today_.
3. **Incidents** → if any breach is in `ASSESSMENT` and the **72h timer**
   shows >60h elapsed, escalate to the Security Owner. The system auto-
   escalates at 72h but you should not let it get that far.
4. **Retention** → click **Enforce now** if your tenant uses scheduled
   enforcement; otherwise the cron runs nightly and you only review
   the resulting deletion tasks.
5. **DPO Inbox** (Reports module) → triage anything in there. Items that
   sit for >24h get bumped to Compliance Manager.

---

## 3. Setup module — what to keep current

### 3.1 Team and roles

Roles map 1:1 to JVA §S1.3:

| Role | Modules visible |
|------|-----------------|
| TENANT_ADMIN | All |
| COMPLIANCE_MANAGER | All except Setup/team |
| DEPARTMENT_OWNER | Register + Sources for their dept |
| REVIEWER | Read-only across modules |
| CASE_HANDLER | Rights + Retention |
| SECURITY_OWNER | Incidents + Setup/SIEM keys |
| AUDITOR | Reports + Audit trail (read-only) |
| PLATFORM_ADMIN | Internal — cross-tenant admin only |

Invites expire after 7 days. Re-send via `Invites → Resend`.

### 3.2 SSO (OIDC + SCIM)

Configured per tenant. Provider list: Azure AD, Okta, Google Workspace,
JumpCloud. Group → role mapping is one-way (provider is authoritative).

### 3.3 SIEM export keys

These long-lived bearer tokens authenticate **outbound** audit-event streams
to your SIEM. Rotate quarterly.

- **Create**: Setup → SIEM keys → New key, give it a label.
- **Copy the raw key once** — you cannot retrieve it again (Stripe model).
- **Revoke** is immediate; the key stops authenticating new pulls but doesn't
  invalidate already-streamed events (immutable log).

### 3.4 Webhooks (outbound)

Subscribe an HTTPS endpoint to event types like `rights.case.opened`,
`incident.severity.changed`, `deletion.task.closed`.

- Each subscription has a `secret`. We sign payloads with HMAC-SHA256 over
  the body; verify on your side using the header `x-prooflyt-signature`.
- Failed deliveries retry with exponential backoff (1m, 5m, 30m, 2h, 12h).
  After 5 failures the subscription auto-pauses; you must `Resume` it.

### 3.5 LLM residency

Per §S1.8(f) you can pick where AI requests are routed:

- **MANAGED** — Prooflyt-hosted Groq inference (default; data masked before send)
- **SELF_HOSTED** — Your own LLM endpoint (configure URL + auth header)
- **AIR_GAPPED** — No LLM calls; heuristics-only mapping

Change via the **LLM residency** panel in Setup. Switching modes does not
require a redeploy — it's read live by the worker on each request.

---

## 4. Sources module — discovery and AI mapping

### 4.1 File uploads

Drop a CSV / XLSX / JSON. Pick a **profile mode**:

| Mode | What goes to the LLM | When to use |
|------|----------------------|-------------|
| HEADER_ONLY | Column names + types | Default — privacy-safe |
| MASKED_SAMPLE | Headers + masked 1st-row sample | When mapping needs context |
| EPHEMERAL_FULL | Full content, then discarded | Only with DPO sign-off |

The AI proposes (category, identifier-type, purpose, legal-basis, retention)
for each column. **Always review before pushing to Register** — confidence
below 70% is flagged; below 50% requires human sign-off.

### 4.2 Connector OAuth

Supported phase-1 connectors: Salesforce, HubSpot, Stripe, Zendesk, Shopify.
Authorize via Setup → Connectors → New, pick provider, follow the OAuth flow.
On callback we exchange the code and store sealed tokens (master-key sealed).

### 4.3 Bombay Grooming Labs demo tenant

Pre-seeded with: 4 processors, 5 rights cases, 2 incidents (1 active CRITICAL),
3 notices (1 published, 1 SMS-consent draft, 1 Hindi version), 12 obligations.
Readiness score: 67%.

---

## 5. Register module — records of processing

Each row is one (system × data-category × purpose) tuple. Lifecycle:
`DRAFT → IN_REVIEW → APPROVED → ARCHIVED`. Only `APPROVED` rows count
toward the readiness score.

**Completeness** is computed from required fields per §5(1):

| Field | Required for COMPLETE |
|-------|------------------------|
| dataCategory | yes |
| purpose | yes |
| legalBasis | yes |
| retentionLabel | yes |
| linkedNoticeId | yes (unless legal-basis = §17 exemption) |
| linkedProcessorIds | yes (or zero-processor attestation) |

A row missing any of these is `PARTIAL`. Missing two or more is `MISSING`.

---

## 6. Notices module — Rule 3 compliance

### 6.1 Block editor

Click **Insert DPDP-compliant blocks** to open the picker. Mandatory blocks
(per Rule 3(1)–(7)) are tagged with a red **Required by DPDP** badge. Pick
the blocks your notice needs; selected blocks are appended to the notice
content with their citation header.

You can then edit the body to replace `[REPLACE — operator must fill]`
placeholders with tenant-specific values.

### 6.2 Rule 3 analyzer

Click **Analyze for Rule 3** on a notice to get a coverage score and a list
of missing items. Each missing item links to its block template so you can
add the right boilerplate without re-reading the Act.

### 6.3 Versioning

Editing a published notice creates a new version (semver patch bump).
Publishing supersedes the previous version but does not delete it — the
old version stays accessible at `/public/<slug>/notice?version=v1.2.0`.

### 6.4 Languages

Notices can have language variants linked to a parent via `parentNoticeId`.
Phase-1 supports English, Hindi, Tamil (DPDP §5(3) requires availability
in any Eighth-Schedule language on request).

---

## 7. Rights module — DSR caseflow

### 7.1 SLA windows

Statutory windows (JVA §S1.9):

| Right type | Window | Citation |
|------------|--------|----------|
| ACCESS | 30 days | §13 |
| CORRECTION | 30 days | §14(1)(b) |
| DELETION | 45 days | §14(1)(c) |
| PORTABILITY | 30 days | §13 (treated as access) |
| GRIEVANCE | 30 days (max 90) | §15 + Rule 13 |
| WITHDRAWAL | 7 days | §6(4) |

The system computes "days remaining" from `openedAt + window` and shows
amber/red tints as you approach the deadline.

### 7.2 Identity verification

Before opening a case, the requestor goes through the **OTP gate** at
`/public/<slug>/dsr-portal`. We send an OTP to the email/phone of record;
3 attempts max, 15-minute window. Failed verifications are logged but do
not create a case.

### 7.3 Closing a case

A case **cannot close** without one of:

- An evidence artifact linked (preferred), or
- A documented refusal note (e.g., §17 exemption applied)

For DELETION cases, additionally:

- Linked deletion task must be `CLOSED`
- Proof must be linked OR processor must have acknowledged
- Exceptions require Compliance Manager sign-off

### 7.4 SLA escalation

If a case crosses 80% of its window, the SLA panel surfaces it in red.
Clicking **Escalate** notifies the assigned owner + Compliance Manager.
The escalation is itself an audit event.

---

## 8. Retention module — deletion enforcement

### 8.1 Enforcement schedules

Runs nightly via Cloudflare cron, or on-demand via **Enforce now**. The
enforcer:

1. Computes `now - retentionWindow` per (system × category) pair
2. Lists rows older than that threshold
3. **Caps** the batch at `BULK_DELETE_BATCH_LIMIT = 10,000` rows per run
   to avoid runaway deletions; remaining candidates carry over to the
   next run (`deferredCount` in the report)
4. Issues delete instructions to the data source via connector
5. Records proof artifacts (manifest hash + processor acknowledgement)

### 8.2 Legal holds

A deletion task in `LEGAL_HOLD` does not delete even if the window has
passed. The hold reason + expiry must be documented. Only Compliance
Manager or higher can place or release a legal hold.

### 8.3 Proof of deletion

For each deletion, the system stores:

- The candidate manifest (what rows were targeted)
- The processor acknowledgement (HMAC-signed by the processor or
  attested by the operator if no processor API)
- A SHA-256 of the manifest, recorded in the audit trail

---

## 9. Incidents module — breach response

### 9.1 Triage tree

```
NEW
 ├─ within 1h: log title + source + initial scope
 │
 ├─ TRIAGE (≤ 24h after NEW)
 │    set severity (LOW/MEDIUM/HIGH/CRITICAL)
 │    set affectedCount  (auto-bump severity if > 1,000)
 │
 ├─ ASSESSMENT (≤ 72h after discovery)
 │    classify per Rule 7 + §32
 │    decide notify-board / notify-DPB / notify-principals
 │
 ├─ CONTAINMENT
 │    remediation steps + owner + deadline
 │
 └─ CLOSED
    evidence linked + retrospective filed
```

### 9.2 Auto-severity rule

JVA §A9.6 mandates: **affectedCount > 1,000 → severity floor HIGH**;
**> 100,000 → CRITICAL**. The system applies this whenever you save an
incident — you can raise the severity higher manually, but you cannot
lower it below the floor.

### 9.3 72-hour timer

Anchored to `discoveryDate`. If the incident is still in `TRIAGE` 72h
later, the **escalation sweep** auto-promotes it to `ASSESSMENT` and
notifies the Security Owner + Tenant Admin. The sweep runs hourly via
the cron route `/portal/{slug}/incidents/escalation-sweep`.

### 9.4 Anomaly scanner

Click **Run anomaly scan** on the Incidents module to compute outlier
metrics across the audit trail (e.g., spike in failed logins, unusual
export volume). The scanner uses statistical thresholds, not LLM. Findings
appear as `ALERTS` you can promote to incidents.

---

## 10. Processors module — vendor management

Each processor has:

- DPA status: `SIGNED` / `IN_REVIEW` / `MISSING`
- Purge ack. status: `ACKNOWLEDGED` / `PENDING` / `REFUSED`
- Sub-processor count

A processor in `IN_REVIEW` for >30 days surfaces a yellow warning on the
Dashboard. The **DPA generator** drafts a model DPA covering §8 obligations
that you can negotiate with the vendor.

---

## 11. Reports module — exports for auditors and regulators

### 11.1 Named reports (the 6 mandated by §A7.10)

Each report comes in 4 formats:

| Report | Citation | What's in it |
|--------|----------|---------------|
| register-completeness | §A7.3 | Lifecycle + completeness per row |
| open-rights | §A7.5 + §S1.9 | Cases not closed + SLA window |
| due-deletions | §A7.6 + §A14 | Deletion tasks with due/overdue subset |
| incident-register | §A9.6 | Severity + 72h timer + affected count |
| audit-extract | §A7.9 + §S1.8(c) | Append-only trail, filterable by `?since=` |
| processor-status | §A7.8 + §A8 | Vendors + DPA + purge ack. + sub-processors |

URL: `GET /api/portal/{slug}/reports/{reportType}?format=json|csv|xlsx|pdf`.

Each PDF has a header (title + citation + tenant + timestamp), paginated
Courier rows. XLSX is two-sheet (Cover + Data).

### 11.2 Compliance Pack (multipart bundle)

The full bundle, flavoured per audit firm:

| Firm | Cover style |
|------|-------------|
| generic | Default — platform branding |
| kpmg | KPMG India audit-binder convention |
| ey | EY India |
| pwc | PwC India |
| deloitte | Deloitte India |
| grantthornton | Grant Thornton Bharat |

Endpoint: `GET /api/portal/{slug}/export/compliance-pack?firm=<firm>`.

### 11.3 DPIA

For high-risk processing (children, large-scale profiling, automated
significant decisions, cross-border, sensitive identifiers), run a DPIA
from the **DPIA panel** on the Reports module. Risk level (LOW / MEDIUM /
HIGH / EXTREME) is computed from a deterministic rubric — the same inputs
always produce the same level, which auditors can spot-check.

---

## 12. Audit trail

Every state-changing operation produces an audit event with:

- `id` — monotonic; can be hash-chained for integrity (§S1.8(c))
- `createdAt` — ISO-8601 UTC
- `actor` — user name + ID
- `module` — which module owned the action
- `action` — verb (e.g., `RIGHTS_CASE_OPENED`)
- `targetId` — entity affected
- `summary` — human-readable one-liner

Events are append-only. They stream to SIEM via the keys you created in
Setup §3.3. Within the app they're queryable via Reports → audit-extract.

---

## 13. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Login redirects to /login loop | Session token expired (1h TTL) or stale cookie | Clear cookies, log in fresh |
| Report download is 0 bytes | Browser blocked binary content type | Try a different browser, or use curl |
| Anomaly scan never finishes | Audit trail too large (> 50k events) | Bound it with `?since=` |
| OAuth callback says "state expired" | OAuth state TTL is 10 min | Restart the connect flow |
| Webhook deliveries auto-pausing | 5+ consecutive failures | Check your endpoint, then Resume |
| Rights case won't close | Missing evidence or proof | Link an artifact or document refusal |
| Notice publish blocked | Rule 3 analyzer reports missing items | Add mandatory blocks via the editor |

For anything else, file a ticket with the audit event ID — that's the
fastest way for support to find the failure mode.
