/**
 *  SIEM export keys management panel.
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
  tenantSlug, keys, flashRawKey, flashRevokedKeyId, flashError,
}: SiemKeysPanelProps) {
  return (
    <section className="admin-panel worksheet">
      <header className="admin-panel-header">
        <div>
          <h3>SIEM audit-export keys</h3>
          <p>Long-lived bearer keys for Splunk HEC / Datadog Logs / Elastic SIEM pollers. Read-only against the audit trail. Each call rate-limited to 60/min.</p>
        </div>
      </header>

      {flashRawKey && (
        <div className="admin-key-flash">
          <strong>Key minted.</strong> Copy this now — it is shown only once:
          <pre>{flashRawKey}</pre>
        </div>
      )}
      {flashRevokedKeyId && (
        <p className="form-status success">
          Key {flashRevokedKeyId} revoked. Subsequent calls return 401.
        </p>
      )}
      {flashError && <p className="form-status error">{flashError}</p>}

      <form action={createSiemKeyAction.bind(null, tenantSlug)} className="admin-form-row">
        <input
          name="label"
          required
          placeholder='Label (e.g. "Splunk HEC — prod")'
          className="admin-input"
        />
        <button type="submit" className="primary-button">Mint key</button>
      </form>

      {keys.length === 0 && (
        <p className="admin-empty">No keys yet. Mint one to wire up your SIEM.</p>
      )}

      <ul className="admin-list">
        {keys.map((k) => (
          <li key={k.id} className={`admin-list-row ${k.active ? "" : "is-revoked"}`}>
            <code>{k.keyHint}</code>
            <div className="admin-list-row-body">
              <div className="admin-list-row-title">{k.label}</div>
              <div className="admin-list-row-meta">
                Created {new Date(k.createdAt).toLocaleDateString("en-IN")}
                {k.lastUsedAt && (
                  <> · last used {new Date(k.lastUsedAt).toLocaleString("en-IN")}{k.lastUsedFromIp ? ` from ${k.lastUsedFromIp}` : ""}</>
                )}
              </div>
            </div>
            {k.active ? (
              <form action={revokeSiemKeyAction.bind(null, tenantSlug, k.id)}>
                <button type="submit" className="admin-mini-btn is-danger">Revoke</button>
              </form>
            ) : (
              <span className="admin-list-row-meta">Revoked</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
