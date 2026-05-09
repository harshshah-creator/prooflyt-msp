/**
 *  Notice Rule-3 analyzer trigger.
 *
 *  Renders a small "Analyze against Rule 3" button next to a notice that
 *  POSTs to the worker. The result is shown in a sibling expandable
 *  block when the page is reloaded with ?rule3=<noticeId>.
 */

import { analyzeNoticeAction } from "../../app/workspace/admin-actions";

export interface Rule3ResultProps {
  totalItems: number;
  coverageScore: number;
  appearsDpdpAware: boolean;
  presentItems: Array<{ id: string; label: string; citation: string }>;
  missingItems: Array<{ id: string; label: string; citation: string; draftTemplate: string }>;
  drafts?: { provider: "groq" | "template"; draft: string };
}

export function NoticeRule3Trigger({
  tenantSlug,
  noticeId,
  active,
  result,
}: {
  tenantSlug: string;
  noticeId: string;
  active: boolean;
  result?: Rule3ResultProps;
}) {
  return (
    <div style={{ marginTop: "0.5rem" }}>
      <form action={analyzeNoticeAction.bind(null, tenantSlug, noticeId)}>
        <button type="submit" className="ghost-button" style={{ fontSize: "0.78rem", padding: "0.35rem 0.7rem" }}>
          Analyze against Rule 3
        </button>
      </form>

      {active && result && (
        <div
          style={{
            marginTop: "0.6rem", border: "1px solid var(--border)", borderRadius: 8,
            background: "var(--surface-1)", padding: "0.75rem 1rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
            <strong style={{ fontSize: "1.05rem", color: "var(--ink)" }}>
              Coverage {result.coverageScore}%
            </strong>
            <span style={{ fontSize: "0.74rem", color: "var(--ink-3)" }}>
              {result.presentItems.length}/{result.totalItems} Rule-3 items present
            </span>
            {result.appearsDpdpAware ? (
              <span style={{ fontSize: "0.7rem", color: "#3d6b3a", fontWeight: 600 }}>· DPDP-aware</span>
            ) : (
              <span style={{ fontSize: "0.7rem", color: "#7d1818", fontWeight: 600 }}>· Looks like a GDPR copy-paste</span>
            )}
          </div>

          {result.missingItems.length > 0 && (
            <div>
              <div style={{ fontSize: "0.78rem", color: "var(--ink-2)", marginBottom: "0.3rem", fontWeight: 600 }}>
                Missing items ({result.missingItems.length}):
              </div>
              <ul style={{ listStyle: "disc", paddingLeft: "1.2rem", margin: 0, fontSize: "0.78rem", color: "var(--ink-2)" }}>
                {result.missingItems.map((m) => (
                  <li key={m.id}>
                    {m.label} <span style={{ color: "var(--ink-4)" }}>({m.citation})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.drafts && result.missingItems.length > 0 && (
            <details style={{ marginTop: "0.6rem" }}>
              <summary style={{ cursor: "pointer", fontSize: "0.78rem", color: "var(--ink-2)", fontWeight: 600 }}>
                Suggested draft (provider: {result.drafts.provider})
              </summary>
              <pre
                style={{
                  fontSize: "0.74rem", whiteSpace: "pre-wrap",
                  padding: "0.6rem", borderRadius: 6, background: "rgba(0,0,0,0.04)",
                  marginTop: "0.4rem",
                }}
              >
                {result.drafts.draft}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
