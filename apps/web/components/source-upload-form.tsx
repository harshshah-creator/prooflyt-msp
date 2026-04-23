import { uploadSourceAction } from "../app/workspace/actions";

export function SourceUploadForm({ tenantSlug }: { tenantSlug: string }) {
  return (
    <form className="task-form" action={uploadSourceAction.bind(null, tenantSlug)}>
      <div className="task-form-grid">
        <label>
          Upload source file
          <input name="file" type="file" accept=".csv,.xls,.xlsx" required />
        </label>
        <label>
          Profiling mode
          <select name="mode" defaultValue="MASKED_SAMPLE">
            <option value="HEADER_ONLY">Header only</option>
            <option value="MASKED_SAMPLE">Masked sample</option>
            <option value="EPHEMERAL_FULL">Ephemeral full</option>
          </select>
        </label>
      </div>
      <button type="submit" className="primary-button">
        Profile and queue for review
      </button>
    </form>
  );
}
