import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import "@/app/auth/auth.css";

export const metadata: Metadata = {
  title: "Sign up — Octivate",
  description: "Create Octivate access and open the Caribbean decision-intelligence workspace.",
};

export default function SignUpPage() {
  return <AuthShell mode="signup" />;
}
