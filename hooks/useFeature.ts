"use client";

import { useSession } from "next-auth/react";
import type { PlanFeatures } from "@/lib/auth";

/** True when the tenant's plan switches this feature on (false until claims load). */
export function useFeature(feature: keyof PlanFeatures): boolean {
  const { data } = useSession();
  return Boolean(data?.user?.features?.[feature]);
}
