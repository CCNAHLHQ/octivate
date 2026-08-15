import { redirect } from "next/navigation";

/** Workspace sources UI retired — registry lives on the operator catalog only. */
export default function SourcesPageRedirect() {
  redirect("/dashboard");
}
