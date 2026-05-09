import { notFound } from "next/navigation";
import { ModuleView, DashboardView } from "../../../../components/module-views";
import { WorkspaceShell } from "../../../../components/workspace-shell";
import {
  API_BASE,
  getWorkspace,
  getDpoInbox,
  getRightsSla,
  getAnomalyAlerts,
  listAuditExportKeys,
  listWebhookSubscriptions,
  listWebhookDeliveries,
  listCompliancePackFirms,
  listDpiaResults,
  analyzeNotice,
} from "../../../../lib/api";
import { requireSession } from "../../../../lib/session";
import type { ModuleId } from "../../../../lib/types";

const validModules: ModuleId[] = [
  "dashboard",
  "setup",
  "sources",
  "register",
  "notices",
  "rights",
  "retention",
  "incidents",
  "processors",
  "evidence",
  "connectors",
  "reports",
  "dpdp-reference",
];

/* Admin search-params accepted across modules. All optional; each module
 * reads only the keys it cares about. */
type AdminSearch = {
  uploaded?: string; updated?: string; error?: string;
  // Notices
  rule3?: string; ruleErr?: string;
  // Rights
  slaEscalated?: string;
  // Incidents
  anomalyScanned?: string;
  // Setup
  siemNew?: string; siemKeyId?: string; siemErr?: string; siemRevoked?: string;
  whOk?: string; whErr?: string; whDeleted?: string; whPaused?: string; whResumed?: string;
  // Reports
  dpiaOk?: string; dpiaRisk?: string; dpiaErr?: string;
};

export default async function WorkspaceModulePage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string; moduleId: string }>;
  searchParams: Promise<AdminSearch>;
}) {
  const { tenantSlug, moduleId } = await params;
  const flash = await searchParams;
  if (!validModules.includes(moduleId as ModuleId)) notFound();

  const token = await requireSession();
  const data = await getWorkspace(tenantSlug, token);

  // Fetch the admin-data slice this module needs. Each call is best-effort;
  // if any returns 4xx/5xx the panel renders an empty state instead of
  // crashing the whole module page.
  const adminData = await loadAdminDataFor(moduleId as ModuleId, tenantSlug, token, flash);

  return (
    <WorkspaceShell data={data} currentModule={moduleId as ModuleId}>
      {moduleId === "dashboard" ? (
        <DashboardView data={data} />
      ) : (
        <ModuleView
          data={data}
          moduleId={moduleId as ModuleId}
          flash={flash}
          adminData={adminData}
        />
      )}
    </WorkspaceShell>
  );
}

async function loadAdminDataFor(
  moduleId: ModuleId,
  tenantSlug: string,
  token: string,
  flash: AdminSearch,
) {
  const safe = async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    try {
      return await fn();
    } catch {
      return undefined;
    }
  };

  if (moduleId === "rights") {
    return { sla: await safe(() => getRightsSla(tenantSlug, token)) };
  }
  if (moduleId === "incidents") {
    const [dpoInbox, anomalies] = await Promise.all([
      safe(() => getDpoInbox(tenantSlug, token)),
      safe(() => getAnomalyAlerts(tenantSlug, token)),
    ]);
    return { dpoInbox, anomalies };
  }
  if (moduleId === "notices") {
    // When the operator has just clicked "Analyze against Rule 3" the
    // page reloads with ?rule3=<noticeId>. Re-run the analyzer (read-only)
    // and inject the result so the trigger button can show the output.
    if (flash.rule3) {
      const rule3 = await safe(() => analyzeNotice(tenantSlug, flash.rule3!, token));
      return { rule3 };
    }
    return {};
  }
  if (moduleId === "setup") {
    const [siemKeys, webhookSubs, webhookDeliveries] = await Promise.all([
      safe(() => listAuditExportKeys(tenantSlug, token)),
      safe(() => listWebhookSubscriptions(tenantSlug, token)),
      safe(() => listWebhookDeliveries(tenantSlug, token)),
    ]);
    return { siemKeys, webhookSubs, webhookDeliveries, apiBase: API_BASE };
  }
  if (moduleId === "reports") {
    const [firms, dpiaResults] = await Promise.all([
      safe(() => listCompliancePackFirms(token)),
      safe(() => listDpiaResults(tenantSlug, token)),
    ]);
    return {
      firms,
      dpiaResults,
      apiBase: API_BASE,
      bearerHint: token.slice(0, 24) + "…",
    };
  }
  return {};
}
