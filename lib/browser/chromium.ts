import { existsSync } from "fs";
import puppeteer, { type Browser } from "puppeteer-core";

const EDGE_CANDIDATES = [
  process.env.CHROMIUM_PATH,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean) as string[];

export function resolveChromiumPath(): string | null {
  for (const candidate of EDGE_CANDIDATES) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export function canLaunchChromium(): boolean {
  return resolveChromiumPath() !== null;
}

/** Shared headless Chromium for PDF export + source capture. */
let sharedBrowser: Browser | null = null;
let launching: Promise<Browser> | null = null;

export async function getChromiumBrowser(): Promise<Browser> {
  if (sharedBrowser?.connected) return sharedBrowser;
  if (launching) return launching;

  const executablePath = resolveChromiumPath();
  if (!executablePath) {
    throw new Error(
      "chromium_not_found: Set CHROMIUM_PATH or install Microsoft Edge / Chrome."
    );
  }

  launching = puppeteer
    .launch({
      executablePath,
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    })
    .then((browser) => {
      sharedBrowser = browser;
      browser.on("disconnected", () => {
        sharedBrowser = null;
      });
      return browser;
    })
    .finally(() => {
      launching = null;
    });

  return launching;
}

/** Close the shared browser so capture deletes are not blocked by file locks. */
export async function closeChromiumBrowser(): Promise<void> {
  if (launching) {
    try {
      await launching;
    } catch {
      /* ignore launch failure */
    }
  }
  const browser = sharedBrowser;
  sharedBrowser = null;
  launching = null;
  if (!browser) return;
  try {
    await browser.close();
  } catch {
    /* ignore */
  }
}
