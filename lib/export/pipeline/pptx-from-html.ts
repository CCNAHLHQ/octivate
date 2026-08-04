import PptxGenJS from "pptxgenjs";

type SlideChunk = { title: string; body: string };

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function extractTitle(chunk: string, fallback: string) {
  const match = chunk.match(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/i);
  return match ? stripHtml(match[1]) : fallback;
}

function splitByHeadings(html: string): SlideChunk[] {
  const parts = html.split(/(?=<h[12][^>]*>)/i).filter((p) => p.trim());
  if (parts.length <= 1) {
    const title = extractTitle(html, "Brief");
    return [{ title, body: stripHtml(html) }];
  }
  return parts.map((part, i) => ({
    title: extractTitle(part, `Slide ${i + 1}`),
    body: stripHtml(part),
  }));
}

function splitHtmlIntoSlides(html: string): SlideChunk[] {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const content = bodyMatch ? bodyMatch[1] : html;

  const sections: string[] = [];
  const sectionRegex = /<section[^>]*>([\s\S]*?)<\/section>/gi;
  let match: RegExpExecArray | null;
  while ((match = sectionRegex.exec(content)) !== null) {
    sections.push(match[1]);
  }

  if (sections.length) {
    return sections.map((section, i) => ({
      title: extractTitle(section, `Section ${i + 1}`),
      body: stripHtml(section),
    }));
  }

  return splitByHeadings(content);
}

export async function pptxFromHtml(documentHtml: string, meta?: { title?: string }): Promise<Buffer> {
  const slides = splitHtmlIntoSlides(documentHtml);
  const pptx = new PptxGenJS();
  pptx.author = "Octivate";
  pptx.company = "Octivate";
  pptx.title = meta?.title ?? slides[0]?.title ?? "Octivate export";

  for (const chunk of slides) {
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };
    slide.addText(chunk.title, {
      x: 0.5,
      y: 0.35,
      w: 9,
      h: 0.6,
      fontSize: 22,
      color: "9333EA",
      bold: true,
    });
    slide.addText(chunk.body.slice(0, 4000), {
      x: 0.5,
      y: 1.1,
      w: 9,
      h: 4.2,
      fontSize: 12,
      color: "101A2E",
      valign: "top",
      wrap: true,
    });
  }

  if (!slides.length) {
    const slide = pptx.addSlide();
    slide.addText(meta?.title ?? "Octivate export", {
      x: 0.5,
      y: 2,
      w: 9,
      fontSize: 24,
      color: "101A2E",
      align: "center",
    });
  }

  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}
