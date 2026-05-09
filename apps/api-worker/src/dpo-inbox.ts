/**
 *  DPO Inbox — single-pane-of-glass aggregator for the Data Protection
 *  Officer's daily compliance work.
 *
 *  Pulls cross-module signals into a prioritised list of "what needs your
 *  attention today". Each item is typed, linked back to its source record,
 *  and carries a soft SLA so the DPO can triage at a glance.
 *
 *  Categories:
 *    URGENT    — past SLA, will breach within 24h, or §29 board deadline
 *    BLOCKING  — open incident at HIGH/CRITICAL, missing evidence on closed RR
 *    REVIEW    — DPIA due, notice gaps, register entries IN_REVIEW
 *    INFO      — connector events, periodic reminders
 */

import type {
  DeletionTask,
  Incident,
  Notice,
  Processor,
  RegisterEntry,
  RightsCase,
  TenantWorkspace,
} from "@prooflyt/contracts";

export type InboxPriority = "URGENT" | "BLOCKING" | "REVIEW" | "INFO";

export interface InboxItem {
  id: string;
  priority: InboxPriority;
  module: string;       // "rights" | "incidents" | "retention" | "register" | "processors" | "notices" | "connectors"
  title: string;
  detail: string;
  /** Stable link target inside the workspace UI */
  link: string;
  /** ISO timestamp where applicable (SLA, deadline) */
  dueAt?: string;
  /** Source record id for traceability */
  sourceId: string;
}

const URGENT_SLA_PATTERNS = [/overdue/i, /1 day/i, /less than/i, /hour/i];

function isUrgentSla(sla: string): boolean {
  return URGENT_SLA_PATTERNS.some((p) => p.test(sla));
}

export interface InboxSummary {
  generatedAt: string;
  counts: Record<InboxPriority, number>;
  totalOpen: number;
  /** Compliance pulse — single integer DPO sees on the dashboard */
  pulseScore: number;       // 0–100, higher is healthier
  items: InboxItem[];
}

/**
 *  Build the inbox view from the current workspace state. Pure read — no
 *  side effects on workspace.
 */
export function buildDpoInbox(workspace: TenantWorkspace): InboxSummary {
  const items: InboxItem[] = [];
  const slug = workspace.tenant.slug;

  /* ── Rights & Grievances ── */
  for (const r of workspace.rightsCases as RightsCase[]) {
    if (r.status === "CLOSED") continue;
    const overdue = isUrgentSla(r.sla);
    const noEvidence = r.status === "AWAITING_PROOF" && !r.evidenceLinked;
    const priority: InboxPriority = overdue || noEvidence ? "URGENT" : "REVIEW";
    items.push({
      id: `rights:${r.id}`,
      priority,
      module: "rights",
      title: `${r.type} request from ${r.requestor}`,
      detail: `${r.status.replace(/_/g, " ").toLowerCase()} · ${r.sla}${noEvidence ? " · missing evidence" : ""}`,
      link: `/workspace/${slug}/rights`,
      sourceId: r.id,
    });
  }

  /* ── Incidents (DPDP §29 — 72-hour Board notification) ── */
  for (const i of workspace.incidents as Incident[]) {
    if (i.status === "CLOSED") continue;
    const critical = i.severity === "CRITICAL" || i.severity === "HIGH";
    const priority: InboxPriority = critical ? "URGENT" : "BLOCKING";
    items.push({
      id: `incident:${i.id}`,
      priority,
      module: "incidents",
      title: `${i.severity} incident — ${i.title}`,
      detail: `${i.status} · board deadline ${i.boardDeadline} · owner ${i.remediationOwner}${i.evidenceLinked ? "" : " · evidence missing"}`,
      link: `/workspace/${slug}/incidents`,
      sourceId: i.id,
    });
  }

  /* ── Retention / deletion tasks ── */
  for (const t of workspace.deletionTasks as DeletionTask[]) {
    if (t.status === "CLOSED") continue;
    const overdue = new Date(t.dueDate).getTime() < Date.now();
    const priority: InboxPriority = overdue ? "URGENT" : "REVIEW";
    items.push({
      id: `deletion:${t.id}`,
      priority,
      module: "retention",
      title: `Retention task — ${t.label}`,
      detail: `${t.status.replace(/_/g, " ").toLowerCase()} · due ${t.dueDate}${t.proofLinked ? "" : " · no proof"}${t.processorAcknowledged ? "" : " · processor not ack"}`,
      link: `/workspace/${slug}/retention`,
      dueAt: t.dueDate,
      sourceId: t.id,
    });
  }

  /* ── Processors / Vendors with DPA gaps ── */
  for (const p of workspace.processors as Processor[]) {
    if (p.dpaStatus === "MISSING") {
      items.push({
        id: `processor:${p.id}:no-dpa`,
        priority: "BLOCKING",
        module: "processors",
        title: `${p.name} — no DPA on file`,
        detail: `Service: ${p.service}. DPDP §8 governance gap.`,
        link: `/workspace/${slug}/processors`,
        sourceId: p.id,
      });
    } else if (p.dpaStatus === "IN_REVIEW") {
      items.push({
        id: `processor:${p.id}:dpa-review`,
        priority: "REVIEW",
        module: "processors",
        title: `${p.name} — DPA pending review`,
        detail: `Service: ${p.service}. Sub-processors: ${p.subProcessorCount}.`,
        link: `/workspace/${slug}/processors`,
        sourceId: p.id,
      });
    }
    if (p.purgeAckStatus === "REFUSED") {
      items.push({
        id: `processor:${p.id}:purge-refused`,
        priority: "URGENT",
        module: "processors",
        title: `${p.name} — refused purge ack`,
        detail: `Escalate to legal — DPDP §8(7) retention compliance at risk.`,
        link: `/workspace/${slug}/processors`,
        sourceId: p.id,
      });
    }
  }

  /* ── Register entries needing review ── */
  for (const e of workspace.registerEntries as RegisterEntry[]) {
    if (e.lifecycle === "IN_REVIEW" && e.completeness !== "COMPLETE") {
      items.push({
        id: `register:${e.id}`,
        priority: "REVIEW",
        module: "register",
        title: `${e.system} — register entry needs approval`,
        detail: `${e.dataCategory} · ${e.legalBasis} · ${e.completeness}`,
        link: `/workspace/${slug}/register`,
        sourceId: e.id,
      });
    }
  }

  /* ── Notices in DRAFT or IN_REVIEW ── */
  for (const n of workspace.notices as Notice[]) {
    if (n.status === "DRAFT" || n.status === "IN_REVIEW") {
      items.push({
        id: `notice:${n.id}`,
        priority: n.status === "DRAFT" ? "REVIEW" : "BLOCKING",
        module: "notices",
        title: `${n.title} — ${n.status.toLowerCase()}`,
        detail: `Audience ${n.audience}, version ${n.version}. Run Rule 3 analyzer to surface gaps.`,
        link: `/workspace/${slug}/notices`,
        sourceId: n.id,
      });
    }
  }

  /* ── Connector events from the last 24h that need attention ── */
  const day = 24 * 60 * 60 * 1000;
  for (const ev of workspace.connectorEvents.slice(0, 25)) {
    if (Date.now() - new Date(ev.createdAt).getTime() > day) break;
    if (ev.eventType === "DSR_ERASURE_DENIED" || ev.eventType === "GRIEVANCE_INGESTED") {
      items.push({
        id: `connector-event:${ev.id}`,
        priority: ev.eventType === "DSR_ERASURE_DENIED" ? "REVIEW" : "URGENT",
        module: "connectors",
        title: ev.summary,
        detail: `${ev.connectorType} · ${new Date(ev.createdAt).toLocaleString("en-IN")}`,
        link: `/workspace/${slug}/connectors`,
        sourceId: ev.id,
      });
    }
  }

  /* ── Sort by priority then by dueAt ── */
  const order: Record<InboxPriority, number> = { URGENT: 0, BLOCKING: 1, REVIEW: 2, INFO: 3 };
  items.sort((a, b) => {
    const o = order[a.priority] - order[b.priority];
    if (o !== 0) return o;
    return (a.dueAt || "9999") < (b.dueAt || "9999") ? -1 : 1;
  });

  const counts: Record<InboxPriority, number> = { URGENT: 0, BLOCKING: 0, REVIEW: 0, INFO: 0 };
  for (const it of items) counts[it.priority] += 1;

  // Pulse score: higher when the inbox is empty / clean. Each URGENT or
  // BLOCKING knocks 6 points, each REVIEW 1.5. Floor at 0.
  const pulseScore = Math.max(0, Math.round(100 - counts.URGENT * 6 - counts.BLOCKING * 6 - counts.REVIEW * 1.5));

  return {
    generatedAt: new Date().toISOString(),
    counts,
    totalOpen: items.length,
    pulseScore,
    items,
  };
}
