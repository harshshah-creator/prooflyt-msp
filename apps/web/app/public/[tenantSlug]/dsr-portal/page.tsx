import { getPublicRights } from "../../../../lib/api";
import { requestDsrOtpAction, verifyDsrOtpAction } from "./actions";

/**
 *  DSR portal — identity-verified Data Subject Request submission.
 *
 *  Two-step flow:
 *    1. The principal submits their email/phone → we generate a 6-digit OTP
 *       and surface it via the tenant's connected SMS/email connector
 *       (in dev/seed mode, the OTP is also returned in the success URL).
 *    2. The principal submits the OTP + the request type + details. We
 *       verify the OTP, mark the resulting RightsCase as identity-verified,
 *       and return a reference number for tracking.
 *
 *  This is the §13 access / §14 correction-erasure / §15 grievance surface
 *  the customer publishes once for all DSR types — replacing the per-channel
 *  "email grievance@…" pattern with a typed, rate-limited, OTP-verified flow.
 */
export default async function DsrPortalPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{
    step?: string;
    contact?: string;
    devOtp?: string;
    rr?: string;
    error?: string;
  }>;
}) {
  const { tenantSlug } = await params;
  const flash = await searchParams;
  const data = await getPublicRights(tenantSlug);
  const step = flash.step || (flash.contact ? "verify" : "request");

  return (
    <main className="public-stage">
      <section className="public-sheet">
        <span className="section-kicker">DSR portal · Identity-verified intake</span>
        <h1>{data.tenant.name}</h1>
        <p>
          Lodge a request to access, correct, erase, withdraw consent, or raise a grievance under the
          Digital Personal Data Protection Act, 2023. We verify your contact identity with a one-time
          code before opening the case.
        </p>

        {flash.rr && (
          <div className="callout-success">
            <strong>Request received.</strong> Reference: <code>{flash.rr}</code>. We will respond
            within the statutory window. You may track or escalate via this reference.
          </div>
        )}
        {flash.error && (
          <div className="callout-error">
            <strong>Couldn&apos;t process the request:</strong> {flash.error}
          </div>
        )}

        {step === "request" && !flash.rr && (
          <form
            className="public-form"
            action={requestDsrOtpAction.bind(null, tenantSlug)}
          >
            <h2>Step 1 — Verify your contact</h2>
            <p className="public-help">
              We will send a 6-digit code to the email or phone you enter. Codes expire in 15 minutes.
            </p>
            <label>
              Email or phone (the contact tied to the records you want to act on)
              <input
                type="text"
                name="contact"
                required
                placeholder="you@example.com  or  +91…"
                autoComplete="email"
              />
            </label>
            <button type="submit" className="primary-button">
              Send verification code
            </button>
          </form>
        )}

        {step === "verify" && flash.contact && !flash.rr && (
          <form
            className="public-form"
            action={verifyDsrOtpAction.bind(null, tenantSlug)}
          >
            <h2>Step 2 — Lodge your request</h2>
            <p className="public-help">
              We sent a 6-digit code to <strong>{flash.contact}</strong>.{" "}
              {flash.devOtp && (
                <span>
                  (Dev mode: code <code>{flash.devOtp}</code>.)
                </span>
              )}
            </p>
            <input type="hidden" name="contact" value={flash.contact} />
            <label>
              Verification code
              <input
                type="text"
                name="otp"
                required
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                placeholder="123456"
                autoComplete="one-time-code"
              />
            </label>
            <label>
              Type of request
              <select name="type" defaultValue="ACCESS">
                <option value="ACCESS">Access — get a copy of my data (DPDP §13)</option>
                <option value="CORRECTION">Correction — fix a mistake (DPDP §14)</option>
                <option value="DELETION">Erasure — delete my data (DPDP §14)</option>
                <option value="PORTABILITY">Portability — machine-readable export (DPDP §13)</option>
                <option value="WITHDRAWAL">Withdraw consent (DPDP §6)</option>
                <option value="GRIEVANCE">Grievance — file a complaint (DPDP §15)</option>
              </select>
            </label>
            <label>
              Details (what records, accounts, or services this concerns)
              <textarea
                name="details"
                rows={5}
                required
                placeholder="Help us identify the records — order ids, dates, account number, etc."
              />
            </label>
            <button type="submit" className="primary-button">
              Submit request
            </button>
          </form>
        )}

        <hr />
        <div className="public-footnote">
          <span className="section-kicker">Statutory information</span>
          <p>
            Grievance Officer: see <a href={`/public/${tenantSlug}/notice`}>privacy notice</a>.
            Open rights cases: <strong>{data.queueSummary.openRights}</strong>. Deletion tasks in
            queue: <strong>{data.queueSummary.overdueDeletions}</strong>.
          </p>
        </div>
      </section>
    </main>
  );
}
