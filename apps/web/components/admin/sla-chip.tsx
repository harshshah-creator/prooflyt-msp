/**
 *  SLA chip — single-cell visual that shows a Rights case's DPDP §13/§14/§15
 *  deadline state and time remaining.
 *
 *  Server component (no client JS). The page that shows rights cases passes
 *  the slaInfo from the worker's /rights/sla response.
 */

import type { CSSProperties } from "react";

export interface SlaChipProps {
  state: "ON_TRACK" | "AT_RISK" | "OVERDUE" | "CLOSED";
  daysRemaining: number;
  humanLabel: string;
  citation: string;
}

const PALETTE: Record<SlaChipProps["state"], { bg: string; fg: string; border: string }> = {
  ON_TRACK: { bg: "rgba(90,138,82,0.10)",  fg: "#3d6b3a", border: "rgba(90,138,82,0.45)"  },
  AT_RISK:  { bg: "rgba(196,160,50,0.12)", fg: "#7a5e0e", border: "rgba(196,160,50,0.45)" },
  OVERDUE:  { bg: "rgba(185,74,74,0.12)",  fg: "#7d1818", border: "rgba(185,74,74,0.55)"  },
  CLOSED:   { bg: "rgba(0,0,0,0.06)",      fg: "#3d3d36", border: "rgba(0,0,0,0.18)"      },
};

const ICON: Record<SlaChipProps["state"], string> = {
  ON_TRACK: "●",
  AT_RISK:  "◐",
  OVERDUE:  "▲",
  CLOSED:   "✓",
};

export function SlaChip({ state, daysRemaining, humanLabel, citation }: SlaChipProps) {
  const c = PALETTE[state];
  const style: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.4rem",
    padding: "0.18rem 0.6rem",
    borderRadius: 999,
    background: c.bg,
    color: c.fg,
    border: `1px solid ${c.border}`,
    fontSize: "0.74rem",
    fontWeight: 600,
    fontFamily: "ui-monospace, SFMono-Regular, monospace",
  };
  // Humanise: "OVERDUE by 3d", "AT_RISK · 4d left", "ON_TRACK · 18d left"
  const label = state === "OVERDUE"
    ? `Overdue · ${Math.abs(Math.floor(daysRemaining))}d`
    : state === "CLOSED"
      ? "Closed"
      : `${state === "AT_RISK" ? "At risk" : "On track"} · ${Math.max(0, Math.floor(daysRemaining))}d`;
  return (
    <span style={style} title={`${humanLabel} — ${citation}`}>
      <span aria-hidden="true">{ICON[state]}</span>
      <span>{label}</span>
    </span>
  );
}
