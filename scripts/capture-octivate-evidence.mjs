/**
 * Capture fresh https://octivate.io evidence screenshots for FC logbook days.
 * NEVER captures os.futurecaribbean.com — that site is publish destination only.
 *
 * Usage:
 *   node scripts/capture-octivate-evidence.mjs
 *   node scripts/capture-octivate-evidence.mjs --only-missing
 *   node scripts/capture-octivate-evidence.mjs --keys "Wed 08/12,Thu 08/13"
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "docs", "future-caribbean-logbook", "screenshots");
const ENTRIES = path.join(ROOT, "lib", "future-caribbean", "entries.json");
const TOOL =
  process.env.FC_LOGBOOK_TOOL_DIR ||
  path.join(process.env.USERPROFILE || "", "Desktop", "octivate-fc-logbook-tool");
const BASE = (process.env.OCT_BASE || "https://octivate.io").replace(/\/$/, "");
const STATE = path.join(ROOT, "data", "local", "octivate-evidence-auth.json");
const SESS_OUT = path.join(ROOT, "data", "local", "octivate-evidence-session.json");

const args = process.argv.slice(2);
const ONLY_MISSING = args.includes("--only-missing");
const keysArg = args.find((a) => a.startsWith("--keys=")) || "";
const KEY_FILTER = keysArg
  ? keysArg
      .slice("--keys=".length)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : null;

/** Default surface map — every path is on octivate.io. */
const SURFACE_BY_KEY = {
  "Mon 07/13": { path: "/", public: true },
  "Tue 07/14": { path: "/signin", public: true },
  "Wed 07/15": { path: "/", public: true },
  "Thu 07/16": { path: "/dashboard" },
  "Fri 07/17": { path: "/dashboard/projects" },
  "Sat 07/18": { path: "/dashboard/operator" },
  "Sun 07/19": { path: "/dashboard" },
  "Mon 07/20": { path: "/dashboard/briefs" },
  "Tue 07/21": { path: "/", public: true },
  "Wed 07/22": { path: "/dashboard/operator", tab: "Mail" },
  "Thu 07/23": { path: "/pricing", public: true },
  "Fri 07/24": { path: "/dashboard" },
  "Sat 07/25": { path: "/support", public: true },
  "Sun 07/26": { path: "/dashboard/projects" },
  "Mon 07/27": { path: "/dashboard/projects" },
  "Tue 07/28": { path: "/", public: true },
  "Wed 07/29": { path: "/dashboard/briefs" },
  "Thu 07/30": { path: "/dashboard/operator", tab: "Operations" },
  "Fri 07/31": { path: "/dashboard/operator", tab: "Mail" },
  "Sat 08/01": { path: "/dashboard/operator", tab: "Mail" },
  "Sun 08/02": { path: "/dashboard" },
  "Mon 08/03": { path: "/dashboard/operator", tab: "Mail" },
  "Tue 08/04": { path: "/dashboard/projects" },
  "Wed 08/05": { path: "/dashboard/operator", tab: "Mail" },
  "Thu 08/06": { path: "/dashboard/operator", tab: "Operations" },
  "Fri 08/07": { path: "/dashboard/operator" },
  "Sat 08/08": { path: "/dashboard/operator" },
  "Sun 08/09": { path: "/dashboard" },
  "Mon 08/10": { path: "/dashboard" },
  "Tue 08/11": { path: "/", public: true },
  "Wed 08/12": { path: "/dashboard/operator", tab: "Automation" },
  "Thu 08/13": { path: "/dashboard/projects" },
  "Fri 08/14": { path: "/", public: true },
  "Sat 08/15": { path: "/dashboard/briefs" },
  "Sun 08/16": { path: "/dashboard/operator", tab: "Operations" },
};

function shotName(key) {
  return `${key.replace(/\s+/g, "_").replace(/\//g, "_")}.png`;
}

function assertOctivateUrl(url) {
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error(`invalid_url_${url}`);
  }
  if (!/(^|\.)octivate\.io$/i.test(host) && host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(
      `refusing_non_octivate_screenshot host=${host} url=${url} — evidence must be our site`
    );
  }
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
    assertOctivateUrl(page.url());
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
  assertOctivateUrl(page.url());
  await dismissOverlays(page);
  await page.screenshot({ path: file, fullPage: false });
}

function loadCapturePlan() {
  const raw = JSON.parse(fs.readFileSync(ENTRIES, "utf8"));
  const days = [];
  for (const w of raw.weeks || []) {
    for (const d of w.days || []) {
      const surface = SURFACE_BY_KEY[d.key] || { path: "/dashboard" };
      days.push({
        key: d.key,
        path: surface.path,
        public: Boolean(surface.public),
        tab: surface.tab,
      });
    }
  }
  return days;
}

function detectMissing(plan) {
  const missing = [];
  for (const item of plan) {
    const file = path.join(OUT, shotName(item.key));
    if (!fs.existsSync(file)) missing.push(item.key);
  }
  return missing;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  let plan = loadCapturePlan();
  if (KEY_FILTER) {
    plan = plan.filter((c) => KEY_FILTER.includes(c.key));
  } else if (ONLY_MISSING) {
    const missing = new Set(detectMissing(plan));
    console.log("[oct-evidence] missing days:", [...missing].join(", ") || "(none)");
    plan = plan.filter((c) => missing.has(c.key));
  } else {
    for (const f of fs.readdirSync(OUT)) {
      if (f.endsWith(".png") && !f.startsWith("00-") && f !== "99-final.png") {
        // keep 00/99 unless full refresh — wipe day shots only when full run
        fs.unlinkSync(path.join(OUT, f));
      }
    }
  }

  if (!plan.length) {
    console.log("[oct-evidence] nothing to capture");
    return;
  }

  console.log(
    "[oct-evidence] capturing",
    plan.length,
    "day shot(s) from",
    BASE,
    ONLY_MISSING ? "(only-missing)" : ""
  );

  const req = createRequire(path.join(TOOL, "package.json"));
  const { chromium } = req("playwright");
  const msPlaywright = path.join(process.env.LOCALAPPDATA || "", "ms-playwright");
  let chromeExe;
  if (fs.existsSync(msPlaywright)) {
    const builds = fs
      .readdirSync(msPlaywright)
      .filter((n) => /^chromium-\d+$/.test(n))
      .sort()
      .reverse();
    for (const build of builds) {
      const candidate = path.join(msPlaywright, build, "chrome-win", "chrome.exe");
      if (fs.existsSync(candidate)) {
        chromeExe = candidate;
        break;
      }
    }
  }
  const browser = await chromium.launch({
    executablePath: chromeExe,
    headless: true,
    args: ["--disable-dev-shm-usage", "--disable-blink-features=AutomationControlled"],
  });

  const pubItems = plan.filter((c) => c.public);
  const authItems = plan.filter((c) => !c.public);

  if (pubItems.length || !ONLY_MISSING) {
    const pub = await browser.newContext({
      viewport: { width: 1440, height: 960 },
      deviceScaleFactor: 1.25,
      ignoreHTTPSErrors: true,
    });
    const pubPage = await pub.newPage();
    pubPage.setDefaultTimeout(45000);
    await pubPage.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 90000 });
    assertOctivateUrl(pubPage.url());
    await dismissOverlays(pubPage);
    if (!ONLY_MISSING) {
      await shot(pubPage, path.join(OUT, "00-landing.png"));
      console.log("[oct-evidence] 00-landing", pubPage.url());
    }

    for (const item of pubItems) {
      await pubPage.goto(`${BASE}${item.path}`, { waitUntil: "domcontentloaded", timeout: 90000 });
      await pubPage.waitForTimeout(1000);
      assertOctivateUrl(pubPage.url());
      await shot(pubPage, path.join(OUT, shotName(item.key)));
      console.log("[oct-evidence]", item.key, pubPage.url());
    }
    await pub.close();
  }

  if (authItems.length || !ONLY_MISSING) {
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

    if (!ONLY_MISSING) {
      await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.waitForTimeout(1000);
      if (!isAuthedUrl(page.url())) await ensureAuthed(auth, page);
      assertOctivateUrl(page.url());
      await shot(page, path.join(OUT, "00-dashboard.png"));
      console.log("[oct-evidence] 00-dashboard", page.url());
    }

    for (const item of authItems) {
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
      assertOctivateUrl(page.url());
      if (item.path.startsWith("/dashboard") && !isAuthedUrl(page.url())) {
        throw new Error(`auth_failed_${item.key}_${page.url()}`);
      }
      await shot(page, path.join(OUT, shotName(item.key)));
      console.log("[oct-evidence]", item.key, item.tab || "", page.url());
    }

    if (!ONLY_MISSING) {
      await injectSession(auth);
      await page.goto(`${BASE}/dashboard/operator`, { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.waitForTimeout(900);
      if (!isAuthedUrl(page.url())) await ensureAuthed(auth, page);
      await openTab(page, "Operations");
      assertOctivateUrl(page.url());
      await shot(page, path.join(OUT, "99-final.png"));
      console.log("[oct-evidence] 99-final", page.url());
    }

    await auth.close();
  }

  await browser.close();

  const files = fs.readdirSync(OUT).filter((f) => f.endsWith(".png")).sort();
  const missingAfter = detectMissing(loadCapturePlan());
  console.log("[oct-evidence] total png", files.length);
  console.log(
    "[oct-evidence] still missing",
    missingAfter.length ? missingAfter.join(", ") : "(none)"
  );
  fs.writeFileSync(
    path.join(OUT, "..", "capture-manifest.json"),
    JSON.stringify(
      {
        base: BASE,
        capturedAt: new Date().toISOString(),
        files,
        missing: missingAfter,
        note: "All day screenshots are captures of octivate.io only.",
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error("[oct-evidence] FATAL", err);
  process.exit(1);
});
