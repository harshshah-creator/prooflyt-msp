import { submitPublicRightAction } from "./actions";
import { getPublicRights } from "../../../../lib/api";
import { messagesFor, normaliseLocale } from "../../../../lib/i18n";
import { LocaleSwitcher } from "../../../../components/locale-switcher";
import { brandStageStyle, safeBrand } from "../../../../lib/tenant-brand";
import { TenantBrandHeader } from "../../../../components/tenant-brand-header";

export default async function PublicRightsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ submitted?: string; error?: string; lang?: string }>;
}) {
  const { tenantSlug } = await params;
  const query = await searchParams;
  const locale = normaliseLocale(query.lang);
  const t = messagesFor(locale);
  const data = await getPublicRights(tenantSlug);
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
          tenantName={data.tenant.name}
          subtitle="DPDP §13–§15 — Data principal rights"
        />
        <LocaleSwitcher
          basePath={`/public/${tenantSlug}/rights`}
          current={locale}
          label={t.selectLanguage}
          searchParams={query}
        />
        <span className="section-kicker">{t.rightsKicker}</span>
        <p>{data.tenant.operationalStory}</p>
        <div className="public-stats">
          <div>
            <strong>{data.queueSummary.openRights}</strong>
            <span>{t.rightsOpenCases}</span>
          </div>
          <div>
            <strong>{data.queueSummary.overdueDeletions}</strong>
            <span>{t.rightsDeletionQueue}</span>
          </div>
        </div>
        {query.submitted && (
          <p className="form-status success">
            {t.rightsSubmittedPrefix} {query.submitted}
          </p>
        )}
        {query.error && <p className="form-status error">{t.rightsErrorBody}</p>}
        <form className="public-form" action={submitPublicRightAction.bind(null, tenantSlug, locale)}>
          <label>
            {t.rightsLabelName}
            <input name="name" placeholder={t.rightsPlaceholderName} />
          </label>
          <label>
            {t.rightsLabelEmail}
            <input name="email" type="email" placeholder={t.rightsPlaceholderEmail} />
          </label>
          <label>
            {t.rightsLabelType}
            <select name="type" defaultValue="DELETION">
              <option value="ACCESS">{t.typeAccess}</option>
              <option value="CORRECTION">{t.typeCorrection}</option>
              <option value="DELETION">{t.typeDeletion}</option>
              <option value="PORTABILITY">{t.typePortability}</option>
              <option value="GRIEVANCE">{t.typeGrievance}</option>
              <option value="WITHDRAWAL">{t.typeWithdrawal}</option>
            </select>
          </label>
          <label>
            {t.rightsLabelMessage}
            <textarea name="message" placeholder={t.rightsPlaceholderMessage} />
          </label>
          <button type="submit" className="primary-button primary-button--branded">
            {t.rightsSubmit}
          </button>
        </form>
        <p className="public-footnote">{t.legalRightsFooter}</p>
        <p className="public-footnote public-footnote--muted">{t.poweredByProoflyt}</p>
      </section>
    </main>
  );
}
