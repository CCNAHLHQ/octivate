import fs from "fs";
import path from "path";
import { createHash, randomBytes } from "crypto";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SESS_FILE = path.join(ROOT, "data", "local", "auth-sessions.json");
const OUT = path.join(ROOT, "data", "local", "octivate-evidence-session.json");
const users = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "local", "users.json"), "utf8"));
const she = users.find((u) => u.username === "shemuel");
if (!she) throw new Error("shemuel_missing");

function readSessions() {
  try {
    return JSON.parse(fs.readFileSync(SESS_FILE, "utf8"));
  } catch {
    return [];
  }
}

function writeSessions(sessions) {
  const tmp = `${SESS_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(sessions, null, 2));
  fs.renameSync(tmp, SESS_FILE);
}

/** Append session with retry so concurrent createSession writes cannot drop us. */
function mint() {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("base64url");
  const now = Date.now();
  const session = {
    id: `sess_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`,
    userId: she.id,
    tokenHash,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };

  for (let attempt = 0; attempt < 8; attempt++) {
    const sessions = readSessions().filter((s) => new Date(s.expiresAt).getTime() > Date.now());
    if (!sessions.some((s) => s.tokenHash === tokenHash)) sessions.push(session);
    writeSessions(sessions);
    const verify = readSessions();
    if (verify.some((s) => s.tokenHash === tokenHash)) {
      fs.writeFileSync(
        OUT,
        JSON.stringify(
          {
            token,
            sessionId: session.id,
            userId: she.id,
            cookieName: "octivate_session",
            expCookieName: "octivate_session_exp",
            expiresAt: session.expiresAt,
          },
          null,
          2
        )
      );
      return { token, session };
    }
  }
  throw new Error("mint_race_unresolved");
}

const result = mint();
console.log(
  JSON.stringify({ ok: true, userId: she.id, sessionId: result.session.id, expiresAt: result.session.expiresAt })
);
