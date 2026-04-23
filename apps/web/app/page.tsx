import Link from "next/link";
import { productNarrative } from "../lib/content";

export default function HomePage() {
  return (
    <div className="showcase-page">
      <header className="showcase-hero">
        <div className="showcase-topline">
          <span className="eyebrow">Prooflyt</span>
          <span className="tiny-rule" />
          <span>India&apos;s DPDP Compliance Operating System</span>
        </div>

        <div className="showcase-grid">
          <div className="showcase-copy">
            <h1>Privacy compliance that runs as an operating system, not a spreadsheet.</h1>
            <p>
              Prooflyt gives compliance teams a single platform to discover personal data, run operational
              workflows, and produce audit-ready evidence for the DPDP Act — replacing scattered
              consultants, shared drives, and email threads.
            </p>
          </div>

          <div className="showcase-scoreboard">
            <div>
              <span>Platform shape</span>
              <strong>Admin · Client · Public</strong>
            </div>
            <div>
              <span>AI capability</span>
              <strong>Smart Mapping with human gatekeeping</strong>
            </div>
            <div>
              <span>Data promise</span>
              <strong>Metadata-first, sealed evidence artifacts</strong>
            </div>
            <div>
              <span>Enforcement window</span>
              <strong>DPDP Act effective May 2027</strong>
            </div>
          </div>
        </div>

        <div className="showcase-actions">
          <Link href="/workspace/bombay-grooming-labs/dashboard" className="primary-button">
            Open workspace demo
          </Link>
          <Link href="/public/bombay-grooming-labs/rights" className="ghost-button">
            Public rights intake
          </Link>
          <Link href="/login" className="ghost-button">
            Sign in
          </Link>
        </div>
      </header>

      <main className="showcase-main">
        <section className="showcase-band">
          <div className="showcase-section-head">
            <span className="section-kicker">Problem</span>
            <h2>Why Prooflyt exists</h2>
          </div>
          <div className="statement-ledger">
            {productNarrative.problem.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </section>

        <section className="showcase-band">
          <div className="showcase-section-head">
            <span className="section-kicker">Architecture</span>
            <h2>Four layers, one operating model</h2>
          </div>
          <div className="architecture-ledger">
            {productNarrative.architecture.map(([label, body]) => (
              <div key={label} className="architecture-row">
                <strong>{label}</strong>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="showcase-band">
          <div className="showcase-section-head">
            <span className="section-kicker">Smart Mapping</span>
            <h2>AI-assisted discovery, never autonomous over the register</h2>
          </div>
          <div className="statement-ledger">
            {productNarrative.ai.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </section>

        <section className="showcase-band">
          <div className="showcase-section-head">
            <span className="section-kicker">Workflow</span>
            <h2>How compliance actually operates</h2>
          </div>
          <div className="architecture-ledger">
            {productNarrative.workflow.map(([label, body]) => (
              <div key={label} className="architecture-row">
                <strong>{label}</strong>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="showcase-band">
          <div className="showcase-section-head">
            <span className="section-kicker">Scoring</span>
            <h2>Coverage and pressure stay separate on purpose</h2>
          </div>
          <div className="statement-ledger">
            {productNarrative.scoring.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </section>

        <section className="showcase-band">
          <div className="showcase-section-head">
            <span className="section-kicker">Roles</span>
            <h2>Operational ownership is explicit</h2>
          </div>
          <div className="roles-ribbon">
            {productNarrative.roles.map((role) => (
              <span key={role}>{role}</span>
            ))}
          </div>
        </section>

        <section className="showcase-band">
          <div className="showcase-section-head">
            <span className="section-kicker">Surfaces</span>
            <h2>Three portals, one compliance record</h2>
          </div>
          <div className="statement-ledger">
            {productNarrative.screens.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </section>

        <section className="showcase-band">
          <div className="showcase-section-head">
            <span className="section-kicker">Trust architecture</span>
            <h2>How Prooflyt handles your data</h2>
          </div>
          <div className="statement-ledger">
            {productNarrative.capabilities.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </section>

        <section className="showcase-band">
          <div className="showcase-section-head">
            <span className="section-kicker">Roadmap</span>
            <h2>What comes next</h2>
          </div>
          <div className="statement-ledger">
            {productNarrative.phaseTwo.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
