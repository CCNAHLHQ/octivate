export type FcDayEntry = {
  key: string;
  title: string;
  body: string;
  screenshot?: string;
  weekLabel: string;
};

export type FcDayStatus = {
  key: string;
  weekLabel: string;
  title: string;
  planned: boolean;
  remoteChars: number;
  remotePreview: string;
  disabled: boolean;
  present: boolean;
  needsPublish: boolean;
  screenshot?: string;
};

export type FcJobStep = {
  id: string;
  label: string;
  status: "pending" | "running" | "done" | "error" | "skipped";
  detail?: string;
};

export type FcLogbookJob = {
  id: string;
  status: "idle" | "running" | "done" | "error";
  publishTarget: string;
  publishTargetLabel: string;
  startedAt: string | null;
  finishedAt: string | null;
  steps: FcJobStep[];
  progress: { done: number; total: number; pct: number; label: string };
  check?: {
    planned: number;
    present: number;
    missing: number;
    disabled: number;
    days: FcDayStatus[];
  };
  results?: Array<{
    key: string;
    ok: boolean;
    skipped?: boolean;
    error?: string;
    chars?: number;
  }>;
  github?: {
    uploaded: number;
    urls: string[];
    commitUrl?: string;
  };
  error?: string;
};
