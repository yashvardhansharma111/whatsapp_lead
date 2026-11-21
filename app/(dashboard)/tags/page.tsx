import { redirect } from "next/navigation";

/** Label management moved into Settings; applying a label happens in the chat. */
export default function TagsRedirect() {
  redirect("/settings?tab=labels");
}
