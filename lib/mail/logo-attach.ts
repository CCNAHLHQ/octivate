import { promises as fs } from "fs";
import path from "path";
import { DEFAULT_MAIL_LOGO_CID } from "@/lib/mail/default-template";
import { MAIL_ICON_CIDS } from "@/lib/mail/invite-defaults";

const LOGO_REL = path.join("public", "email", "octivate-lockup.png");

export type MailInlineAttachment = {
  filename: string;
  content: Buffer;
  cid: string;
  contentType: string;
  contentDisposition: "inline";
};

export type MailLogoAttachment = MailInlineAttachment;

async function readInlinePng(
  relParts: string[],
  filename: string,
  cid: string
): Promise<MailInlineAttachment | null> {
  const file = path.join(/* turbopackIgnore: true */ process.cwd(), ...relParts);
  try {
    const content = await fs.readFile(file);
    if (!content.length) return null;
    return {
      filename,
      content,
      cid,
      contentType: "image/png",
      contentDisposition: "inline",
    };
  } catch {
    return null;
  }
}

/** Load the email lockup for CID embedding. Returns null if the asset is missing. */
export async function loadMailLogoAttachment(): Promise<MailLogoAttachment | null> {
  return readInlinePng(
    ["public", "email", "octivate-lockup.png"],
    "octivate-lockup.png",
    DEFAULT_MAIL_LOGO_CID
  );
}

/** Tutorial-style step icons for invite feature cards. */
export async function loadMailIconAttachments(): Promise<MailInlineAttachment[]> {
  const specs: Array<{ file: string; filename: string; cid: string }> = [
    {
      file: "icon-brief.png",
      filename: "icon-brief.png",
      cid: MAIL_ICON_CIDS.brief,
    },
    {
      file: "icon-monitor.png",
      filename: "icon-monitor.png",
      cid: MAIL_ICON_CIDS.monitor,
    },
    {
      file: "icon-team.png",
      filename: "icon-team.png",
      cid: MAIL_ICON_CIDS.team,
    },
  ];
  const out: MailInlineAttachment[] = [];
  for (const spec of specs) {
    const att = await readInlinePng(
      ["public", "email", "icons", spec.file],
      spec.filename,
      spec.cid
    );
    if (att) out.push(att);
  }
  return out;
}

export function mailLogoPublicUrl(siteUrl: string): string {
  const site = siteUrl.replace(/\/$/, "");
  return `${site}/email/octivate-lockup.png`;
}

/** @deprecated path constant kept for callers that expect LOGO_REL */
export const MAIL_LOGO_REL = LOGO_REL;
