import { existsSync } from "fs";
import puppeteer from "puppeteer-core";

const EDGE = [
  process.env.CHROMIUM_PATH,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);

function chromium() {
  for (const c of EDGE) if (existsSync(c)) return c;
  throw new Error("no chromium");
}

const URLS = [
  "https://www.barbadosparliament.com/parliament_tv",
  "https://www.barbadosparliament.com/",
  "https://www.ttparliament.org/parliament-channel/",
  "https://www.ttparliament.org/house/sittings-in-the-house/",
  "https://www.ttparliament.org/house/sittings-in-the-house/?page=2",
  "https://parliament.gov.gy/",
  "https://japarliament.gov.jm/",
];

const browser = await puppeteer.launch({
  executablePath: chromium(),
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});

for (const url of URLS) {
  const page = await browser.newPage();
  try {
    await page.setUserAgent("OctivateAutomationBot/1.0 (+https://octivate.io)");
    await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    await new Promise((r) => setTimeout(r, 2500));
    const info = await page.evaluate(() => {
      const html = document.documentElement.outerHTML;
      const vimeo = [...html.matchAll(/vimeo\.com\/(?:video\/)?(\d+)/gi)].map((m) => m[0]);
      const yt = [...html.matchAll(/youtube\.com\/(?:embed\/|watch\?v=)|youtu\.be\//gi)].length;
      const iframes = [...document.querySelectorAll("iframe")]
        .map((i) => i.src)
        .filter(Boolean)
        .slice(0, 25);
      const pageLinks = [...document.querySelectorAll("a[href*='page=']")]
        .map((a) => a.href)
        .filter((v, i, a) => a.indexOf(v) === i)
        .slice(0, 12);
      const sittingLinks = [...document.querySelectorAll("a[href]")]
        .map((a) => ({
          href: a.href,
          text: (a.textContent || "").trim().replace(/\s+/g, " ").slice(0, 100),
        }))
        .filter((a) =>
          /sitting|session|watch|video|parliament_tv|broadcast|hansard|chamber/i.test(
            a.href + " " + a.text
          )
        )
        .slice(0, 30);
      const headings = [...document.querySelectorAll("h1,h2,h3,.entry-title,.post-title")]
        .map((h) => (h.textContent || "").trim().replace(/\s+/g, " ").slice(0, 120))
        .filter(Boolean)
        .slice(0, 15);
      return {
        title: document.title,
        vimeo: [...new Set(vimeo)].slice(0, 20),
        ytHits: yt,
        iframes,
        pageLinks,
        sittingLinks,
        headings,
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
