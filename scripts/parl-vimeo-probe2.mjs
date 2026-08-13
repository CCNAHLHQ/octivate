import { existsSync, mkdirSync, writeFileSync } from "fs";
import path from "path";
import puppeteer from "puppeteer-core";

const EDGE = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].find((c) => existsSync(c));

const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage();
await page.setUserAgent(
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
);

const media = [];
page.on("response", async (res) => {
  const u = res.url();
  const ct = (res.headers()["content-type"] || "").toLowerCase();
  if (
    /\.mp4(\?|$)/i.test(u) ||
    /m3u8/i.test(u) ||
    ct.includes("mpegurl") ||
    ct.includes("mp4") ||
    /vimeocdn\.com\/.*\/video\//i.test(u)
  ) {
    media.push({ status: res.status(), ct, url: u.slice(0, 220) });
  }
});

// Showcase page first (session)
await page.goto("https://vimeo.com/barbadosparliament/videos", {
  waitUntil: "networkidle2",
  timeout: 90000,
});
await new Promise((r) => setTimeout(r, 3000));

// Open a known video page
await page.goto("https://vimeo.com/1217463577", {
  waitUntil: "networkidle2",
  timeout: 90000,
});
await new Promise((r) => setTimeout(r, 5000));

// Try click play
await page.mouse.click(400, 300).catch(() => {});
await new Promise((r) => setTimeout(r, 5000));

const meta = await page.evaluate(() => {
  const scripts = [...document.querySelectorAll("script")]
    .map((s) => s.textContent || "")
    .filter((t) => /progressive|hls|cdn\.vimeo|play_config|clip_page_config/i.test(t))
    .slice(0, 3)
    .map((t) => t.slice(0, 400));
  return {
    title: document.title,
    scripts,
    videoSrc: document.querySelector("video")?.currentSrc || document.querySelector("video")?.src || null,
  };
});

mkdirSync("data/local/_ytdlp_test", { recursive: true });
writeFileSync(
  path.join("data/local/_ytdlp_test", "probe.json"),
  JSON.stringify({ meta, media: media.slice(0, 50) }, null, 2)
);
console.log(JSON.stringify({ title: meta.title, videoSrc: meta.videoSrc, media: media.slice(0, 20), scriptN: meta.scripts.length }, null, 2));
await browser.close();
