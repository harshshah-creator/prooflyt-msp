import { LoginForm } from "../../components/login-form";

/**
 *  Login page.
 *
 *  This is the demo deployment's login surface — the credentials it
 *  displays are intentionally visible (this is a demo, not production
 *  multi-tenant SaaS yet). However, the passwords themselves are NOT
 *  hardcoded in source any more — they are read from the server's env
 *  bindings:
 *
 *    DEMO_PASSWORD — Bombay Grooming Labs demo users
 *    OPS_PASSWORD  — internal ops admin
 *
 *  Set these on Vercel (Production env) and Cloudflare Workers (secret).
 *  If unset, the page shows a clear "(unset)" marker so the operator
 *  notices during onboarding instead of leaking a default.
 *
 *  To hide the credential panel entirely in a production-y deployment,
 *  set `NEXT_PUBLIC_HIDE_DEMO_CREDS=true`.
 */
export default function LoginPage() {
  const demoPassword = process.env.DEMO_PASSWORD ?? "(set DEMO_PASSWORD env)";
  const opsPassword = process.env.OPS_PASSWORD ?? "(set OPS_PASSWORD env)";
  const hidePanel = process.env.NEXT_PUBLIC_HIDE_DEMO_CREDS === "true";

  return (
    <main className="login-stage">
      <section className="login-sheet">
        <span className="section-kicker">Prooflyt</span>
        <h1>Sign in to your workspace</h1>
        <p>Access your compliance dashboard, run workflows, and manage evidence for DPDP readiness.</p>
        <LoginForm defaultPassword={hidePanel ? "" : demoPassword} />
        {!hidePanel && (
          <div className="credential-list">
            <div>
              <strong>Demo: Compliance Lead</strong>
              <p>arjun@bombaygrooming.com</p>
              <code>{demoPassword}</code>
            </div>
            <div>
              <strong>Demo: Auditor</strong>
              <p>audit@bombaygrooming.com</p>
              <code>{demoPassword}</code>
            </div>
            <div>
              <strong>Demo: Platform Admin</strong>
              <p>ops@prooflyt.com</p>
              <code>{opsPassword}</code>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
