import { redirect } from "next/navigation";

/** Monitors workspace surface retired — send traffic to overview. */
export default function MonitorDetailPage() {
  redirect("/dashboard");
}
