/**
 * Seed founder operator accounts (Shemuel, Jaden).
 * Usage: node --env-file=.env scripts/seed-founders.mjs
 * Prints credentials once to stdout — do not commit the output.
 */
import { createRequire } from "module";
import { createHash, randomBytes, scryptSync } from "crypto";
import { promises as fs } from "fs";
import path from "path";

const DATA = path.join(process.cwd(), "data", "local");
const USERS_FILE = path.join(DATA, "users.json");
const CREDS_FILE = path.join(DATA, "founder-credentials.local.json");

const SCRYPT_OPTS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEYLEN = 64;

function generatePassword(bytes = 18) {
  return randomBytes(bytes).toString("base64url");
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, KEYLEN, SCRYPT_OPTS).toString("base64url");
  return { salt, hash };
}

function uid(prefix = "usr") {
  return `${prefix}_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
}

const FOUNDERS = [
  {
    id: "shemuel",
    name: "Shemuel",
    email: "shemuel@octivate.io",
    username: "shemuel",
  },
  {
    id: "jaden",
    name: "Jaden",
    email: "jaden@octivate.io",
    username: "jaden",
  },
];

async function supabaseCreate(email, password, displayName) {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // try list lookup
    const list = await fetch(`${url}/auth/v1/admin/users?page=1&per_page=200`, {
      headers: { Authorization: `Bearer ${key}`, apikey: key },
    });
    const listed = await list.json().catch(() => ({}));
    const hit = (listed.users || []).find(
      (u) => String(u.email || "").toLowerCase() === email.toLowerCase()
    );
    return hit?.id || null;
  }
  return data.id || data.user?.id || null;
}

async function main() {
  await fs.mkdir(DATA, { recursive: true });
  let users = [];
  try {
    users = JSON.parse(await fs.readFile(USERS_FILE, "utf8"));
  } catch {
    users = [];
  }

  const issued = [];

  for (const f of FOUNDERS) {
    const existing = users.find(
      (u) =>
        u.email?.toLowerCase() === f.email ||
        u.username?.toLowerCase() === f.username
    );
    const password = generatePassword();
    const { salt, hash } = hashPassword(password);
    const supabaseUserId = await supabaseCreate(f.email, password, f.name);

    if (existing) {
      existing.passwordSalt = salt;
      existing.passwordHash = hash;
      existing.role = "operator";
      existing.staffProfileId = f.id;
      existing.displayName = f.name;
      existing.email = f.email;
      existing.disabled = false;
      if (supabaseUserId) existing.supabaseUserId = supabaseUserId;
      issued.push({
        name: f.name,
        email: f.email,
        username: existing.username,
        password,
        role: "operator",
      });
    } else {
      const row = {
        id: uid("usr"),
        username: f.username,
        email: f.email,
        displayName: f.name,
        role: "operator",
        staffProfileId: f.id,
        supabaseUserId: supabaseUserId || undefined,
        passwordSalt: salt,
        passwordHash: hash,
        createdAt: new Date().toISOString(),
      };
      users.push(row);
      issued.push({
        name: f.name,
        email: f.email,
        username: f.username,
        password,
        role: "operator",
      });
    }
  }

  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
  await fs.writeFile(
    CREDS_FILE,
    JSON.stringify({ generatedAt: new Date().toISOString(), founders: issued }, null, 2),
    "utf8"
  );

  console.log("=== Octivate founder credentials (save now) ===");
  for (const c of issued) {
    console.log(`${c.name} <${c.email}> / ${c.username}  password: ${c.password}`);
  }
  console.log(`Also written to ${CREDS_FILE} (gitignored local file).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
