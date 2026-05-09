/**
 *  DPO inbox panel — single-pane-of-glass aggregator that summarises
 *  cross-module pressure for a Compliance Manager / DPO.
 */

interface DpoInboxItem {
  id: string;
  priority: "URGENT" | "BLOCKING" | "REVIEW" | "INFO";
  module: string;
  title: string;
  body: string;
  dueAt?: string;
  targetId?: string;
}

export interface DpoInboxPanelProps {
  pulseScore: number;
  totalOpen: number;
  counts: Record<string, number>;
  items: DpoInboxItem[];
  generatedAt: string;
}

const PRIORITY_ORDER: DpoInboxItem["priority"][] = ["URGENT", "BLOCKING", "REVIEW", "INFO"];

function pulseStateClass(score: number): { cls: string; label: string } {
  if (score >= 80) return { cls: "is-healthy",  label: "Healthy"   };
  if (score >= 60) return { cls: "is-watch",    label: "Watch"     };
  if (score >= 35) return { cls: "is-pressure", label: "Pressure"  };
  return            { cls: "is-critical", label: "Critical"  };
}

function priorityClass(p: DpoInboxItem["priority"]): string {
  return p === "URGENT"   ? "is-urgent"
       : p === "BLOCKING" ? "is-blocking"
       : p === "REVIEW"   ? "is-review"
       : "is-info";
}

export function DpoInboxPanel({
  pulseScore, totalOpen, counts, items, generatedAt,
}: DpoInboxPanelProps) {
  const state = pulseStateClass(pulseScore);
  const grouped = PRIORITY_ORDER.map((p) => ({
    priority: p,
    rows: items.filter((it) => it.priority === p),
  })).filter((g) => g.rows.length > 0);

  return (
    <div className="dpo-inbox-panel">
      <header className="dpo-pulse">
        <div className={`dpo-pulse-circle ${state.cls}`}>{pulseScore}</div>
        <div className="dpo-pulse-meta">
          <div className={`dpo-pulse-state ${state.cls}`}>{state.label}</div>
          <div className="dpo-pulse-summary">
            Compliance pulse · {totalOpen} open item{totalOpen === 1 ? "" : "s"}
          </div>
          <div className="dpo-pulse-when">
            Generated {new Date(generatedAt).toLocaleString("en-IN")}
          </div>
        </div>
        <div className="dpo-pulse-counts">
          {Object.entries(counts).filter(([, n]) => n > 0).map(([k, n]) => (
            <span key={k} className="dpo-count-chip">
              {k.toLowerCase()} <strong>{n}</strong>
            </span>
          ))}
        </div>
      </header>

      {items.length === 0 && (
        <p className="admin-empty">Nothing pending. Inbox is clear.</p>
      )}

      {grouped.map(({ priority, rows }) => (
        <section key={priority} className="dpo-priority-group">
          <div className="dpo-priority-head">
            <span className={`priority-pill ${priorityClass(priority)}`}>{priority}</span>
            <span className="dpo-priority-count">
              {rows.length} item{rows.length === 1 ? "" : "s"}
            </span>
          </div>
          <ul className="dpo-item-list">
            {rows.map((it) => (
              <li key={it.id} className="dpo-item">
                <div className="dpo-item-row">
                  <strong className="dpo-item-title">{it.title}</strong>
                  <span className="dpo-item-module">{it.module}</span>
                </div>
                <p className="dpo-item-body">{it.body}</p>
                {it.dueAt && (
                  <div className="dpo-item-due">
                    Due {new Date(it.dueAt).toLocaleString("en-IN")}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
