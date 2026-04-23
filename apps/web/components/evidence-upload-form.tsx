import { uploadEvidenceAction } from "../app/workspace/actions";

export function EvidenceUploadForm({ tenantSlug }: { tenantSlug: string }) {
  return (
    <form className="task-form" action={uploadEvidenceAction.bind(null, tenantSlug)}>
      <div className="task-form-grid">
        <label>
          Evidence file
          <input name="file" type="file" required />
        </label>
        <label>
          Linked record
          <input name="linkedRecord" placeholder="DEL-22 or INC-402" required />
        </label>
        <label>
          Classification
          <select name="classification" defaultValue="UPLOADED">
            <option value="UPLOADED">Uploaded</option>
            <option value="ATTESTATION">Attestation</option>
            <option value="SYSTEM_DERIVED">System derived</option>
          </select>
        </label>
        <label>
          Label
          <input name="label" placeholder="Processor purge confirmation" />
        </label>
      </div>
      <button type="submit" className="primary-button">
        Seal artifact
      </button>
    </form>
  );
}
