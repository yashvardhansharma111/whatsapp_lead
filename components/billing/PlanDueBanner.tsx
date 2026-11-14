"use client";

// "Your plan has ended" — said once, everywhere, before anything stops working.
//
// The grace period was enforced and never mentioned. An account's period ended, the
// guard let everything carry on for however many days the platform had set, and then
// features began refusing — with nothing anywhere having said a clock was running. The
// first anyone knew was a screen that stopped working.
//
// It sits above the app rather than on the billing page, because somebody whose plan has
// lapsed has no reason to open billing; they are in the inbox, wondering why AI replies
// stopped.

import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { useBilling } from "@/hooks/useBilling";
import { cn } from "@/lib/utils";

export function PlanDueBanner() {
  const { data } = useBilling();
  const grace = data?.grace;
  if (!grace?.lapsed) return null;

  const days = grace.daysLeft ?? 0;
  // Last day reads differently from "5 days left": one is a reminder, the other is now.
  const urgent = !grace.inGrace || days <= 2;

  const headline = !grace.inGrace
    ? "Your plan has ended"
    : days <= 1
      ? "Your plan ends today"
      : `${days} days left on your plan`;

  const detail = !grace.inGrace
    ? "Paid features are switched off. Your chats, contacts and history are untouched — renewing turns everything back on."
    : `Your billing period has ended. Everything keeps working until ${formatDay(grace.endsAt)}, after which the paid features stop. Your data stays either way.`;

  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2.5 text-sm",
        urgent
          ? "border-rose-200 bg-rose-50 text-rose-900"
          : "border-amber-200 bg-amber-50 text-amber-900",
      )}
    >
      <AlertTriangle className={cn("h-4 w-4 shrink-0", urgent ? "text-rose-600" : "text-amber-600")} />
      <span className="font-semibold">{headline}</span>
      <span className="min-w-0 flex-1 text-[13px] opacity-90">{detail}</span>
      <Link
        href="/billing"
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition",
          urgent ? "bg-rose-600 hover:bg-rose-700" : "bg-amber-600 hover:bg-amber-700",
        )}
      >
        Renew now
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function formatDay(iso: string | null): string {
  if (!iso) return "the end of the grace period";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "the end of the grace period";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long" });
}
