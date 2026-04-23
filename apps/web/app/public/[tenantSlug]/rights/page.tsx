import { submitPublicRightAction } from "./actions";
import { getPublicRights } from "../../../../lib/api";

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

  return (
    <main className="public-stage">
      <section className="public-sheet">
        <span className="section-kicker">Public rights intake</span>
        <h1>{data.tenant.name}</h1>
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
              <option value="ACCESS">ACCESS</option>
              <option value="CORRECTION">CORRECTION</option>
              <option value="DELETION">DELETION</option>
              <option value="GRIEVANCE">GRIEVANCE</option>
              <option value="WITHDRAWAL">WITHDRAWAL</option>
            </select>
          </label>
          <label>
            Request details
            <textarea name="message" placeholder="Describe the request and any supporting context." />
          </label>
          <button type="submit" className="primary-button">
            Submit request
          </button>
        </form>
      </section>
    </main>
  );
}
