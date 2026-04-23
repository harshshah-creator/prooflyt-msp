import Link from "next/link";
import type { ReactNode } from "react";
import type { ModuleId, WorkspaceResponse } from "../lib/types";
import { LogoutButton } from "./logout-button";

const navItems: Array<{ id: ModuleId; label: string; note: string; icon: string }> = [
  { id: "dashboard", label: "Dashboard", note: "Score, pressure, next action", icon: "⊞" },
  { id: "setup", label: "Company Setup", note: "Brand, departments, roles", icon: "⚙" },
  { id: "sources", label: "Source Discovery", note: "Upload, profile, approve", icon: "◎" },
  { id: "register", label: "Data Register", note: "Traceability and completeness", icon: "▤" },
  { id: "notices", label: "Notices", note: "Versioned transparency", icon: "◧" },
  { id: "rights", label: "Rights & Grievances", note: "Cases and SLA control", icon: "◈" },
  { id: "retention", label: "Retention", note: "Tasks, holds, proof", icon: "◇" },
  { id: "incidents", label: "Breach Register", note: "Assessment to closure", icon: "△" },
  { id: "processors", label: "Vendors", note: "DPA and purge status", icon: "◯" },
  { id: "evidence", label: "Evidence", note: "Sealed proof library", icon: "▣" },
  { id: "reports", label: "Reports", note: "Compliance Pack and extracts", icon: "▧" },
  { id: "dpdp-reference", label: "DPDP Reference", note: "Act, Rules, obligations", icon: "§" },
];

export function WorkspaceShell({
  data,
  currentModule,
  children,
}: {
  data: WorkspaceResponse;
  currentModule: ModuleId;
  children: ReactNode;
}) {
  const { workspace, operator } = data;

  return (
    <div className="shell-frame">
      <aside className="shell-rail">
        <div className="brand-lockup">
          <div className="brand-mark">DP</div>
          <div>
            <h1 className="brand-name">Prooflyt</h1>
            <p className="brand-sub">DPDP Compliance</p>
          </div>
        </div>

        <div className="rail-section">
          <span className="rail-label">Workspace</span>
          <nav className="rail-nav">
            {navItems.map((item) => {
              const enabled = data.moduleAccess[item.id];
              const active = currentModule === item.id;
              return (
                <Link
                  key={item.id}
                  href={`/workspace/${workspace.tenant.slug}/${item.id}`}
                  className={`rail-nav-link ${active ? "is-active" : ""} ${!enabled ? "is-disabled" : ""}`}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-text">
                    <strong>{item.label}</strong>
                    <span>{item.note}</span>
                  </span>
                  {active && <span className="nav-indicator" style={{ background: "var(--accent)" }} />}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="rail-bottom">
          <Link href="/" className="rail-action">Product overview</Link>
          <LogoutButton />
          <p className="rail-footnote">Signed in as {operator.name}</p>
        </div>
      </aside>

      <div className="shell-main">
        <header className="command-strip">
          <form className="search-band" action={`/workspace/${workspace.tenant.slug}/${currentModule}`} method="GET">
            <span className="search-glyph">⌕</span>
            <input
              type="text"
              name="q"
              placeholder="Search data assets, obligations..."
              className="search-input"
              autoComplete="off"
            />
          </form>
          <div className="command-meta">
            <div className="tenant-chip">
              <span className="tenant-seal" style={{ background: workspace.tenant.publicBrand.accentColor }}>
                {workspace.tenant.publicBrand.logoText}
              </span>
              <div>
                <strong>{workspace.tenant.name}</strong>
                <span>{workspace.tenant.industry}</span>
              </div>
            </div>
            <div className="operator-strip">
              <strong>{operator.name}</strong>
              <span>{operator.title}</span>
            </div>
          </div>
        </header>
        <main className="workspace-stage">{children}</main>
      </div>
    </div>
  );
}
