import { redirect } from "next/navigation";

/** Recordings folded into Calls as a tab. */
export default function RecordingsRedirect() {
  redirect("/calls/recordings");
}
