import { notFound } from "next/navigation";
import { ModuleView, DashboardView } from "../../../../components/module-views";
import { WorkspaceShell } from "../../../../components/workspace-shell";
import { getWorkspace } from "../../../../lib/api";
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
  "reports",
];

export default async function WorkspaceModulePage({
  params,
  searchParams,
 }: {
  params: Promise<{ tenantSlug: string; moduleId: string }>;
  searchParams: Promise<{ uploaded?: string; updated?: string; error?: string }>;
}) {
  const { tenantSlug, moduleId } = await params;
  const flash = await searchParams;
  if (!validModules.includes(moduleId as ModuleId)) notFound();

  const token = await requireSession();
  const data = await getWorkspace(tenantSlug, token);

  return (
    <WorkspaceShell data={data} currentModule={moduleId as ModuleId}>
      {moduleId === "dashboard" ? (
        <DashboardView data={data} />
      ) : (
        <ModuleView data={data} moduleId={moduleId as ModuleId} flash={flash} />
      )}
    </WorkspaceShell>
  );
}
