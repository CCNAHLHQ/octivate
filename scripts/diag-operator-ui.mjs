import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOOL = path.join(process.env.USERPROFILE || "", "Desktop", "octivate-fc-logbook-tool");
const DESKTOP = path.join(process.env.USERPROFILE || "", "Desktop");
const BASE = "https://octivate.io";

spawnSync(process.execPath, [path.join(ROOT, "scripts", "mint-shemuel-session.mjs")], {
  cwd: ROOT,
  encoding: "utf8",
});
const sess = JSON.parse(
  fs.readFileSync(path.join(ROOT, "data", "local", "octivate-evidence-session.json"), "utf8")
);

const { chromium } = createRequire(path.join(TOOL, "package.json"))("playwright");
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
  args: ["--disable-dev-shm-usage"],
});
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 960 },
  ignoreHTTPSErrors: true,
});
const expires = Math.floor(new Date(sess.expiresAt).getTime() / 1000);
await ctx.addCookies([
  {
    name: sess.cookieName,
    value: sess.token,
    domain: "octivate.io",
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    expires,
  },
  {
    name: "octivate_session_exp",
    value: sess.expiresAt,
    domain: "octivate.io",
    path: "/",
    httpOnly: false,
    secure: true,
    sameSite: "Lax",
    expires,
  },
]);
const page = await ctx.newPage();
const errors = [];
const failed = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console:${m.text()}`);
});
page.on("response", (r) => {
  if (r.url().includes("/api/") && r.status() >= 400) {
    failed.push(`${r.status()} ${r.url()}`);
  }
});
await page.route("**/api/auth/logout", (route) =>
  route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' })
);

await page.goto(`${BASE}/dashboard/operator`, {
  waitUntil: "domcontentloaded",
  timeout: 90000,
});
await page.waitForTimeout(3500);
await page.keyboard.press("Escape").catch(() => {});

const pulse = await page.evaluate(() => {
  const panel = document.querySelector(".op-tab-panel");
  return {
    url: location.href,
    panelChildCount: panel?.children?.length || 0,
    panelText: (panel?.innerText || "").replace(/\s+/g, " ").slice(0, 500),
    panelHtml: (panel?.innerHTML || "").slice(0, 1200),
    opClassCount: document.querySelectorAll("[class*='op-']").length,
  };
});
await page.screenshot({ path: path.join(DESKTOP, "operator-ui-pulse.png"), fullPage: false });

for (const name of ["Operations", "Mail", "Catalog"]) {
  const tab = page
    .getByRole("button", { name: new RegExp(`^${name}`, "i") })
    .or(page.getByRole("tab", { name: new RegExp(`^${name}`, "i") }));
  if (await tab.first().isVisible().catch(() => false)) {
    await tab.first().click().catch(() => {});
    await page.waitForTimeout(1800);
    await page.keyboard.press("Escape").catch(() => {});
    const snap = await page.evaluate(() => ({
      text: (document.querySelector(".op-tab-panel")?.innerText || "")
        .replace(/\s+/g, " ")
        .slice(0, 400),
      htmlLen: (document.querySelector(".op-tab-panel")?.innerHTML || "").length,
      childCount: document.querySelector(".op-tab-panel")?.children?.length || 0,
    }));
    await page.screenshot({
      path: path.join(DESKTOP, `operator-ui-${name.toLowerCase()}.png`),
      fullPage: false,
    });
    console.log(JSON.stringify({ tab: name, snap }, null, 2));
  }
}

console.log(JSON.stringify({ errors: errors.slice(0, 30), failed: failed.slice(0, 30), pulse }, null, 2));
await browser.close();
