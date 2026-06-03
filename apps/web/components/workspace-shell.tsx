import Link from "next/link";
import type { ReactNode } from "react";
import type { ModuleId, WorkspaceResponse } from "../lib/types";
import { LogoutButton } from "./logout-button";
import { Icon, Avatar } from "./pf-ui";

/* Navigation model — module rail. Icons + badges/alerts derive from the
 * workspace metrics so the rail stays live. Mirrors the Claude Design
 * handoff (Prooflyt.html) shell. */
const navItems: Array<{ id: ModuleId; label: string; icon: string }> = [
  { id: "dashboard", label: "Overview", icon: "dashboard" },
  { id: "sources", label: "Source Discovery", icon: "source" },
  { id: "register", label: "Data Register", icon: "register" },
  { id: "notices", label: "Notices", icon: "notice" },
  { id: "rights", label: "Rights & Grievances", icon: "rights" },
  { id: "retention", label: "Retention", icon: "retention" },
  { id: "incidents", label: "Breaches", icon: "breach" },
  { id: "processors", label: "Processors", icon: "processor" },
  { id: "evidence", label: "Evidence & Audit", icon: "evidence" },
  { id: "connectors", label: "Connectors", icon: "link" },
  { id: "reports", label: "Reports", icon: "reports" },
  { id: "dpdp-reference", label: "DPDP Reference", icon: "doc" },
];

const SCREEN_TITLES: Record<string, string> = {
  dashboard: "Compliance Overview", setup: "Company Setup", sources: "Source Discovery",
  register: "Data Register", notices: "Notice Builder", rights: "Rights & Grievances",
  retention: "Retention & Deletion", incidents: "Breach Register", processors: "Processors",
  evidence: "Evidence & Audit", connectors: "Connectors", reports: "Reports",
  "dpdp-reference": "DPDP Reference",
};

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
  const { metrics } = workspace;
  const title = SCREEN_TITLES[currentModule] || "Prooflyt";
  const seal = workspace.tenant.publicBrand?.logoText || workspace.tenant.name.slice(0, 3).toUpperCase();

  return (
    <div className="pf-app">
      {/* ───────── Left module rail ───────── */}
      <nav className="pf-rail" aria-label="Modules">
        <div className="pf-rail-top">
          <div className="pf-logo">
            <div className="pf-logo-mark" aria-hidden="true">
              <span className="pf-logo-p serif">P</span>
              <span className="pf-logo-seal" />
            </div>
            <span className="pf-logo-word serif">Prooflyt</span>
          </div>
        </div>

        <div className="pf-rail-tenant">
          <span className="pf-rail-tenant-name">{workspace.tenant.name}</span>
          <span className="pf-rail-tenant-sub mono">{workspace.tenant.industry} · Phase 1</span>
        </div>

        <div className="pf-rail-nav">
          <div className="pf-rail-label">Modules</div>
          {navItems.map((item) => {
            const enabled = data.moduleAccess[item.id];
            const active = currentModule === item.id;
            const badge = item.id === "rights" && metrics.openRights > 0 ? metrics.openRights : null;
            const alert = item.id === "incidents" && metrics.activeIncidents > 0;
            return (
              <Link
                key={item.id}
                href={`/workspace/${workspace.tenant.slug}/${item.id}`}
                className={`pf-navitem${active ? " is-active" : ""}${!enabled ? " is-disabled" : ""}`}
                aria-disabled={!enabled}
              >
                <Icon name={item.icon} size={17} />
                <span className="pf-navitem-label">{item.label}</span>
                {alert && <span className="pf-navitem-alert" title="Active critical" />}
                {badge != null && <span className="pf-navitem-badge">{badge}</span>}
              </Link>
            );
          })}
        </div>

        <div className="pf-rail-foot">
          <Link href="/" className="pf-navitem">
            <Icon name="settings" size={17} />
            <span className="pf-navitem-label">Product overview</span>
          </Link>
          <div className="pf-rail-me">
            <Avatar name={operator.name} size={30} />
            <div className="pf-rail-me-txt">
              <span className="pf-rail-me-name">{operator.name}</span>
              <span className="pf-rail-me-role">{operator.title}</span>
            </div>
          </div>
          <div className="pf-rail-logout">
            <LogoutButton />
          </div>
        </div>
      </nav>

      {/* ───────── Content column ───────── */}
      <div className="pf-content">
        <header className="pf-topbar">
          <div className="pf-topbar-l">
            <h1 className="pf-topbar-title serif">{title}</h1>
          </div>
          <div className="pf-topbar-r">
            <form className="pf-search-trigger" action={`/workspace/${workspace.tenant.slug}/${currentModule}`} method="GET">
              <Icon name="search" size={15} />
              <input name="q" placeholder="Search or jump to…" autoComplete="off" className="pf-search-input" />
              <kbd className="mono">⌘K</kbd>
            </form>
            <button type="button" className="pf-tenant-switch" title="Switch tenant">
              <span className="pf-tenant-switch-tile">{seal}</span>
              <Icon name="chevD" size={13} />
            </button>
            <button type="button" className="pf-iconbtn" aria-label="Notifications" title="Notifications">
              <Icon name="bell" size={16} />
              {metrics.activeIncidents > 0 && <span className="pf-iconbtn-badge">{metrics.activeIncidents}</span>}
            </button>
            <span className="pf-profile-btn" aria-label="Profile">
              <Avatar name={operator.name} size={30} />
            </span>
          </div>
        </header>
        <main className="pf-main">{children}</main>
      </div>
    </div>
  );
}
