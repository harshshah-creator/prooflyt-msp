import { submitPublicRightAction } from "./actions";
import { getPublicRights } from "../../../../lib/api";
import { brandStageStyle, safeBrand } from "../../../../lib/tenant-brand";
import { TenantBrandHeader } from "../../../../components/tenant-brand-header";

export default async function PublicRightsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ submitted?: string; error?: string }>;
}) {
  const { tenantSlug } = await params;
  const query = await searchParams;
  const data = await getPublicRights(tenantSlug);
  const brand = safeBrand(data.tenant?.publicBrand);

  return (
    <main className="public-stage public-stage--branded" style={brandStageStyle(brand)}>
      <section className="public-sheet">
        <TenantBrandHeader
          brand={brand}
          tenantName={data.tenant.name}
          subtitle="DPDP §13–§15 — Data principal rights"
        />
        <span className="section-kicker">Public rights intake</span>
        <h1>Submit a rights request</h1>
        <p>{data.tenant.operationalStory}</p>
        <div className="public-stats">
          <div>
            <strong>{data.queueSummary.openRights}</strong>
            <span>Open rights cases</span>
          </div>
          <div>
            <strong>{data.queueSummary.overdueDeletions}</strong>
            <span>Deletion tasks in queue</span>
          </div>
        </div>
        {query.submitted && <p className="form-status success">Request submitted successfully. Case ID: {query.submitted}</p>}
        {query.error && <p className="form-status error">We could not submit the request. Please review the form and try again.</p>}
        <form className="public-form" action={submitPublicRightAction.bind(null, tenantSlug)}>
          <label>
            Full name
            <input name="name" placeholder="Aadya Rao" />
          </label>
          <label>
            Email
            <input name="email" type="email" placeholder="aadya@example.com" />
          </label>
          <label>
            Request type
            <select name="type" defaultValue="DELETION">
              <option value="ACCESS">Access (§13)</option>
              <option value="CORRECTION">Correction (§14)</option>
              <option value="DELETION">Deletion (§14)</option>
              <option value="GRIEVANCE">Grievance (§15)</option>
              <option value="WITHDRAWAL">Consent withdrawal (§6)</option>
            </select>
          </label>
          <label>
            Request details
            <textarea name="message" placeholder="Describe the request and any supporting context." />
          </label>
          <button type="submit" className="primary-button primary-button--branded">
            Submit request
          </button>
        </form>
        <p className="public-footnote public-footnote--muted">Powered by Prooflyt — DPDP Compliance OS</p>
      </section>
    </main>
  );
}
