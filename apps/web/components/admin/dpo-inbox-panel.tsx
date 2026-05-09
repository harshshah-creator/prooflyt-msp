/**
 *  DPO inbox panel — single-pane-of-glass aggregator that summarises
 *  cross-module pressure for a Compliance Manager / DPO.
 *
 *  Pulse score (0–100) is the headline; below it, items grouped by
 *  priority. Item priority is from the worker, not derived here.
 */

import type { ReactNode } from "react";

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

function pulseHue(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "Healthy",     color: "#5a8a52" };
  if (score >= 60) return { label: "Watch",       color: "#c4a032" };
  if (score >= 35) return { label: "Pressure",    color: "#d68a32" };
  return                  { label: "Critical",   color: "#b94a4a" };
}

function priorityChip(p: DpoInboxItem["priority"]): ReactNode {
  const palette: Record<typeof p, string> = {
    URGENT:   "#b94a4a",
    BLOCKING: "#d68a32",
    REVIEW:   "#c4a032",
    INFO:     "#7a7a6e",
  };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.12rem 0.5rem",
        borderRadius: 4,
        background: `${palette[p]}1a`,
        color: palette[p],
        fontSize: "0.66rem",
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
      }}
    >
      {p}
    </span>
  );
}

export function DpoInboxPanel({
  pulseScore,
  totalOpen,
  counts,
  items,
  generatedAt,
}: DpoInboxPanelProps) {
  const pulse = pulseHue(pulseScore);
  const grouped = PRIORITY_ORDER.map((p) => ({
    priority: p,
    rows: items.filter((it) => it.priority === p),
  })).filter((g) => g.rows.length > 0);

  return (
    <div className="dpo-inbox-panel">
      <header className="dpo-inbox-pulse" style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
        <div
          style={{
            width: 88, height: 88, borderRadius: "50%",
            display: "grid", placeItems: "center",
            background: `${pulse.color}1a`, border: `3px solid ${pulse.color}`,
          }}
        >
          <strong style={{ fontSize: "1.6rem", color: pulse.color }}>{pulseScore}</strong>
        </div>
        <div>
          <div style={{ fontWeight: 700, color: pulse.color, fontSize: "1.1rem" }}>{pulse.label}</div>
          <div style={{ color: "var(--ink-3)", fontSize: "0.85rem" }}>
            Compliance pulse · {totalOpen} open item{totalOpen === 1 ? "" : "s"}
          </div>
          <div style={{ color: "var(--ink-4)", fontSize: "0.74rem", marginTop: "0.2rem" }}>
            Generated {new Date(generatedAt).toLocaleString("en-IN")}
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {Object.entries(counts).filter(([, n]) => n > 0).map(([k, n]) => (
            <span key={k} style={{
              padding: "0.18rem 0.6rem", borderRadius: 999,
              background: "rgba(0,0,0,0.04)", border: "1px solid var(--border)",
              fontSize: "0.72rem", color: "var(--ink-2)",
            }}>
              {k.toLowerCase()} <strong>{n}</strong>
            </span>
          ))}
        </div>
      </header>

      {items.length === 0 && (
        <p style={{ color: "var(--ink-3)", fontSize: "0.85rem" }}>
          Nothing pending. Inbox is clear.
        </p>
      )}

      {grouped.map(({ priority, rows }) => (
        <section key={priority} style={{ marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
            {priorityChip(priority)}
            <span style={{ fontSize: "0.74rem", color: "var(--ink-4)" }}>
              {rows.length} item{rows.length === 1 ? "" : "s"}
            </span>
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.5rem" }}>
            {rows.map((it) => (
              <li
                key={it.id}
                style={{
                  border: "1px solid var(--border)", borderRadius: 8,
                  background: "var(--surface-1)", padding: "0.6rem 0.85rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "0.5rem" }}>
                  <strong style={{ fontSize: "0.9rem" }}>{it.title}</strong>
                  <span style={{ fontSize: "0.7rem", color: "var(--ink-4)", whiteSpace: "nowrap" }}>
                    {it.module}
                  </span>
                </div>
                <p style={{ fontSize: "0.82rem", color: "var(--ink-2)", margin: "0.2rem 0 0" }}>{it.body}</p>
                {it.dueAt && (
                  <div style={{ fontSize: "0.7rem", color: "var(--ink-3)", marginTop: "0.3rem" }}>
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
