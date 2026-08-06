/**
 * Operator Future Caribbean logbook sync runner.
 * Invoked by POST /api/operator/fc-logbook — updates data/local/fc-logbook-job.json
 */
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const JOB = path.join(ROOT, "data", "local", "fc-logbook-job.json");
const ENTRIES = path.join(ROOT, "lib", "future-caribbean", "entries.json");
const SHOT_DIR = path.join(ROOT, "docs", "future-caribbean-logbook", "screenshots");
const TOOL =
  process.env.FC_LOGBOOK_TOOL_DIR ||
  path.join(process.env.USERPROFILE || "", "Desktop", "octivate-fc-logbook-tool");
const LOGIN = process.env.FC_LOGIN_URL || "https://os.futurecaribbean.com/login";
const LOGBOOK =
  process.env.FC_LOGBOOK_URL || "https://os.futurecaribbean.com/builder/logbook";
const EMAIL = process.env.FC_LOGBOOK_EMAIL || process.env.FC_EMAIL || "";
const PASSWORD = process.env.FC_LOGBOOK_PASSWORD || process.env.FC_PASSWORD || "";
const PUBLISH_TARGET = LOGBOOK;
const PUBLISH_LABEL = "Future Caribbean Builder · Logbook";
const GH_BASE =
  "https://github.com/CCNAHLHQ/octivate/blob/main/docs/future-caribbean-logbook/screenshots";

function readJob() {
  return JSON.parse(fs.readFileSync(JOB, "utf8"));
}
function writeJob(job) {
  fs.mkdirSync(path.dirname(JOB), { recursive: true });
  fs.writeFileSync(JOB, JSON.stringify(job, null, 2));
}
function setStep(job, id, status, detail) {
  job.steps = job.steps.map((s) =>
    s.id === id ? { ...s, status, detail: detail ?? s.detail } : s
  );
  const done = job.steps.filter((s) => s.status === "done" || s.status === "skipped").length;
  const running = job.steps.find((s) => s.status === "running");
  job.progress = {
    done,
    total: job.steps.length,
    pct: Math.min(99, Math.round((done / job.steps.length) * 100) + (running ? 8 : 0)),
    label: running?.label || job.progress?.label || "Working…",
  };
  writeJob(job);
}

function loadDays() {
  const raw = JSON.parse(fs.readFileSync(ENTRIES, "utf8"));
  const days = [];
  for (const w of raw.weeks) {
    for (const d of w.days) {
      const screenshot =
        d.screenshot ||
        `${GH_BASE}/${d.key.replace(/\s+/g, "_").replace(/\//g, "_")}.png`;
      let body = d.body || "";
      if (!body.includes("Evidence screenshot:")) {
        body += `\n\nEvidence screenshot: ${screenshot}`;
      }
      if (!body.startsWith(d.title)) body = `${d.title}\n\n${body}`;
      days.push({
        weekLabel: w.label,
        key: d.key,
        title: d.title,
        body,
        screenshot,
      });
    }
  }
  return days;
}

function uploadGithub(job) {
  setStep(job, "github", "running", "Staging screenshots…");
  writeJob(job);
  if (!fs.existsSync(SHOT_DIR)) {
    setStep(job, "github", "skipped", "No screenshots folder");
    return { uploaded: 0, urls: [] };
  }
  const files = fs
    .readdirSync(SHOT_DIR)
    .filter((f) => f.endsWith(".png"))
    .sort();
  const urls = files.map((f) => `${GH_BASE}/${f}`);

  // Prefer git commit+push so private repo evidence is versioned.
  const add = spawnSync("git", ["add", "docs/future-caribbean-logbook"], {
    cwd: ROOT,
    encoding: "utf8",
    shell: true,
  });
  if (add.status !== 0) {
    setStep(job, "github", "error", add.stderr || add.stdout || "git add failed");
    throw new Error("github_add_failed");
  }
  const st = spawnSync("git", ["status", "--porcelain", "docs/future-caribbean-logbook"], {
    cwd: ROOT,
    encoding: "utf8",
    shell: true,
  });
  if ((st.stdout || "").trim()) {
    const commit = spawnSync(
      "git",
      [
        "commit",
        "-m",
        "Add Future Caribbean logbook evidence screenshots for Shemuel Open Track.",
      ],
      { cwd: ROOT, encoding: "utf8", shell: true }
    );
    if (commit.status !== 0 && !/nothing to commit/i.test(commit.stdout + commit.stderr)) {
      // commit may fail if identity missing — still try push of existing
      console.warn("[fc-sync] commit:", commit.stdout, commit.stderr);
    }
    const push = spawnSync("git", ["push", "origin", "HEAD"], {
      cwd: ROOT,
      encoding: "utf8",
      shell: true,
    });
    if (push.status !== 0) {
      console.warn("[fc-sync] push:", push.stdout, push.stderr);
      setStep(
        job,
        "github",
        "done",
        `Staged ${files.length} screenshots (push pending: check gh auth)`
      );
      return { uploaded: files.length, urls };
    }
  }
  setStep(job, "github", "done", `${files.length} evidence files on GitHub`);
  job.github = { uploaded: files.length, urls };
  writeJob(job);
  return { uploaded: files.length, urls };
}

async function withBrowser(fn) {
  const playwrightPath = path.join(TOOL, "node_modules", "playwright", "index.js");
  if (!fs.existsSync(playwrightPath)) {
    throw new Error(`playwright_missing_at_${TOOL}`);
  }
  const { chromium } = await import(pathToFileURL(playwrightPath).href);
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
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
  });
  page.setDefaultTimeout(45000);
  try {
    return await fn(page);
  } finally {
    await browser.close();
  }
}

async function login(page) {
  if (!EMAIL || !PASSWORD) throw new Error("fc_credentials_missing");
  await page.goto(LOGIN, { waitUntil: "domcontentloaded", timeout: 90000 });
  if (!/\/builder\//.test(page.url())) {
    await page.getByLabel(/Email/i).fill(EMAIL);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.getByRole("button", { name: /Sign in/i }).click();
    await page.waitForURL(/\/builder\//, { timeout: 60000, waitUntil: "commit" });
  }
  await page.goto(LOGBOOK, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForFunction(
    () => /Aug\s+\d|Jul\s+\d/.test(document.body?.innerText || ""),
    { timeout: 60000 }
  );
  for (let i = 0; i < 5; i++) {
    const skip = page.getByRole("button", { name: /Skip tour/i });
    if (await skip.isVisible().catch(() => false)) {
      await skip.click({ force: true });
      await page.waitForTimeout(300);
    } else break;
  }
}

function weekRe(label) {
  return new RegExp(
    label.replace(/[–—−-]/g, "[-–—−]").replace(/\s+/g, "\\s+"),
    "i"
  );
}

async function ensureDayVisible(page, day) {
  const weekBtn = page.getByRole("button", { name: weekRe(day.weekLabel) }).first();
  await weekBtn.waitFor({ timeout: 20000 });
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
  return dayBtn;
}

async function inventory(page, planned) {
  const byKey = new Map();
  for (const day of planned) {
    const dayBtn = await ensureDayVisible(page, day);
    if (!(await dayBtn.isVisible().catch(() => false))) {
      byKey.set(day.key, {
        key: day.key,
        weekLabel: day.weekLabel,
        title: day.title,
        planned: true,
        remoteChars: 0,
        remotePreview: "",
        disabled: false,
        present: false,
        needsPublish: true,
        screenshot: day.screenshot,
      });
      continue;
    }
    const disabled = await dayBtn.isDisabled();
    if (disabled) {
      byKey.set(day.key, {
        key: day.key,
        weekLabel: day.weekLabel,
        title: day.title,
        planned: true,
        remoteChars: 0,
        remotePreview: "",
        disabled: true,
        present: false,
        needsPublish: false,
        screenshot: day.screenshot,
      });
      continue;
    }
    await dayBtn.click();
    await page.waitForTimeout(550);
    const val = await page.locator("textarea").first().inputValue().catch(() => "");
    const present =
      (val || "").trim().length >= 40 &&
      ((val || "").includes(day.title.slice(0, 18)) ||
        (val || "").length >= Math.min(120, day.body.length / 2));
    byKey.set(day.key, {
      key: day.key,
      weekLabel: day.weekLabel,
      title: day.title,
      planned: true,
      remoteChars: (val || "").length,
      remotePreview: (val || "").slice(0, 100),
      disabled: false,
      present,
      needsPublish: !present,
      screenshot: day.screenshot,
    });
  }
  return [...byKey.values()];
}

async function publishDay(page, day) {
  const dayBtn = await ensureDayVisible(page, day);
  if (!(await dayBtn.isVisible().catch(() => false))) {
    return { key: day.key, ok: false, error: "day not visible" };
  }
  if (await dayBtn.isDisabled()) {
    return { key: day.key, ok: false, skipped: true, error: "disabled" };
  }
  await dayBtn.click();
  await page.waitForTimeout(800);
  const ta = page.locator("textarea").first();
  await ta.fill(day.body);
  await page.getByRole("button", { name: /^Save entry$/i }).click();
  await page
    .getByText(/Entry saved/i)
    .first()
    .waitFor({ timeout: 15000 })
    .catch(() => {});
  await page.waitForTimeout(900);

  // Capture screenshot into repo evidence folder
  const shotName = `${day.key.replace(/\s+/g, "_").replace(/\//g, "_")}.png`;
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const shotPath = path.join(SHOT_DIR, shotName);
  await page.screenshot({ path: shotPath, fullPage: false });
  // also tool out
  try {
    fs.mkdirSync(path.join(TOOL, "out", "screenshots"), { recursive: true });
    fs.copyFileSync(shotPath, path.join(TOOL, "out", "screenshots", shotName));
  } catch {
    /* optional */
  }

  await dayBtn.click().catch(() => {});
  await page.waitForTimeout(500);
  const persisted = await ta.inputValue().catch(() => "");
  const ok =
    (persisted || "").includes(day.title.slice(0, 18)) ||
    (persisted || "").length >= Math.min(80, day.body.length);
  return { key: day.key, ok, chars: day.body.length, error: ok ? undefined : "persist check failed" };
}

async function main() {
  let job = readJob();
  job.status = "running";
  job.startedAt = new Date().toISOString();
  job.finishedAt = null;
  job.error = undefined;
  job.publishTarget = PUBLISH_TARGET;
  job.publishTargetLabel = PUBLISH_LABEL;
  writeJob(job);

  try {
    setStep(job, "prepare", "running");
    const days = loadDays();
    setStep(job, "prepare", "done", `${days.length} planned days loaded`);
    job = readJob();

    uploadGithub(job);
    job = readJob();

    setStep(job, "check", "running", `Connecting to ${PUBLISH_LABEL}…`);
    writeJob(job);

    const results = [];
    await withBrowser(async (page) => {
      await login(page);
      job = readJob();
      setStep(job, "check", "running", "Reading remote day inventory…");
      writeJob(job);
      const daysStatus = await inventory(page, days);
      const present = daysStatus.filter((d) => d.present).length;
      const missing = daysStatus.filter((d) => d.needsPublish).length;
      const disabled = daysStatus.filter((d) => d.disabled).length;
      job = readJob();
      job.check = {
        planned: days.length,
        present,
        missing,
        disabled,
        days: daysStatus,
      };
      setStep(
        job,
        "check",
        "done",
        `${present} present · ${missing} need publish · ${disabled} locked`
      );
      writeJob(job);

      const toPublish = days.filter((d) => {
        const st = daysStatus.find((x) => x.key === d.key);
        return st?.needsPublish;
      });

      job = readJob();
      setStep(
        job,
        "publish",
        "running",
        toPublish.length
          ? `Publishing ${toPublish.length} day(s) to ${PUBLISH_LABEL}`
          : "Nothing missing — verifying today"
      );
      writeJob(job);

      // Always ensure today is attempted if in plan
      const publishList = toPublish.length ? toPublish : [];
      let i = 0;
      for (const day of publishList) {
        i += 1;
        job = readJob();
        job.progress.label = `Publishing ${day.key} (${i}/${publishList.length}) → ${PUBLISH_LABEL}`;
        writeJob(job);
        const res = await publishDay(page, day);
        results.push(res);
      }

      // If today exists and wasn't in list but we want a fresh screenshot, skip if present
      if (!publishList.length) {
        setStep(job, "publish", "done", "All planned enabled days already present");
      } else {
        const ok = results.filter((r) => r.ok).length;
        const skipped = results.filter((r) => r.skipped).length;
        const failed = results.filter((r) => !r.ok && !r.skipped).length;
        setStep(
          job,
          "publish",
          failed ? "error" : "done",
          `${ok} saved · ${skipped} skipped · ${failed} failed`
        );
      }
    });

    // Re-upload any new screenshots captured during publish
    job = readJob();
    try {
      uploadGithub(job);
    } catch {
      /* non-fatal if already uploaded */
    }

    job = readJob();
    job.results = results;
    job.status = results.some((r) => !r.ok && !r.skipped) ? "error" : "done";
    job.finishedAt = new Date().toISOString();
    job.progress.pct = 100;
    job.progress.label =
      job.status === "done"
        ? `Published to ${PUBLISH_LABEL}`
        : "Completed with errors";
    writeJob(job);
    console.log("[fc-sync] done", job.status, JSON.stringify(job.progress));
  } catch (err) {
    job = readJob();
    job.status = "error";
    job.error = err instanceof Error ? err.message : String(err);
    job.finishedAt = new Date().toISOString();
    const running = job.steps.find((s) => s.status === "running");
    if (running) setStep(job, running.id, "error", job.error);
    writeJob(job);
    console.error("[fc-sync] FATAL", job.error);
    process.exit(1);
  }
}

main();
