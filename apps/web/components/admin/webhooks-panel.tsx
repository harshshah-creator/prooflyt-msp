/**
 *  Outbound webhooks management panel.
 *  Lives inside the Setup module under "Integrations".
 */

import {
  createWebhookAction,
  deleteWebhookAction,
  pauseWebhookAction,
  resumeWebhookAction,
} from "../../app/workspace/admin-actions";

export interface WebhookSubRow {
  id: string;
  url: string;
  eventFilter: string;
  description?: string;
  active: boolean;
  failureStreak: number;
  pausedReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDeliveryRow {
  id: string;
  subscriptionId: string;
  eventType: string;
  status: "PENDING" | "DELIVERED" | "FAILED";
  httpStatus?: number;
  attempts: number;
  lastError?: string;
  createdAt: string;
  deliveredAt?: string;
  payloadSha256: string;
}

export interface WebhooksPanelProps {
  tenantSlug: string;
  subscriptions: WebhookSubRow[];
  deliveries: WebhookDeliveryRow[];
  flashOk?: boolean;
  flashError?: string;
}

const STATUS_COLOR: Record<WebhookDeliveryRow["status"], string> = {
  PENDING:   "#c4a032",
  DELIVERED: "#5a8a52",
  FAILED:    "#b94a4a",
};

export function WebhooksPanel({
  tenantSlug,
  subscriptions,
  deliveries,
  flashOk,
  flashError,
}: WebhooksPanelProps) {
  return (
    <section className="worksheet" style={{ padding: "1rem 1.25rem", marginTop: "1rem" }}>
      <header style={{ marginBottom: "0.8rem" }}>
        <h3 style={{ margin: 0, fontSize: "1rem" }}>Outbound webhooks</h3>
        <p style={{ margin: "0.2rem 0 0", color: "var(--ink-3)", fontSize: "0.8rem" }}>
          HMAC-SHA256-signed event fan-out to Slack, PagerDuty, Datadog, or any HTTPS receiver.
          Cloud-metadata IPs are blocked at registration.
        </p>
      </header>

      {flashOk && (
        <p className="form-status success" style={{ marginBottom: "0.8rem" }}>
          Subscription registered.
        </p>
      )}
      {flashError && (
        <p className="form-status error" style={{ marginBottom: "0.8rem" }}>{flashError}</p>
      )}

      <details style={{ marginBottom: "1rem" }}>
        <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "0.85rem", color: "var(--ink-2)" }}>
          + Add subscription
        </summary>
        <form
          action={createWebhookAction.bind(null, tenantSlug)}
          style={{ display: "grid", gap: "0.5rem", marginTop: "0.5rem", maxWidth: 600 }}
        >
          <label style={{ fontSize: "0.78rem", color: "var(--ink-2)" }}>
            HTTPS URL
            <input
              name="url"
              type="url"
              required
              placeholder="https://hooks.slack.com/services/..."
              style={inputStyle}
            />
          </label>
          <label style={{ fontSize: "0.78rem", color: "var(--ink-2)" }}>
            Event filter (e.g. <code>rights.*</code>, <code>incidents.*</code>, <code>*</code>)
            <input
              name="eventFilter"
              defaultValue="*"
              style={inputStyle}
            />
          </label>
          <label style={{ fontSize: "0.78rem", color: "var(--ink-2)" }}>
            Shared secret (16+ chars, used for HMAC-SHA256 signature)
            <input
              name="secret"
              type="password"
              required
              minLength={16}
              placeholder="At least 16 characters"
              style={inputStyle}
            />
          </label>
          <label style={{ fontSize: "0.78rem", color: "var(--ink-2)" }}>
            Description (optional)
            <input name="description" placeholder="Slack #compliance-alerts" style={inputStyle} />
          </label>
          <button type="submit" className="primary-button" style={{ justifySelf: "start" }}>
            Register
          </button>
        </form>
      </details>

      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 1rem", display: "grid", gap: "0.4rem" }}>
        {subscriptions.length === 0 && (
          <li style={{ color: "var(--ink-3)", fontSize: "0.85rem" }}>No subscriptions yet.</li>
        )}
        {subscriptions.map((s) => (
          <li
            key={s.id}
            style={{
              border: "1px solid var(--border)", borderRadius: 8,
              padding: "0.55rem 0.85rem",
              display: "flex", alignItems: "center", gap: "0.75rem",
              background: s.active ? "var(--surface-1)" : "rgba(0,0,0,0.03)",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <code style={{ fontSize: "0.78rem", color: "var(--ink-2)" }}>{s.url}</code>
              <div style={{ fontSize: "0.72rem", color: "var(--ink-4)", marginTop: "0.2rem" }}>
                filter <code>{s.eventFilter}</code>
                {s.description && <> · {s.description}</>}
                {s.failureStreak > 0 && <> · failures: <strong style={{ color: "var(--danger)" }}>{s.failureStreak}</strong></>}
                {s.pausedReason && <> · paused: {s.pausedReason}</>}
              </div>
            </div>
            {s.active ? (
              <form action={pauseWebhookAction.bind(null, tenantSlug, s.id)}>
                <button type="submit" className="ghost-button" style={miniBtn}>Pause</button>
              </form>
            ) : (
              <form action={resumeWebhookAction.bind(null, tenantSlug, s.id)}>
                <button type="submit" className="ghost-button" style={miniBtn}>Resume</button>
              </form>
            )}
            <form action={deleteWebhookAction.bind(null, tenantSlug, s.id)}>
              <button type="submit" className="ghost-button" style={{ ...miniBtn, color: "var(--danger)" }}>
                Delete
              </button>
            </form>
          </li>
        ))}
      </ul>

      <details>
        <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "0.85rem", color: "var(--ink-2)" }}>
          Recent deliveries ({deliveries.length})
        </summary>
        <ul style={{ listStyle: "none", padding: 0, margin: "0.5rem 0 0", display: "grid", gap: "0.3rem" }}>
          {deliveries.slice(0, 25).map((d) => (
            <li
              key={d.id}
              style={{
                fontSize: "0.74rem", color: "var(--ink-2)",
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                padding: "0.3rem 0.5rem", borderRadius: 4,
                background: "rgba(0,0,0,0.03)",
              }}
            >
              <span style={{ color: STATUS_COLOR[d.status], fontWeight: 700 }}>{d.status}</span>
              {" · "}
              {d.eventType}
              {d.httpStatus && ` · HTTP ${d.httpStatus}`}
              {" · "}
              {new Date(d.createdAt).toLocaleString("en-IN")}
              {d.lastError && <span style={{ color: "var(--danger)" }}> · {d.lastError}</span>}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

const inputStyle = {
  width: "100%", marginTop: "0.25rem",
  padding: "0.5rem 0.75rem",
  border: "1px solid var(--border-strong)",
  borderRadius: 8,
};
const miniBtn = { fontSize: "0.74rem", padding: "0.3rem 0.7rem" } as const;
