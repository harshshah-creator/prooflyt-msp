import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const apiBase = process.env.PROOFLYT_VERIFY_API || "http://127.0.0.1:4010/api";
const webBase = process.env.PROOFLYT_VERIFY_WEB || "http://127.0.0.1:3002";
const tenantSlug = process.env.PROOFLYT_VERIFY_TENANT || "bombay-grooming-labs";
const mutate = process.env.PROOFLYT_VERIFY_MUTATING === "1";

function ensure(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function curlText(url, options = {}) {
  const args = ["-sS", "-X", options.method || "GET"];
  for (const [key, value] of Object.entries(options.headers || {})) {
    args.push("-H", `${key}: ${value}`);
  }
  if (options.body) {
    args.push("--data", options.body);
  }
  args.push("-w", "\n%{http_code}", url);

  const output = execFileSync("curl", args, { encoding: "utf8" });
  const splitAt = output.lastIndexOf("\n");
  const body = output.slice(0, splitAt);
  const status = Number(output.slice(splitAt + 1));

  if (status < 200 || status >= 300) {
    throw new Error(`${url} failed with ${status}: ${body}`);
  }

  return body;
}

function curlJson(path, options = {}) {
  const body = curlText(`${apiBase}${path}`, options);
  return body ? JSON.parse(body) : null;
}

function page(url, cookie) {
  return curlText(url, {
    headers: cookie ? { Cookie: cookie } : {},
  });
}

function download(path, token) {
  const tmpRoot = mkdtempSync(join(tmpdir(), "prooflyt-pack-"));
  const filePath = join(tmpRoot, "bundle.bin");

  const args = ["-sS", "-L", "-o", filePath, "-w", "%{http_code}|%{content_type}|%{size_download}"];
  if (token) {
    args.push("-H", `Authorization: Bearer ${token}`);
  }
  args.push(`${apiBase}${path}`);

  const meta = execFileSync("curl", args, { encoding: "utf8" }).trim();
  const [statusText, contentType, sizeText] = meta.split("|");
  const status = Number(statusText);

  if (status < 200 || status >= 300) {
    rmSync(tmpRoot, { recursive: true, force: true });
    throw new Error(`${path} failed with ${status}`);
  }

  const size = Number(sizeText);
  const buffer = readFileSync(filePath);
  rmSync(tmpRoot, { recursive: true, force: true });

  ensure(buffer.length === size || Math.abs(buffer.length - size) < 8, `${path} size mismatch during download`);
  return { contentType, size: buffer.length };
}

function login(email, password) {
  const payload = curlJson("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return payload.session.token;
}

function postJson(path, token, payload) {
  return curlJson(path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

function main() {
  const health = curlJson("/health");
  ensure(health.ok === true, "health check did not return ok");

  const tenantToken = login("arjun@bombaygrooming.com", "ProoflytDemo!2026");
  const adminToken = login("ops@prooflyt.com", "ProoflytOps!2026");

  const adminBootstrap = curlJson("/admin/bootstrap", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  ensure(Array.isArray(adminBootstrap.tenants) && adminBootstrap.tenants.length > 0, "admin bootstrap returned no tenants");

  const workspace = curlJson(`/portal/${tenantSlug}/bootstrap`, {
    headers: { Authorization: `Bearer ${tenantToken}` },
  });
  ensure(workspace.workspace.tenant.slug === tenantSlug, "workspace bootstrap returned wrong tenant");
  ensure(Array.isArray(workspace.workspace.auditTrail), "workspace audit trail missing");

  const publicRights = curlJson(`/public/${tenantSlug}/rights`);
  ensure(publicRights.tenant.slug === tenantSlug, "public rights page returned wrong tenant");
  const publicNotice = curlJson(`/public/${tenantSlug}/notice`);
  ensure(publicNotice.tenant.slug === tenantSlug, "public notice page returned wrong tenant");

  const pack = download(`/portal/${tenantSlug}/export/compliance-pack`, tenantToken);
  ensure(pack.contentType.includes("zip"), "compliance pack was not a zip");

  const homeHtml = page(`${webBase}/`);
  ensure(homeHtml.includes("How the operating loop actually works"), "showcase workflow section missing");
  ensure(homeHtml.includes("Built as a real product system"), "showcase tech stack section missing");

  const setupHtml = page(`${webBase}/workspace/${tenantSlug}/setup`, `prooflyt_session=${tenantToken}`);
  ensure(setupHtml.includes("Create invite"), "setup invite flow not rendered");
  ensure(setupHtml.includes("Save profile"), "setup profile form not rendered");

  const adminHtml = page(`${webBase}/admin`, `prooflyt_session=${adminToken}`);
  ensure(adminHtml.includes("Open showcase"), "admin page missing showcase link");

  if (mutate) {
    const stamp = Date.now();
    const descriptor = `Phase 1 command desk ${stamp}`;
    const domain = `privacy-${stamp}.bombaygrooming.example`;

    const profile = postJson(`/portal/${tenantSlug}/setup/profile`, tenantToken, {
      descriptor,
      operationalStory: "Operational proof for privacy, deletion, incidents, and public transparency.",
      publicDomain: domain,
      primaryColor: "#0b4760",
      accentColor: "#1aa7c8",
    });
    ensure(profile.tenant.descriptor === descriptor, "setup profile update did not persist");

    const department = postJson(`/portal/${tenantSlug}/setup/departments`, tenantToken, {
      name: `Finance Controls ${stamp}`,
      ownerTitle: "Finance Controller",
      obligationFocus: "Vendor invoices and retention evidence",
    });
    ensure(department.department.name.includes(String(stamp)), "department create failed");

    const sourceSystem = postJson(`/portal/${tenantSlug}/setup/source-systems`, tenantToken, {
      name: `CleverTap ${stamp}`,
      systemType: "Engagement",
      owner: "Lifecycle Marketing",
      status: "PLANNED",
    });
    ensure(sourceSystem.sourceSystem.name.includes(String(stamp)), "source system create failed");

    const invite = postJson(`/portal/${tenantSlug}/setup/invite`, tenantToken, {
      email: `dept.owner.${stamp}@bombaygrooming.com`,
      role: "DEPARTMENT_OWNER",
      title: "Department Owner",
    });
    ensure(invite.invite.email.includes(String(stamp)), "invite create failed");

    const deactivate = postJson(`/admin/tenants/${tenantSlug}/status`, adminToken, { active: false });
    ensure(deactivate.tenant.active === false, "tenant deactivate failed");

    const activate = postJson(`/admin/tenants/${tenantSlug}/status`, adminToken, { active: true });
    ensure(activate.tenant.active === true, "tenant reactivate failed");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        apiBase,
        webBase,
        tenantSlug,
        mutate,
        checks: [
          "health",
          "auth",
          "admin bootstrap",
          "workspace bootstrap",
          "public rights",
          "public notice",
          "compliance pack download",
          "showcase route",
          "setup route",
          "admin route",
          ...(mutate ? ["setup mutations", "admin status toggle"] : []),
        ],
      },
      null,
      2,
    ),
  );
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
