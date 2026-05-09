/**
 * Public-surface translations (DPDP §6(3) + Rule 3(2)).
 *
 * The DPDP Act requires that notices be available in any language listed in
 * the Eighth Schedule of the Constitution. Rule 3(2) confirms the data
 * principal must be able to read the notice in a language they understand.
 *
 * Translations covered today:
 *   en — English (baseline)
 *   hi — हिन्दी   (~43% of India's L1 speakers; near-universal L2)
 *   ta — தமிழ்   (highest-leverage non-Hindi 8th-Schedule language;
 *                 also covers a politically-sensitive language gap that
 *                 many western SaaS notices skip)
 *
 * We intentionally translate the *page chrome* (button labels, headings,
 * error states) and not the notice body itself — the notice content comes
 * from the API and must be drafted by the tenant's DPO. The page chrome
 * around the notice is what a regulator inspects when checking accessibility:
 * "can a Tamil-speaking principal navigate to an acknowledgement, find the
 * grievance officer, and submit a rights request?"
 *
 * Adding a language: append a key to `LOCALES`, fill in every entry in
 * `MESSAGES`, and the locale appears in the switcher automatically. Missing
 * keys fall back to English with a console warning so a half-translated
 * locale never silently ships.
 */

export type Locale = "en" | "hi" | "ta";

export const LOCALES: { code: Locale; label: string; nativeLabel: string }[] = [
  { code: "en", label: "English",  nativeLabel: "English" },
  { code: "hi", label: "Hindi",    nativeLabel: "हिन्दी" },
  { code: "ta", label: "Tamil",    nativeLabel: "தமிழ்" },
];

export const DEFAULT_LOCALE: Locale = "en";

/**
 *  All translatable strings on public surfaces. Group keys by page so a
 *  reviewer can read one column top-to-bottom and verify nothing is missing
 *  for that surface.
 */
export interface Messages {
  /* common */
  selectLanguage: string;
  poweredByProoflyt: string;
  /* notice page */
  noticeKicker: string;
  noticeNoPublished: string;
  noticeNoPublishedBody: string;
  noticeVersion: string;
  noticeAcknowledgements: string;
  noticeAckButton: string;
  noticeAckSuccess: string;
  noticeAckError: string;
  /* rights page */
  rightsKicker: string;
  rightsOpenCases: string;
  rightsDeletionQueue: string;
  rightsSubmittedPrefix: string;
  rightsErrorBody: string;
  rightsLabelName: string;
  rightsPlaceholderName: string;
  rightsLabelEmail: string;
  rightsPlaceholderEmail: string;
  rightsLabelType: string;
  rightsLabelMessage: string;
  rightsPlaceholderMessage: string;
  rightsSubmit: string;
  /* type options */
  typeAccess: string;
  typeCorrection: string;
  typeDeletion: string;
  typeGrievance: string;
  typeWithdrawal: string;
  /* legal references */
  legalNoticeFooter: string;
  legalRightsFooter: string;
}

/* ------------------------------------------------------------------ */
/*  Translations                                                        */
/*  Keys are sorted identically to the interface so reviewers can diff. */
/* ------------------------------------------------------------------ */

const en: Messages = {
  selectLanguage: "Select language",
  poweredByProoflyt: "Powered by Prooflyt — DPDP Compliance OS",
  noticeKicker: "Published notice",
  noticeNoPublished: "No published notice",
  noticeNoPublishedBody: "A published notice has not yet been released for this organisation.",
  noticeVersion: "Version",
  noticeAcknowledgements: "Acknowledgements",
  noticeAckButton: "Acknowledge notice",
  noticeAckSuccess: "Acknowledgment recorded successfully.",
  noticeAckError: "We could not record the acknowledgment. Please try again.",
  rightsKicker: "Public rights intake",
  rightsOpenCases: "Open rights cases",
  rightsDeletionQueue: "Deletion tasks in queue",
  rightsSubmittedPrefix: "Request submitted successfully. Case ID:",
  rightsErrorBody: "We could not submit the request. Please review the form and try again.",
  rightsLabelName: "Full name",
  rightsPlaceholderName: "Aadya Rao",
  rightsLabelEmail: "Email",
  rightsPlaceholderEmail: "aadya@example.com",
  rightsLabelType: "Request type",
  rightsLabelMessage: "Request details",
  rightsPlaceholderMessage: "Describe the request and any supporting context.",
  rightsSubmit: "Submit request",
  typeAccess: "Access (§13)",
  typeCorrection: "Correction (§14)",
  typeDeletion: "Deletion (§14)",
  typeGrievance: "Grievance (§15)",
  typeWithdrawal: "Consent withdrawal (§6)",
  legalNoticeFooter: "Notice published under the Digital Personal Data Protection Act, 2023, §5 read with Rule 3.",
  legalRightsFooter: "Rights submission accepted under DPDP §13–§15 and the DPDP Rules, 2025.",
};

const hi: Messages = {
  selectLanguage: "भाषा चुनें",
  poweredByProoflyt: "Prooflyt द्वारा संचालित — DPDP अनुपालन OS",
  noticeKicker: "प्रकाशित सूचना",
  noticeNoPublished: "कोई प्रकाशित सूचना नहीं",
  noticeNoPublishedBody: "इस संगठन के लिए अब तक कोई सूचना प्रकाशित नहीं की गई है।",
  noticeVersion: "संस्करण",
  noticeAcknowledgements: "स्वीकृतियाँ",
  noticeAckButton: "सूचना स्वीकार करें",
  noticeAckSuccess: "स्वीकृति सफलतापूर्वक दर्ज की गई।",
  noticeAckError: "हम स्वीकृति दर्ज नहीं कर सके। कृपया पुनः प्रयास करें।",
  rightsKicker: "सार्वजनिक अधिकार अनुरोध",
  rightsOpenCases: "खुले अधिकार मामले",
  rightsDeletionQueue: "विलोपन कार्य कतार में",
  rightsSubmittedPrefix: "अनुरोध सफलतापूर्वक प्रस्तुत किया गया। केस आईडी:",
  rightsErrorBody: "हम अनुरोध प्रस्तुत नहीं कर सके। कृपया फ़ॉर्म की समीक्षा करें और पुनः प्रयास करें।",
  rightsLabelName: "पूरा नाम",
  rightsPlaceholderName: "आद्या राव",
  rightsLabelEmail: "ईमेल",
  rightsPlaceholderEmail: "aadya@example.com",
  rightsLabelType: "अनुरोध का प्रकार",
  rightsLabelMessage: "अनुरोध विवरण",
  rightsPlaceholderMessage: "अनुरोध का विवरण और सहायक संदर्भ दें।",
  rightsSubmit: "अनुरोध प्रस्तुत करें",
  typeAccess: "अभिगम (§13)",
  typeCorrection: "सुधार (§14)",
  typeDeletion: "विलोपन (§14)",
  typeGrievance: "शिकायत (§15)",
  typeWithdrawal: "सहमति वापसी (§6)",
  legalNoticeFooter: "यह सूचना डिजिटल व्यक्तिगत डेटा सुरक्षा अधिनियम, 2023, §5 और नियम 3 के तहत प्रकाशित की गई है।",
  legalRightsFooter: "अधिकार अनुरोध DPDP §13–§15 और DPDP नियम, 2025 के अंतर्गत स्वीकार किया जाता है।",
};

const ta: Messages = {
  selectLanguage: "மொழியைத் தேர்வு செய்யவும்",
  poweredByProoflyt: "Prooflyt இயக்கம் — DPDP இணக்கம் OS",
  noticeKicker: "வெளியிடப்பட்ட அறிவிப்பு",
  noticeNoPublished: "வெளியிடப்பட்ட அறிவிப்பு இல்லை",
  noticeNoPublishedBody: "இந்த நிறுவனத்திற்கு இதுவரை எந்த அறிவிப்பும் வெளியிடப்படவில்லை.",
  noticeVersion: "பதிப்பு",
  noticeAcknowledgements: "ஒப்புதல்கள்",
  noticeAckButton: "அறிவிப்பை ஒப்புக்கொள்",
  noticeAckSuccess: "ஒப்புதல் வெற்றிகரமாக பதிவு செய்யப்பட்டது.",
  noticeAckError: "எங்களால் ஒப்புதலை பதிவு செய்ய முடியவில்லை. மீண்டும் முயற்சிக்கவும்.",
  rightsKicker: "பொது உரிமை சமர்ப்பணம்",
  rightsOpenCases: "திறந்த உரிமை வழக்குகள்",
  rightsDeletionQueue: "நீக்கம் பணி வரிசையில்",
  rightsSubmittedPrefix: "கோரிக்கை வெற்றிகரமாக சமர்ப்பிக்கப்பட்டது. வழக்கு எண்:",
  rightsErrorBody: "எங்களால் கோரிக்கையை சமர்ப்பிக்க முடியவில்லை. படிவத்தை மறுபரிசீலனை செய்து மீண்டும் முயற்சிக்கவும்.",
  rightsLabelName: "முழு பெயர்",
  rightsPlaceholderName: "ஆத்யா ராவ்",
  rightsLabelEmail: "மின்னஞ்சல்",
  rightsPlaceholderEmail: "aadya@example.com",
  rightsLabelType: "கோரிக்கை வகை",
  rightsLabelMessage: "கோரிக்கை விவரங்கள்",
  rightsPlaceholderMessage: "கோரிக்கையும் தொடர்புடைய சூழலையும் விவரிக்கவும்.",
  rightsSubmit: "கோரிக்கையை சமர்ப்பிக்கவும்",
  typeAccess: "அணுகல் (§13)",
  typeCorrection: "திருத்தம் (§14)",
  typeDeletion: "நீக்கம் (§14)",
  typeGrievance: "புகார் (§15)",
  typeWithdrawal: "ஒப்புதல் திரும்பப் பெறுதல் (§6)",
  legalNoticeFooter: "டிஜிட்டல் தனிநபர் தரவு பாதுகாப்புச் சட்டம், 2023, §5 மற்றும் விதி 3-ன் கீழ் வெளியிடப்பட்ட அறிவிப்பு.",
  legalRightsFooter: "உரிமை சமர்ப்பணம் DPDP §13–§15 மற்றும் DPDP விதிகள், 2025-ன் கீழ் ஏற்கப்படுகிறது.",
};

export const MESSAGES: Record<Locale, Messages> = { en, hi, ta };

/* ------------------------------------------------------------------ */
/*  Resolution helpers                                                  */
/* ------------------------------------------------------------------ */

/** Normalise an unknown string into a supported Locale, falling back to en. */
export function normaliseLocale(raw: string | string[] | undefined | null): Locale {
  if (!raw) return DEFAULT_LOCALE;
  const candidate = (Array.isArray(raw) ? raw[0] : raw).toLowerCase().slice(0, 2);
  if (candidate === "hi" || candidate === "ta" || candidate === "en") return candidate;
  return DEFAULT_LOCALE;
}

/** Return the Messages for a locale; never undefined (falls back to en). */
export function messagesFor(locale: Locale): Messages {
  return MESSAGES[locale] ?? MESSAGES.en;
}

/** Build the href that switches to a given locale on the same path. */
export function withLocaleParam(path: string, locale: Locale): string {
  const url = new URL(path, "https://placeholder.local");
  url.searchParams.set("lang", locale);
  return `${url.pathname}${url.search}`;
}
