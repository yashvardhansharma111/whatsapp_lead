"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global error boundary]", error);
  }, [error]);

  return (
    <html>
      <body className="flex min-h-screen items-center justify-center bg-white p-6 font-sans text-slate-900">
        <div className="flex max-w-sm flex-col items-center gap-4 text-center">
          <p className="text-4xl">⚠️</p>
          <h1 className="text-lg font-semibold">Application error</h1>
          <p className="text-sm text-slate-500">
            An unexpected error occurred. Please refresh the page.
          </p>
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </body>
    </html>
  );
}
