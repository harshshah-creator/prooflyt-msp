/**
 *  SLA chip — single-cell visual that shows a Rights case's DPDP §13/§14/§15
 *  deadline state and time remaining. Server component, no client JS.
 */

export interface SlaChipProps {
  state: "ON_TRACK" | "AT_RISK" | "OVERDUE" | "CLOSED";
  daysRemaining: number;
  humanLabel: string;
  citation: string;
}

const ICON: Record<SlaChipProps["state"], string> = {
  ON_TRACK: "●",
  AT_RISK:  "◐",
  OVERDUE:  "▲",
  CLOSED:   "✓",
};

const CLS: Record<SlaChipProps["state"], string> = {
  ON_TRACK: "is-on-track",
  AT_RISK:  "is-at-risk",
  OVERDUE:  "is-overdue",
  CLOSED:   "is-closed",
};

export function SlaChip({ state, daysRemaining, humanLabel, citation }: SlaChipProps) {
  const label = state === "OVERDUE"
    ? `Overdue · ${Math.abs(Math.floor(daysRemaining))}d`
    : state === "CLOSED"
      ? "Closed"
      : `${state === "AT_RISK" ? "At risk" : "On track"} · ${Math.max(0, Math.floor(daysRemaining))}d`;
  return (
    <span className={`sla-chip ${CLS[state]}`} title={`${humanLabel} — ${citation}`}>
      <span aria-hidden="true">{ICON[state]}</span>
      <span>{label}</span>
    </span>
  );
}
