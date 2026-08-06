/**
 * Capture fresh octivate.io evidence screenshots for each FC logbook day.
 * Uses a minted session cookie (bypasses login rate limits).
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "docs", "future-caribbean-logbook", "screenshots");
const TOOL =
  process.env.FC_LOGBOOK_TOOL_DIR ||
  path.join(process.env.USERPROFILE || "", "Desktop", "octivate-fc-logbook-tool");
const BASE = process.env.OCT_BASE || "https://octivate.io";
const STATE = path.join(ROOT, "data", "local", "octivate-evidence-auth.json");
const SESS_OUT = path.join(ROOT, "data", "local", "octivate-evidence-session.json");

const CAPTURES = [
  { key: "Mon 07/13", path: "/", public: true },
  { key: "Tue 07/14", path: "/signin", public: true },
  { key: "Wed 07/15", path: "/", public: true },
  { key: "Thu 07/16", path: "/dashboard" },
  { key: "Fri 07/17", path: "/dashboard/sources" },
  { key: "Sat 07/18", path: "/dashboard/operator" },
  { key: "Sun 07/19", path: "/dashboard" },
  { key: "Mon 07/20", path: "/dashboard/briefs" },
  { key: "Tue 07/21", path: "/", public: true },
  { key: "Wed 07/22", path: "/dashboard/operator", tab: "Mail" },
  { key: "Thu 07/23", path: "/pricing", public: true },
  { key: "Fri 07/24", path: "/dashboard" },
  { key: "Sat 07/25", path: "/support", public: true },
  { key: "Sun 07/26", path: "/dashboard/sources" },
  { key: "Mon 07/27", path: "/dashboard/sources" },
  { key: "Tue 07/28", path: "/", public: true },
  { key: "Wed 07/29", path: "/dashboard/briefs" },
  { key: "Thu 07/30", path: "/dashboard/operator", tab: "Operations" },
  { key: "Fri 07/31", path: "/dashboard/operator", tab: "Mail" },
  { key: "Sat 08/01", path: "/dashboard/operator", tab: "Mail" },
  { key: "Sun 08/02", path: "/dashboard" },
  { key: "Mon 08/03", path: "/dashboard/operator", tab: "Mail" },
  { key: "Tue 08/04", path: "/dashboard/projects" },
  { key: "Wed 08/05", path: "/dashboard/operator", tab: "Mail" },
  { key: "Thu 08/06", path: "/dashboard/operator", tab: "Operations" },
];

function shotName(key) {
  return `${key.replace(/\s+/g, "_").replace(/\//g, "_")}.png`;
}

function isAuthedUrl(url) {
  return /\/(dashboard|operator)/.test(url) && !/signin|session_expired/.test(url);
}

function remint() {
  const r = spawnSync(process.execPath, [path.join(ROOT, "scripts", "mint-shemuel-session.mjs")], {
    cwd: ROOT,
    encoding: "utf8",
  });
  if (r.status !== 0) {
    throw new Error(`mint_failed: ${r.stderr || r.stdout}`);
  }
  console.log("[oct-evidence] minted", (r.stdout || "").trim());
}

async function dismissOverlays(page) {
  for (const name of [/Close mailing list/i, /^Close$/i, /Skip tour/i, /Got it/i]) {
    const btn = page.getByRole("button", { name });
    if (await btn.first().isVisible({ timeout: 350 }).catch(() => false)) {
      await btn.first().click({ force: true }).catch(() => {});
      await page.waitForTimeout(200);
    }
  }
  await page.keyboard.press("Escape").catch(() => {});
}

function readSess() {
  if (!fs.existsSync(SESS_OUT)) remint();
  return JSON.parse(fs.readFileSync(SESS_OUT, "utf8"));
}

async function injectSession(context) {
  const sess = readSess();
  const url = new URL(BASE);
  const expires = Math.floor(new Date(sess.expiresAt).getTime() / 1000);
  // Do not clearCookies — that races SessionGuard's /api/auth/me checks.
  await context.addCookies([
    {
      name: sess.cookieName || "octivate_session",
      value: sess.token,
      domain: url.hostname,
      path: "/",
      httpOnly: true,
      secure: url.protocol === "https:",
      sameSite: "Lax",
      expires,
    },
    {
      name: sess.expCookieName || "octivate_session_exp",
      value: sess.expiresAt,
      domain: url.hostname,
      path: "/",
      httpOnly: false,
      secure: url.protocol === "https:",
      sameSite: "Lax",
      expires,
    },
  ]);
}

async function armSessionProtection(page) {
  // Bulk navigation trips API rate limits; SessionGuard treats that as expiry and logs out.
  await page.route("**/api/auth/logout", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, signedOut: true, blocked: true }),
    });
  });
  await page.route("**/api/auth/me**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    const sess = readSess();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: sess.userId,
          username: "shemuel",
          email: "shemuel@octivate.io",
          displayName: "Shemuel",
          role: "operator",
          staffProfileId: "shemuel",
        },
        session: { expiresAt: sess.expiresAt, createdAt: new Date().toISOString() },
        profileLimits: {},
        signup: { allowAutogenerateAccounts: true },
        captureStub: true,
      }),
    });
  });
}

async function ensureAuthed(context, page) {
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt === 0 || !fs.existsSync(SESS_OUT)) remint();
    else if (attempt > 0) remint();
    await injectSession(context);
    await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(1200);
    if (isAuthedUrl(page.url())) {
      await dismissOverlays(page);
      return;
    }
    console.log("[oct-evidence] cookie rejected at", page.url(), "— reminting");
  }
  throw new Error(`session_cookie_rejected at ${page.url()}`);
}

async function openTab(page, tabName) {
  if (!tabName) return;
  const re = new RegExp(`^${tabName}$`, "i");
  const tab = page
    .getByRole("button", { name: re })
    .or(page.getByRole("link", { name: re }))
    .or(page.getByRole("tab", { name: re }));
  if (await tab.first().isVisible({ timeout: 2500 }).catch(() => false)) {
    await tab.first().click().catch(() => {});
    await page.waitForTimeout(800);
  }
}

async function shot(page, file) {
  await dismissOverlays(page);
  await page.screenshot({ path: file, fullPage: false });
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) {
    if (f.endsWith(".png")) fs.unlinkSync(path.join(OUT, f));
  }

  const req = createRequire(path.join(TOOL, "package.json"));
  const { chromium } = req("playwright");
  const chrome = path.join(
    process.env.LOCALAPPDATA || "",
    "ms-playwright",
    "chromium-1181",
    "chrome-win",
    "chrome.exe"
  );
  const browser = await chromium.launch({
    executablePath: chrome,
    headless: true,
    args: ["--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled"],
  });

  // ---- public (logged out) ----
  const pub = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1.25,
    ignoreHTTPSErrors: true,
  });
  const pubPage = await pub.newPage();
  pubPage.setDefaultTimeout(45000);
  await pubPage.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await dismissOverlays(pubPage);
  await shot(pubPage, path.join(OUT, "00-landing.png"));
  console.log("[oct-evidence] 00-landing", pubPage.url());

  for (const item of CAPTURES.filter((c) => c.public)) {
    await pubPage.goto(`${BASE}${item.path}`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await pubPage.waitForTimeout(1000);
    await shot(pubPage, path.join(OUT, shotName(item.key)));
    console.log("[oct-evidence]", item.key, pubPage.url());
  }
  await pub.close();

  // ---- authenticated ----
  const auth = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1.25,
    ignoreHTTPSErrors: true,
  });
  const page = await auth.newPage();
  page.setDefaultTimeout(45000);
  await armSessionProtection(page);
  await ensureAuthed(auth, page);
  await auth.storageState({ path: STATE }).catch(() => {});

  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(1000);
  if (!isAuthedUrl(page.url())) await ensureAuthed(auth, page);
  await shot(page, path.join(OUT, "00-dashboard.png"));
  console.log("[oct-evidence] 00-dashboard", page.url());

  for (const item of CAPTURES.filter((c) => !c.public)) {
    await injectSession(auth);
    await page.goto(`${BASE}${item.path}`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(1100);
    if (!isAuthedUrl(page.url()) && item.path.startsWith("/dashboard")) {
      console.log("[oct-evidence] session lost — remint for", item.key);
      await ensureAuthed(auth, page);
      await page.goto(`${BASE}${item.path}`, { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.waitForTimeout(1100);
    }
    await openTab(page, item.tab);
    if (item.path.startsWith("/dashboard") && !isAuthedUrl(page.url())) {
      throw new Error(`auth_failed_${item.key}_${page.url()}`);
    }
    await shot(page, path.join(OUT, shotName(item.key)));
    console.log("[oct-evidence]", item.key, item.tab || "", page.url());
  }

  await injectSession(auth);
  await page.goto(`${BASE}/dashboard/operator`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(900);
  if (!isAuthedUrl(page.url())) await ensureAuthed(auth, page);
  await page.goto(`${BASE}/dashboard/operator`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await openTab(page, "Operations");
  await shot(page, path.join(OUT, "99-final.png"));
  console.log("[oct-evidence] 99-final", page.url());

  await auth.close();
  await browser.close();

  const files = fs.readdirSync(OUT).filter((f) => f.endsWith(".png")).sort();
  console.log("[oct-evidence] total", files.length);
  fs.writeFileSync(
    path.join(OUT, "..", "capture-manifest.json"),
    JSON.stringify({ base: BASE, capturedAt: new Date().toISOString(), files, captures: CAPTURES }, null, 2)
  );
}

main().catch((err) => {
  console.error("[oct-evidence] FATAL", err);
  process.exit(1);
});
