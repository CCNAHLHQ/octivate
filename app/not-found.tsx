import type { Metadata } from "next";
import { NotFoundPage } from "@/components/not-found/not-found-page";
import "@/app/landing-depth.css";
import "@/app/not-found.css";

export const metadata: Metadata = {
  title: "Page not found | Octivate",
  description:
    "This route isn't on the Octivate intelligence map. Return home, open the workspace, or contact the CENSII team.",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return <NotFoundPage />;
}
