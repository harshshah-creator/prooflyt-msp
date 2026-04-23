import Link from "next/link";
import { API_BASE, getAdminBootstrap } from "../../lib/api";
import { requireSession } from "../../lib/session";
import { createTenantAction, setTenantStatusAction } from "./actions";

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ updated?: string; error?: string }>;
}) {
  const token = await requireSession();
  const data = await getAdminBootstrap(token);
  const flash = (await searchParams) || {};

  /* ── Fetch DPDP obligation library ───────────────── */
  let dpdpLibrary: Array<{
    obligation: string;
    dpdpSection: string;
    rule: string;
    maxPenalty: string;
    module: string;
  }> = [];
  try {
    const libRes = await fetch(`${API_BASE}/admin/dpdp-library`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (libRes.ok) {
      dpdpLibrary = await libRes.json();
    }
  } catch {
    /* graceful degradation */
  }

  /* ── Fetch platform audit log ────────────────────── */
  let auditLog: Array<{
    action: string;
    module: string;
    actor: string;
    tenant: string;
    when: string;
  }> = [];
  try {
    const auditRes = await fetch(`${API_BASE}/admin/audit-log`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (auditRes.ok) {
      auditLog = await auditRes.json();
    }
  } catch {
    /* graceful degradation */
  }

  return (
    <main className="login-stage">
      <section className="public-sheet">
        <span className="section-kicker">Admin portal</span>
        <h1>Prooflyt internal operations</h1>
        <p>
          Internal-only surface for tenant activation, obligation-library stewardship, and portfolio visibility. This is
          intentionally narrower than the tenant workspace.
        </p>

        {flash.updated === "tenant-status" ? <p className="form-status success">Tenant status updated.</p> : null}
        {flash.error === "tenant-status" ? <p className="form-status error">Tenant status update failed.</p> : null}
        {flash.updated === "tenant-created" ? <p className="form-status success">Tenant created.</p> : null}
        {flash.error === "tenant-create" ? <p className="form-status error">Tenant creation failed.</p> : null}

        {/* ── Create Tenant Form ──────────────────────── */}
        <div className="narrative-block">
          <span className="section-kicker">Onboard</span>
          <h3>Create Tenant</h3>
          <form action={createTenantAction} className="narrative-block">
            <input name="name" placeholder="Company name" required />
            <select name="industry" defaultValue="Other">
              <option value="D2C">D2C</option>
              <option value="Fintech">Fintech</option>
              <option value="Edtech">Edtech</option>
              <option value="Healthcare">Healthcare</option>
              <option value="SaaS">SaaS</option>
              <option value="Other">Other</option>
            </select>
            <button type="submit" className="text-button">Create Tenant</button>
          </form>
        </div>

        {/* ── Tenant List ─────────────────────────────── */}
        <div className="statement-ledger">
          {data.tenants.map((tenant) => (
            <div key={tenant.slug} className="ledger-row">
              <div>
                <strong>{tenant.name}</strong>
                <span>
                  {tenant.industry} · {tenant.teamCount} users
                </span>
              </div>
              <div>
                <strong>{tenant.metrics.readinessScore}%</strong>
                <span>{tenant.metrics.openGaps} visible gaps</span>
              </div>
              <form action={setTenantStatusAction.bind(null, tenant.slug)} className="compact-inline-form compact-inline-form--right">
                <input type="hidden" name="active" value={tenant.active ? "false" : "true"} />
                <span className="micro-note">{tenant.active ? "Active" : "Inactive"}</span>
                <button type="submit" className="text-button">
                  {tenant.active ? "Deactivate" : "Activate"}
                </button>
              </form>
              <Link href={`/workspace/${tenant.slug}/dashboard`} className="text-button">
                Open Workspace
              </Link>
            </div>
          ))}
        </div>

        {/* ── DPDP Obligation Library ─────────────────── */}
        <div className="narrative-block">
          <span className="section-kicker">Reference</span>
          <h3>DPDP Obligation Library</h3>
          {dpdpLibrary.length > 0 ? (
            <div className="statement-ledger">
              <div className="ledger-row ledger-header">
                <span>Obligation</span>
                <span>DPDP Section</span>
                <span>Rule</span>
                <span>Max Penalty</span>
                <span>Module</span>
              </div>
              {dpdpLibrary.map((item, idx) => (
                <div key={idx} className="ledger-row">
                  <span>{item.obligation}</span>
                  <span>{item.dpdpSection}</span>
                  <span>{item.rule}</span>
                  <span>{item.maxPenalty}</span>
                  <span>{item.module}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="roles-ribbon">
              {data.masterLibrary.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          )}
        </div>

        {/* ── Platform Audit Log ──────────────────────── */}
        <div className="narrative-block">
          <span className="section-kicker">Activity</span>
          <h3>Platform Audit Log</h3>
          {auditLog.length > 0 ? (
            <div className="statement-ledger">
              <div className="ledger-row ledger-header">
                <span>Action</span>
                <span>Module</span>
                <span>Actor</span>
                <span>Tenant</span>
                <span>When</span>
              </div>
              {auditLog.map((entry, idx) => (
                <div key={idx} className="ledger-row">
                  <span>{entry.action}</span>
                  <span>{entry.module}</span>
                  <span>{entry.actor}</span>
                  <span>{entry.tenant}</span>
                  <span>{entry.when}</span>
                </div>
              ))}
            </div>
          ) : (
            <p>No audit entries yet.</p>
          )}
        </div>

        <div className="showcase-actions">
          <Link href="/workspace/bombay-grooming-labs/dashboard" className="primary-button">
            Open demo tenant
          </Link>
          <Link href="/" className="ghost-button">
            Open showcase
          </Link>
        </div>
      </section>
    </main>
  );
}
