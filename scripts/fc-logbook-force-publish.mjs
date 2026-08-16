/**
 * Force re-publish every planned enabled day to Future Caribbean,
 * refreshing evidence screenshot URLs in each entry body.
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ENTRIES = path.join(ROOT, "lib", "future-caribbean", "entries.json");
const TOOL =
  process.env.FC_LOGBOOK_TOOL_DIR ||
  path.join(process.env.USERPROFILE || "", "Desktop", "octivate-fc-logbook-tool");
const LOGIN = process.env.FC_LOGIN_URL || "https://os.futurecaribbean.com/login";
const LOGBOOK =
  process.env.FC_LOGBOOK_URL || "https://os.futurecaribbean.com/builder/logbook";
const EMAIL = process.env.FC_LOGBOOK_EMAIL || process.env.FC_EMAIL || "";
const PASSWORD = process.env.FC_LOGBOOK_PASSWORD || process.env.FC_PASSWORD || "";
const GH_BASE =
  "https://github.com/CCNAHLHQ/octivate/blob/main/docs/future-caribbean-logbook/screenshots";

function loadDays() {
  const raw = JSON.parse(fs.readFileSync(ENTRIES, "utf8"));
  const days = [];
  for (const w of raw.weeks) {
    for (const d of w.days) {
      const screenshot =
        d.screenshot ||
        `${GH_BASE}/${d.key.replace(/\s+/g, "_").replace(/\//g, "_")}.png`;
      let body = (d.body || "").replace(
        /Evidence screenshot:\s*https?:\/\/\S+/g,
        `Evidence screenshot: ${screenshot}`
      );
      if (!body.includes("Evidence screenshot:")) {
        body += `\n\nEvidence screenshot: ${screenshot}`;
      }
      if (!body.startsWith(d.title)) body = `${d.title}\n\n${body}`;
      days.push({ weekLabel: w.label, key: d.key, title: d.title, body, screenshot });
    }
  }
  // persist refreshed URLs
  for (const w of raw.weeks) {
    for (const d of w.days) {
      const screenshot = `${GH_BASE}/${d.key.replace(/\s+/g, "_").replace(/\//g, "_")}.png`;
      d.screenshot = screenshot;
      d.body = (d.body || "").replace(
        /Evidence screenshot:\s*https?:\/\/\S+/g,
        `Evidence screenshot: ${screenshot}`
      );
      if (!d.body.includes("Evidence screenshot:")) {
        d.body += `\n\nEvidence screenshot: ${screenshot}`;
      }
    }
  }
  fs.writeFileSync(ENTRIES, JSON.stringify(raw, null, 2));
  fs.writeFileSync(path.join(TOOL, "entries.json"), JSON.stringify(raw, null, 2));
  return days;
}

function weekRe(label) {
  return new RegExp(label.replace(/[–—−-]/g, "[-–—−]").replace(/\s+/g, "\\s+"), "i");
}

async function main() {
  if (!EMAIL || !PASSWORD) throw new Error("fc_credentials_missing");
  const days = loadDays();
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
    args: ["--disable-dev-shm-usage"],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  page.setDefaultTimeout(45000);

  try {
    await page.goto(LOGIN, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.getByLabel(/Email/i).fill(EMAIL);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.getByRole("button", { name: /Sign in/i }).click();
    await page.waitForURL(/\/builder\//, { timeout: 60000, waitUntil: "commit" });
    await page.goto(LOGBOOK, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForFunction(
      () => /Aug\s+\d|Jul\s+\d/.test(document.body?.innerText || ""),
      { timeout: 60000 }
    );
    for (let i = 0; i < 5; i++) {
      const s = page.getByRole("button", { name: /Skip tour/i });
      if (await s.isVisible().catch(() => false)) {
        await s.click({ force: true });
        await page.waitForTimeout(300);
      } else break;
    }

    let saved = 0;
    let skipped = 0;
    let failed = 0;
    for (const day of days) {
      process.stdout.write(`[force] ${day.key} … `);
      const weekBtn = page.getByRole("button", { name: weekRe(day.weekLabel) }).first();
      await weekBtn.click().catch(() => {});
      await page.waitForTimeout(400);
      const dayRe = new RegExp(
        `^${day.key.replaceAll("/", "[/\\\\]").replace(/\s+/g, "\\s+")}$`,
        "i"
      );
      let dayBtn = page.getByRole("button", { name: dayRe }).first();
      if (!(await dayBtn.isVisible().catch(() => false))) {
        await weekBtn.click();
        await page.waitForTimeout(700);
        dayBtn = page.getByRole("button", { name: dayRe }).first();
      }
      if (!(await dayBtn.isVisible().catch(() => false))) {
        console.log("FAIL not visible");
        failed++;
        continue;
      }
      if (await dayBtn.isDisabled()) {
        console.log("skipped disabled");
        skipped++;
        continue;
      }
      await dayBtn.click();
      await page.waitForTimeout(700);
      await page.locator("textarea").first().fill(day.body);
      await page.getByRole("button", { name: /^Save entry$/i }).click();
      await page.getByText(/Entry saved/i).first().waitFor({ timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(800);
      console.log("ok");
      saved++;
    }
    console.log("[force] summary", { saved, skipped, failed, total: days.length });
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error("[force] FATAL", e);
  process.exit(1);
});
