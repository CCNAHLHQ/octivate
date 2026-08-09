import fs from "fs";
import path from "path";
import { createRequire } from "module";

const ROOT = path.resolve("C:/Users/Administrator/Desktop/octivate-deploy-20260720-2012");
const TOOL = "C:/Users/Administrator/Desktop/octivate-fc-logbook-tool";
const founders = JSON.parse(
  fs.readFileSync(path.join(ROOT, "data/local/founder-credentials.local.json"), "utf8")
);
const she = founders.founders.find((f) => f.username === "shemuel");
const { chromium } = createRequire(path.join(TOOL, "package.json"))("playwright");
const chrome = path.join(
  process.env.LOCALAPPDATA,
  "ms-playwright",
  "chromium-1181",
  "chrome-win",
  "chrome.exe"
);

async function tryLogin(page, base) {
  console.log("TRY", base);
  page.on("response", async (res) => {
    const u = res.url();
    if (u.includes("/api/") && (u.includes("auth") || u.includes("session") || u.includes("signin"))) {
      let body = "";
      try {
        body = (await res.text()).slice(0, 240);
      } catch {
        /* ignore */
      }
      console.log("RESP", res.status(), u, body);
    }
  });
  await page.goto(`${base}/signin`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page
    .waitForFunction(() => !/LOADING OCTIVATE/i.test(document.body?.innerText || ""), {
      timeout: 60000,
    })
    .catch(() => {});
  await page.getByLabel(/Email or username/i).waitFor({ state: "visible", timeout: 30000 });
  await page.getByLabel(/Email or username/i).fill(she.email);
  await page.locator('input[type="password"]').fill(she.password);
  await page.getByRole("button", { name: /^Sign in$/i }).click();
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(1000);
    console.log(i, page.url());
    if (/\/(dashboard|operator)/.test(page.url()) && !/signin/.test(page.url())) {
      console.log("OK", base);
      return true;
    }
  }
  console.log("FAIL", base, (await page.locator("body").innerText()).slice(0, 300));
  return false;
}

const browser = await chromium.launch({
  executablePath: chrome,
  headless: true,
  args: ["--disable-dev-shm-usage"],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 960 },
  ignoreHTTPSErrors: true,
});
const okLocal = await tryLogin(page, "http://127.0.0.1:4000");
const page2 = await browser.newPage({
  viewport: { width: 1440, height: 960 },
  ignoreHTTPSErrors: true,
});
const okIo = await tryLogin(page2, "https://octivate.io");
console.log({ okLocal, okIo });
await browser.close();
