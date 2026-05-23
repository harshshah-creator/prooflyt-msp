# Prooflyt — User Guide

_For end-users (data principals) exercising rights under the DPDP Act, 2023._

This guide is for **you, the customer/subscriber/data principal** whose
personal data is being processed by a company that uses Prooflyt to run its
DPDP compliance. It walks you through the rights you have, what to expect
when you exercise them, and where to escalate if things go wrong.

If you are a company operating Prooflyt on behalf of customers, see the
**Admin Guide** (`admin-guide.md`) instead.

---

## 1. What is the DPDP Act?

India's **Digital Personal Data Protection Act, 2023** (Act 22 of 2023)
governs how organisations handle your personal data. The Act was passed in
August 2023, the implementing Rules were notified on **13 November 2025**,
and substantive obligations take effect by **13 May 2027**.

The Act gives you **six concrete rights** as a data principal:

| Right | DPDP §  | What it means |
|-------|---------|----------------|
| Access | §13 | Get a summary of the personal data the company holds about you |
| Correction | §14 | Ask the company to fix factual errors |
| Erasure | §14 | Ask the company to delete your data |
| Portability | §13 | Get a machine-readable copy you can move to another service |
| Grievance | §15 | Escalate a complaint to the company's Grievance Officer |
| Withdrawal | §6(4) | Take back consent you previously gave |

---

## 2. Where to go

Each Prooflyt-using company has a **public DSR portal** at:

```
https://app.prooflyt.com/public/<company-slug>/dsr-portal
```

Replace `<company-slug>` with the company's URL identifier. For example, if
the company is _Bombay Grooming Labs_, the portal is at
`/public/bombay-grooming-labs/dsr-portal`.

The portal works on mobile + desktop. It is available in **English, Hindi,
and Tamil** (more languages on request — see §5.3).

---

## 3. Submitting a request — step by step

### 3.1 Pick the right type

The portal asks "What would you like to do?" with these options:

- **Access** — _"Show me what you have about me."_ The company sends you a
  structured summary within 30 days.
- **Correction** — _"This information is wrong; fix it."_ You provide the
  field and the correct value.
- **Deletion / Erasure** — _"Delete my data."_ The company has 45 days. Note
  that some data may be retained under §8(7) (regulatory obligation) — the
  response will say what was kept and why.
- **Portability** — _"Give me a machine-readable copy."_ You get JSON / CSV
  within 30 days.
- **Grievance** — _"I have a complaint about how my data was handled."_
  Goes to the Grievance Officer; response within 30 days (max 90).
- **Withdrawal** — _"I withdraw my consent."_ Effective within 7 days; the
  company stops processing that uses consent as the legal basis.

### 3.2 Identity verification

We send a **6-digit OTP** to your registered email or phone. Enter it within
**15 minutes**. You get 3 attempts; after that you must restart.

Why this step exists: without it, anyone could pretend to be you and get
your data. The OTP is the minimum proof of identity required by §13(1)(a).

### 3.3 Submit and track

After OTP, you get a **case ID** (format: `RR-2026-NNN`). Save it. You can
use the same portal to check status by entering your case ID + OTP again.

The portal shows you:

- Current stage (NEW → IN_PROGRESS → AWAITING_PROOF → CLOSED)
- Days remaining in the statutory window
- When the company expects to respond

---

## 4. What the company is required to do

For every request:

1. **Acknowledge within 24 hours** (§S1.9 of the platform spec).
2. **Verify your identity** through the OTP gate.
3. **Respond substantively within the statutory window** (see table in §1).
4. **Provide evidence of action** — for deletion, that means proof the data
   was actually deleted from their systems and any processors.
5. **Log the case** in an immutable audit trail you can subpoena.

If the company refuses your request (for example, citing §17 exemption for
RBI-mandated retention), they must tell you **why** with citations.

---

## 5. Special situations

### 5.1 Children's data

If you are under 18, or if the data concerns a child, the parent / legal
guardian must submit the request. The OTP goes to the guardian's verified
contact. Companies cannot track or behaviourally profile children, nor send
them targeted advertising (§9 + Rules 10–12).

### 5.2 Sensitive data

Health records, biometric data, financial account numbers, government IDs
(PAN, Aadhaar) get extra protection. Companies must store them with stricter
controls and you can ask for a list of who else has had access (§13(1)(b)).

### 5.3 Languages

The Eighth Schedule of the Constitution recognises 22 official languages.
Companies must make notices available in the language of your choice from
that list. If your preferred language is not in the dropdown, email the
Grievance Officer at `dpo@<company-domain>` and they will provide a
translation within 30 days.

### 5.4 Consent Manager (Sahamati AA)

Some companies integrate with **Sahamati Account Aggregators** so you can
issue and revoke consents through your AA app instead of the company's
portal. If you see the **"Use Consent Manager"** button on the portal,
clicking it bounces you to your AA, where revoking the consent automatically
flows back to the company within 24 hours.

### 5.5 Cross-border transfers

§16 of the DPDP Act lets the government notify a **negative list** of
countries to which data may not be transferred. Companies must disclose to
which countries your data goes; you can find this in their privacy notice
under "Cross-border transfer disclosure."

---

## 6. When things go wrong

### 6.1 No response within the statutory window

If the company has not responded by the deadline:

1. Use the **Grievance** option on the same portal to open a complaint.
2. The Grievance Officer must respond within 30 days.
3. If they still don't respond, you can escalate to the **Data Protection
   Board of India** (DPBI) at `https://dpb.gov.in/` (URL final on full
   enforcement, 13 May 2027).

### 6.2 Identity verification keeps failing

- Confirm you are using the email / phone the company has on file. If you've
  changed contact details, you may need to update them via a Correction
  request first (a chicken-and-egg case the Grievance route covers).
- OTPs expire after 15 minutes. Get a fresh one if it took too long.
- Three failed attempts locks you out for the rest of the day. Try
  tomorrow or call the company's Grievance Officer.

### 6.3 You get partial data

For Access / Portability, the company may legitimately withhold some
records (e.g., where production of the data would reveal another person's
data). They must tell you **why** for each redaction. If the redaction
seems excessive, file a Grievance.

### 6.4 The company says it has deleted your data — but you still hear from them

This sometimes happens when an offline list (e.g., a printed mailing) was
created before the deletion and is still in circulation. File a Correction
or new Deletion request referencing the original case ID, and the company's
audit trail can show whether the original deletion was complete.

---

## 7. Glossary

- **Data principal** — you, the person the data is about
- **Data fiduciary** — the company that decides why and how your data is
  processed (similar to GDPR "controller")
- **Data processor** — a vendor the company hires to process data on its
  behalf (similar to GDPR "processor")
- **SDF (Significant Data Fiduciary)** — a company designated by the
  government as higher-risk; subject to extra obligations like DPIA,
  Data Auditor, DPO. Crystallisation date: 13 November 2026.
- **DPB / DPBI** — Data Protection Board of India, the regulator
- **Grievance Officer / DPO** — the named officer at the company who
  handles your complaints. Their contact details must be in the
  privacy notice.
- **Consent artefact** — an immutable record proving you said yes to a
  specific processing. Can be issued by a Consent Manager (Sahamati AA).
- **§17 exemption** — circumstances where the Act doesn't apply (e.g.,
  prevention of crime, judicial functions, research with adequate
  safeguards). Companies citing this must say which clause applies.

---

## 8. Quick reference card

| If you want to... | Use the option | Expect a response in |
|-------------------|----------------|-----------------------|
| See what they have | Access | 30 days |
| Fix wrong info | Correction | 30 days |
| Delete your account | Erasure | 45 days |
| Take your data elsewhere | Portability | 30 days |
| Complain about handling | Grievance | 30 days (max 90) |
| Take back permission | Withdrawal | 7 days |

Keep your case ID and the date you opened the request. If the response
doesn't arrive on time, that's your starting point with the Grievance
Officer (and ultimately the DPB).
