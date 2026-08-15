import { getChromiumBrowser, canLaunchChromium } from "@/lib/browser/chromium";

export async function pdfFromHtml(documentHtml: string): Promise<Buffer> {
  const browser = await getChromiumBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(documentHtml, { waitUntil: "load", timeout: 45_000 });
    // Brief CSS pads the plate; leave a little Chromium margin for print breathing room.
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: "12mm", right: "11mm", bottom: "12mm", left: "11mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => null);
  }
}

export function canRenderPdfFromHtml() {
  return canLaunchChromium();
}
