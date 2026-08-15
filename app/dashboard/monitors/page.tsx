import { redirect } from "next/navigation";

/** Monitors workspace surface retired — send traffic to overview. */
export default function MonitorsPage() {
  redirect("/dashboard");
}
