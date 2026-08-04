/**
 * Supabase Management API client (PAT / sbp_ token).
 * @see https://supabase.com/docs/reference/api/introduction
 */

const MGMT = "https://api.supabase.com/v1";

function accessToken(): string {
  const t = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (!t) throw new Error("SUPABASE_ACCESS_TOKEN is not set");
  return t;
}

async function mgmt<T>(
  path: string,
  init?: RequestInit & { json?: unknown }
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken()}`,
    Accept: "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  let body = init?.body;
  if (init?.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.json);
  }
  const res = await fetch(`${MGMT}${path}`, { ...init, headers, body });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg =
      typeof data === "object" && data && "message" in data
        ? String((data as { message: unknown }).message)
        : text || res.statusText;
    throw new Error(`Supabase Management API ${res.status}: ${msg}`);
  }
  return data as T;
}

export type MgmtOrg = { id: string; name: string };
export type MgmtProject = {
  id: string;
  ref: string;
  name: string;
  organization_id: string;
  region?: string;
  status?: string;
};

export async function listOrganizations(): Promise<MgmtOrg[]> {
  return mgmt<MgmtOrg[]>("/organizations");
}

export async function listProjects(): Promise<MgmtProject[]> {
  return mgmt<MgmtProject[]>("/projects");
}

export async function getProjectApiKeys(ref: string): Promise<
  Array<{ name: string; api_key: string }>
> {
  return mgmt(`/projects/${ref}/api-keys`);
}

export async function createProject(input: {
  name: string;
  organization_id: string;
  region?: string;
  db_pass: string;
}): Promise<MgmtProject> {
  return mgmt<MgmtProject>("/projects", {
    method: "POST",
    json: {
      name: input.name,
      organization_id: input.organization_id,
      region: input.region || "us-east-1",
      db_pass: input.db_pass,
    },
  });
}

/** Resolve or create the octivate project and return ref + keys. */
export async function ensureOctivateProject(): Promise<{
  ref: string;
  url: string;
  anonKey: string;
  serviceRoleKey: string;
  created: boolean;
}> {
  const projects = await listProjects();
  let project =
    projects.find((p) => p.name.toLowerCase() === "octivate") ||
    projects.find((p) => p.ref.includes("octivate")) ||
    projects[0];
  let created = false;

  if (!project) {
    const orgs = await listOrganizations();
    if (!orgs.length) throw new Error("No Supabase organizations found for this PAT");
    const dbPass = `Oc${Date.now().toString(36)}!${Math.random().toString(36).slice(2, 10)}A1`;
    project = await createProject({
      name: "octivate",
      organization_id: orgs[0].id,
      region: "us-east-1",
      db_pass: dbPass,
    });
    created = true;
    // Wait briefly for project to become active
    await new Promise((r) => setTimeout(r, 8000));
  }

  const keys = await getProjectApiKeys(project.ref);
  const anon =
    keys.find((k) => k.name === "anon" || k.name === "anon key")?.api_key ||
    keys.find((k) => /anon/i.test(k.name))?.api_key;
  const service =
    keys.find((k) => k.name === "service_role" || k.name === "service_role key")?.api_key ||
    keys.find((k) => /service/i.test(k.name))?.api_key;

  if (!anon || !service) {
    throw new Error("Could not resolve anon/service_role keys from Management API");
  }

  return {
    ref: project.ref,
    url: `https://${project.ref}.supabase.co`,
    anonKey: anon,
    serviceRoleKey: service,
    created,
  };
}
