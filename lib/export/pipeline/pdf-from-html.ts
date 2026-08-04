import { getChromiumBrowser, canLaunchChromium } from "@/lib/browser/chromium";

export async function pdfFromHtml(documentHtml: string): Promise<Buffer> {
  const browser = await getChromiumBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(documentHtml, { waitUntil: "load", timeout: 45_000 });
    // Premade brief CSS already pads .page/.content — keep Puppeteer margins tight
    // so violet/coral fills and spacing are not doubled on PDF pages.
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: "8mm", right: "8mm", bottom: "8mm", left: "8mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => null);
  }
}

export function canRenderPdfFromHtml() {
  return canLaunchChromium();
}
