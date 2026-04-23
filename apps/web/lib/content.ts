export const productNarrative = {
  problem: [
    "Compliance owners inherit spreadsheets, consultant PDFs, and email threads with no live proof trail. The DPDP Act demands operational readiness, not just documentation.",
    "Deletion, grievance, and incident obligations become invisible until a deadline turns them into regulatory pressure. Indian companies need a system that surfaces obligations before they become violations.",
    "Evidence ends up in shared drives, creating accidental PII stores instead of a governed proof layer. Auditors and the Data Protection Board expect sealed, traceable evidence — not folder hierarchies.",
  ],
  architecture: [
    ["Visibility", "Obligation readiness, operational pressure, and evidence coverage — in one score with drillable detail."],
    ["Input", "AI-assisted source discovery with Smart Mapping, human review, and controlled push-to-register."],
    ["Control", "Notices, rights, deletion, processors, and incidents run as managed workflows, not ad hoc threads."],
    ["Proof", "Sealed evidence artifacts, append-only audit trail, and a regulator-ready Compliance Pack export."],
  ],
  ai: [
    "Smart Mapping works in header-only, masked-sample, or ephemeral-full profiling mode — the classifier never sees raw personal data in the default flow.",
    "Each field gets a suggested category, identifier type, purpose, legal basis, and retention label, all scored for confidence so reviewers know exactly where to focus.",
    "Nothing reaches the register without reviewer approval, and raw profiling payloads are purged after analysis. The AI accelerates discovery; humans own the register.",
  ],
  workflow: [
    ["Discover", "Upload a workbook or questionnaire, derive fields, and hold ambiguous mappings in review until a reviewer confirms."],
    ["Register", "Push approved mappings into a metadata-first register with notice and processor links for full traceability."],
    ["Operate", "Run notice, rights, deletion, incident, and processor workflows against live obligations with SLA enforcement."],
    ["Prove", "Attach sealed evidence, capture audit events, and generate a regulator-ready Compliance Pack on demand."],
  ],
  scoring: [
    "Readiness is weighted from owner coverage, evidence coverage, approved register maturity, and published transparency — not a single checkbox.",
    "Pressure is shown separately so active rights cases, deletion tasks, and incidents stay visible even when the readiness score looks healthy.",
    "Each obligation bucket carries its own maturity so teams can drill into weak control areas rather than argue over one blended number.",
  ],
  roles: [
    "Tenant Admin",
    "Compliance Manager",
    "Department Owner",
    "Reviewer",
    "Case Handler",
    "Security / IT Owner",
    "Auditor",
  ],
  screens: [
    "Admin portal for tenant activation, master obligation stewardship, and platform-level governance.",
    "Client workspace for setup, source discovery, data register, notices, rights, retention, incidents, processors, evidence, and reports.",
    "Public rights intake and branded notice pages — tenant-branded, no Prooflyt identity leakage.",
    "Product overview route that explains the system architecture, scoring model, and operational philosophy.",
  ],
  phaseTwo: [
    "Native system connectors for Salesforce, Zoho, SAP HR, and Razorpay with scheduler-backed recurring evidence collection.",
    "Vendor-facing acknowledgment surface and deeper third-party risk workflows with sub-processor visibility.",
    "DPO-as-a-Service portal for managed service providers handling compliance for multiple entities.",
  ],
  capabilities: [
    "Sealed evidence architecture — artifacts are encrypted at rest, access-logged, and hash-verified. Never parsed or full-text indexed.",
    "Append-only audit trail — every mutation is captured with actor, action, timestamp, and target for full regulatory traceability.",
    "Metadata-first data model — Prooflyt records never store raw personal data. If the database were breached, no PII is exposed.",
  ],
};
