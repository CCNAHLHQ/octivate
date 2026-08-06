import path from "path";

export const FC_PUBLISH_TARGET =
  process.env.FC_LOGBOOK_URL || "https://os.futurecaribbean.com/builder/logbook";

export const FC_PUBLISH_TARGET_LABEL = "Future Caribbean Builder · Logbook";

export const FC_LOGIN_URL =
  process.env.FC_LOGIN_URL || "https://os.futurecaribbean.com/login";

export const FC_GITHUB_SCREENSHOT_DIR =
  "docs/future-caribbean-logbook/screenshots";

export const FC_GITHUB_RAW_BASE =
  process.env.FC_GITHUB_SCREENSHOT_BASE ||
  "https://github.com/CCNAHLHQ/octivate/blob/main/docs/future-caribbean-logbook/screenshots";

export function fcToolDir() {
  return (
    process.env.FC_LOGBOOK_TOOL_DIR ||
    path.join(
      process.env.USERPROFILE || "C:\\Users\\Administrator",
      "Desktop",
      "octivate-fc-logbook-tool"
    )
  );
}

export function fcCredentials() {
  return {
    email: process.env.FC_LOGBOOK_EMAIL || process.env.FC_EMAIL || "",
    password: process.env.FC_LOGBOOK_PASSWORD || process.env.FC_PASSWORD || "",
  };
}
