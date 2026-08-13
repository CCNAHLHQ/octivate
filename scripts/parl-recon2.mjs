import { existsSync } from "fs";
import puppeteer from "puppeteer-core";
import { spawnSync } from "child_process";

const EDGE = [
  process.env.CHROMIUM_PATH,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);
const chrome = EDGE.find((c) => existsSync(c));
const ytdlp = process.env.YT_DLP_PATH || "C:/Python314/Scripts/yt-dlp.exe";

const URLS = [
  "https://www.barbadosparliament.com/sittings/listall/1",
  "https://www.barbadosparliament.com/sittings/listall/2",
  "https://parliament.gov.gy/chamber-business/sittings/",
  "https://parliament.gov.gy/sittings/detail/5th-sitting-thirteenth-parliament",
  "https://parliament.gov.gy/sittings/detail/4th-sitting-thirteenth-parliament-budget-presentation-2026",
];

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});

for (const url of URLS) {
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    await new Promise((r) => setTimeout(r, 2000));
    const info = await page.evaluate(() => {
      const html = document.documentElement.outerHTML;
      const vimeo = [...html.matchAll(/vimeo\.com\/(?:event\/\d+|video\/\d+|\d+)/gi)].map(
        (m) => m[0]
      );
      const rows = [...document.querySelectorAll("tr, .sitting, article, .card, li, .item")]
        .map((el) => (el.innerText || "").trim().replace(/\s+/g, " ").slice(0, 160))
        .filter((t) => t.length > 20 && /sitting|senate|house|budget|video|vimeo/i.test(t))
        .slice(0, 20);
      const links = [...document.querySelectorAll("a[href]")]
        .map((a) => ({
          href: a.href,
          text: (a.textContent || "").trim().replace(/\s+/g, " ").slice(0, 100),
        }))
        .filter((a) =>
          /vimeo|video|sitting|detail|listall|page|watch|mp4/i.test(a.href + " " + a.text)
        )
        .slice(0, 40);
      return {
        title: document.title,
        vimeo: [...new Set(vimeo)],
        rows,
        links,
      };
    });
    console.log("\n====", url);
    console.log(JSON.stringify(info, null, 2));
  } catch (e) {
    console.log("\n==== FAIL", url, e.message);
  } finally {
    await page.close().catch(() => {});
  }
}
await browser.close();

console.log("\n==== yt-dlp flat playlist barbados showcase");
const r = spawnSync(
  ytdlp,
  [
    "--flat-playlist",
    "--print",
    "%(id)s\t%(title)s\t%(duration)s\t%(webpage_url)s",
    "https://vimeo.com/barbadosparliament/videos",
  ],
  { encoding: "utf8", timeout: 120000 }
);
console.log((r.stdout || "").split("\n").slice(0, 25).join("\n"));
console.log("stderr tail:", (r.stderr || "").slice(-500));
console.log("code", r.status);
