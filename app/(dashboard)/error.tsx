"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard error boundary]", error);
  }, [error]);

  const router = useRouter();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-4 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50">
        <AlertTriangle className="h-7 w-7 text-rose-500" />
      </span>

      <div>
        <h1 className="text-lg font-semibold text-slate-900">Something went wrong</h1>
        <p className="mt-1 text-sm text-slate-500">
          This page hit an unexpected error. Click &quot;Try again&quot; to reload, or go back.
        </p>
        {process.env.NODE_ENV === "development" && error.message && (
          <p className="mt-2 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 font-mono text-xs text-rose-700">
            {error.message}
          </p>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Go back
        </button>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
      </div>
    </div>
  );
}
