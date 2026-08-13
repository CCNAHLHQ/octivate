import { existsSync } from "fs";
import puppeteer from "puppeteer-core";

const EDGE = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].find((c) => existsSync(c));

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});
const page = await browser.newPage();
const hits = [];
page.on("response", async (res) => {
  const u = res.url();
  if (/vimeocdn|player\.vimeo|progressive|playlist|\.mp4|m3u8/i.test(u)) {
    hits.push({ status: res.status(), url: u.slice(0, 180) });
  }
});

// Open Guyana sitting page that embeds Vimeo (correct referer context)
await page.goto(
  "https://parliament.gov.gy/sittings/detail/4th-sitting-thirteenth-parliament-budget-presentation-2026",
  { waitUntil: "networkidle2", timeout: 60000 }
);
await new Promise((r) => setTimeout(r, 4000));

const fromDom = await page.evaluate(async () => {
  const iframe = document.querySelector("iframe[src*='vimeo']");
  const src = iframe?.src || "";
  let playerCfg = null;
  try {
    const id = (src.match(/video\/(\d+)/) || [])[1];
    if (id) {
      const r = await fetch(`https://player.vimeo.com/video/${id}/config`, {
        credentials: "include",
      });
      playerCfg = { status: r.status, body: (await r.text()).slice(0, 800) };
    }
  } catch (e) {
    playerCfg = { error: String(e) };
  }
  return { src, playerCfg };
});

console.log(JSON.stringify({ fromDom, hits: hits.slice(0, 40) }, null, 2));
await browser.close();
