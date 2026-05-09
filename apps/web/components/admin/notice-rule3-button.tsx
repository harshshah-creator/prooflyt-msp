/**
 *  Notice Rule-3 analyzer trigger.
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
  tenantSlug, noticeId, active, result,
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
        <div className="rule3-result">
          <div className="rule3-summary">
            <strong className="rule3-coverage">Coverage {result.coverageScore}%</strong>
            <span className="rule3-meta">
              {result.presentItems.length}/{result.totalItems} Rule-3 items present
            </span>
            {result.appearsDpdpAware ? (
              <span className="rule3-flag-good">· DPDP-aware</span>
            ) : (
              <span className="rule3-flag-bad">· Looks like a GDPR copy-paste</span>
            )}
          </div>

          {result.missingItems.length > 0 && (
            <div>
              <div className="rule3-missing-label">
                Missing items ({result.missingItems.length}):
              </div>
              <ul className="rule3-missing-list">
                {result.missingItems.map((m) => (
                  <li key={m.id}>
                    {m.label} <small>({m.citation})</small>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.drafts && result.missingItems.length > 0 && (
            <details className="rule3-draft" style={{ marginTop: "0.6rem" }}>
              <summary style={{ cursor: "pointer", fontSize: "0.78rem", fontWeight: 600, color: "var(--ink-2)" }}>
                Suggested draft (provider: {result.drafts.provider})
              </summary>
              <pre>{result.drafts.draft}</pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
