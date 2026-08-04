import { redirect } from "next/navigation";

export default function MarqueeRedirectPage() {
  redirect("/dashboard/operator#ticker");
}
