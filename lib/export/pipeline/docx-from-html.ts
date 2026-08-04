import HTMLtoDOCX from "html-to-docx";

export async function docxFromHtml(documentHtml: string): Promise<Buffer> {
  const result = await HTMLtoDOCX(
    documentHtml,
    null,
    {
      table: { row: { cantSplit: true } },
      footer: false,
      pageNumber: false,
      creator: "Octivate",
      title: "Octivate export",
    },
    null
  );

  if (Buffer.isBuffer(result)) return result;
  if (result instanceof ArrayBuffer) return Buffer.from(result);
  if (ArrayBuffer.isView(result)) {
    return Buffer.from(result.buffer, result.byteOffset, result.byteLength);
  }
  return Buffer.from(result as Uint8Array);
}
