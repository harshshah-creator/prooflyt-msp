/**
 *  Outbound webhooks management panel.
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

const STATUS_CLS: Record<WebhookDeliveryRow["status"], string> = {
  DELIVERED: "is-delivered",
  FAILED: "is-failed",
  PENDING: "is-pending",
};

export function WebhooksPanel({
  tenantSlug, subscriptions, deliveries, flashOk, flashError,
}: WebhooksPanelProps) {
  return (
    <section className="admin-panel worksheet">
      <header className="admin-panel-header">
        <div>
          <h3>Outbound webhooks</h3>
          <p>HMAC-SHA256-signed event fan-out to Slack, PagerDuty, Datadog, or any HTTPS receiver. Cloud-metadata IPs are blocked at registration.</p>
        </div>
      </header>

      {flashOk && (
        <p className="form-status success">Subscription registered.</p>
      )}
      {flashError && <p className="form-status error">{flashError}</p>}

      <details>
        <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "0.85rem", color: "var(--ink-2)" }}>
          + Add subscription
        </summary>
        <form action={createWebhookAction.bind(null, tenantSlug)} className="admin-form-stacked">
          <label>
            HTTPS URL
            <input name="url" type="url" required placeholder="https://hooks.slack.com/services/..." className="admin-input" />
          </label>
          <label>
            Event filter (e.g. <code>rights.*</code>, <code>incidents.*</code>, <code>*</code>)
            <input name="eventFilter" defaultValue="*" className="admin-input" />
          </label>
          <label>
            Shared secret (16+ chars, used for HMAC-SHA256 signature)
            <input name="secret" type="password" required minLength={16} placeholder="At least 16 characters" className="admin-input" />
          </label>
          <label>
            Description (optional)
            <input name="description" placeholder="Slack #compliance-alerts" className="admin-input" />
          </label>
          <button type="submit" className="primary-button" style={{ justifySelf: "start" }}>Register</button>
        </form>
      </details>

      <ul className="admin-list" style={{ marginTop: "1rem" }}>
        {subscriptions.length === 0 && (
          <li className="admin-empty">No subscriptions yet.</li>
        )}
        {subscriptions.map((s) => (
          <li key={s.id} className={`admin-list-row ${s.active ? "" : "is-revoked"}`}>
            <div className="admin-list-row-body">
              <code>{s.url}</code>
              <div className="admin-list-row-meta">
                filter <code>{s.eventFilter}</code>
                {s.description && <> · {s.description}</>}
                {s.failureStreak > 0 && <> · failures: <strong style={{ color: "var(--danger)" }}>{s.failureStreak}</strong></>}
                {s.pausedReason && <> · paused: {s.pausedReason}</>}
              </div>
            </div>
            <div className="admin-list-row-actions">
              {s.active ? (
                <form action={pauseWebhookAction.bind(null, tenantSlug, s.id)}>
                  <button type="submit" className="admin-mini-btn">Pause</button>
                </form>
              ) : (
                <form action={resumeWebhookAction.bind(null, tenantSlug, s.id)}>
                  <button type="submit" className="admin-mini-btn">Resume</button>
                </form>
              )}
              <form action={deleteWebhookAction.bind(null, tenantSlug, s.id)}>
                <button type="submit" className="admin-mini-btn is-danger">Delete</button>
              </form>
            </div>
          </li>
        ))}
      </ul>

      <details style={{ marginTop: "1rem" }}>
        <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "0.85rem", color: "var(--ink-2)" }}>
          Recent deliveries ({deliveries.length})
        </summary>
        <ul className="delivery-list">
          {deliveries.slice(0, 25).map((d) => (
            <li key={d.id} className="delivery-row">
              <span className={`delivery-status ${STATUS_CLS[d.status]}`}>{d.status}</span>
              {" · "}
              {d.eventType}
              {d.httpStatus && ` · HTTP ${d.httpStatus}`}
              {" · "}
              {new Date(d.createdAt).toLocaleString("en-IN")}
              {d.lastError && <span className="delivery-error"> · {d.lastError}</span>}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
