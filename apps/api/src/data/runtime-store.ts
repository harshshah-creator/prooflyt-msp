import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createSeedState, type AppState } from "./seed.js";

const currentDir = dirname(fileURLToPath(import.meta.url));
const runtimeRoot = resolve(currentDir, "../../.runtime");
const stateFile = resolve(runtimeRoot, "state.json");
const evidenceRoot = resolve(runtimeRoot, "evidence");

function ensureDir(path: string) {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

export class RuntimeStore {
  private readonly statePath = process.env.PROOFLYT_STATE_FILE || stateFile;
  private readonly evidencePath = process.env.PROOFLYT_EVIDENCE_DIR || evidenceRoot;
  private state: AppState;

  constructor() {
    ensureDir(dirname(this.statePath));
    ensureDir(this.evidencePath);

    if (!existsSync(this.statePath)) {
      // Demo passwords come from env; never hardcoded.
      this.state = createSeedState({
        demoPassword: process.env.DEMO_PASSWORD,
        opsPassword: process.env.OPS_PASSWORD,
      });
      this.save(this.state);
      return;
    }

    this.state = JSON.parse(readFileSync(this.statePath, "utf8")) as AppState;
  }

  getState() {
    return this.state;
  }

  save(nextState: AppState) {
    this.state = nextState;
    writeFileSync(this.statePath, JSON.stringify(nextState, null, 2), "utf8");
  }

  getEvidenceRoot() {
    ensureDir(this.evidencePath);
    return this.evidencePath;
  }
}
