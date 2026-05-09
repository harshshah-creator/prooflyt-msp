import { acknowledgeNoticeAction } from "./actions";
import { getPublicNotice } from "../../../../lib/api";
import { messagesFor, normaliseLocale } from "../../../../lib/i18n";
import { LocaleSwitcher } from "../../../../components/locale-switcher";
import { brandStageStyle, safeBrand } from "../../../../lib/tenant-brand";
import { TenantBrandHeader } from "../../../../components/tenant-brand-header";

export default async function PublicNoticePage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ ack?: string; error?: string; lang?: string }>;
}) {
  const { tenantSlug } = await params;
  const query = await searchParams;
  const locale = normaliseLocale(query.lang);
  const t = messagesFor(locale);
  const data = await getPublicNotice(tenantSlug);
  const brand = safeBrand(data.tenant?.publicBrand);

  return (
    <main
      className="public-stage public-stage--branded"
      style={brandStageStyle(brand)}
      lang={locale}
    >
      <section className="public-sheet">
        <TenantBrandHeader
          brand={brand}
          tenantName={data.tenant?.name || t.noticeNoPublished}
          subtitle="DPDP §5 — Data principal notice"
        />
        <LocaleSwitcher
          basePath={`/public/${tenantSlug}/notice`}
          current={locale}
          label={t.selectLanguage}
          searchParams={query}
        />
        <span className="section-kicker">{t.noticeKicker}</span>
        <h1>{data.notice?.title || t.noticeNoPublished}</h1>
        <p>{data.notice?.content || t.noticeNoPublishedBody}</p>
        <div className="public-stats">
          <div>
            <strong>{data.notice?.version || "-"}</strong>
            <span>{t.noticeVersion}</span>
          </div>
          <div>
            <strong>{data.notice?.acknowledgements || 0}</strong>
            <span>{t.noticeAcknowledgements}</span>
          </div>
        </div>
        {query.ack && <p className="form-status success">{t.noticeAckSuccess}</p>}
        {query.error && <p className="form-status error">{t.noticeAckError}</p>}
        <form action={acknowledgeNoticeAction.bind(null, tenantSlug, locale)}>
          <button type="submit" className="primary-button primary-button--branded">
            {t.noticeAckButton}
          </button>
        </form>
        <p className="public-footnote">{t.legalNoticeFooter}</p>
        <p className="public-footnote public-footnote--muted">{t.poweredByProoflyt}</p>
      </section>
    </main>
  );
}
