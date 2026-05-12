/**
 *  Notice building-blocks per JVA Schedule 1 §S1.4 Module 5 + Annexure A §A7.4:
 *    "Template-driven privacy notice creation and management. Template
 *     library; drag-and-drop editor; obligation mapping; version control."
 *
 *  Phase 1 doesn't ship a free-form drag-and-drop canvas (that would
 *  duplicate the work of a CMS). Instead we offer a curated set of
 *  pre-built DPDP-compliant blocks that an operator selects and orders
 *  via the editor. Each block carries:
 *    - mandatory flag (cannot publish without it),
 *    - citation (the DPDP §/Rule it satisfies),
 *    - boilerplate draft (operator edits per tenant).
 *
 *  Rule 3 of the DPDP Rules 2025 + §5(1) enumerate the items every
 *  notice must contain. This catalogue mirrors what notice-rule3.ts
 *  uses, so the analyzer and the editor stay in sync.
 */

export interface NoticeBlockTemplate {
  id: string;
  label: string;
  citation: string;
  mandatory: boolean;
  defaultBody: string;
}

export const NOTICE_BLOCK_TEMPLATES: NoticeBlockTemplate[] = [
  {
    id: "items-collected",
    label: "Personal data we collect",
    citation: "DPDP §5(1)(a) + Rule 3(1)",
    mandatory: true,
    defaultBody:
      "We collect the following items of personal data:\n" +
      "  · Identity: full name, date of birth, government identification (e.g. PAN last 4)\n" +
      "  · Contact: email, mobile, postal address\n" +
      "  · Transactional: order history, payment-method tokens, refund records\n" +
      "  · Behavioural: device identifiers, IP address, app event logs",
  },
  {
    id: "purposes",
    label: "Purposes for which we process the data",
    citation: "DPDP §5(1)(b) + Rule 3(2)",
    mandatory: true,
    defaultBody:
      "We process your personal data for the following purposes:\n" +
      "  · Deliver the service you requested (performance of contract)\n" +
      "  · Meet legal obligations (RBI / GST retention, DPDP §17 exemptions)\n" +
      "  · Prevent fraud and secure our systems (legitimate use)\n" +
      "  · Send marketing communications, only with your explicit consent",
  },
  {
    id: "rights",
    label: "How to exercise data principal rights",
    citation: "DPDP §11–§15 + Rule 3(3)",
    mandatory: true,
    defaultBody:
      "You have the following rights under the DPDP Act, 2023:\n" +
      "  · Right of access (§13) — request a summary of the personal data we process\n" +
      "  · Right to correction (§14) — ask us to fix mistakes\n" +
      "  · Right to erasure (§14) — ask us to delete your data (subject to retention)\n" +
      "  · Right to portability (§13) — receive a machine-readable copy\n" +
      "  · Right to nominate (§13) — designate someone to exercise your rights\n" +
      "  · Right of grievance redressal (§15) — escalate via our Grievance Officer\n" +
      "Submit any of these via /public/<tenant>/dsr-portal. Identity is verified before opening the case.",
  },
  {
    id: "consent-withdrawal",
    label: "How to withdraw consent",
    citation: "DPDP §6(4) + Rule 3(4)",
    mandatory: true,
    defaultBody:
      "Where we rely on your consent, you may withdraw it at any time without prejudice to the " +
      "lawfulness of processing before the withdrawal. Withdraw via the DSR portal or by emailing " +
      "the Grievance Officer below.",
  },
  {
    id: "grievance-officer",
    label: "Grievance Officer details",
    citation: "DPDP §8(10) + §15 + Rule 3(5)",
    mandatory: true,
    defaultBody:
      "Grievance Officer\n" +
      "Name: [REPLACE — operator must fill]\n" +
      "Email: dpo@[your-domain]\n" +
      "We acknowledge grievances within 24 hours and respond substantively within 30 days.",
  },
  {
    id: "retention",
    label: "Retention period",
    citation: "DPDP §8(7) + Rule 3(6) + Rule 8",
    mandatory: true,
    defaultBody:
      "We retain personal data only as long as necessary for the stated purpose, then delete or " +
      "anonymise it. Indicative periods: customer accounts — 24 months post-closure; transactional " +
      "records — 8 years (CGST §36); payment records — 5 years (RBI). Specific retention rules " +
      "per category are listed in our Retention Schedule.",
  },
  {
    id: "processors",
    label: "Categories of processors / sub-processors",
    citation: "DPDP §8 + Rule 3(7)",
    mandatory: true,
    defaultBody:
      "We engage the following categories of processors:\n" +
      "  · Payment gateway providers (RBI-licensed)\n" +
      "  · Customer-support helpdesk\n" +
      "  · Email/SMS delivery vendors\n" +
      "  · Cloud hosting and analytics\n" +
      "All processors are bound by a DPA mirroring DPDP §8 obligations.",
  },
  {
    id: "cross-border",
    label: "Cross-border transfer disclosure",
    citation: "DPDP §16 + Rule 15",
    mandatory: true,
    defaultBody:
      "Personal data may be transferred to processors in [LIST COUNTRIES]. Transfers comply with " +
      "DPDP §16 restrictions and the MeitY notified list. We do not transfer to countries on the " +
      "DPDP §16 negative list.",
  },
  {
    id: "children",
    label: "Children's data processing",
    citation: "DPDP §9 + Rules 10–12",
    mandatory: true,
    defaultBody:
      "If we knowingly collect personal data of a child (under 18), we obtain verifiable parental " +
      "consent. We do not track, target ads, or behaviourally profile children.",
  },
  {
    id: "consent-manager",
    label: "Consent Manager registration",
    citation: "DPDP §7 + Rule 4",
    mandatory: false,
    defaultBody:
      "Where applicable, you may issue and revoke consent for our processing via any DPB-registered " +
      "Consent Manager (Sahamati Account Aggregator). Consent artefacts are linked to your account " +
      "and revocation flows back to us within 24 hours.",
  },
  {
    id: "automated-processing",
    label: "Automated decision-making disclosure",
    citation: "DPDP §11 + ECT principles",
    mandatory: false,
    defaultBody:
      "We use automated processing in limited contexts: fraud-prevention scoring on payments, " +
      "personalised content recommendations, and email send-time optimisation. Where significant " +
      "legal effects could result, a human reviewer is involved before action.",
  },
  {
    id: "language-access",
    label: "Notice availability in scheduled Indian languages",
    citation: "DPDP §5(3)",
    mandatory: false,
    defaultBody:
      "This notice is available in English. Translations into Hindi and other Eighth-Schedule " +
      "languages are available on request via the Grievance Officer or at /public/<tenant>/notice?lang=hi.",
  },
];
