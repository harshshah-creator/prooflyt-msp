import { LoginForm } from "../../components/login-form";

export default function LoginPage() {
  return (
    <main className="login-stage">
      <section className="login-sheet">
        <span className="section-kicker">Prooflyt</span>
        <h1>Sign in to your workspace</h1>
        <p>Access your compliance dashboard, run workflows, and manage evidence for DPDP readiness.</p>
        <LoginForm />
        <div className="credential-list">
          <div>
            <strong>Demo: Compliance Lead</strong>
            <p>arjun@bombaygrooming.com</p>
            <code>ProoflytDemo!2026</code>
          </div>
          <div>
            <strong>Demo: Auditor</strong>
            <p>audit@bombaygrooming.com</p>
            <code>ProoflytDemo!2026</code>
          </div>
          <div>
            <strong>Demo: Platform Admin</strong>
            <p>ops@prooflyt.com</p>
            <code>ProoflytOps!2026</code>
          </div>
        </div>
      </section>
    </main>
  );
}
