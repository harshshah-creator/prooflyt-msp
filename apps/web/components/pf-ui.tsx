/**
 *  pf-ui — server-safe presentational primitives ported from the
 *  Claude Design handoff (Prooflyt.html). Pure functions, no hooks,
 *  so they render inside Server Components. Visual structure + class
 *  names match the handoff's components.css / shell.css / screens.css.
 */
import type { CSSProperties, ReactNode } from "react";

/* ---- Icons (single-weight outline, from the handoff ICONS map) ---- */
const ICONS: Record<string, string> = {
  dashboard: "M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z",
  source: "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6",
  register: "M4 4h13l3 3v13H4zM8 4v16M12 9h5M12 13h5",
  notice: "M4 4h12l4 4v12H4zM14 4v5h5M8 13h8M8 17h5",
  rights: "M12 3l8 4v5c0 4.5-3.2 7.7-8 9-4.8-1.3-8-4.5-8-9V7zM9 12l2 2 4-4",
  retention: "M12 3a9 9 0 1 0 9 9M12 3v9l5 3M12 3a9 9 0 0 1 7 3.5",
  breach: "M12 3l9 16H3zM12 9v5M12 17h.01",
  processor: "M9 3h6v4H9zM4 10h6v4H4zM14 10h6v4h-6zM12 7v3M7 14v3h10v-3",
  evidence: "M9 3h7l4 4v14H6V3zM9 3v4H6M9 13l2 2 4-4",
  reports: "M5 3h9l5 5v13H5zM14 3v5h5M9 13v4M12 11v6M15 14v3",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4",
  bell: "M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6zM10 20a2 2 0 0 0 4 0",
  plus: "M12 5v14M5 12h14",
  check: "M5 12l4 4L19 7",
  x: "M6 6l12 12M18 6L6 18",
  chevR: "M9 6l6 6-6 6",
  chevD: "M6 9l6 6 6-6",
  filter: "M3 5h18l-7 8v6l-4-2v-4z",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 3.6-6 8-6s8 2 8 6",
  link: "M9 15l6-6M8 12l-2 2a3.5 3.5 0 0 0 5 5l2-2M16 12l2-2a3.5 3.5 0 0 0-5-5l-2 2",
  doc: "M7 3h7l4 4v14H7zM14 3v4h4M10 13h5M10 17h5",
  arrowUp: "M12 19V5M6 11l6-6 6 6",
  arrowDown: "M12 5v14M6 13l6 6 6-6",
  dot: "M12 12h.01",
  settings: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM4 12l-1 2 2 2M20 12l1 2-2 2M12 4l-2-1-2 2M12 20l2 1 2-2",
  shield: "M12 3l8 4v5c0 4.5-3.2 7.7-8 9-4.8-1.3-8-4.5-8-9V7z",
  hash: "M5 9h14M5 15h14M9 4l-2 16M17 4l-2 16",
  external: "M14 4h6v6M20 4l-8 8M18 14v6H4V6h6",
  upload: "M12 16V5M7 10l5-5 5 5M5 19h14",
  globe: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18",
  calendar: "M4 6h16v15H4zM4 10h16M8 3v4M16 3v4",
};

export function Icon({ name, size = 16, style, className }: { name: string; size?: number; style?: CSSProperties; className?: string }) {
  const d = ICONS[name] || ICONS.dot;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={style} className={className} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/* ---- Avatar (deterministic warm-neutral tint from the name) ---- */
export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const initials = (name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const hue = [...(name || "")].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <span className="pf-avatar" style={{
      width: size, height: size, fontSize: size * 0.36,
      background: `hsl(${hue} 30% 88%)`, color: `hsl(${hue} 38% 32%)`,
    }}>{initials}</span>
  );
}

/* ---- Readiness ring (static SVG, computed from value) ---- */
export function ReadinessRing({ value = 0, size = 148, stroke = 9, label }: { value?: number; size?: number; stroke?: number; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (Math.max(0, Math.min(100, value)) / 100) * c;
  const tone = value >= 80 ? "var(--success)" : value >= 50 ? "var(--warning)" : "var(--danger)";
  return (
    <div className="pf-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
          transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div className="pf-ring-center">
        <div className="pf-ring-val serif tnum">{value}</div>
        {label && <div className="pf-ring-label">{label}</div>}
      </div>
    </div>
  );
}

type Tone = "good" | "warn" | "bad" | "soft" | "accent";

export function Pill({ tone = "soft", children, dot = true, sm }: { tone?: Tone; children: ReactNode; dot?: boolean; sm?: boolean }) {
  return (
    <span className={`pf-pill pf-pill-${tone}${sm ? " pf-pill-sm" : ""}`}>
      {dot && <span className="pf-pill-dot" />}
      {children}
    </span>
  );
}

export function Citation({ children, soft }: { children: ReactNode; soft?: boolean }) {
  return <span className={`pf-cite mono${soft ? " pf-cite-soft" : ""}`}>{children}</span>;
}

export function Delta({ value, tone = "soft", arrow }: { value: ReactNode; tone?: Tone; arrow?: "up" | "down" | null }) {
  return (
    <span className={`pf-delta pf-delta-${tone}`}>
      {arrow && <Icon name={arrow === "up" ? "arrowUp" : "arrowDown"} size={12} />}
      <span className="tnum">{value}</span>
    </span>
  );
}

export function Bar({ value, tone = "accent", h = 6 }: { value: number; tone?: Tone; h?: number }) {
  const color = tone === "good" ? "var(--success)" : tone === "warn" ? "var(--warning)" : tone === "bad" ? "var(--danger)" : "var(--accent)";
  return (
    <div className="pf-bar" style={{ height: h }}>
      <div className="pf-bar-fill" style={{ width: `${value}%`, background: color }} />
    </div>
  );
}

export function InlineAlert({ tone = "warn", title, cite, children }: { tone?: "good" | "warn" | "bad"; title?: ReactNode; cite?: ReactNode; children?: ReactNode }) {
  return (
    <div className={`pf-alert pf-alert-${tone}`}>
      <Icon name={tone === "bad" ? "breach" : tone === "good" ? "check" : "shield"} size={16} />
      <div>
        {title && <div className="pf-alert-title">{title}{cite && <Citation soft>{cite}</Citation>}</div>}
        {children && <div className="pf-alert-body">{children}</div>}
      </div>
    </div>
  );
}

export function AuditRow({ time, actor, verb, target, hash, tone }: { time: string; actor: string; verb: string; target: string; hash: string; tone?: "good" | "bad" }) {
  return (
    <div className="pf-audit-row">
      <span className="pf-audit-time mono">{time}</span>
      <Avatar name={actor} size={22} />
      <span className="pf-audit-actor">{actor}</span>
      <span className={`pf-audit-verb${tone ? " is-" + tone : ""}`}>{verb}</span>
      <span className="pf-audit-target mono">{target}</span>
      <span className="pf-audit-hash mono" title="Integrity hash (append-only)"><Icon name="hash" size={11} />{hash}</span>
    </div>
  );
}

export function SectionHead({ title, sub, cite, right }: { title: ReactNode; sub?: ReactNode; cite?: ReactNode; right?: ReactNode }) {
  return (
    <div className="pf-sechead">
      <div>
        <div className="pf-sechead-title serif">{title}{cite && <Citation soft>{cite}</Citation>}</div>
        {sub && <div className="pf-sechead-sub">{sub}</div>}
      </div>
      {right && <div className="pf-sechead-right">{right}</div>}
    </div>
  );
}

/* ---- Stat (used in module stat-strips) ---- */
export function Stat({ label, value, sub, tone }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: "good" | "warn" | "bad" }) {
  return (
    <div className="pf-stat">
      <span className="pf-stat-label">{label}</span>
      <span className={`pf-stat-val serif tnum${tone ? " is-" + tone : ""}`}>{value}</span>
      {sub && <span className="pf-stat-sub">{sub}</span>}
    </div>
  );
}

/* ---- Severity tag (breaches/processors) ---- */
export function SevTag({ level }: { level: string }) {
  return <span className={`pf-sev-tag pf-sev-${level.toLowerCase()}`}>{level.toLowerCase()}</span>;
}
