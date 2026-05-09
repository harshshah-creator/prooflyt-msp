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
import { NoticeRule3Trigger } from "./admin/notice-rule3-button";
import { DpiaPanel } from "./admin/dpia-panel";

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
  const totalMapped = workspace.registerEntries.length;

  return (
    <div className="stage-grid">
      {/* ── Welcome greeting ────────────────────────── */}
      <div className="dash-greeting">
        <div className="dash-greeting-text">
          <span>Welcome back, {data.operator.name.split(" ")[0]}</span>
          <h2>Overview Dashboard</h2>
        </div>
      </div>

      {/* ── Readiness Score card ─────────────────────── */}
      <div className="readiness-card">
        <div className="readiness-label">Readiness Score</div>
        <div className="readiness-score">{workspace.metrics.readinessScore}%</div>
        <span className="readiness-delta">
          ↑ {Math.max(3, Math.round(workspace.metrics.readinessScore * 0.14))}% from last audit batch
        </span>
        {/* Badge removed — we show posture, not certification */}
      </div>

      {/* ── Privacy Obligation Coverage ──────────────── */}
      <div className="coverage-card">
        <div className="coverage-label">Privacy Obligation Coverage</div>
        <div className="coverage-metrics">
          <div className="coverage-metric">
            <span className="metric-val">{workspace.metrics.ownerCoverage}</span>
            <span className="metric-label">Mapped Actions</span>
          </div>
          <div className="coverage-metric">
            <span className="metric-val">
              {String(workspace.metrics.openGaps).padStart(2, "0")}
            </span>
            <span className="metric-label">Missing Evidence</span>
          </div>
          <div className="coverage-metric">
            <span className="metric-val is-danger">{workspace.metrics.activeIncidents + workspace.metrics.overdueDeletions}</span>
            <span className="metric-label">Compliance Gaps</span>
          </div>
        </div>
      </div>

      {/* ── Source Discovery upload zone ─────────────── */}
      <Link href={`/workspace/${workspace.tenant.slug}/sources`} className="source-discovery-card">
        <span className="card-section-label">Source Discovery</span>
        <h3>Drop your Excel/CSV data inventory here</h3>
        <p>Our AI auto-detects personal data fields with confidence scores</p>
        <span className="upload-cta">Upload Assets</span>
      </Link>

      {/* ── Recent Rights Requests ──────────────────── */}
      <div className="rights-recent-card">
        <div className="card-section-label">Recent Rights Requests</div>
        <div className="rights-recent-list">
          {workspace.rightsCases.slice(0, 4).map((caseItem) => {
            const pill = statusToPill(caseItem.status);
            return (
              <div key={caseItem.id} className="rights-recent-item">
                <div className="rights-recent-info">
                  <strong>{caseItem.type.replaceAll("_", " ")} Request</strong>
                  <span>User: {caseItem.requestor} &bull; {caseItem.sla}</span>
                </div>
                <span className={`status-pill ${pill.cls}`}>{pill.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Data Register Core table ────────────────── */}
      <div className="register-preview">
        <div className="register-header">
          <h3>Data Register Core</h3>
          <span className="register-count">{totalMapped} Assets Mapped</span>
        </div>
        <div className="dash-register-table">
          <div className="dash-register-head">
            <span>Data Asset</span>
            <span>Category</span>
            <span>Source</span>
            <span>Retention</span>
            <span>Status</span>
          </div>
          {workspace.registerEntries.slice(0, 5).map((entry) => {
            const pill = lifecycleToPill(entry.lifecycle);
            return (
              <div key={entry.id} className="dash-register-row">
                <div className="asset-info">
                  <strong>{entry.system}</strong>
                  <span>{entry.sourceTrace}</span>
                </div>
                <span>{entry.dataCategory}</span>
                <span>{entry.sourceTrace}</span>
                <span>{entry.legalBasis}</span>
                <span className={`status-pill ${pill.cls}`}>{pill.label}</span>
              </div>
            );
          })}
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
    <div className="module-stage">
      <section className="module-banner">
        <span className="section-kicker">{moduleId.replace(/^\w/, (letter) => letter.toUpperCase())}</span>
        <h2>{headerByModule[moduleId].title}</h2>
        <p>{headerByModule[moduleId].body}</p>
      </section>

      {moduleId === "sources" && (
        <section className="worksheet">
          <div className="split-ledger">
            <div className="narrative-block">
              <span className="section-kicker">New source intake</span>
              <p>
                Upload CSV or Excel files into the profiling queue. The system derives headers, scores the mapping, and
                keeps the raw file out of the core compliance model.
              </p>
            </div>
            <SourceUploadForm tenantSlug={workspace.tenant.slug} />
          </div>
          {flash?.uploaded === "source" && <p className="form-status success">Source uploaded and sent to review.</p>}
          <FlashStatus
            flash={flash}
            updatedValue="source"
            updatedMessage="Source approved and pushed into the register review queue."
            errorValue="source-upload"
            errorMessage="Source workflow failed. Please try again."
          />
          <div className="section-heading">
            <div>
              <span className="section-kicker">AI Smart Mapping</span>
              <h3>Review queue</h3>
            </div>
          </div>
          <div className="ruled-table">
            <div className="ruled-head">
              <span>Source</span>
              <span>Mode</span>
              <span>Status</span>
              <span>Field coverage</span>
            </div>
            {workspace.sources.map((source) => (
              <div key={source.id} className="ruled-row">
                <div>
                  <strong>{source.name}</strong>
                  <span>{source.fileName}</span>
                </div>
                <span>{source.profileMode.replaceAll("_", " ")}</span>
                <span>{source.status}</span>
                <div className="row-stack align-end">
                  <span>
                    {source.approvedFields}/{source.fields}
                  </span>
                  {!source.pushedToRegister ? (
                    <form action={approveSourceAction.bind(null, workspace.tenant.slug, source.id)}>
                      <button type="submit" className="text-button">
                        Approve to register
                      </button>
                    </form>
                  ) : (
                    <span className="micro-note">Register linked</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="split-ledger">
            <div>
              <span className="section-kicker">Classifier output</span>
              {workspace.sourceProfiles.slice(0, 6).map((field) => (
                <div key={field.id} className="ledger-row">
                  <div>
                    <strong>{field.fieldName}</strong>
                    <span>{field.mappedCategory}</span>
                  </div>
                  <div>
                    <strong>{Math.round(field.confidence * 100)}%</strong>
                    <span>{field.requiresReview ? "Reviewer hold" : "Ready"}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="narrative-block">
              <span className="section-kicker">Boundary</span>
              <p>
                Smart Mapping supports header-only, masked-sample, and ephemeral-full modes. Raw payloads are never retained
                in the core compliance model, and low-confidence fields stay in reviewer hold.
              </p>
            </div>
          </div>
        </section>
      )}

      {moduleId === "register" && (
        <section className="worksheet">
          <FlashStatus
            flash={flash}
            updatedValue="register"
            updatedMessage="Register lifecycle updated."
            errorValue="register-update"
            errorMessage="Register update failed."
          />
          <div className="ruled-table">
            <div className="ruled-head five">
              <span>System</span>
              <span>Category</span>
              <span>Legal basis</span>
              <span>Lifecycle</span>
              <span>Completeness</span>
            </div>
            {workspace.registerEntries.map((entry) => (
              <div key={entry.id} className="ruled-row five">
                <div>
                  <strong>{entry.system}</strong>
                  <span>{entry.sourceTrace}</span>
                </div>
                <span>{entry.dataCategory}</span>
                <span>{entry.legalBasis}</span>
                <form action={updateRegisterLifecycleAction.bind(null, workspace.tenant.slug, entry.id)} className="compact-inline-form">
                  <select name="lifecycle" defaultValue={entry.lifecycle}>
                    <option value="DRAFT">Draft</option>
                    <option value="IN_REVIEW">In review</option>
                    <option value="APPROVED">Approved</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                  <button type="submit" className="text-button">
                    Save
                  </button>
                </form>
                <span>{entry.completeness}</span>
              </div>
            ))}
          </div>
        </section>
      )}

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
                <textarea name="content" defaultValue={notice.content} rows={4} />
                <input name="audience" defaultValue={notice.audience} />
                <button type="submit" className="text-button">Save</button>
              </form>
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
          {workspace.rightsCases.map((caseItem) => {
            const enriched = adminData?.sla?.cases.find((c) => c.id === caseItem.id);
            return (
            <article key={caseItem.id} className="case-row">
              <div>
                <strong>{caseItem.id}</strong>
                <span>
                  {caseItem.type} · {caseItem.requestor}
                </span>
                {enriched?.slaInfo && (
                  <div style={{ marginTop: "0.4rem" }}>
                    <SlaChip
                      state={enriched.slaInfo.state}
                      daysRemaining={enriched.slaInfo.daysRemaining}
                      humanLabel={enriched.slaInfo.humanLabel}
                      citation={enriched.slaInfo.citation}
                    />
                  </div>
                )}
              </div>
              <form action={updateRightsCaseAction.bind(null, workspace.tenant.slug, caseItem.id)} className="compact-inline-form">
                <select name="status" defaultValue={caseItem.status}>
                  <option value="NEW">New</option>
                  <option value="IN_PROGRESS">In progress</option>
                  <option value="AWAITING_PROOF">Awaiting proof</option>
                  <option value="CLOSED">Closed</option>
                </select>
                <label className="micro-toggle">
                  <input type="checkbox" name="evidenceLinked" defaultChecked={caseItem.evidenceLinked} />
                  <span>Evidence</span>
                </label>
                <input name="refusalNote" placeholder="Refusal note if closing without proof" />
                <button type="submit" className="text-button">
                  Save
                </button>
              </form>
              <div className="rights-agent-bar">
                <span>{caseItem.sla}</span>
                <span>{caseItem.evidenceLinked ? "Proof linked" : "Awaiting proof"}</span>
                <form action={triggerRightsAgentAction.bind(null, workspace.tenant.slug, caseItem.id)}>
                  <button type="submit" className="agent-trigger-button">
                    <span className="agent-icon">⚡</span> Run Rights Orchestrator
                  </button>
                </form>
              </div>
            </article>
            );
          })}

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

      {moduleId === "retention" && (
        <section className="worksheet">
          <FlashStatus
            flash={flash}
            updatedValue="retention"
            updatedMessage="Deletion task updated."
            errorValue="retention-update"
            errorMessage="Retention workflow update failed. Closing still requires proof and an acknowledged downstream path."
          />
          {workspace.deletionTasks.map((task) => (
            <article key={task.id} className="case-row">
              <div>
                <strong>{task.label}</strong>
                <span>{task.system}</span>
              </div>
              <form action={updateDeletionTaskAction.bind(null, workspace.tenant.slug, task.id)} className="compact-inline-form">
                <select name="status" defaultValue={task.status}>
                  <option value="OPEN">Open</option>
                  <option value="LEGAL_HOLD">Legal hold</option>
                  <option value="AWAITING_PROCESSOR">Awaiting processor</option>
                  <option value="READY_FOR_PROOF">Ready for proof</option>
                  <option value="CLOSED">Closed</option>
                </select>
                <label className="micro-toggle">
                  <input type="checkbox" name="proofLinked" defaultChecked={task.proofLinked} />
                  <span>Proof</span>
                </label>
                <label className="micro-toggle">
                  <input type="checkbox" name="processorAcknowledged" defaultChecked={task.processorAcknowledged} />
                  <span>Processor ack</span>
                </label>
                <input name="exceptionNote" placeholder="Exception note" />
                <button type="submit" className="text-button">
                  Save
                </button>
              </form>
              <span>{task.dueDate}</span>
              <span>{task.proofLinked ? "Proof linked" : "Proof missing"}</span>
            </article>
          ))}
        </section>
      )}

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
          {workspace.incidents.map((incident) => (
            <article key={incident.id} className="notice-line warning">
              <div>
                <span className="section-kicker">{incident.severity}</span>
                <h3>{incident.title}</h3>
              </div>
              <form action={updateIncidentAction.bind(null, workspace.tenant.slug, incident.id)} className="notice-meta notice-form">
                <strong>{incident.status}</strong>
                <span>{incident.remediationOwner}</span>
                <select name="status" defaultValue={incident.status}>
                  <option value="TRIAGE">Triage</option>
                  <option value="ASSESSMENT">Assessment</option>
                  <option value="CONTAINMENT">Containment</option>
                  <option value="CLOSED">Closed</option>
                </select>
                <label className="micro-toggle align-end">
                  <input type="checkbox" name="evidenceLinked" defaultChecked={incident.evidenceLinked} />
                  <span>Evidence</span>
                </label>
                <input name="remediationOwner" defaultValue={incident.remediationOwner} />
                <button type="submit" className="text-button">
                  Save
                </button>
              </form>
              <div className="incident-agent-bar">
                <p>{incident.boardDeadline}</p>
                <form action={triggerBreachAgentAction.bind(null, workspace.tenant.slug, incident.id)}>
                  <button type="submit" className="agent-trigger-button">
                    <span className="agent-icon">⚡</span> Run Breach Response Agent
                  </button>
                </form>
              </div>
            </article>
          ))}

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

      {moduleId === "processors" && (
        <section className="worksheet">
          <FlashStatus
            flash={flash}
            updatedValue="processor"
            updatedMessage="Processor governance updated."
            errorValue="processor-update"
            errorMessage="Processor update failed."
          />
          {workspace.processors.map((processor) => (
            <article key={processor.id} className="ledger-row">
              <div>
                <strong>{processor.name}</strong>
                <span>{processor.service}</span>
              </div>
              <form action={updateProcessorAction.bind(null, workspace.tenant.slug, processor.id)} className="compact-inline-form compact-inline-form--right">
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
                <button type="submit" className="text-button">
                  Save
                </button>
              </form>
            </article>
          ))}
        </section>
      )}

      {moduleId === "evidence" && (
        <section className="worksheet">
          <div className="split-ledger">
            <div className="narrative-block">
              <span className="section-kicker">Sealed upload</span>
              <p>
                Evidence files are stored as sealed artifacts and only exposed through metadata plus explicit downloads for
                authorized operators.
              </p>
            </div>
            <EvidenceUploadForm tenantSlug={workspace.tenant.slug} />
          </div>
          {flash?.uploaded === "evidence" && <p className="form-status success">Evidence artifact uploaded successfully.</p>}
          {flash?.error === "evidence-upload" && <p className="form-status error">Evidence upload failed. Please try again.</p>}
          {workspace.evidence.map((artifact) => (
            <article key={artifact.id} className="ledger-row">
              <div>
                <strong>{artifact.label}</strong>
                <span>{artifact.classification}</span>
              </div>
              <div>
                <strong>{artifact.linkedRecord}</strong>
                <span>
                  Metadata only · no content indexing
                  {artifact.fileName ? (
                    <>
                      {" · "}
                      <Link href={`/workspace/${workspace.tenant.slug}/evidence/${artifact.id}/download`} className="text-link">
                        Download sealed file
                      </Link>
                    </>
                  ) : null}
                </span>
              </div>
            </article>
          ))}
        </section>
      )}

      {moduleId === "setup" && (
        <section className="worksheet">
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
