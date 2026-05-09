/**
 *  SIEM export keys management panel.
 *  Lives inside the Setup module under "Integrations".
 */

import { createSiemKeyAction, revokeSiemKeyAction } from "../../app/workspace/admin-actions";

export interface SiemKeyRow {
  id: string;
  label: string;
  active: boolean;
  createdAt: string;
  keyHint: string;
  lastUsedAt?: string;
  lastUsedFromIp?: string;
}

export interface SiemKeysPanelProps {
  tenantSlug: string;
  keys: SiemKeyRow[];
  flashRawKey?: string;
  flashRevokedKeyId?: string;
  flashError?: string;
}

export function SiemKeysPanel({
  tenantSlug,
  keys,
  flashRawKey,
  flashRevokedKeyId,
  flashError,
}: SiemKeysPanelProps) {
  return (
    <section className="worksheet" style={{ padding: "1rem 1.25rem", marginTop: "1rem" }}>
      <header style={{ marginBottom: "0.8rem" }}>
        <h3 style={{ margin: 0, fontSize: "1rem" }}>SIEM audit export keys</h3>
        <p style={{ margin: "0.2rem 0 0", color: "var(--ink-3)", fontSize: "0.8rem" }}>
          Long-lived bearer keys for Splunk HEC / Datadog Logs / Elastic SIEM pollers.
          Keys are read-only against the audit trail. Each call is rate-limited (60/min).
        </p>
      </header>

      {flashRawKey && (
        <div className="callout-success" style={{ marginBottom: "0.8rem" }}>
          <strong>Key minted.</strong> Copy this now — it is shown only once:
          <pre style={{
            margin: "0.5rem 0 0", padding: "0.6rem", borderRadius: 6,
            background: "rgba(0,0,0,0.06)", overflowX: "auto", fontSize: "0.75rem",
          }}>{flashRawKey}</pre>
        </div>
      )}
      {flashRevokedKeyId && (
        <p className="form-status success" style={{ marginBottom: "0.8rem" }}>
          Key {flashRevokedKeyId} revoked. Subsequent calls return 401.
        </p>
      )}
      {flashError && (
        <p className="form-status error" style={{ marginBottom: "0.8rem" }}>{flashError}</p>
      )}

      <form
        action={createSiemKeyAction.bind(null, tenantSlug)}
        style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}
      >
        <input
          name="label"
          required
          placeholder='Label (e.g. "Splunk HEC — prod")'
          style={{
            flex: 1, minWidth: 240, padding: "0.5rem 0.75rem",
            border: "1px solid var(--border-strong)", borderRadius: 8,
          }}
        />
        <button type="submit" className="primary-button">Mint key</button>
      </form>

      {keys.length === 0 && (
        <p style={{ color: "var(--ink-3)", fontSize: "0.85rem" }}>
          No keys yet. Mint one to wire up your SIEM.
        </p>
      )}

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.4rem" }}>
        {keys.map((k) => (
          <li
            key={k.id}
            style={{
              border: "1px solid var(--border)", borderRadius: 8,
              padding: "0.55rem 0.85rem",
              display: "flex", alignItems: "center", gap: "0.75rem",
              background: k.active ? "var(--surface-1)" : "rgba(0,0,0,0.03)",
              opacity: k.active ? 1 : 0.6,
            }}
          >
            <code style={{ fontSize: "0.75rem", color: "var(--ink-2)" }}>{k.keyHint}</code>
            <div style={{ flex: 1 }}>
              <strong style={{ fontSize: "0.85rem" }}>{k.label}</strong>
              <div style={{ fontSize: "0.72rem", color: "var(--ink-4)" }}>
                Created {new Date(k.createdAt).toLocaleDateString("en-IN")}
                {k.lastUsedAt && (
                  <> · last used {new Date(k.lastUsedAt).toLocaleString("en-IN")}{k.lastUsedFromIp ? ` from ${k.lastUsedFromIp}` : ""}</>
                )}
              </div>
            </div>
            {k.active ? (
              <form action={revokeSiemKeyAction.bind(null, tenantSlug, k.id)}>
                <button type="submit" className="ghost-button" style={{ fontSize: "0.75rem", padding: "0.3rem 0.7rem" }}>
                  Revoke
                </button>
              </form>
            ) : (
              <span style={{ fontSize: "0.7rem", color: "var(--danger)" }}>Revoked</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
