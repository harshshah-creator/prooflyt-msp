/**
 *  Regulatory Calendar — JVA Schedule 2 §S2.3 should-pass item:
 *    "Compliance Dashboard: Regulatory Calendar pre-populated with DPDP Act
 *     enforcement dates (November 2025, November 2026, May 2027)."
 *
 *  Static, server-rendered timeline of the dates a tenant's compliance
 *  programme must plan against. No tenant data; just the published DPB +
 *  MeitY commencement / enforcement schedule.
 */

interface CalendarItem {
  date: string;          // ISO date, used for sort + relative-time
  label: string;
  citation: string;
  note: string;
}

// Source: DPDP Rules 2025 commencement notification (Nov 2025) and
// published DPB enforcement window guidance. Update this list as MeitY
// issues further dates.
const ITEMS: CalendarItem[] = [
  {
    date: "2025-11-13",
    label: "DPDP Act commencement",
    citation: "DPDP Act §1(3) — Notification S.O. dated 13 Nov 2025",
    note: "Sections 1, 2, 3, 4, 5, 6, 7, 8, 9, 11–32 brought into force.",
  },
  {
    date: "2026-11-13",
    label: "Significant Data Fiduciary obligations crystallise",
    citation: "DPDP §10 + Rule 13 — 12-month grace from commencement",
    note: "SDFs must complete first DPIA, appoint DPO, and publish data-audit framework.",
  },
  {
    date: "2027-05-13",
    label: "Full enforcement window opens",
    citation: "DPB enforcement guidance — 18 months from commencement",
    note: "Penalty regime under §33 fully enforceable; voluntary undertakings window closes.",
  },
];

function daysUntil(iso: string, asOf: Date = new Date()): number {
  const t = new Date(iso).getTime();
  return Math.round((t - asOf.getTime()) / (24 * 60 * 60 * 1000));
}

function statusClass(days: number): string {
  if (days < 0) return "is-past";
  if (days <= 30) return "is-imminent";
  if (days <= 180) return "is-soon";
  return "is-future";
}

export function RegulatoryCalendar() {
  const now = new Date();
  return (
    <section className="admin-panel worksheet regulatory-calendar">
      <header className="admin-panel-header">
        <div>
          <h3>DPDP regulatory calendar</h3>
          <p>
            Statutory milestones for the DPDP Act, 2023 and DPDP Rules, 2025. These dates govern the
            compliance window your obligations must close against — they are fixed by MeitY and the
            Data Protection Board and do not vary by tenant.
          </p>
        </div>
      </header>

      <ol className="reg-cal-list">
        {ITEMS.map((it) => {
          const days = daysUntil(it.date, now);
          const cls = statusClass(days);
          const label = days === 0
            ? "Today"
            : days > 0
              ? `${days} day${days === 1 ? "" : "s"} away`
              : `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`;
          return (
            <li key={it.date} className={`reg-cal-item ${cls}`}>
              <div className="reg-cal-date">
                <strong>{new Date(it.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</strong>
                <span>{label}</span>
              </div>
              <div className="reg-cal-body">
                <div className="reg-cal-label">{it.label}</div>
                <div className="reg-cal-citation">{it.citation}</div>
                <p className="reg-cal-note">{it.note}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
