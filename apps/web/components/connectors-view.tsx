import type { WorkspaceResponse } from "../lib/types";
import { getConnectorBootstrap } from "../lib/api";
import { getSessionToken } from "../lib/session";
import {
  startOAuthConnectorAction,
  connectApiKeyConnectorAction,
  runConnectorDiscoveryAction,
  runConnectorDsrAction,
  revokeConnectorAction,
} from "../app/workspace/actions";

/**
 *  ConnectorsView — surface the third-party integrations module.
 *
 *  Shows:
 *    - Catalogue of supported connectors (HubSpot / Razorpay / Freshdesk)
 *      with capability badges + DPDP context callouts.
 *    - Currently connected instances with status, discovery + DSR controls.
 *    - Recent connector events (grievance ingestion, DSR proof, denials).
 */

type ConnectorType =
  | "HUBSPOT"
  | "RAZORPAY"
  | "FRESHDESK"
  | "ZOHO_CRM"
  | "SHOPIFY"
  | "POSTGRES"
  | "MONGODB"
  | "AWS_S3";

interface ConnectorDefinitionVM {
  id: ConnectorType | string;
  name: string;
  vendor: string;
  category:
    | "CRM" | "PAYMENTS" | "HELPDESK" | "ECOMMERCE" | "DATABASE" | "OBJECT_STORAGE"
    | "IDENTITY" | "MARKETING" | "COMMS" | "ANALYTICS"
    | "MARKETPLACE" | "LOGISTICS" | "HR" | "COLLABORATION"
    | "DATA_WAREHOUSE" | "STORAGE_DOC";
  authType: "OAUTH2" | "API_KEY" | "CONNECTION_STRING" | "AWS_IAM";
  capabilities: {
    discovery: boolean;
    dsrAccess: boolean;
    dsrErasure: boolean;
    dsrCorrection: boolean;
    grievanceIngest: boolean;
    webhooks: boolean;
    purgeProof: boolean;
  };
  dpdpNotes: { legalBasisFloor?: string; dataResidency?: string; indianFootprint?: string };
  brand: { logoText: string; accentColor: string };
}

// Local catalogue (mirrors apps/api-worker/src/connectors.ts CONNECTOR_DEFINITIONS).
const CATALOGUE: ConnectorDefinitionVM[] = [
  {
    id: "RAZORPAY",
    name: "Razorpay Payments",
    vendor: "Razorpay Software Pvt Ltd",
    category: "PAYMENTS",
    authType: "API_KEY",
    capabilities: { discovery: true, dsrAccess: true, dsrErasure: false, dsrCorrection: true, grievanceIngest: false, webhooks: true, purgeProof: true },
    dpdpNotes: {
      legalBasisFloor: "RBI 5–10 year retention floor. Erasure denied under DPDP §17(2)(a) with legal-basis letter.",
      dataResidency: "India only (RBI 100% local storage mandate).",
      indianFootprint: "55%+ India online payment market share.",
    },
    brand: { logoText: "RP", accentColor: "#0d2eb1" },
  },
  {
    id: "HUBSPOT",
    name: "HubSpot CRM",
    vendor: "HubSpot, Inc.",
    category: "CRM",
    authType: "OAUTH2",
    capabilities: { discovery: true, dsrAccess: true, dsrErasure: true, dsrCorrection: true, grievanceIngest: true, webhooks: true, purgeProof: true },
    dpdpNotes: {
      legalBasisFloor: "Native /gdpr-delete API. Subscription/deal records may carry retention exceptions.",
      dataResidency: "US / EU / Canada — disclose cross-border transfer.",
      indianFootprint: "Free + Starter tiers common in Indian SMB and SaaS.",
    },
    brand: { logoText: "HS", accentColor: "#ff7a59" },
  },
  {
    id: "FRESHDESK",
    name: "Freshdesk Support",
    vendor: "Freshworks Inc.",
    category: "HELPDESK",
    authType: "API_KEY",
    capabilities: { discovery: true, dsrAccess: true, dsrErasure: true, dsrCorrection: true, grievanceIngest: true, webhooks: true, purgeProof: true },
    dpdpNotes: {
      legalBasisFloor: "Hard-delete cascade is irreversible. Quarantine attachments before erasure.",
      dataResidency: "India DC available since 2024 (Freshworks IN region).",
      indianFootprint: "Indian-origin (Freshworks/Chennai). Common SMB helpdesk.",
    },
    brand: { logoText: "FD", accentColor: "#25c16f" },
  },
  {
    id: "ZOHO_CRM",
    name: "Zoho CRM",
    vendor: "Zoho Corporation Pvt Ltd",
    category: "CRM",
    authType: "API_KEY",
    capabilities: { discovery: true, dsrAccess: true, dsrErasure: true, dsrCorrection: true, grievanceIngest: false, webhooks: true, purgeProof: true },
    dpdpNotes: {
      legalBasisFloor: "Two-step erasure: DELETE → recycle-bin purge. Both receipts captured as evidence.",
      dataResidency: "India DC option (in.zoho.com). Strong DPDP fit when configured to Indian region.",
      indianFootprint: "Indian-origin. Large Indian SMB / sales-team footprint, free 3-user tier.",
    },
    brand: { logoText: "ZH", accentColor: "#e42527" },
  },
  {
    id: "SHOPIFY",
    name: "Shopify",
    vendor: "Shopify Inc.",
    category: "ECOMMERCE",
    authType: "API_KEY",
    capabilities: { discovery: true, dsrAccess: true, dsrErasure: true, dsrCorrection: true, grievanceIngest: false, webhooks: true, purgeProof: true },
    dpdpNotes: {
      legalBasisFloor: "Mandatory customers/data_request + customers/redact webhooks; 30-day SLA enforced by Shopify.",
      dataResidency: "Global (US/CA primary). No India-only DC; disclose cross-border transfer.",
      indianFootprint: "Dominant India D2C platform. Most Indian DTC brands run on Shopify or Shopify Plus.",
    },
    brand: { logoText: "SH", accentColor: "#5e8e3e" },
  },
  {
    id: "POSTGRES",
    name: "PostgreSQL",
    vendor: "Self-hosted / RDS / Supabase / Neon",
    category: "DATABASE",
    authType: "CONNECTION_STRING",
    capabilities: { discovery: true, dsrAccess: true, dsrErasure: true, dsrCorrection: true, grievanceIngest: false, webhooks: false, purgeProof: true },
    dpdpNotes: {
      legalBasisFloor: "FK constraints can block DELETE. Prooflyt generates a CASCADE plan and surfaces blockers.",
      dataResidency: "Depends on host (RDS region / Supabase project / on-prem). Disclose in cross-border register.",
      indianFootprint: "The most common app database in Indian SaaS. Often holds the canonical user/order/event PII.",
    },
    brand: { logoText: "PG", accentColor: "#336791" },
  },
  {
    id: "MONGODB",
    name: "MongoDB",
    vendor: "MongoDB, Inc. (Atlas) / self-hosted",
    category: "DATABASE",
    authType: "CONNECTION_STRING",
    capabilities: { discovery: true, dsrAccess: true, dsrErasure: true, dsrCorrection: true, grievanceIngest: false, webhooks: false, purgeProof: true },
    dpdpNotes: {
      legalBasisFloor: "Embedded arrays may need $pull operations. Per-collection erasure plan flags these.",
      dataResidency: "Atlas region pinning required for India residency. Self-hosted depends on infra.",
      indianFootprint: "Dominant document DB in Indian startups. Profiles, sessions, and preference data.",
    },
    brand: { logoText: "MG", accentColor: "#4faa41" },
  },
  {
    id: "AWS_S3",
    name: "AWS S3",
    vendor: "Amazon Web Services",
    category: "OBJECT_STORAGE",
    authType: "AWS_IAM",
    capabilities: { discovery: true, dsrAccess: true, dsrErasure: true, dsrCorrection: false, grievanceIngest: false, webhooks: false, purgeProof: true },
    dpdpNotes: {
      legalBasisFloor: "Versioning + cross-region replication are §16 surfaces. DeleteObjectVersion required for true erasure.",
      dataResidency: "Region-bound per bucket. ap-south-1 (Mumbai) / ap-south-2 (Hyderabad) for India residency.",
      indianFootprint: "Default object storage for Indian cloud-native companies. Holds uploads, KYC scans, exports, backups.",
    },
    brand: { logoText: "S3", accentColor: "#ff9900" },
  },
];

function categoryLabel(c: ConnectorDefinitionVM["category"]): string {
  switch (c) {
    case "CRM":             return "CRM";
    case "PAYMENTS":        return "PAYMENTS";
    case "HELPDESK":        return "HELPDESK";
    case "ECOMMERCE":       return "E-COMMERCE";
    case "DATABASE":        return "DATABASE";
    case "OBJECT_STORAGE":  return "OBJECT STORAGE";
    case "IDENTITY":        return "IDENTITY";
    case "MARKETING":       return "MARKETING";
    case "COMMS":           return "COMMS";
    case "ANALYTICS":       return "ANALYTICS";
    case "MARKETPLACE":     return "MARKETPLACE";
    case "LOGISTICS":       return "LOGISTICS";
    case "HR":              return "HR";
    case "COLLABORATION":   return "COLLABORATION";
    case "DATA_WAREHOUSE":  return "DATA WAREHOUSE";
    case "STORAGE_DOC":     return "STORAGE";
    default:                return String(c);
  }
}

function authLabel(a: ConnectorDefinitionVM["authType"]): string {
  switch (a) {
    case "OAUTH2":            return "OAuth 2.0";
    case "API_KEY":           return "API key";
    case "CONNECTION_STRING": return "Connection string";
    case "AWS_IAM":           return "AWS IAM";
  }
}

function statusPill(status: string) {
  switch (status) {
    case "CONNECTED": return { label: "Connected", cls: "pill-active" };
    case "PENDING_AUTH": return { label: "Pending auth", cls: "pill-review" };
    case "REFRESHING": return { label: "Refreshing", cls: "pill-review" };
    case "REVOKED": return { label: "Revoked", cls: "pill-closed" };
    case "ERROR": return { label: "Error", cls: "pill-error" };
    default: return { label: status, cls: "pill-active" };
  }
}

function eventLabel(eventType: string) {
  switch (eventType) {
    case "DISCOVERY_COMPLETED": return "Discovery completed";
    case "GRIEVANCE_INGESTED": return "Grievance ticket ingested";
    case "DSR_EXPORT_COMPLETED": return "Access export completed";
    case "DSR_ERASURE_COMPLETED": return "Erasure completed";
    case "DSR_ERASURE_DENIED": return "Erasure denied (legal basis)";
    case "WEBHOOK_RECEIVED": return "Webhook received";
    case "TOKEN_REFRESHED": return "Connection authenticated";
    case "CONNECTION_REVOKED": return "Connection revoked";
    default: return eventType;
  }
}

export async function ConnectorsView({ data }: { data: WorkspaceResponse }) {
  const { workspace } = data;
  // The runtime augments the workspace with `connections` + `connectorEvents`,
  // but the published WorkspaceResponse type may not yet expose them on
  // older clients. Read defensively.
  let connections = ((workspace as any).connections || []) as any[];
  let events = ((workspace as any).connectorEvents || []) as any[];

  // Fetch the live catalogue from the worker so adding a new connector to the
  // worker doesn't require a web redeploy. Falls back to the local CATALOGUE
  // (legacy 8) if the worker call fails for any reason.
  let liveCatalogue: ConnectorDefinitionVM[] = CATALOGUE;
  try {
    const token = await getSessionToken();
    const bootstrap = await getConnectorBootstrap(workspace.tenant.slug, token);
    if (Array.isArray(bootstrap.catalogue) && bootstrap.catalogue.length > 0) {
      liveCatalogue = bootstrap.catalogue.map((c) => ({
        id: c.id as ConnectorType,
        name: c.name,
        vendor: c.vendor,
        category: c.category as ConnectorDefinitionVM["category"],
        authType: c.authType as ConnectorDefinitionVM["authType"],
        capabilities: c.capabilities,
        dpdpNotes: c.dpdpNotes,
        brand: c.brand,
      }));
    }
    // Prefer fresh worker-side connections + events.
    connections = bootstrap.connections;
    events = bootstrap.events;
  } catch {
    // Keep defaults — page renders with the legacy local CATALOGUE.
  }

  return (
    <>
      {/* ── 1. Catalogue ──────────────────────────────────────────── */}
      <section className="worksheet">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Catalogue</span>
            <h3>Available connectors</h3>
            <p className="module-subtitle">
              {liveCatalogue.length} integrations covering the systems where Indian SMB customers' personal data
              actually lives — payments, CRM, helpdesk, e-commerce, application databases, and object storage.
              Each connector auto-creates a Vendor (Processor) entry with DPA stub on connect.
            </p>
          </div>
        </div>

        <div className="connector-grid">
          {liveCatalogue.map((def) => {
            const connected = connections.filter((c) => c.connectorType === def.id && c.status === "CONNECTED");
            return (
              <article key={def.id} className="connector-card">
                <header className="connector-card-head">
                  <span
                    className="connector-mark"
                    style={{ background: def.brand.accentColor }}
                  >
                    {def.brand.logoText}
                  </span>
                  <div>
                    <strong>{def.name}</strong>
                    <span className="connector-vendor">
                      {def.vendor} · {categoryLabel(def.category)} · {authLabel(def.authType)}
                    </span>
                  </div>
                  <span className="pill-active">
                    {connected.length} connected
                  </span>
                </header>

                <ul className="connector-caps">
                  {def.capabilities.discovery && <li>Auto-discovery</li>}
                  {def.capabilities.dsrAccess && <li>Access (export)</li>}
                  {def.capabilities.dsrErasure && <li>Erasure</li>}
                  {def.capabilities.dsrCorrection && <li>Correction</li>}
                  {def.capabilities.grievanceIngest && <li>Grievance intake</li>}
                  {def.capabilities.webhooks && <li>Webhooks</li>}
                  {def.capabilities.purgeProof && <li>Purge proof</li>}
                </ul>

                <div className="connector-dpdp">
                  {def.dpdpNotes.legalBasisFloor && (
                    <p>
                      <strong>Legal basis:</strong> {def.dpdpNotes.legalBasisFloor}
                    </p>
                  )}
                  {def.dpdpNotes.dataResidency && (
                    <p>
                      <strong>Residency:</strong> {def.dpdpNotes.dataResidency}
                    </p>
                  )}
                  {def.dpdpNotes.indianFootprint && (
                    <p>
                      <strong>India footprint:</strong> {def.dpdpNotes.indianFootprint}
                    </p>
                  )}
                </div>

                {def.authType === "OAUTH2" ? (
                  <form
                    className="connector-form"
                    action={startOAuthConnectorAction.bind(null, workspace.tenant.slug, def.id as ConnectorType)}
                  >
                    <button type="submit" className="primary-button">
                      Connect via OAuth
                    </button>
                  </form>
                ) : (
                  <form
                    className="connector-form"
                    action={connectApiKeyConnectorAction.bind(null, workspace.tenant.slug, def.id as ConnectorType)}
                  >
                    {/* Per-connector fields */}
                    {def.id === "FRESHDESK" && (
                      <input name="domain" placeholder="acme  (.freshdesk.com)" required />
                    )}
                    {def.id === "RAZORPAY" && (
                      <input name="apiKeyId" placeholder="rzp_live_XXXXXXXXXXXX (key id)" required />
                    )}
                    {def.id === "ZOHO_CRM" && (
                      <input name="domain" placeholder="zohoapis.in  (DC: in / com / eu / au)" required />
                    )}
                    {def.id === "SHOPIFY" && (
                      <input name="domain" placeholder="acme  (.myshopify.com)" required />
                    )}
                    {def.id === "AWS_S3" && (
                      <>
                        <input name="apiKeyId" placeholder="AKIAXXXXXXXXXXXXXXXX (access key id)" required />
                        <input name="region" placeholder="ap-south-1  (Mumbai) / ap-south-2 (Hyderabad)" required />
                        <input name="bucket" placeholder="acme-prod-uploads (bucket)" required />
                      </>
                    )}
                    {(def.id === "POSTGRES" || def.id === "MONGODB") && (
                      <input
                        name="schemaScope"
                        placeholder={def.id === "POSTGRES" ? "schema scope (default: public)" : "database name (default: app)"}
                      />
                    )}

                    {/* Secret field — semantics differ per connector */}
                    <input
                      name="apiKey"
                      type="password"
                      placeholder={
                        def.id === "RAZORPAY"   ? "Key secret"
                      : def.id === "ZOHO_CRM"   ? "Self-Client refresh token"
                      : def.id === "SHOPIFY"    ? "Admin API access token (shpat_…)"
                      : def.id === "AWS_S3"     ? "AWS secret access key"
                      : def.id === "POSTGRES"   ? "postgres://user:pass@host:5432/db?ssl=true"
                      : def.id === "MONGODB"    ? "mongodb+srv://user:pass@cluster0.xxx.mongodb.net/app"
                      : "API key"
                      }
                      required
                    />

                    {/* Webhook secret only where webhooks are supported */}
                    {def.capabilities.webhooks && (
                      <input
                        name="webhookSecret"
                        placeholder="Webhook signing secret (16+ chars, optional)"
                      />
                    )}

                    <input
                      name="displayName"
                      placeholder={`${def.name} — production`}
                    />
                    <button type="submit" className="primary-button">
                      Connect
                    </button>
                  </form>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {/* ── 2. Active connections ─────────────────────────────────── */}
      <section className="worksheet">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Active connections</span>
            <h3>Connected systems and last activity</h3>
          </div>
        </div>

        {connections.length === 0 ? (
          <p className="empty-state">
            No connectors yet. Connect Razorpay, HubSpot, Freshdesk, Zoho, Shopify, Postgres, MongoDB, or AWS S3
            above to auto-discover PII and unlock DSR execution from inside Prooflyt.
          </p>
        ) : (
          <div className="ruled-table">
            <div className="ruled-head">
              <span>Connection</span>
              <span>Status</span>
              <span>Records discovered</span>
              <span>Last activity</span>
              <span>Actions</span>
            </div>
            {connections.map((c) => {
              const pill = statusPill(c.status);
              return (
                <div key={c.id} className="ruled-row">
                  <div>
                    <strong>{c.displayName}</strong>
                    <span>
                      {c.connectorType}
                      {c.connectorType === "FRESHDESK" && c.workspaceDomain ? ` · ${c.workspaceDomain}.freshdesk.com` : ""}
                      {c.connectorType === "SHOPIFY"   && c.workspaceDomain ? ` · ${c.workspaceDomain}.myshopify.com` : ""}
                      {c.connectorType === "ZOHO_CRM"  && c.workspaceDomain ? ` · ${c.workspaceDomain}` : ""}
                      {c.connectorType === "AWS_S3"    && c.bucketName ? ` · s3://${c.bucketName}${c.region ? ` (${c.region})` : ""}` : ""}
                      {(c.connectorType === "POSTGRES" || c.connectorType === "MONGODB") && c.accountIdentifier ? ` · ${c.accountIdentifier}` : ""}
                      {c.connectorType === "RAZORPAY"  && c.accountIdentifier ? ` · ${c.accountIdentifier}` : ""}
                      {c.connectorType === "AWS_S3"    && c.accountIdentifier ? ` · ${c.accountIdentifier}` : ""}
                    </span>
                  </div>
                  <span className={pill.cls}>{pill.label}</span>
                  <span>
                    {(c.recordsDiscovered ?? 0).toLocaleString("en-IN")}{" "}
                    {c.recordsDiscovered ? "records" : ""}
                  </span>
                  <span>
                    {c.lastDsrAt
                      ? `DSR ${new Date(c.lastDsrAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`
                      : c.lastDiscoveryAt
                      ? `Discovery ${new Date(c.lastDiscoveryAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`
                      : "—"}
                  </span>
                  <div className="connector-row-actions">
                    <form
                      action={runConnectorDiscoveryAction.bind(
                        null,
                        workspace.tenant.slug,
                        c.id,
                      )}
                    >
                      <button type="submit" className="text-button">
                        Run discovery
                      </button>
                    </form>
                    <details className="connector-dsr-details">
                      <summary className="text-button">DSR</summary>
                      <form
                        className="connector-form-inline"
                        action={runConnectorDsrAction.bind(
                          null,
                          workspace.tenant.slug,
                          c.id,
                        )}
                      >
                        <select name="rightsCaseId" required>
                          <option value="">Pick a rights case</option>
                          {workspace.rightsCases.map((rc) => (
                            <option key={rc.id} value={rc.id}>
                              {rc.id} — {rc.type} — {rc.requestor}
                            </option>
                          ))}
                        </select>
                        <select name="action" defaultValue="EXPORT">
                          <option value="EXPORT">Access (export)</option>
                          <option value="ERASE">Erasure</option>
                        </select>
                        <input
                          name="subjectIdentifier"
                          placeholder="email or phone"
                          required
                        />
                        <button type="submit" className="primary-button">
                          Execute
                        </button>
                      </form>
                    </details>
                    <form
                      action={revokeConnectorAction.bind(
                        null,
                        workspace.tenant.slug,
                        c.id,
                      )}
                    >
                      <button type="submit" className="text-button">
                        Revoke
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── 3. Connector events ───────────────────────────────────── */}
      <section className="worksheet">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Activity</span>
            <h3>Connector event log</h3>
            <p className="module-subtitle">
              Discovery runs, DSR fulfilment, grievance ingestion, and legal-basis denials are pinned here in
              chronological order. Each event is linked to its evidence artifact.
            </p>
          </div>
        </div>

        {events.length === 0 ? (
          <p className="empty-state">No connector activity yet.</p>
        ) : (
          <div className="ruled-table">
            <div className="ruled-head">
              <span>Event</span>
              <span>Connector</span>
              <span>Linked record</span>
              <span>When</span>
            </div>
            {events.slice(0, 25).map((ev) => (
              <div key={ev.id} className="ruled-row">
                <div>
                  <strong>{eventLabel(ev.eventType)}</strong>
                  <span>{ev.summary}</span>
                </div>
                <span>{ev.connectorType}</span>
                <span>
                  {ev.linkedRightsId || ev.linkedDeletionId || ev.linkedEvidenceId || ev.externalId || "—"}
                </span>
                <span>
                  {new Date(ev.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
