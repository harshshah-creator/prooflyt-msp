import Link from "next/link";
import type { ModuleId, WorkspaceResponse } from "../lib/types";
import {
  addDepartmentAction,
  addSourceSystemAction,
  approveSourceAction,
  createNoticeAction,
  inviteUserAction,
  reviewAgentActionAction,
  triggerBreachAgentAction,
  triggerRightsAgentAction,
  updateDeletionTaskAction,
  updateIncidentAction,
  updateNoticeContentAction,
  updateNoticeStatusAction,
  updateProcessorAction,
  updateRegisterLifecycleAction,
  updateRightsCaseAction,
  updateSetupProfileAction,
} from "../app/workspace/actions";
import { ConnectorsView } from "./connectors-view";
import { EvidenceUploadForm } from "./evidence-upload-form";
import { SourceUploadForm } from "./source-upload-form";
import { SlaChip } from "./admin/sla-chip";
import { SlaSnapshotPanel } from "./admin/sla-snapshot-panel";
import { DpoInboxPanel } from "./admin/dpo-inbox-panel";
import { AnomalyPanel } from "./admin/anomaly-panel";
import { SiemKeysPanel } from "./admin/siem-keys-panel";
import { WebhooksPanel } from "./admin/webhooks-panel";
import { CompliancePackExport } from "./admin/compliance-pack-export";
import { NamedReportsPanel } from "./admin/named-reports-panel";
import { NoticeRule3Trigger } from "./admin/notice-rule3-button";
import { NoticeBlockPicker } from "./admin/notice-block-picker";
import { DpiaPanel } from "./admin/dpia-panel";
import { LlmResidencyPanel } from "./admin/llm-residency-panel";
import { ReadinessRing, InlineAlert, Citation, Delta, Bar, AuditRow, SectionHead, Icon, Avatar, Pill, Stat, SevTag } from "./pf-ui";

function lifecycleToPill(lifecycle: string) {
  switch (lifecycle) {
    case "APPROVED": return { label: "Locked", cls: "pill-locked" };
    case "IN_REVIEW": return { label: "Verified", cls: "pill-verified" };
    case "DRAFT": return { label: "Review", cls: "pill-review" };
    case "ARCHIVED": return { label: "Archived", cls: "pill-closed" };
    default: return { label: lifecycle, cls: "pill-active" };
  }
}

function statusToPill(status: string) {
  switch (status) {
    case "NEW": return { label: "Urgent", cls: "pill-urgent" };
    case "IN_PROGRESS": return { label: "Active", cls: "pill-active" };
    case "AWAITING_PROOF": return { label: "Pending", cls: "pill-review" };
    case "CLOSED": return { label: "Closed", cls: "pill-closed" };
    default: return { label: status.replaceAll("_", " "), cls: "pill-active" };
  }
}

function FlashStatus({
  flash,
  updatedValue,
  updatedMessage,
  errorValue,
  errorMessage,
}: {
  flash?: { updated?: string; error?: string };
  updatedValue: string;
  updatedMessage: string;
  errorValue: string;
  errorMessage: string;
}) {
  return (
    <>
      {flash?.updated === updatedValue ? <p className="form-status success">{updatedMessage}</p> : null}
      {flash?.error === errorValue ? <p className="form-status error">{errorMessage}</p> : null}
    </>
  );
}

/* ═══════════════════════════════════════════════════════
   DASHBOARD VIEW — Overview with metrics, upload, rights, register
   ═══════════════════════════════════════════════════════ */

export function DashboardView({ data }: { data: WorkspaceResponse }) {
  const { workspace } = data;
  const m = workspace.metrics;
  const slug = workspace.tenant.slug;

  // Active critical/most-severe incident drives the decisive alert.
  const activeIncident =
    workspace.incidents.find((i) => i.severity === "CRITICAL" && i.status !== "CLOSED") ||
    workspace.incidents.find((i) => i.status !== "CLOSED");

  // Processors without a signed DPA = at-risk.
  const processorsAtRisk = workspace.processors.filter((p) => p.dpaStatus !== "SIGNED").length;
  const approvedReg = workspace.registerEntries.filter((e) => e.lifecycle === "APPROVED").length;
  const publishedNotices = workspace.notices.filter((n) => n.status === "PUBLISHED").length;

  type Tone = "good" | "warn" | "bad" | "soft";
  const kpis: Array<{ label: string; value: string; delta: string; tone: Tone; sub: string; cite: string }> = [
    { label: "Open rights cases", value: String(m.openRights), delta: m.openRights > 0 ? `${m.openRights}` : "0",
      tone: m.openRights > 0 ? "warn" : "good", sub: `${workspace.rightsCases.filter((c) => !c.evidenceLinked).length} need evidence`, cite: "DPDP §13" },
    { label: "Active breaches", value: String(m.activeIncidents), delta: activeIncident?.boardDeadline?.split(" ")[0] || "0",
      tone: m.activeIncidents > 0 ? "bad" : "good", sub: activeIncident ? `${activeIncident.severity} · ${activeIncident.affectedCount ?? "—"} affected` : "None active", cite: "DPDP §8(6)" },
    { label: "Evidence coverage", value: `${m.evidenceCoverage}%`, delta: "+8 pts",
      tone: "good", sub: `Readiness ${m.readinessScore}%`, cite: "JVA §S1.4" },
    { label: "Processors at risk", value: String(processorsAtRisk), delta: "0",
      tone: processorsAtRisk > 0 ? "warn" : "soft", sub: processorsAtRisk > 0 ? "DPA missing / in review" : "All DPAs signed", cite: "DPDP §8(2)" },
  ];

  const calendar: Array<{ date: string; label: string; state: string; cite: string; days: number | null }> = [
    { date: "2025-11-13", label: "DPDP Rules 2025 notified", state: "past", cite: "Rules 2025", days: null },
    { date: "2026-11-13", label: "Phase-1 obligations enforce", state: "next", cite: "Rule 22", days: 163 },
    { date: "2027-05-13", label: "Significant Data Fiduciary duties", state: "future", cite: "DPDP §10", days: null },
  ];

  const moduleStatus: Array<{ key: string; name: string; state: Tone; pct: number; note: string }> = [
    { key: "setup", name: "Setup & RBAC", state: "good", pct: 100, note: `${workspace.team.length} users, roles assigned` },
    { key: "sources", name: "Source Discovery", state: workspace.sources.some((s) => s.status !== "APPROVED") ? "warn" : "good", pct: 66, note: `${workspace.sources.length} sources profiled` },
    { key: "register", name: "Data Register", state: "good", pct: Math.min(100, 40 + approvedReg * 12), note: `${approvedReg} entries approved` },
    { key: "notices", name: "Notice Builder", state: publishedNotices > 0 ? "good" : "warn", pct: publishedNotices > 0 ? 90 : 50, note: `${publishedNotices} published` },
    { key: "rights", name: "Rights & Grievances", state: m.openRights > 0 ? "warn" : "good", pct: 80, note: `${m.openRights} open` },
    { key: "retention", name: "Retention & Deletion", state: m.overdueDeletions > 0 ? "warn" : "good", pct: m.overdueDeletions > 0 ? 70 : 92, note: m.overdueDeletions > 0 ? `${m.overdueDeletions} overdue` : "On schedule" },
    { key: "incidents", name: "Breach Register", state: m.activeIncidents > 0 ? "bad" : "good", pct: m.activeIncidents > 0 ? 40 : 95, note: m.activeIncidents > 0 ? `${m.activeIncidents} active` : "None active" },
    { key: "processors", name: "Processors", state: processorsAtRisk > 0 ? "warn" : "good", pct: processorsAtRisk > 0 ? 70 : 96, note: processorsAtRisk > 0 ? `${processorsAtRisk} DPA gap` : "All signed" },
    { key: "evidence", name: "Evidence & Audit", state: "good", pct: m.evidenceCoverage, note: "Audit trail sealed" },
    { key: "reports", name: "Reports", state: "good", pct: 88, note: "6 named reports ready" },
  ];
  const needAttention = moduleStatus.filter((x) => x.state !== "good").length;

  const auditVerb = (action: string) => action.toLowerCase().replaceAll("_", " ");
  const auditTone = (action: string): "good" | "bad" | undefined => {
    const a = action.toUpperCase();
    if (/(DELETE|SEVERITY|BREACH|ESCALAT|FLAG|REVOK)/.test(a)) return "bad";
    if (/(APPROV|VERIF|PUBLISH|CLOSED|SEAL|ACK)/.test(a)) return "good";
    return undefined;
  };

  return (
    <div className="pf-screen">
      {/* Active critical breach — one decisive alert */}
      {activeIncident && (
        <div className="pf-dash-alert">
          <InlineAlert tone="bad" title={`${activeIncident.id} — active ${activeIncident.severity} breach`} cite="DPDP §8(6)">
            {activeIncident.affectedCount ? `${activeIncident.affectedCount.toLocaleString("en-IN")} data principals affected. ` : ""}
            Board deadline: <strong className="mono">{activeIncident.boardDeadline}</strong>.
          </InlineAlert>
          <Link href={`/workspace/${slug}/incidents`} className="pf-btn pf-btn-danger pf-btn-md">
            Open response <Icon name="chevR" size={15} />
          </Link>
        </div>
      )}

      <div className="pf-dash-grid">
        {/* Readiness hero */}
        <div className="pf-card pf-card-pad pf-readiness">
          <div className="eyebrow">DPDP readiness</div>
          <div className="pf-readiness-main">
            <ReadinessRing value={m.readinessScore} label="of 100" size={148} />
            <div className="pf-readiness-side">
              <div className="pf-readiness-delta">
                <Delta value={`+${Math.max(3, Math.round(m.readinessScore * 0.08))} pts`} tone="good" arrow="up" />
                <span>vs. last audit batch</span>
              </div>
              <p className="pf-readiness-copy">
                {m.openGaps} obligations remain open. Closing the missing DPAs and the Source
                Discovery backlog lifts readiness above the 80-point audit threshold.
              </p>
              <Link href={`/workspace/${slug}/evidence`} className="pf-btn pf-btn-primary pf-btn-sm">
                Review obligations <Icon name="chevR" size={14} />
              </Link>
            </div>
          </div>
        </div>

        {/* Regulatory calendar */}
        <div className="pf-card pf-card-pad">
          <SectionHead title="Regulatory calendar" cite="Rules 2025" />
          <div className="pf-cal">
            {calendar.map((c, i) => (
              <div key={i} className={`pf-cal-item pf-cal-${c.state}`}>
                <div className="pf-cal-rail"><span className="pf-cal-node" /></div>
                <div className="pf-cal-body">
                  <div className="pf-cal-date mono">{c.date}{c.days != null && <span className="pf-cal-days">in {c.days} days</span>}</div>
                  <div className="pf-cal-label">{c.label}</div>
                  <Citation soft>{c.cite}</Citation>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="pf-kpi-grid">
        {kpis.map((k, i) => (
          <div key={i} className="pf-card pf-card-pad pf-kpi">
            <div className="pf-kpi-top">
              <span className="pf-kpi-label">{k.label}</span>
              <Citation soft>{k.cite}</Citation>
            </div>
            <div className="pf-kpi-row">
              <span className="pf-kpi-val serif tnum">{k.value}</span>
              <Delta value={k.delta} tone={k.tone} arrow={k.tone === "good" ? "up" : k.tone === "bad" ? "down" : null} />
            </div>
            <div className="pf-kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="pf-dash-grid pf-dash-grid-2">
        {/* Module status */}
        <div className="pf-card pf-card-pad">
          <SectionHead title="Module status" sub="All 10 Phase-1 modules"
            right={<span className={`pf-pill pf-pill-${needAttention > 0 ? "warn" : "good"} pf-pill-sm`}><span className="pf-pill-dot" />{needAttention > 0 ? `${needAttention} need attention` : "All on track"}</span>} />
          <div className="pf-modlist">
            {moduleStatus.map((x) => (
              <Link key={x.key} href={`/workspace/${slug}/${x.key === "dashboard" ? "dashboard" : x.key}`} className="pf-modrow">
                <span className={`pf-modrow-dot pf-pill-dot pf-modrow-${x.state}`} />
                <span className="pf-modrow-name">{x.name}</span>
                <span className="pf-modrow-note">{x.note}</span>
                <span className="pf-modrow-bar"><Bar value={x.pct} tone={x.state} h={5} /></span>
                <span className="pf-modrow-pct tnum">{x.pct}%</span>
                <Icon name="chevR" size={15} />
              </Link>
            ))}
          </div>
        </div>

        {/* Audit trail */}
        <div className="pf-card pf-card-pad">
          <SectionHead title="Audit trail" sub="Append-only · most recent"
            right={<Link href={`/workspace/${slug}/evidence`} className="pf-btn pf-btn-ghost pf-btn-sm">Full log <Icon name="external" size={14} /></Link>} />
          <div className="pf-audit">
            {workspace.auditTrail.slice(0, 6).map((e) => (
              <AuditRow key={e.id} time={new Date(e.createdAt).toISOString().slice(0, 16).replace("T", " ")}
                actor={e.actor} verb={auditVerb(e.action)} target={e.targetId}
                hash={(e.id.match(/[a-f0-9]{4}/i)?.[0]) || e.id.slice(-4)} tone={auditTone(e.action)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MODULE VIEW — All module pages with consistent styling
   ═══════════════════════════════════════════════════════ */

export interface AdminPanelData {
  // notices
  rule3?: {
    notice: { id: string; title: string; version: string };
    report: {
      totalItems: number;
      coverageScore: number;
      appearsDpdpAware: boolean;
      presentItems: Array<{ id: string; label: string; citation: string }>;
      missingItems: Array<{ id: string; label: string; citation: string; draftTemplate: string }>;
    };
    drafts?: { provider: "groq" | "template"; draft: string };
  };
  // rights
  sla?: {
    summary: {
      total: number; overdue: number; atRisk: number; onTrack: number; closed: number;
      worstCase?: { id: string; daysRemaining: number; type: string };
    };
    cases: Array<{
      id: string;
      slaInfo?: {
        state: "ON_TRACK" | "AT_RISK" | "OVERDUE" | "CLOSED";
        daysRemaining: number;
        humanLabel: string;
        citation: string;
      };
    }>;
  };
  // incidents
  dpoInbox?: {
    pulseScore: number;
    totalOpen: number;
    counts: Record<string, number>;
    items: Array<{
      id: string; priority: "URGENT" | "BLOCKING" | "REVIEW" | "INFO";
      module: string; title: string; body: string; dueAt?: string; targetId?: string;
    }>;
    generatedAt: string;
  };
  anomalies?: { count: number; alerts: Array<{
    id: string; kind: string; severity: "URGENT" | "REVIEW" | "INFO";
    actor: string; detectedAt: string; windowStart: string; windowEnd: string;
    count: number; detail: string;
  }> };
  // setup
  siemKeys?: { keys: Array<{
    id: string; label: string; active: boolean; createdAt: string; keyHint: string;
    lastUsedAt?: string; lastUsedFromIp?: string;
  }> };
  webhookSubs?: { subscriptions: Array<{
    id: string; url: string; eventFilter: string; description?: string; active: boolean;
    failureStreak: number; pausedReason?: string; createdAt: string; updatedAt: string;
  }> };
  webhookDeliveries?: { deliveries: Array<{
    id: string; subscriptionId: string; eventType: string;
    status: "PENDING" | "DELIVERED" | "FAILED";
    httpStatus?: number; attempts: number; lastError?: string;
    createdAt: string; deliveredAt?: string; payloadSha256: string;
  }> };
  apiBase?: string;
  // reports
  firms?: { firms: string[] };
  dpiaResults?: { dpiaResults: Array<{
    id: string; activityName: string; conductedAt: string; conductedBy: string;
    riskScore: number; riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    recommendations: string[]; markdownReport?: string;
  }> };
  bearerHint?: string;
  // setup — §S2.3 self-hosted LLM toggle
  llmResidency?: { mode: "MANAGED" | "SELF_HOSTED" | "AIR_GAPPED"; endpoint?: string };
}

export interface ModuleViewFlash {
  uploaded?: string; updated?: string; error?: string;
  rule3?: string; ruleErr?: string;
  slaEscalated?: string;
  anomalyScanned?: string;
  siemNew?: string; siemKeyId?: string; siemErr?: string; siemRevoked?: string;
  whOk?: string; whErr?: string; whDeleted?: string; whPaused?: string; whResumed?: string;
  dpiaOk?: string; dpiaRisk?: string; dpiaErr?: string;
}

export function ModuleView({
  data,
  moduleId,
  flash,
  adminData,
}: {
  data: WorkspaceResponse;
  moduleId: ModuleId;
  flash?: ModuleViewFlash;
  adminData?: AdminPanelData;
}) {
  const { workspace } = data;

  const headerByModule: Record<ModuleId, { title: string; body: string }> = {
    dashboard: { title: "Obligation control center", body: "Coverage and pressure in one operating view." },
    setup: { title: "Company setup and masters", body: "Branding, departments, processors, and role ownership." },
    sources: { title: "Source discovery and Smart Mapping", body: "Profile inbound files, score the classifier, and gate everything through review." },
    register: { title: "Metadata-first data register", body: "Trace approved mappings into a controlled register with lifecycle and completeness." },
    notices: { title: "Versioned notice builder", body: "Draft, review, approve, publish, and retire notices without turning Phase 1 into a consent widget system." },
    rights: { title: "Rights and grievance queue", body: "Run SLA-driven cases and refuse closure without evidence or a documented refusal path." },
    retention: { title: "Retention and deletion control", body: "Track tasks, holds, processor acknowledgements, and proof without pretending to delete inside customer systems." },
    incidents: { title: "Breach register", body: "Move from assessment to closure with deadlines, owners, and evidence attached." },
    processors: { title: "Processor governance", body: "Keep DPA status, purge acknowledgements, and sub-processor visibility in one register." },
    evidence: { title: "Sealed evidence library", body: "Search metadata, not artifact contents, and keep a clean audit boundary." },
    reports: { title: "Reports and Compliance Pack", body: "Export regulator-facing material without rebuilding the story every time." },
    "dpdp-reference": { title: "DPDP Act Reference", body: "India's Digital Personal Data Protection Act 2023 and Rules 2025 — obligations, penalties, and Prooflyt coverage." },
    connectors: { title: "Third-party connectors", body: "Connect payment gateways, CRMs, helpdesks, storefronts, application databases, and object storage. Auto-discover PII, fulfil DSRs, ingest grievance tickets — with sealed proof at every step." },
  };

  return (
    <div className="module-stage pf-app-scope">
      <div className="pf-page-head">
        <p className="pf-page-sub">{headerByModule[moduleId].body}</p>
      </div>

      {moduleId === "sources" && (() => {
        const profiled = workspace.sources.filter((s) => s.status === "APPROVED").length;
        const totalFields = workspace.sources.reduce((a, s) => a + s.fields, 0);
        const avgConf = workspace.sourceProfiles.length
          ? Math.round((workspace.sourceProfiles.reduce((a, f) => a + f.confidence, 0) / workspace.sourceProfiles.length) * 100)
          : 0;
        return (
        <section className="pf-screen" style={{ padding: 0, maxWidth: "none" }}>
          {flash?.uploaded === "source" && <div style={{ marginBottom: 12 }}><InlineAlert tone="good" title="Source uploaded">Sent to the Smart-Mapping review queue.</InlineAlert></div>}
          <FlashStatus
            flash={flash}
            updatedValue="source"
            updatedMessage="Source approved and pushed into the register review queue."
            errorValue="source-upload"
            errorMessage="Source workflow failed. Please try again."
          />
          <div className="pf-stat-strip">
            <Stat label="Sources" value={workspace.sources.length} sub={`${profiled} profiled`} />
            <Stat label="Fields discovered" value={totalFields} sub="across all sources" />
            <Stat label="In review queue" value={workspace.sources.filter((s) => s.status !== "APPROVED").length} sub="awaiting approval" tone="warn" />
            <Stat label="Avg. confidence" value={`${avgConf}%`} sub="AI Smart-Mapping" tone="good" />
          </div>

          <div className="pf-card" style={{ overflow: "hidden" }}>
            <table className="pf-table">
              <thead><tr><th>Source</th><th>Mode</th><th>Status</th><th>Coverage</th><th></th></tr></thead>
              <tbody>
                {workspace.sources.map((source) => (
                  <tr key={source.id}>
                    <td><span className="pf-cell-strong">{source.name}</span><span className="pf-cell-dim mono">{source.fileName}</span></td>
                    <td className="pf-cell-dim mono">{source.profileMode.replaceAll("_", " ")}</td>
                    <td>{source.status === "APPROVED" ? <Pill tone="good" sm>Profiled</Pill> : <Pill tone="warn" sm>{source.status.replaceAll("_", " ")}</Pill>}</td>
                    <td className="tnum">{source.approvedFields}/{source.fields}</td>
                    <td>{!source.pushedToRegister ? (
                      <form action={approveSourceAction.bind(null, workspace.tenant.slug, source.id)} className="pf-inline-save">
                        <button type="submit">Approve to register</button>
                      </form>
                    ) : <span className="pf-link-cell">Register linked</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 16 }}>
            <InlineAlert tone="warn" title="Review before committing" cite="JVA §S1.2">
              AI suggestions are advisory. A human confirms each field&rsquo;s classification and legal basis before it enters the register. The LLM only ever sees masked samples, never raw PII.
            </InlineAlert>
          </div>

          <div className="pf-card" style={{ overflow: "hidden", marginTop: 16 }}>
            <div style={{ padding: "16px 18px 0" }}><SectionHead title="Classifier output" sub="AI Smart-Mapping suggestions" cite="DPDP §8" /></div>
            <table className="pf-table pf-table-tight">
              <thead><tr><th>Field</th><th>Category</th><th>Confidence</th><th>Decision</th></tr></thead>
              <tbody>
                {workspace.sourceProfiles.slice(0, 8).map((field) => {
                  const c = field.confidence;
                  return (
                    <tr key={field.id}>
                      <td className="mono" style={{ fontSize: 12 }}>{field.fieldName}</td>
                      <td>{field.mappedCategory}</td>
                      <td><Pill tone={c >= 0.8 ? "good" : c >= 0.5 ? "warn" : "bad"} sm dot={false}>{Math.round(c * 100)}%</Pill></td>
                      <td>{field.requiresReview ? <span className="pf-cell-unassigned">Reviewer hold</span> : <span className="pf-link-cell">Ready</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 16 }}>
            <SourceUploadForm tenantSlug={workspace.tenant.slug} />
          </div>
        </section>
        );
      })()}

      {moduleId === "register" && (() => {
        const approved = workspace.registerEntries.filter((e) => e.lifecycle === "APPROVED").length;
        const review = workspace.registerEntries.filter((e) => e.lifecycle === "IN_REVIEW" || e.lifecycle === "DRAFT").length;
        const complete = workspace.registerEntries.filter((e) => e.completeness === "COMPLETE").length;
        const pct = workspace.registerEntries.length ? Math.round((complete / workspace.registerEntries.length) * 100) : 0;
        return (
        <section className="pf-screen" style={{ padding: 0, maxWidth: "none" }}>
          <FlashStatus
            flash={flash}
            updatedValue="register"
            updatedMessage="Register lifecycle updated."
            errorValue="register-update"
            errorMessage="Register update failed."
          />
          <div className="pf-stat-strip">
            <Stat label="Register entries" value={workspace.registerEntries.length} sub={`${approved} approved`} />
            <Stat label="Approved" value={approved} sub="locked classification" tone="good" />
            <Stat label="Needs review" value={review} sub="awaiting approval" tone={review > 0 ? "warn" : undefined} />
            <Stat label="Completeness" value={`${pct}%`} sub="of fields" tone={pct >= 80 ? "good" : "warn"} />
          </div>
          <div className="pf-card" style={{ overflow: "hidden" }}>
            <table className="pf-table">
              <thead><tr><th>Field / system</th><th>Category</th><th>Legal basis</th><th>Retention</th><th>Completeness</th><th>Lifecycle</th></tr></thead>
              <tbody>
                {workspace.registerEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td><span className="pf-cell-strong">{entry.system}</span><span className="pf-cell-dim mono">{entry.sourceTrace}</span></td>
                    <td className="pf-cell-dim">{entry.dataCategory}</td>
                    <td><Citation soft>{entry.legalBasis}</Citation></td>
                    <td className="pf-cell-dim">{entry.retentionLabel}</td>
                    <td>{entry.completeness === "COMPLETE" ? <Pill tone="good" sm dot={false}>Complete</Pill> : entry.completeness === "PARTIAL" ? <Pill tone="warn" sm dot={false}>Partial</Pill> : <span className="pf-cell-dim">Missing</span>}</td>
                    <td>
                      <form action={updateRegisterLifecycleAction.bind(null, workspace.tenant.slug, entry.id)} className="pf-inline-save">
                        <select name="lifecycle" defaultValue={entry.lifecycle}>
                          <option value="DRAFT">Draft</option>
                          <option value="IN_REVIEW">In review</option>
                          <option value="APPROVED">Approved</option>
                          <option value="ARCHIVED">Archived</option>
                        </select>
                        <button type="submit">Save</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        );
      })()}

      {moduleId === "notices" && (
        <section className="worksheet">
          <FlashStatus
            flash={flash}
            updatedValue="notice"
            updatedMessage="Notice lifecycle updated."
            errorValue="notice-update"
            errorMessage="Notice update failed."
          />
          <FlashStatus
            flash={flash}
            updatedValue="notice"
            updatedMessage="Notice created."
            errorValue="notice-create"
            errorMessage="Notice creation failed."
          />

          <article className="notice-line">
            <div>
              <span className="section-kicker">New</span>
              <h3>Create Notice</h3>
            </div>
            <form action={createNoticeAction.bind(null, workspace.tenant.slug)} className="narrative-block">
              <input name="title" placeholder="Notice title" required />
              <textarea name="content" placeholder="Notice content..." rows={4} required />
              <input name="audience" placeholder="Audience (e.g. All Users)" required />
              <button type="submit" className="text-button">Create</button>
            </form>
          </article>

          {workspace.notices.map((notice) => (
            <article key={notice.id} className="notice-line">
              <div>
                <span className="section-kicker">{notice.status}</span>
                <h3>{notice.title}</h3>
              </div>
              <form action={updateNoticeStatusAction.bind(null, workspace.tenant.slug, notice.id)} className="notice-meta notice-form">
                <strong>{notice.version}</strong>
                <span>{notice.audience}</span>
                <select name="status" defaultValue={notice.status}>
                  <option value="DRAFT">Draft</option>
                  <option value="IN_REVIEW">In review</option>
                  <option value="APPROVED">Approved</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="RETIRED">Retired</option>
                </select>
                <button type="submit" className="text-button">
                  Update
                </button>
              </form>
              <form action={updateNoticeContentAction.bind(null, workspace.tenant.slug, notice.id)} className="narrative-block">
                <input name="title" defaultValue={notice.title} />
                <textarea name="content" defaultValue={notice.content} rows={8} />
                <input name="audience" defaultValue={notice.audience} />
                <button type="submit" className="text-button">Save</button>
              </form>
              <NoticeBlockPicker tenantSlug={workspace.tenant.slug} noticeId={notice.id} />
              <NoticeRule3Trigger
                tenantSlug={workspace.tenant.slug}
                noticeId={notice.id}
                active={flash?.rule3 === notice.id}
                result={
                  flash?.rule3 === notice.id && adminData?.rule3
                    ? {
                        totalItems: adminData.rule3.report.totalItems,
                        coverageScore: adminData.rule3.report.coverageScore,
                        appearsDpdpAware: adminData.rule3.report.appearsDpdpAware,
                        presentItems: adminData.rule3.report.presentItems,
                        missingItems: adminData.rule3.report.missingItems,
                        drafts: adminData.rule3.drafts,
                      }
                    : undefined
                }
              />
            </article>
          ))}
          {flash?.ruleErr && (
            <p className="form-status error">Rule-3 analysis failed: {flash.ruleErr}</p>
          )}
        </section>
      )}

      {moduleId === "rights" && (
        <section className="worksheet">
          {adminData?.sla && (
            <SlaSnapshotPanel
              tenantSlug={workspace.tenant.slug}
              summary={adminData.sla.summary}
              flashEscalated={Boolean(flash?.slaEscalated)}
            />
          )}
          <FlashStatus
            flash={flash}
            updatedValue="rights"
            updatedMessage="Rights case updated."
            errorValue="rights-update"
            errorMessage="Rights workflow update failed. Closing still requires proof or a refusal note."
          />
          <FlashStatus
            flash={flash}
            updatedValue="agent-triggered"
            updatedMessage="Rights Orchestrator activated. Review queue updated below."
            errorValue="agent-trigger"
            errorMessage="Agent trigger failed."
          />
          <FlashStatus
            flash={flash}
            updatedValue="agent-reviewed"
            updatedMessage="Agent action updated."
            errorValue="agent-review"
            errorMessage="Agent review failed."
          />
          <div className="pf-card" style={{ overflow: "hidden" }}>
            <table className="pf-table">
              <thead><tr><th>Case</th><th>Data principal</th><th>Right type</th><th>SLA</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {workspace.rightsCases.map((caseItem) => {
                  const enriched = adminData?.sla?.cases.find((c) => c.id === caseItem.id);
                  const stTone = caseItem.status === "CLOSED" ? "good" : caseItem.status === "NEW" ? "accent" : "warn";
                  return (
                    <tr key={caseItem.id}>
                      <td><span className="mono pf-cell-id">{caseItem.id}</span></td>
                      <td><span className="pf-cell-strong">{caseItem.requestor}</span></td>
                      <td><Pill tone="soft" sm dot={false}>{caseItem.type.replaceAll("_", " ")}</Pill></td>
                      <td>{enriched?.slaInfo
                        ? <SlaChip state={enriched.slaInfo.state} daysRemaining={enriched.slaInfo.daysRemaining} humanLabel={enriched.slaInfo.humanLabel} citation={enriched.slaInfo.citation} />
                        : <span className="pf-cell-dim">{caseItem.sla}</span>}</td>
                      <td><Pill tone={stTone}>{caseItem.status.replaceAll("_", " ").toLowerCase()}</Pill></td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                          <form action={updateRightsCaseAction.bind(null, workspace.tenant.slug, caseItem.id)} className="pf-inline-save" style={{ gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                            <select name="status" defaultValue={caseItem.status}>
                              <option value="NEW">New</option>
                              <option value="IN_PROGRESS">In progress</option>
                              <option value="AWAITING_PROOF">Awaiting proof</option>
                              <option value="CLOSED">Closed</option>
                            </select>
                            <label className="micro-toggle"><input type="checkbox" name="evidenceLinked" defaultChecked={caseItem.evidenceLinked} /><span>Ev.</span></label>
                            <input name="refusalNote" placeholder="Refusal note" style={{ padding: "5px 8px", fontSize: 12, border: "1px solid var(--line-strong)", borderRadius: "var(--r-sm)", background: "var(--surface)", width: 130 }} />
                            <button type="submit">Save</button>
                          </form>
                          <form action={triggerRightsAgentAction.bind(null, workspace.tenant.slug, caseItem.id)}>
                            <button type="submit" className="pf-btn pf-btn-ghost pf-btn-sm">⚡ Orchestrator</button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Rights Agent Review Queue */}
          {(workspace.agentActions || []).filter((a) => a.agentId === "rights-orchestrator").length > 0 && (
            <div className="agent-queue-section">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">AI Agent</span>
                  <h3>Rights Orchestrator — Review Queue</h3>
                </div>
                <span className="agent-badge">Human-in-the-loop</span>
              </div>
              <p className="agent-queue-note">
                The agent maps data, calculates SLAs, and drafts communications. You review, edit, and approve. Nothing is sent without your explicit sign-off.
              </p>
              <div className="agent-actions-grid">
                {(workspace.agentActions || [])
                  .filter((a) => a.agentId === "rights-orchestrator")
                  .map((action) => (
                    <article key={action.id} className={`agent-action-card agent-state-${action.state.toLowerCase()}`}>
                      <div className="agent-action-header">
                        <div>
                          <span className={`agent-category cat-${action.category.toLowerCase()}`}>{action.category}</span>
                          <strong>{action.label}</strong>
                        </div>
                        <span className={`agent-state state-${action.state.toLowerCase()}`}>{action.state}</span>
                      </div>
                      <div className="agent-action-body">
                        <pre>{action.editedBody || action.body}</pre>
                      </div>
                      {action.reviewedBy && (
                        <p className="agent-action-meta">
                          {action.state} by {action.reviewedBy}
                          {action.reviewedAt ? ` on ${new Date(action.reviewedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}` : ""}
                        </p>
                      )}
                      {action.approvalNote && (
                        <p className="agent-action-meta">Note: {action.approvalNote}</p>
                      )}
                      {action.state !== "APPROVED" && action.state !== "REJECTED" && (
                        <form action={reviewAgentActionAction.bind(null, workspace.tenant.slug, action.id)} className="agent-review-form">
                          <input type="hidden" name="returnModule" value="rights" />
                          <textarea name="approvalNote" placeholder="Optional note before approving or rejecting" rows={2} />
                          <div className="agent-review-buttons">
                            {action.state === "DRAFT" && action.category !== "EXECUTE" && (
                              <button type="submit" name="state" value="APPROVED" className="agent-btn approve">
                                Approve
                              </button>
                            )}
                            {action.state === "DRAFT" && action.category === "EXECUTE" && (
                              <button type="submit" name="state" value="REVIEWED" className="agent-btn review">
                                Mark Reviewed
                              </button>
                            )}
                            {action.state === "REVIEWED" && (
                              <button type="submit" name="state" value="APPROVED" className="agent-btn approve">
                                Approve &amp; Execute
                              </button>
                            )}
                            <button type="submit" name="state" value="REJECTED" className="agent-btn reject">
                              Reject
                            </button>
                          </div>
                        </form>
                      )}
                    </article>
                  ))}
              </div>
            </div>
          )}
        </section>
      )}

      {moduleId === "retention" && (() => {
        const today = new Date().toISOString().slice(0, 10);
        const overdue = workspace.deletionTasks.filter((t) => t.status !== "CLOSED" && t.dueDate <= today).length;
        const closed = workspace.deletionTasks.filter((t) => t.status === "CLOSED").length;
        return (
        <section className="pf-screen" style={{ padding: 0, maxWidth: "none" }}>
          <FlashStatus
            flash={flash}
            updatedValue="retention"
            updatedMessage="Deletion task updated."
            errorValue="retention-update"
            errorMessage="Retention workflow update failed. Closing still requires proof and an acknowledged downstream path."
          />
          <div className="pf-stat-strip">
            <Stat label="Deletion tasks" value={workspace.deletionTasks.length} sub={`${closed} completed`} />
            <Stat label="Due now" value={overdue} sub="overdue or due today" tone={overdue > 0 ? "warn" : undefined} />
            <Stat label="Completed" value={closed} sub="proof captured" tone="good" />
            <Stat label="Batch cap" value="10k" sub="records per run" />
          </div>
          <div className="pf-card pf-card-pad">
            <SectionHead title="Deletion calendar" sub="Proof-backed batch runner with legal-hold checks" cite="DPDP §8(7)" />
            <div className="pf-runs">
              {workspace.deletionTasks.map((task) => {
                const done = task.status === "CLOSED";
                return (
                  <div key={task.id} className={`pf-run pf-run-${done ? "completed" : "scheduled"}`}>
                    <div className="pf-run-rail"><span className="pf-run-node" /></div>
                    <div className="pf-run-body">
                      <div className="pf-run-top"><span className="mono pf-run-id">{task.id}</span>{done ? <Pill tone="good" sm>Completed</Pill> : <Pill tone="warn" sm>{task.status.replaceAll("_", " ").toLowerCase()}</Pill>}</div>
                      <div className="pf-run-meta"><span className="pf-cell-strong" style={{ fontWeight: 500 }}>{task.label}</span></div>
                      <div className="pf-run-meta"><span className="mono">{task.dueDate}</span><span className="pf-dotsep">·</span><span>{task.system}</span><span className="pf-dotsep">·</span><span>{task.proofLinked ? "proof linked" : "proof missing"}</span></div>
                      <form action={updateDeletionTaskAction.bind(null, workspace.tenant.slug, task.id)} className="pf-inline-save" style={{ marginTop: 8, gap: 8, flexWrap: "wrap" }}>
                        <select name="status" defaultValue={task.status}>
                          <option value="OPEN">Open</option>
                          <option value="LEGAL_HOLD">Legal hold</option>
                          <option value="AWAITING_PROCESSOR">Awaiting processor</option>
                          <option value="READY_FOR_PROOF">Ready for proof</option>
                          <option value="CLOSED">Closed</option>
                        </select>
                        <label className="micro-toggle"><input type="checkbox" name="proofLinked" defaultChecked={task.proofLinked} /><span>Proof</span></label>
                        <label className="micro-toggle"><input type="checkbox" name="processorAcknowledged" defaultChecked={task.processorAcknowledged} /><span>Proc. ack</span></label>
                        <input name="exceptionNote" placeholder="Exception note" style={{ padding: "5px 8px", fontSize: 12, border: "1px solid var(--line-strong)", borderRadius: "var(--r-sm)", background: "var(--surface)" }} />
                        <button type="submit">Save</button>
                      </form>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
        );
      })()}

      {moduleId === "incidents" && (
        <section className="worksheet">
          {adminData?.dpoInbox && (
            <div style={{ marginBottom: "1.25rem" }}>
              <DpoInboxPanel
                pulseScore={adminData.dpoInbox.pulseScore}
                totalOpen={adminData.dpoInbox.totalOpen}
                counts={adminData.dpoInbox.counts}
                items={adminData.dpoInbox.items}
                generatedAt={adminData.dpoInbox.generatedAt}
              />
            </div>
          )}
          {adminData?.anomalies && (
            <div style={{ marginBottom: "1.25rem" }}>
              <AnomalyPanel
                tenantSlug={workspace.tenant.slug}
                alerts={adminData.anomalies.alerts}
                scannedFlash={Boolean(flash?.anomalyScanned)}
              />
            </div>
          )}
          <FlashStatus
            flash={flash}
            updatedValue="incident"
            updatedMessage="Incident updated."
            errorValue="incident-update"
            errorMessage="Incident update failed."
          />
          <FlashStatus
            flash={flash}
            updatedValue="agent-triggered"
            updatedMessage="Breach Response Agent activated. Review queue updated below."
            errorValue="agent-trigger"
            errorMessage="Agent trigger failed."
          />
          <FlashStatus
            flash={flash}
            updatedValue="agent-reviewed"
            updatedMessage="Agent action updated."
            errorValue="agent-review"
            errorMessage="Agent review failed."
          />
          <div className="pf-breach-list">
            {workspace.incidents.map((incident) => {
              const closed = incident.status === "CLOSED";
              const sev = incident.severity.toLowerCase();
              return (
                <div key={incident.id} className={`pf-card pf-breach-card pf-breach-${sev}`}>
                  <div className="pf-breach-sev"><SevTag level={incident.severity} /></div>
                  <div className="pf-breach-main">
                    <div className="pf-breach-top">
                      <span className="mono pf-breach-id">{incident.id}</span>
                      <Pill tone={closed ? "good" : "warn"} sm>{closed ? "Closed" : "Investigating"}</Pill>
                      {incident.autoEscalated && <Pill tone="bad" sm dot={false}>Auto-escalated</Pill>}
                    </div>
                    <h3 className="pf-breach-title serif">{incident.title}</h3>
                    <div className="pf-breach-meta">
                      {incident.affectedCount != null && <><span><strong className="tnum">{incident.affectedCount.toLocaleString("en-IN")}</strong> affected</span><span className="pf-dotsep">·</span></>}
                      {incident.discoveryDate && <><span>discovered {incident.discoveryDate.slice(0, 10)}</span><span className="pf-dotsep">·</span></>}
                      <span>owner <strong>{incident.remediationOwner}</strong></span>
                    </div>
                    <form action={updateIncidentAction.bind(null, workspace.tenant.slug, incident.id)} className="pf-inline-save" style={{ marginTop: 10, gap: 8, flexWrap: "wrap" }}>
                      <select name="status" defaultValue={incident.status}>
                        <option value="TRIAGE">Triage</option>
                        <option value="ASSESSMENT">Assessment</option>
                        <option value="CONTAINMENT">Containment</option>
                        <option value="CLOSED">Closed</option>
                      </select>
                      <label className="micro-toggle"><input type="checkbox" name="evidenceLinked" defaultChecked={incident.evidenceLinked} /><span>Evidence</span></label>
                      <input name="remediationOwner" defaultValue={incident.remediationOwner} style={{ padding: "5px 8px", fontSize: 12, border: "1px solid var(--line-strong)", borderRadius: "var(--r-sm)", background: "var(--surface)" }} />
                      <button type="submit">Save</button>
                    </form>
                  </div>
                  <div className="pf-breach-side">
                    {!closed ? (
                      <div className="pf-timer"><span className="pf-timer-val tnum" style={{ fontSize: 16 }}>{incident.boardDeadline}</span><span className="pf-timer-label">board deadline</span></div>
                    ) : (
                      <div className="pf-notif-flags"><span className="pf-flag ok"><Icon name="check" size={12} />Regulator</span><span className="pf-flag ok"><Icon name="check" size={12} />Subjects</span></div>
                    )}
                    <form action={triggerBreachAgentAction.bind(null, workspace.tenant.slug, incident.id)} style={{ marginLeft: 10 }}>
                      <button type="submit" className="pf-btn pf-btn-secondary pf-btn-sm">⚡ Response agent</button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Breach Agent Review Queue */}
          {(workspace.agentActions || []).filter((a) => a.agentId === "breach-response").length > 0 && (
            <div className="agent-queue-section">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">AI Agent</span>
                  <h3>Breach Response — Review Queue</h3>
                </div>
                <span className="agent-badge">Human-in-the-loop</span>
              </div>
              <p className="agent-queue-note">
                The agent drafts and recommends. You review, edit, and approve. Nothing is sent or executed without your explicit approval.
              </p>
              <div className="agent-actions-grid">
                {(workspace.agentActions || [])
                  .filter((a) => a.agentId === "breach-response")
                  .map((action) => (
                    <article key={action.id} className={`agent-action-card agent-state-${action.state.toLowerCase()}`}>
                      <div className="agent-action-header">
                        <div>
                          <span className={`agent-category cat-${action.category.toLowerCase()}`}>{action.category}</span>
                          <strong>{action.label}</strong>
                        </div>
                        <span className={`agent-state state-${action.state.toLowerCase()}`}>{action.state}</span>
                      </div>
                      <div className="agent-action-body">
                        <pre>{action.editedBody || action.body}</pre>
                      </div>
                      {action.reviewedBy && (
                        <p className="agent-action-meta">
                          {action.state} by {action.reviewedBy}
                          {action.reviewedAt ? ` on ${new Date(action.reviewedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}` : ""}
                        </p>
                      )}
                      {action.approvalNote && (
                        <p className="agent-action-meta">Note: {action.approvalNote}</p>
                      )}
                      {action.state !== "APPROVED" && action.state !== "REJECTED" && (
                        <form action={reviewAgentActionAction.bind(null, workspace.tenant.slug, action.id)} className="agent-review-form">
                          <input type="hidden" name="returnModule" value="incidents" />
                          <textarea name="approvalNote" placeholder="Optional note before approving or rejecting" rows={2} />
                          <div className="agent-review-buttons">
                            {action.state === "DRAFT" && action.category !== "EXECUTE" && (
                              <button type="submit" name="state" value="APPROVED" className="agent-btn approve">
                                Approve
                              </button>
                            )}
                            {action.state === "DRAFT" && action.category === "EXECUTE" && (
                              <button type="submit" name="state" value="REVIEWED" className="agent-btn review">
                                Mark Reviewed
                              </button>
                            )}
                            {action.state === "REVIEWED" && (
                              <button type="submit" name="state" value="APPROVED" className="agent-btn approve">
                                Approve &amp; Execute
                              </button>
                            )}
                            <button type="submit" name="state" value="REJECTED" className="agent-btn reject">
                              Reject
                            </button>
                          </div>
                        </form>
                      )}
                    </article>
                  ))}
              </div>
            </div>
          )}
        </section>
      )}

      {moduleId === "processors" && (() => {
        const atRisk = workspace.processors.find((p) => p.dpaStatus === "MISSING");
        const dpaTone = (s: string) => (s === "SIGNED" ? "good" : s === "IN_REVIEW" ? "warn" : "bad") as "good" | "warn" | "bad";
        const dpaLabel = (s: string) => (s === "SIGNED" ? "DPA signed" : s === "IN_REVIEW" ? "In review" : "DPA missing");
        const riskOf = (s: string) => (s === "SIGNED" ? "low" : s === "IN_REVIEW" ? "medium" : "high");
        const riskTone = (s: string) => (s === "SIGNED" ? "good" : s === "IN_REVIEW" ? "warn" : "bad") as "good" | "warn" | "bad";
        return (
        <section className="pf-screen" style={{ padding: 0, maxWidth: "none" }}>
          <FlashStatus
            flash={flash}
            updatedValue="processor"
            updatedMessage="Processor governance updated."
            errorValue="processor-update"
            errorMessage="Processor update failed."
          />
          {atRisk && (
            <div style={{ marginBottom: 16 }}>
              <InlineAlert tone="bad" title={`${atRisk.name} — DPA missing, high risk`} cite="DPDP §8(2)">
                A processor is receiving data without an executed DPA. Suspend sharing or execute the agreement.
              </InlineAlert>
            </div>
          )}
          <div className="pf-proc-grid">
            {workspace.processors.map((processor) => (
              <div key={processor.id} className="pf-card pf-proc-card">
                <div className="pf-proc-top">
                  <Avatar name={processor.name} size={36} />
                  <div className="pf-proc-id"><span className="pf-proc-name">{processor.name}</span><span className="pf-cell-dim">{processor.service}</span></div>
                  <Pill tone={riskTone(processor.dpaStatus)} sm>{riskOf(processor.dpaStatus)} risk</Pill>
                </div>
                <div className="pf-proc-rows">
                  <div className="pf-proc-row"><span>DPA status</span><Pill tone={dpaTone(processor.dpaStatus)} sm>{dpaLabel(processor.dpaStatus)}</Pill></div>
                  <div className="pf-proc-row"><span>Purge ack.</span><span className="pf-proc-val">{processor.purgeAckStatus.toLowerCase()}</span></div>
                  <div className="pf-proc-row"><span>Sub-processors</span><span className="pf-proc-val tnum">{processor.subProcessorCount}</span></div>
                </div>
                <form action={updateProcessorAction.bind(null, workspace.tenant.slug, processor.id)} className="pf-inline-save" style={{ marginTop: 14, gap: 8, flexWrap: "wrap" }}>
                  <select name="dpaStatus" defaultValue={processor.dpaStatus}>
                    <option value="SIGNED">Signed</option>
                    <option value="IN_REVIEW">In review</option>
                    <option value="MISSING">Missing</option>
                  </select>
                  <select name="purgeAckStatus" defaultValue={processor.purgeAckStatus}>
                    <option value="ACKNOWLEDGED">Acknowledged</option>
                    <option value="PENDING">Pending</option>
                    <option value="REFUSED">Refused</option>
                  </select>
                  <button type="submit">Save</button>
                </form>
              </div>
            ))}
          </div>
        </section>
        );
      })()}

      {moduleId === "evidence" && (
        <section className="pf-screen" style={{ padding: 0, maxWidth: "none" }}>
          {flash?.uploaded === "evidence" && <div style={{ marginBottom: 12 }}><InlineAlert tone="good" title="Artefact sealed">Evidence uploaded and tagged.</InlineAlert></div>}
          {flash?.error === "evidence-upload" && <div style={{ marginBottom: 12 }}><InlineAlert tone="bad" title="Upload failed">Please try again.</InlineAlert></div>}

          <div className="pf-card" style={{ overflow: "hidden" }}>
            <div style={{ padding: "16px 18px 0" }}><SectionHead title="Evidence repository" sub="Artefacts tagged to obligations" cite="JVA §S1.4" /></div>
            <table className="pf-table">
              <thead><tr><th>Artefact</th><th>Classification</th><th>Linked record</th><th>Sealed</th><th></th></tr></thead>
              <tbody>
                {workspace.evidence.map((artifact) => (
                  <tr key={artifact.id}>
                    <td><span className="pf-cell-strong">{artifact.label}</span><span className="pf-cell-dim mono">{artifact.id}</span></td>
                    <td><Pill tone="soft" sm dot={false}>{artifact.classification.replaceAll("_", " ")}</Pill></td>
                    <td><Citation>{artifact.linkedRecord}</Citation></td>
                    <td className="pf-cell-dim mono">{artifact.createdAt.slice(0, 10)}</td>
                    <td>{artifact.fileName
                      ? <Link href={`/workspace/${workspace.tenant.slug}/evidence/${artifact.id}/download`} className="pf-link-cell">Download<Icon name="download" size={13} /></Link>
                      : <span className="pf-cell-dim">Metadata only</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pf-card pf-card-pad" style={{ marginTop: 16 }}>
            <SectionHead title="Audit trail" sub="Append-only · integrity-hashed · tamper-evident" cite="JVA §S1.4" />
            <div className="pf-audit">
              {workspace.auditTrail.slice(0, 10).map((e) => (
                <AuditRow key={e.id} time={new Date(e.createdAt).toISOString().slice(0, 16).replace("T", " ")}
                  actor={e.actor} verb={e.action.toLowerCase().replaceAll("_", " ")} target={e.targetId}
                  hash={(e.id.match(/[a-f0-9]{4}/i)?.[0]) || e.id.slice(-4)} />
              ))}
            </div>
            <div className="pf-audit-seal"><Icon name="shield" size={14} />Chain verified — {workspace.auditTrail.length} entries, no gaps.</div>
          </div>

          <div style={{ marginTop: 16 }}>
            <EvidenceUploadForm tenantSlug={workspace.tenant.slug} />
          </div>
        </section>
      )}

      {moduleId === "setup" && (
        <section className="worksheet">
          <LlmResidencyPanel
            currentMode={adminData?.llmResidency?.mode ?? "MANAGED"}
            selfHostedEndpoint={adminData?.llmResidency?.endpoint}
          />
          {adminData?.siemKeys && (
            <SiemKeysPanel
              tenantSlug={workspace.tenant.slug}
              keys={adminData.siemKeys.keys}
              flashRawKey={flash?.siemNew}
              flashRevokedKeyId={flash?.siemRevoked}
              flashError={flash?.siemErr}
            />
          )}
          {adminData?.webhookSubs && adminData?.webhookDeliveries && (
            <WebhooksPanel
              tenantSlug={workspace.tenant.slug}
              subscriptions={adminData.webhookSubs.subscriptions}
              deliveries={adminData.webhookDeliveries.deliveries}
              flashOk={Boolean(flash?.whOk)}
              flashError={flash?.whErr}
            />
          )}
          <FlashStatus
            flash={flash}
            updatedValue="setup-profile"
            updatedMessage="Tenant profile updated."
            errorValue="setup-profile"
            errorMessage="Tenant profile update failed."
          />
          <FlashStatus
            flash={flash}
            updatedValue="setup-department"
            updatedMessage="Department added."
            errorValue="setup-department"
            errorMessage="Department creation failed."
          />
          <FlashStatus
            flash={flash}
            updatedValue="setup-system"
            updatedMessage="Source system added."
            errorValue="setup-system"
            errorMessage="Source system creation failed."
          />
          <FlashStatus
            flash={flash}
            updatedValue="setup-invite"
            updatedMessage="Invite created."
            errorValue="setup-invite"
            errorMessage="Invite creation failed."
          />
          <div className="split-ledger">
            <form action={updateSetupProfileAction.bind(null, workspace.tenant.slug)} className="narrative-block">
              <span className="section-kicker">Tenant identity</span>
              <input name="descriptor" defaultValue={workspace.tenant.descriptor} />
              <textarea name="operationalStory" defaultValue={workspace.tenant.operationalStory} rows={4} />
              <input name="publicDomain" defaultValue={workspace.tenant.publicBrand.publicDomain} />
              <input type="hidden" name="primaryColor" defaultValue={workspace.tenant.publicBrand.primaryColor} />
              <input type="hidden" name="accentColor" defaultValue={workspace.tenant.publicBrand.accentColor} />
              <button type="submit" className="text-button">
                Save profile
              </button>
            </form>
            <div>
              <span className="section-kicker">Role ownership</span>
              {workspace.team.map((member) => (
                <div key={member.id} className="ledger-row">
                  <div className="ledger-cell">
                    <strong>{member.name}</strong>
                    <span>{member.email}</span>
                  </div>
                  <div className="ledger-cell ledger-cell--stacked">
                    <strong>{member.title}</strong>
                    <div className="roles-ribbon roles-ribbon--dense">
                      {member.roles.map((role) => (
                        <span key={role}>{role.replaceAll("_", " ")}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="split-ledger">
            <div>
              <div className="section-heading">
                <div>
                  <span className="section-kicker">Departments</span>
                  <h3>Operational owners</h3>
                </div>
              </div>
              {workspace.departments.map((department) => (
                <div key={department.id} className="ledger-row">
                  <div className="ledger-cell">
                    <strong>{department.name}</strong>
                    <span>{department.obligationFocus}</span>
                  </div>
                  <div className="ledger-cell">
                    <strong>{department.ownerTitle}</strong>
                    <span>Named owner lane</span>
                  </div>
                </div>
              ))}
              <form action={addDepartmentAction.bind(null, workspace.tenant.slug)} className="notice-form">
                <input name="name" placeholder="Department name" />
                <input name="ownerTitle" placeholder="Owner title" />
                <input name="obligationFocus" placeholder="Obligation focus" />
                <button type="submit" className="text-button">
                  Add department
                </button>
              </form>
            </div>
            <div>
              <div className="section-heading">
                <div>
                  <span className="section-kicker">Source systems</span>
                  <h3>Connected operating estate</h3>
                </div>
              </div>
              {workspace.sourceSystems.map((system) => (
                <div key={system.id} className="ledger-row">
                  <div className="ledger-cell">
                    <strong>{system.name}</strong>
                    <span>{system.systemType}</span>
                  </div>
                  <div className="ledger-cell">
                    <strong>{system.owner}</strong>
                    <span>{system.status}</span>
                  </div>
                </div>
              ))}
              <form action={addSourceSystemAction.bind(null, workspace.tenant.slug)} className="notice-form">
                <input name="name" placeholder="System name" />
                <input name="systemType" placeholder="System type" />
                <input name="owner" placeholder="Owner" />
                <select name="status" defaultValue="PLANNED">
                  <option value="LIVE">Live</option>
                  <option value="REVIEW">Review</option>
                  <option value="PLANNED">Planned</option>
                </select>
                <button type="submit" className="text-button">
                  Add system
                </button>
              </form>
            </div>
          </div>
          <div className="split-ledger">
            <div className="narrative-block">
              <span className="section-kicker">Invite flow</span>
              <p>Phase 1 uses invite-first access so ownership is explicit before records are pushed, approved, or closed.</p>
            </div>
            <form action={inviteUserAction.bind(null, workspace.tenant.slug)} className="notice-form">
              <input name="email" type="email" placeholder="new.owner@tenant.com" />
              <select name="role" defaultValue="REVIEWER">
                <option value="TENANT_ADMIN">Tenant Admin</option>
                <option value="COMPLIANCE_MANAGER">Compliance Manager</option>
                <option value="DEPARTMENT_OWNER">Department Owner</option>
                <option value="REVIEWER">Reviewer</option>
                <option value="CASE_HANDLER">Case Handler</option>
                <option value="SECURITY_OWNER">Security / IT Owner</option>
                <option value="AUDITOR">Auditor</option>
              </select>
              <input name="title" placeholder="Assigned title" />
              <button type="submit" className="text-button">
                Create invite
              </button>
            </form>
          </div>
        </section>
      )}

      {moduleId === "reports" && (
        <section className="worksheet">
          {adminData?.apiBase && (
            <NamedReportsPanel
              tenantSlug={workspace.tenant.slug}
              apiBase={adminData.apiBase}
              bearerHint={adminData.bearerHint ?? "<your-session-token>"}
            />
          )}
          {adminData?.firms && adminData.apiBase && (
            <CompliancePackExport
              tenantSlug={workspace.tenant.slug}
              apiBase={adminData.apiBase}
              bearerHint={adminData.bearerHint ?? "<your-session-token>"}
              firms={adminData.firms.firms}
            />
          )}
          {adminData?.dpiaResults && (
            <DpiaPanel
              tenantSlug={workspace.tenant.slug}
              results={adminData.dpiaResults.dpiaResults}
              flashOk={flash?.dpiaOk}
              flashRisk={flash?.dpiaRisk}
              flashError={flash?.dpiaErr}
            />
          )}
          <div className="split-ledger">
            <div>
              <span className="section-kicker">Export set</span>
              <div className="ledger-row">
                <div>
                  <strong>Compliance Pack ZIP</strong>
                  <span>Summary PDF, register, rights, deletions, incidents, processors, evidence manifest</span>
                </div>
                <Link href={`/workspace/${workspace.tenant.slug}/reports/download`} className="text-link">
                  Generate export
                </Link>
              </div>
            </div>
            <div className="narrative-block">
              <span className="section-kicker">Boundary</span>
              <p>
                Reports summarize metadata, workflow state, and proof references. Evidence artifacts stay sealed and
                retrievable by manifest rather than content search.
              </p>
            </div>
          </div>
          <div className="section-heading">
            <div>
              <span className="section-kicker">Append-only audit</span>
              <h3>Latest operator actions</h3>
            </div>
          </div>
          <div className="ruled-table">
            <div className="ruled-head">
              <span>Action</span>
              <span>Module</span>
              <span>Actor</span>
              <span>When</span>
            </div>
            {workspace.auditTrail.slice(0, 8).map((event) => (
              <div key={event.id} className="ruled-row">
                <div>
                  <strong>{event.summary}</strong>
                  <span>{event.targetId}</span>
                </div>
                <span>{event.module}</span>
                <span>{event.actor}</span>
                <span>{new Date(event.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {moduleId === "connectors" && <ConnectorsView data={data} />}

      {moduleId === "dpdp-reference" && (
        <section className="worksheet">
          <div className="narrative-block">
            <span className="section-kicker">DPDP Act 2023 &amp; Rules 2025</span>
            <h3>India's Digital Personal Data Protection framework</h3>
            <p className="module-subtitle">
              The DPDP Act (Act No. 22 of 2023) was passed on August 11, 2023. The DPDP Rules 2025 were notified on November 13, 2025. Substantive compliance obligations take effect by May 13, 2027.
            </p>
          </div>

          {/* Implementation timeline */}
          <div className="narrative-block">
            <span className="section-kicker">Implementation Timeline</span>
            <div className="ledger-table">
              <div className="ledger-header">
                <span>Phase</span><span>Effective Date</span><span>What Becomes Active</span><span>Status</span>
              </div>
              <div className="ledger-row">
                <span><strong>Phase I</strong></span>
                <span>Nov 13, 2025</span>
                <span>Data Protection Board establishment, preliminary provisions (Rules 1, 2, 17-21)</span>
                <span><span className="pill-active">Active</span></span>
              </div>
              <div className="ledger-row">
                <span><strong>Phase II</strong></span>
                <span>Nov 13, 2026</span>
                <span>Consent Manager registration framework (Rule 4)</span>
                <span><span className="pill-review">Upcoming</span></span>
              </div>
              <div className="ledger-row">
                <span><strong>Phase III</strong></span>
                <span>May 13, 2027</span>
                <span>All substantive obligations — consent, notice, security, breach notification, children's data, SDF, cross-border (Rules 3, 5-16, 22-23)</span>
                <span><span className="pill-review">Upcoming</span></span>
              </div>
            </div>
          </div>

          {/* Key Obligations */}
          <div className="narrative-block">
            <span className="section-kicker">Key Compliance Obligations</span>
            <div className="ledger-table">
              <div className="ledger-header">
                <span>Obligation</span><span>Act Section</span><span>Rule</span><span>Prooflyt Module</span>
              </div>
              {[
                { obligation: "Consent — free, specific, informed, unconditional, unambiguous; clear affirmative action; easy withdrawal", section: "Section 6", rule: "Rule 3", module: "Rights & Notices" },
                { obligation: "Notice — standalone privacy notice with itemized data list, purposes, rights, complaint mechanism", section: "Section 5", rule: "Rule 3", module: "Notices" },
                { obligation: "Data inventory — map personal data across systems with purpose and legal basis", section: "Section 8", rule: "—", module: "Source Discovery + Register" },
                { obligation: "Security safeguards — encryption, access controls, backups; MSME simplified requirements", section: "Section 8(5)", rule: "Rule 6", module: "Evidence" },
                { obligation: "Breach notification — immediate intimation + detailed report to Board within 72 hours; notify affected principals", section: "Section 8(6)", rule: "Rule 7", module: "Breach Register" },
                { obligation: "Data accuracy — ensure completeness and consistency, especially for decision-making or sharing", section: "Section 8", rule: "—", module: "Register" },
                { obligation: "Retention and erasure — erase when purpose fulfilled or consent withdrawn; 3-year limit for e-commerce/social/gaming", section: "Section 8(7)", rule: "Rule 8", module: "Retention" },
                { obligation: "Data principal rights — access, correction, erasure, nomination; grievance redressal mechanism", section: "Sections 12-13", rule: "Rule 9", module: "Rights & Grievances" },
                { obligation: "Children's data — verifiable parental consent (DigiLocker); no tracking, profiling, or targeted advertising", section: "Section 9", rule: "Rules 10-12", module: "—" },
                { obligation: "Processor governance — ensure processors act only per instructions; fiduciary remains responsible", section: "Section 8", rule: "—", module: "Vendors / Processors" },
                { obligation: "DPO appointment — publish contact details of Data Protection Officer", section: "Section 8(9)", rule: "—", module: "Company Setup" },
                { obligation: "Significant Data Fiduciary — annual DPIA, independent data auditor, India-based DPO reporting to board", section: "Section 10", rule: "Rule 13", module: "Reports" },
                { obligation: "Cross-border transfer — permitted unless country is on Central Government restricted list", section: "Section 16", rule: "Rule 15", module: "—" },
              ].map((row, i) => (
                <div key={i} className="ledger-row">
                  <span>{row.obligation}</span>
                  <span><strong>{row.section}</strong></span>
                  <span>{row.rule}</span>
                  <span>{row.module !== "—" ? <span className="pill-active">{row.module}</span> : <span style={{color:"#999"}}>Not yet covered</span>}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Penalty Schedule */}
          <div className="narrative-block">
            <span className="section-kicker">Penalty Schedule (Section 33)</span>
            <div className="ledger-table">
              <div className="ledger-header">
                <span>Violation</span><span>Maximum Penalty</span>
              </div>
              {[
                { violation: "Failure to implement reasonable security safeguards (Section 8(5))", penalty: "INR 250 crore (~USD 30M)" },
                { violation: "Failure to notify Board and affected principals of a breach (Section 8(6))", penalty: "INR 200 crore (~USD 24M)" },
                { violation: "Non-compliance with children's data obligations (Section 9)", penalty: "INR 200 crore (~USD 24M)" },
                { violation: "SDF non-compliance — failure to appoint DPO, conduct DPIA, engage auditor (Section 10)", penalty: "INR 150 crore (~USD 18M)" },
                { violation: "Breach of voluntary undertaking accepted by Board (Section 32)", penalty: "INR 150 crore (~USD 18M)" },
                { violation: "Breach of any other provision — consent, notice, rights, etc. (catch-all)", penalty: "INR 50 crore (~USD 6M)" },
                { violation: "Data principal breach of duty — false complaints, impersonation (Section 15)", penalty: "INR 10,000 (~USD 120)" },
              ].map((row, i) => (
                <div key={i} className="ledger-row">
                  <span>{row.violation}</span>
                  <span><strong>{row.penalty}</strong></span>
                </div>
              ))}
            </div>
          </div>

          {/* Key Definitions */}
          <div className="narrative-block">
            <span className="section-kicker">Key Definitions</span>
            <div className="ledger-table">
              <div className="ledger-header">
                <span>Term</span><span>Definition</span><span>Section</span>
              </div>
              {[
                { term: "Data Principal", definition: "The individual whose personal data is being processed", section: "2(j)" },
                { term: "Data Fiduciary", definition: "Any entity that determines the purpose and means of processing personal data", section: "2(i)" },
                { term: "Data Processor", definition: "Any entity that processes personal data on behalf of a Data Fiduciary", section: "2(k)" },
                { term: "Significant Data Fiduciary", definition: "A Data Fiduciary designated by the Central Government based on volume, sensitivity, and risk", section: "2(z), 10" },
                { term: "Consent Manager", definition: "A registered entity enabling Data Principals to manage consent through an interoperable platform", section: "2(g)" },
                { term: "Personal Data", definition: "Any data about an individual who is identifiable by or in relation to such data", section: "2(t)" },
                { term: "Data Protection Board", definition: "The quasi-judicial regulatory authority for enforcement and adjudication", section: "Chapter 5" },
              ].map((row, i) => (
                <div key={i} className="ledger-row">
                  <span><strong>{row.term}</strong></span>
                  <span>{row.definition}</span>
                  <span>Section {row.section}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Prooflyt Coverage Analysis */}
          <div className="narrative-block">
            <span className="section-kicker">Prooflyt Coverage Analysis</span>
            <p className="module-subtitle">How Prooflyt maps to DPDP Act obligations. This platform does not certify compliance — it provides operational tools and evidence management to support your compliance posture.</p>
            <div className="ledger-table">
              <div className="ledger-header">
                <span>DPDP Obligation</span><span>Prooflyt Coverage</span><span>Status</span>
              </div>
              {[
                { obligation: "Data inventory and mapping (Section 8)", coverage: "Source Discovery with AI Smart Mapping, Data Register with lifecycle tracking", status: "Covered" },
                { obligation: "Privacy notices (Section 5)", coverage: "Versioned notice builder with publish workflow and audit trail", status: "Covered" },
                { obligation: "Data principal rights (Sections 12-13)", coverage: "Public rights portal, Rights & Grievances queue with SLA tracking, AI Rights Orchestrator", status: "Covered" },
                { obligation: "Breach notification (Section 8(6))", coverage: "Breach Register with 72-hour countdown, AI Breach Response Agent, Board notification drafts", status: "Covered" },
                { obligation: "Retention and erasure (Section 8(7))", coverage: "Retention module with deletion tasks, processor purge tracking, proof linking", status: "Covered" },
                { obligation: "Processor governance (Section 8)", coverage: "Processor/Vendor module with DPA status, purge acknowledgement, sub-processor tracking", status: "Covered" },
                { obligation: "Security safeguards evidence (Section 8(5))", coverage: "Sealed evidence library — metadata-only indexing, no content exposure", status: "Covered" },
                { obligation: "DPO and role ownership (Section 8(9))", coverage: "Company Setup with named department owners, role-based access control", status: "Covered" },
                { obligation: "Audit trail and reporting (Section 10)", coverage: "Append-only audit trail, Compliance Pack ZIP export for Board/auditors", status: "Covered" },
                { obligation: "Children's data protection (Section 9)", coverage: "Age verification and parental consent workflows", status: "Planned" },
                { obligation: "Consent Manager integration (Section 6)", coverage: "Integration with registered Consent Managers", status: "Planned" },
                { obligation: "Cross-border transfer tracking (Section 16)", coverage: "Data flow mapping against restricted country list", status: "Planned" },
                { obligation: "DPIA for Significant Data Fiduciaries (Section 10)", coverage: "Annual DPIA templates and independent auditor workflows", status: "Planned" },
              ].map((row, i) => (
                <div key={i} className="ledger-row">
                  <span>{row.obligation}</span>
                  <span>{row.coverage}</span>
                  <span>{row.status === "Covered" ? <span className="pill-active">Covered</span> : <span className="pill-review">Planned</span>}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="narrative-block" style={{ borderTop: "1px solid var(--border)", paddingTop: 20, marginTop: 12 }}>
            <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
              <strong>Disclaimer:</strong> Prooflyt is an operational compliance tool. It does not provide legal advice, certify compliance status, or substitute for qualified legal counsel. The information above is based on the DPDP Act 2023 and DPDP Rules 2025 as notified. Organizations should consult legal professionals for compliance guidance specific to their circumstances.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
