import fs from "fs";
import { createHash } from "crypto";

const sess = JSON.parse(fs.readFileSync("data/local/octivate-evidence-session.json", "utf8"));
const sessions = JSON.parse(fs.readFileSync("data/local/auth-sessions.json", "utf8"));
const h = createHash("sha256").update(sess.token).digest("base64url");
console.log("file_has_hash", sessions.some((s) => s.tokenHash === h), "sessions", sessions.length);

const cookie = `${sess.cookieName}=${sess.token}; octivate_session_exp=${sess.expiresAt}`;
for (const url of [
  "https://octivate.io/api/auth/me",
  "http://127.0.0.1:4000/api/auth/me",
]) {
  try {
    const res = await fetch(url, {
      headers: { Cookie: cookie, Accept: "application/json" },
      cache: "no-store",
    });
    const text = await res.text();
    console.log(url, res.status, text.slice(0, 300));
  } catch (e) {
    console.log(url, "ERR", e.message);
  }
}
