"use client";

import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export async function exportPreviewToPdf(previewEl: HTMLElement, fileName: string) {
  const canvas = await html2canvas(previewEl, {
    scale: Math.min(window.devicePixelRatio || 1, 2),
    useCORS: true,
    backgroundColor: "#ffffff",
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 36;
  const imgWidth = pageWidth - margin * 2;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = margin;

  pdf.setFontSize(9);
  pdf.setTextColor(148, 163, 184);
  pdf.text("Octivate — Confidential", margin, pageHeight - 18);

  pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
  heightLeft -= pageHeight - margin * 2;

  while (heightLeft > 0) {
    pdf.addPage();
    pdf.setFontSize(9);
    pdf.setTextColor(148, 163, 184);
    pdf.text("Octivate — Confidential", margin, pageHeight - 18);
    position = margin - (imgHeight - heightLeft);
    pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
    heightLeft -= pageHeight - margin * 2;
  }

  pdf.save(fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`);
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportBriefFile(opts: {
  briefId: string;
  templateId: string;
  format: "html" | "pdf" | "docx" | "pptx";
  mock?: boolean;
  apiKey?: string;
}) {
  const key =
    opts.apiKey ||
    process.env.NEXT_PUBLIC_OCTIVATE_API_KEY ||
    process.env.OCTIVATE_API_KEY ||
    "octivate-dev-key";

  const res = await fetch(`/api/briefs/${opts.briefId}/export`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/octet-stream, application/json",
    },
    body: JSON.stringify({
      templateId: opts.templateId,
      format: opts.format,
      mock: opts.mock,
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || `Export failed (${res.status})`);
  }

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/);
  const fileName = match?.[1] || `octivate-export.${opts.format}`;
  return { blob, fileName };
}
