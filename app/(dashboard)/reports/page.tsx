import { redirect } from "next/navigation";

/** Reports folded into Analytics as a tab. Anyone holding the old link still lands. */
export default function ReportsRedirect() {
  redirect("/analytics/reports");
}
