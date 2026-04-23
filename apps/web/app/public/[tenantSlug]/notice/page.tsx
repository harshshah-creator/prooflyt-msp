import { acknowledgeNoticeAction } from "./actions";
import { getPublicNotice } from "../../../../lib/api";

export default async function PublicNoticePage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ ack?: string; error?: string }>;
}) {
  const { tenantSlug } = await params;
  const query = await searchParams;
  const data = await getPublicNotice(tenantSlug);

  return (
    <main className="public-stage">
      <section className="public-sheet">
        <span className="section-kicker">Published notice</span>
        <h1>{data.notice?.title || "No published notice"}</h1>
        <p>{data.notice?.content || "A published notice has not yet been released for this tenant."}</p>
        <div className="public-stats">
          <div>
            <strong>{data.notice?.version || "-"}</strong>
            <span>Version</span>
          </div>
          <div>
            <strong>{data.notice?.acknowledgements || 0}</strong>
            <span>Acknowledgements</span>
          </div>
        </div>
        {query.ack && <p className="form-status success">Acknowledgment recorded successfully.</p>}
        {query.error && <p className="form-status error">We could not record the acknowledgment. Please try again.</p>}
        <form action={acknowledgeNoticeAction.bind(null, tenantSlug)}>
          <button type="submit" className="primary-button">
            Acknowledge notice
          </button>
        </form>
      </section>
    </main>
  );
}
