/**
 *  LLM Residency panel — JVA Schedule 2 §S2.3 should-pass item:
 *    "Source Discovery: Self-hosted LLM configuration option present in
 *     admin settings (functional LLM connection not required; UI option
 *     and documentation required)."
 *
 *  Static admin surface that documents the three deployment modes and
 *  surfaces the tenant's current setting. Phase 1 ships the UI + docs;
 *  the actual self-hosted LLM bring-up is a deploy-time operation
 *  (Ollama / vLLM / Llama.cpp endpoint) wired via env vars at the
 *  worker tier — out of scope for the in-product UI.
 */

interface LlmResidencyPanelProps {
  /** Currently-configured mode, from env at worker boot. Optional;
   *  if unknown the UI shows "Managed (default)". */
  currentMode?: "MANAGED" | "SELF_HOSTED" | "AIR_GAPPED";
  /** When `currentMode === "SELF_HOSTED"`, this is the host the worker
   *  is talking to (e.g. "https://llm.internal.bgl.example"). */
  selfHostedEndpoint?: string;
}

export function LlmResidencyPanel({
  currentMode = "MANAGED",
  selfHostedEndpoint,
}: LlmResidencyPanelProps) {
  return (
    <section className="admin-panel worksheet llm-residency">
      <header className="admin-panel-header">
        <div>
          <h3>AI Smart Mapping — LLM residency</h3>
          <p>
            All three profiling modes (Header-Only / Masked-Sample / Ephemeral Full-Profile) are
            privacy-first: <strong>no raw PII ever leaves the worker</strong>. This panel controls
            which LLM endpoint receives the masked headers + samples.
          </p>
        </div>
      </header>

      <ol className="llm-mode-list">
        <li className={`llm-mode-row ${currentMode === "MANAGED" ? "is-active" : ""}`}>
          <div className="llm-mode-head">
            <strong>Managed (default)</strong>
            {currentMode === "MANAGED" && <span className="llm-mode-pill">Active</span>}
          </div>
          <p>
            Prooflyt's managed Groq endpoint (Llama 3.3 70B). Lowest latency, no infra
            commitment. Inputs limited to column headers + regex-masked samples per
            <code> apps/api-worker/src/pii-scanner.ts</code>.
          </p>
        </li>
        <li className={`llm-mode-row ${currentMode === "SELF_HOSTED" ? "is-active" : ""}`}>
          <div className="llm-mode-head">
            <strong>Self-hosted (VPC)</strong>
            {currentMode === "SELF_HOSTED" && <span className="llm-mode-pill">Active</span>}
          </div>
          <p>
            Point the worker at your own LLM endpoint (Ollama, vLLM, llama.cpp, or any
            OpenAI-compatible host) inside your VPC. Set <code>GROQ_API_KEY</code> to
            <code> ANY</code> and <code>GROQ_BASE_URL</code> to your endpoint URL. The
            classification request shape is unchanged.
          </p>
          {currentMode === "SELF_HOSTED" && selfHostedEndpoint && (
            <p className="llm-mode-meta">
              Current endpoint: <code>{selfHostedEndpoint}</code>
            </p>
          )}
        </li>
        <li className={`llm-mode-row ${currentMode === "AIR_GAPPED" ? "is-active" : ""}`}>
          <div className="llm-mode-head">
            <strong>Air-gapped (no LLM)</strong>
            {currentMode === "AIR_GAPPED" && <span className="llm-mode-pill">Active</span>}
          </div>
          <p>
            Disable LLM semantic classification entirely. The regex layer alone handles
            Aadhaar / PAN / GSTIN / phone / IFSC / email detection. Suitable for tenants
            who refuse any model inference. Unset <code>GROQ_API_KEY</code> at the worker
            tier to enable this mode.
          </p>
        </li>
      </ol>

      <p className="llm-mode-footer">
        Switching modes requires a worker redeploy. See the Admin Guide §3.4 (LLM
        residency) for the full env-var matrix and the agreed test harness.
      </p>
    </section>
  );
}
