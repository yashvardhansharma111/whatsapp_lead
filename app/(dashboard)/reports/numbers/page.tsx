import { redirect } from "next/navigation";

/** Messages-per-number folded into Analytics as a tab. */
export default function NumbersRedirect() {
  redirect("/analytics/numbers");
}
