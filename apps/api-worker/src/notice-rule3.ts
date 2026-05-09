/**
 *  Privacy Notice — DPDP Rule 3 gap analyzer.
 *
 *  Rule 3 of the DPDP Rules 2025 enumerates the items every privacy notice must
 *  contain. Most Indian notices in the wild are GDPR copy-pastes that miss
 *  half of these. This module parses a notice (raw text or markdown) and
 *  returns:
 *    - which Rule-3 items are present (with confidence + matched evidence)
 *    - which items are missing
 *    - a suggested first-draft of the missing wording (heuristic; Groq
 *      enhancement is the follow-on)
 *
 *  The classifier is a regex+keyword matrix so it works without an LLM call
 *  in the worker. When GROQ_API_KEY is set, callers can pass the gap report
 *  back through Groq for prose drafts — see `draftMissingItems()` below.
 */

export interface Rule3Item {
  /** Stable ID for cross-reference (rule3.itemized-data, rule3.rights, …) */
  id: string;
  /** Short label for UI surfaces */
  label: string;
  /** Where it lives in the DPDP Rules 2025 text */
  citation: string;
  /** Heuristic patterns that, if found in the notice, count as "present" */
  patterns: RegExp[];
  /** First-draft wording when missing — operator must review */
  draftTemplate: string;
}

/**
 *  The 12 mandatory items per Rule 3 + DPDP §5(1). This list is intentionally
 *  hand-coded so the law-changes review is a single-file diff, not a config
 *  hunt. Each pattern is conservative: false-positives (claiming the notice
 *  has it when it doesn't) are worse than false-negatives.
 */
export const RULE_3_ITEMS: Rule3Item[] = [
  {
    id: "itemized-data",
    label: "Itemized list of personal data collected",
    citation: "DPDP §5(1)(a) + Rule 3(1)",
    patterns: [
      /personal data (we|that we) (collect|process)/i,
      /(categories|types|items) of personal data/i,
      /the (following|specific) personal data/i,
    ],
    draftTemplate:
      "We collect the following items of personal data:\n" +
      "  · Identity: full name, date of birth, government identification reference (e.g., PAN last four)\n" +
      "  · Contact: email address, mobile number, postal address\n" +
      "  · Transactional: order history, payment method tokens, refund records\n" +
      "  · Behavioural: device identifiers, IP address, app event logs\n" +
      "  · Sensitive: KYC documents (where applicable)",
  },
  {
    id: "purposes",
    label: "Purposes for which the data is processed",
    citation: "DPDP §5(1)(b) + Rule 3(2)",
    patterns: [
      /purpose(s)? (of|for which)/i,
      /we (use|process) (your|the|this) (data|personal data) (for|to)/i,
      /(legitimate use|consent[- ]based purpose)/i,
    ],
    draftTemplate:
      "We process your personal data for the following purposes:\n" +
      "  · To deliver the service you requested (performance of contract)\n" +
      "  · To meet legal obligations (e.g. RBI/GST retention, DPDP Section 17 exemptions)\n" +
      "  · To prevent fraud and secure our systems (legitimate use)\n" +
      "  · To send marketing communications, only with your explicit consent",
  },
  {
    id: "rights",
    label: "How to exercise data principal rights (access, correction, erasure, nomination, grievance)",
    citation: "DPDP §11–§15 + Rule 3(3)",
    patterns: [
      /right to (access|correction|erasure)/i,
      /you (can|may) (request|exercise) (your|these) rights/i,
      /(grievance|grievance officer|grievance redressal)/i,
    ],
    draftTemplate:
      "You have the following rights under the DPDP Act, 2023:\n" +
      "  · Right of access (§11) — request a summary of the personal data we process about you\n" +
      "  · Right to correction (§12) — ask us to fix mistakes\n" +
      "  · Right to erasure (§12) — ask us to delete your data, subject to retention exemptions\n" +
      "  · Right to nominate (§13) — designate someone to exercise your rights on death/incapacity\n" +
      "  · Right of grievance redressal (§15) — escalate via our Grievance Officer below\n" +
      "  · Submit any of these via /public/<tenant>/dsr-portal — we verify your identity before opening the case.",
  },
  {
    id: "consent-withdrawal",
    label: "How to withdraw consent",
    citation: "DPDP §6(4) + Rule 3(4)",
    patterns: [
      /withdraw(al)? (your|of) consent/i,
      /you may (withdraw|revoke) consent/i,
      /unsubscribe/i,
    ],
    draftTemplate:
      "Where we rely on your consent, you may withdraw it at any time without prejudice to the lawfulness of " +
      "processing before the withdrawal. Withdraw via the DSR portal or by emailing the Grievance Officer.",
  },
  {
    id: "grievance-officer",
    label: "Grievance Officer name + contact",
    citation: "DPDP §8(10) + §15 + Rule 3(5)",
    patterns: [
      /grievance officer/i,
      /data protection officer/i,
      /(dpo)[ @]/i,
    ],
    draftTemplate:
      "Grievance Officer:\n" +
      "  Name: [REPLACE — appoint a named individual under §8(10)]\n" +
      "  Designation: Data Protection Officer\n" +
      "  Email: grievance@<your-domain>\n" +
      "  Phone: +91-…\n" +
      "  Postal address: <office address>\n" +
      "  Response timeline: 7 days for grievance acknowledgment under DPDP Rules 2025.",
  },
  {
    id: "retention",
    label: "Retention period or criteria",
    citation: "DPDP §8(7) + Rule 3(6) + Rule 8",
    patterns: [
      /retention (period|policy)/i,
      /how long.*we keep|we (keep|retain) (your )?(data|personal data) for/i,
      /(retained|stored) for/i,
    ],
    draftTemplate:
      "We retain your personal data for the periods set out below or as otherwise required by law:\n" +
      "  · Account & profile data — for as long as the account is active, plus 12 months\n" +
      "  · Transactional data — minimum 5 years (RBI Storage of Payment System Data direction) or 8 years (CGST Act)\n" +
      "  · Marketing data — until you withdraw consent\n" +
      "  · Audit/security logs — 12 months",
  },
  {
    id: "processors",
    label: "Categories of processors / sub-processors",
    citation: "DPDP §8 + Rule 3(7)",
    patterns: [
      /(third|third[- ]party).*(processors|service providers)/i,
      /(processor|sub[- ]processor)s? (we|with whom)/i,
      /(share|disclose) your data with/i,
    ],
    draftTemplate:
      "We share your personal data with the following categories of processors, each under a written DPA:\n" +
      "  · Payment processing — Razorpay, Cashfree, etc.\n" +
      "  · CRM — HubSpot, Zoho CRM\n" +
      "  · Helpdesk — Freshdesk\n" +
      "  · Cloud storage — AWS, Google Cloud\n" +
      "  · Analytics — Mixpanel, Google Analytics 4\n" +
      "A current list of named sub-processors is available upon request to the Grievance Officer.",
  },
  {
    id: "cross-border",
    label: "Cross-border data transfer disclosure",
    citation: "DPDP §16 + Rule 15",
    patterns: [
      /cross[- ]border (transfer|data transfer)/i,
      /(transferred|stored|processed) (outside|abroad) india/i,
      /(international|overseas) (transfer|servers)/i,
    ],
    draftTemplate:
      "Some of our processors store data outside India. As of the date of this notice, the following processors " +
      "host personal data outside India: [REPLACE — list HubSpot (US/EU/CA), Slack (US), Mailchimp (US), etc.]. " +
      "We rely on the Government of India's notified list of permitted countries under §16 of the DPDP Act and " +
      "have written agreements with each.",
  },
  {
    id: "children",
    label: "Children's data processing (verifiable parental consent)",
    citation: "DPDP §9 + Rules 10–12",
    patterns: [
      /children('s)? (data|personal data|consent)/i,
      /under (the age of |)18/i,
      /(parental|guardian) consent/i,
    ],
    draftTemplate:
      "Where we knowingly process the personal data of a person under the age of 18 (a child), we collect " +
      "verifiable consent from a parent or lawful guardian as required under §9 of the DPDP Act. We do not engage " +
      "in tracking, behavioural monitoring, or targeted advertising directed at children.",
  },
  {
    id: "consent-manager",
    label: "Consent Manager option (where applicable)",
    citation: "DPDP §6 + Rule 4",
    patterns: [
      /consent manager/i,
      /(register|registered) consent manager/i,
    ],
    draftTemplate:
      "You may grant, manage, review and withdraw your consent through a Consent Manager registered with the " +
      "Data Protection Board of India (Rule 4). [REPLACE — link your registered Consent Manager partner here once " +
      "available.]",
  },
  {
    id: "automated-processing",
    label: "Automated decision making + profiling",
    citation: "DPDP §11(1) + Rule 3(8)",
    patterns: [
      /(automated|automatic).*(decision|processing)/i,
      /profiling/i,
      /(scoring|ranking|recommendation engine)/i,
    ],
    draftTemplate:
      "We use automated processing in the following limited contexts: fraud-prevention scoring on payments, " +
      "personalised content recommendations, and email send-time optimisation. Where significant legal effects " +
      "could result, a human reviewer is involved before action.",
  },
  {
    id: "language-access",
    label: "Notice availability in scheduled Indian languages",
    citation: "DPDP §5(3)",
    patterns: [
      /(hindi|tamil|bengali|marathi|telugu|kannada|gujarati|punjabi|urdu)/i,
      /(scheduled languages|22 languages|eighth schedule)/i,
      /this notice is (also )?available in/i,
    ],
    draftTemplate:
      "This notice is available in English. Translations into Hindi and other scheduled languages of the Eighth " +
      "Schedule are available on request via the Grievance Officer or at /public/<tenant>/notice?lang=hi.",
  },
];

export interface Rule3GapReport {
  totalItems: number;
  presentItems: Array<{ id: string; label: string; citation: string; matchedPattern: string }>;
  missingItems: Array<{ id: string; label: string; citation: string; draftTemplate: string }>;
  /** 0–100 — share of Rule 3 items present */
  coverageScore: number;
  /** Heuristic flag: if false, the notice almost certainly was not written for DPDP */
  appearsDpdpAware: boolean;
}

/**
 *  Run the regex matrix over the notice content. Pure, deterministic, no I/O —
 *  safe to call inside the Durable Object request path.
 */
export function analyzeNoticeAgainstRule3(notice: string): Rule3GapReport {
  const present: Rule3GapReport["presentItems"] = [];
  const missing: Rule3GapReport["missingItems"] = [];

  for (const item of RULE_3_ITEMS) {
    const hit = item.patterns.find((p) => p.test(notice));
    if (hit) {
      present.push({ id: item.id, label: item.label, citation: item.citation, matchedPattern: hit.source });
    } else {
      missing.push({ id: item.id, label: item.label, citation: item.citation, draftTemplate: item.draftTemplate });
    }
  }

  const total = RULE_3_ITEMS.length;
  const coverageScore = Math.round((present.length / total) * 100);
  // "DPDP-aware" if the notice mentions either the DPDP Act or India-specific
  // citations like RBI/GST. A GDPR copy-paste typically scores 0 here even if
  // it covers 6+ Rule 3 items by accident.
  const appearsDpdpAware = /\bDPDP\b|Digital Personal Data Protection|RBI|CGST|TRAI|Aadhaar/i.test(notice);

  return {
    totalItems: total,
    presentItems: present,
    missingItems: missing,
    coverageScore,
    appearsDpdpAware,
  };
}

/**
 *  When GROQ_API_KEY is configured, take the gap report and produce a polished
 *  prose draft of just the missing items. Falls back to the template strings
 *  if Groq is unavailable, so the operator always gets *something* to review.
 */
export async function draftMissingItems(
  report: Rule3GapReport,
  tenantName: string,
  env: { GROQ_API_KEY?: string; GROQ_MODEL?: string },
): Promise<{ draft: string; provider: "groq" | "template" }> {
  if (!env.GROQ_API_KEY || report.missingItems.length === 0) {
    return { draft: report.missingItems.map((m) => `## ${m.label}\n\n${m.draftTemplate}`).join("\n\n"), provider: "template" };
  }

  const userPrompt = [
    `You are a DPDP Act, 2023 compliance writer producing privacy-notice fragments for an Indian Data Fiduciary.`,
    `Company name: ${tenantName}. Audience: customers/end-users.`,
    `Tone: clear, concrete, jurisdiction-correct. No GDPR-isms; cite DPDP sections inline where relevant.`,
    `Produce one fragment per missing item below, separated by markdown H2 headings (## …).`,
    `Where you don't know a specific value, use [REPLACE — …] so the operator knows to fill it in.`,
    "",
    "Missing items:",
    ...report.missingItems.map((m) => `  - ${m.label} (${m.citation})`),
    "",
    `Produce the fragments now. Markdown only, no preamble.`,
  ].join("\n");

  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: env.GROQ_MODEL || "llama-3.3-70b-versatile",
        temperature: 0.2,
        max_tokens: 2200,
        messages: [
          { role: "system", content: "You produce DPDP-Act-2023 compliant privacy-notice fragments." },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    if (!r.ok) throw new Error(`groq ${r.status}`);
    const j = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = j.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("empty groq response");
    return { draft: text, provider: "groq" };
  } catch {
    // Always return *some* draft so the operator workflow never dead-ends.
    return { draft: report.missingItems.map((m) => `## ${m.label}\n\n${m.draftTemplate}`).join("\n\n"), provider: "template" };
  }
}
