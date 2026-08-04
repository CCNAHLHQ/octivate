import type { StaffProfileId } from "@/lib/auth/types";

export type SupportMessageRole = "user" | "operator" | "system";

export type SupportAttachment = {
  id: string;
  name: string;
  mime: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  size: number;
  /** Validated image data URL only — omitted on lean list payloads. */
  dataUrl?: string;
};

export type SupportMessage = {
  id: string;
  role: SupportMessageRole;
  body: string;
  at: string;
  attachments?: SupportAttachment[];
  staffProfileId?: StaffProfileId;
  staffName?: string;
  /** Formal canned-reply id when operator used a quick response. */
  quickReplyId?: string;
};

export type SupportThreadStatus = "open" | "pending" | "closed";

/** Client environment captured at thread open / message (moderation). */
export type SupportClientMeta = {
  ip?: string;
  userAgent?: string;
  browser?: string;
  os?: string;
  language?: string;
  capturedAt?: string;
};

export type SupportThread = {
  id: string;
  /** Required for account-based support. */
  userId: string;
  email: string;
  displayName?: string;
  username?: string;
  avatarUrl?: string | null;
  subject: string;
  status: SupportThreadStatus;
  createdAt: string;
  updatedAt: string;
  /** Set when an operator archives a resolved thread — hidden from active inbox tabs. */
  archivedAt?: string;
  /** Staff currently handling the thread. */
  assignedStaffId?: StaffProfileId;
  assignedStaffName?: string;
  clientMeta?: SupportClientMeta;
  messages: SupportMessage[];
};

export const OPERATOR_QUICK_REPLIES: { id: string; label: string; body: string }[] = [
  {
    id: "ack",
    label: "Acknowledge",
    body: "Thank you for contacting Octivate Support. We have received your message and will respond shortly.",
  },
  {
    id: "access",
    label: "Access help",
    body: "Thank you for writing in. To assist with workspace access, please confirm the email on your account and the page where the issue occurs. We will guide you through the next steps.",
  },
  {
    id: "brief",
    label: "Briefs",
    body: "Thank you for your note regarding briefs. Please share the brief title or project name so we can locate it and advise on review or export options.",
  },
  {
    id: "billing",
    label: "Plans",
    body: "Thank you for your enquiry about plans. We will outline the options that fit your organisation and confirm any Team access requirements.",
  },
  {
    id: "close",
    label: "Resolve",
    body: "We believe this matter is resolved. If you need further assistance, reply here and we will reopen the conversation promptly.",
  },
];
