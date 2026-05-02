import { acknowledgeNoticeAction } from "./actions";
import { getPublicNotice } from "../../../../lib/api";
import { messagesFor, normaliseLocale } from "../../../../lib/i18n";
import { LocaleSwitcher } from "../../../../components/locale-switcher";

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

  return (
    <main className="public-stage" lang={locale}>
      <section className="public-sheet">
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
          <button type="submit" className="primary-button">
            {t.noticeAckButton}
          </button>
        </form>
        <p className="public-footnote">{t.legalNoticeFooter}</p>
        <p className="public-footnote public-footnote--muted">{t.poweredByProoflyt}</p>
      </section>
    </main>
  );
}
