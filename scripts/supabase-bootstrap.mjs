/**
 * Bootstrap Supabase project keys via Management API and write into .env
 * Usage: node --env-file=.env scripts/supabase-bootstrap.mjs
 */
import { promises as fs } from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

// Dynamic import of TS-compiled path won't work; reimplement minimal fetch here.
const MGMT = "https://api.supabase.com/v1";

async function mgmt(pathname, init = {}) {
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (!token) throw new Error("SUPABASE_ACCESS_TOKEN missing");
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    ...(init.json ? { "Content-Type": "application/json" } : {}),
  };
  const res = await fetch(`${MGMT}${pathname}`, {
    method: init.method || "GET",
    headers,
    body: init.json ? JSON.stringify(init.json) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(`Management API ${res.status}: ${text}`);
  }
  return data;
}

function upsertEnv(raw, key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(raw)) return raw.replace(re, line);
  return `${raw.trimEnd()}\n${line}\n`;
}

async function main() {
  const root = process.cwd();
  const envPath = path.join(root, ".env");
  let envRaw = await fs.readFile(envPath, "utf8");

  const projects = await mgmt("/projects");
  let project =
    projects.find((p) => String(p.name).toLowerCase() === "octivate") ||
    projects[0];
  let created = false;

  if (!project) {
    const orgs = await mgmt("/organizations");
    if (!orgs?.length) throw new Error("No organizations on this Supabase account");
    const db_pass = `Oc${Date.now().toString(36)}!${Math.random().toString(36).slice(2, 10)}A1`;
    project = await mgmt("/projects", {
      method: "POST",
      json: {
        name: "octivate",
        organization_id: orgs[0].id,
        region: "us-east-1",
        db_pass,
      },
    });
    created = true;
    console.log("Created project octivate — waiting for provisioning…");
    await new Promise((r) => setTimeout(r, 12000));
  } else {
    console.log(`Using existing project: ${project.name} (${project.ref})`);
  }

  const keys = await mgmt(`/projects/${project.ref}/api-keys`);
  const anon = keys.find((k) => /anon/i.test(k.name))?.api_key;
  const service = keys.find((k) => /service/i.test(k.name))?.api_key;
  if (!anon || !service) throw new Error("Missing anon/service_role keys");

  const url = `https://${project.ref}.supabase.co`;
  envRaw = upsertEnv(envRaw, "SUPABASE_URL", url);
  envRaw = upsertEnv(envRaw, "SUPABASE_ANON_KEY", anon);
  envRaw = upsertEnv(envRaw, "SUPABASE_SERVICE_ROLE_KEY", service);
  envRaw = upsertEnv(envRaw, "SUPABASE_PROJECT_REF", project.ref);
  await fs.writeFile(envPath, envRaw, "utf8");

  console.log(
    JSON.stringify(
      {
        ok: true,
        created,
        ref: project.ref,
        url,
        keysWritten: true,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
