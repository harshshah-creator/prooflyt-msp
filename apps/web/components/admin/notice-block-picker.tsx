/**
 *  Notice block picker — server component rendered on the Notices module.
 *
 *  This is the "template-driven editor" per §S1.4 Module 5 / §A7.4.
 *  Operator picks blocks from the catalogue; the picker emits a form that
 *  drops the rendered content into the notice body field via a server
 *  action. Mandatory blocks are surfaced with a "Required by DPDP" badge
 *  so the operator can't ship a notice missing them without explicit
 *  override.
 *
 *  We intentionally avoid client-side state / drag-and-drop libraries.
 *  Notices are low-frequency artefacts; a clean stacked picker beats a
 *  fragile drag canvas on a CMS-grade surface.
 */

import { NOTICE_BLOCK_TEMPLATES } from "./notice-block-templates";
import { applyNoticeBlocksAction } from "../../app/workspace/admin-actions";

export function NoticeBlockPicker({
  tenantSlug,
  noticeId,
}: {
  tenantSlug: string;
  noticeId: string;
}) {
  return (
    <details className="notice-block-picker">
      <summary>Insert DPDP-compliant blocks</summary>
      <p className="notice-block-help">
        Pick the blocks your notice needs. Selected blocks are appended to the notice content with
        proper DPDP citations. Mandatory blocks are required for Rule 3 coverage; the analyzer
        will flag any missing.
      </p>
      <form action={applyNoticeBlocksAction.bind(null, tenantSlug, noticeId)} className="notice-block-form">
        <ul className="notice-block-list">
          {NOTICE_BLOCK_TEMPLATES.map((b) => (
            <li key={b.id} className="notice-block-row">
              <label>
                <input type="checkbox" name="blocks" value={b.id} />
                <span className="notice-block-label">
                  <strong>{b.label}</strong>
                  {b.mandatory && <span className="notice-block-mandatory">Required by DPDP</span>}
                </span>
                <span className="notice-block-citation">{b.citation}</span>
              </label>
            </li>
          ))}
        </ul>
        <button type="submit" className="primary-button">Append selected blocks</button>
      </form>
    </details>
  );
}
