# Prooflyt documentation index

This folder is the source-of-truth documentation set for the Prooflyt
DPDP-compliance platform. It is intentionally kept in-repo so changes
to the implementation move in lockstep with the docs.

| File | Audience | Purpose |
|------|----------|---------|
| `openapi.yaml` | Engineers integrating with the platform | OpenAPI 3.0.3 spec for all 12 endpoint groups, with DPDP citations inline |
| `admin-guide.md` | TENANT_ADMIN, COMPLIANCE_MANAGER | Day-2 runbook covering all 10 modules and the cross-cutting surfaces |
| `user-guide.md` | Data principals (end-users) | How to exercise your rights via the public DSR portal |
| `deployment-notes.md` | PLATFORM_ADMIN, DevOps | First-deploy + day-1 onboarding + monitoring |

The cross-cutting governance source — the **JVA Schedules** doc — is
not checked in (it's the legal contract); citations within the codebase
and these docs (§S1.x / §A.x) reference its sections.
