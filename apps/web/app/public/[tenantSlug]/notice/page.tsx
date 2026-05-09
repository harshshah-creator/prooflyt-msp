import { acknowledgeNoticeAction } from "./actions";
import { getPublicNotice } from "../../../../lib/api";
import { brandStageStyle, safeBrand } from "../../../../lib/tenant-brand";
import { TenantBrandHeader } from "../../../../components/tenant-brand-header";

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
  const brand = safeBrand(data.tenant?.publicBrand);

  return (
    <main className="public-stage public-stage--branded" style={brandStageStyle(brand)}>
      <section className="public-sheet">
        <TenantBrandHeader
          brand={brand}
          tenantName={data.tenant?.name || "Privacy notice"}
          subtitle="DPDP §5 — Data principal notice"
        />
        <span className="section-kicker">Published notice</span>
        <h1>{data.notice?.title || "No published notice"}</h1>
        <p>{data.notice?.content || "A published notice has not yet been released for this organisation."}</p>
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
          <button type="submit" className="primary-button primary-button--branded">
            Acknowledge notice
          </button>
        </form>
        <p className="public-footnote public-footnote--muted">Powered by Prooflyt — DPDP Compliance OS</p>
      </section>
    </main>
  );
}
