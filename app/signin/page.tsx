import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import "@/app/auth/auth.css";

export const metadata: Metadata = {
  title: "Sign in — Octivate",
  description: "Sign in to the Octivate decision-intelligence workspace.",
};

export default function SignInPage() {
  return <AuthShell mode="signin" />;
}
