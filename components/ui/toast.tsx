"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { AlertCircle, Bell, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastKind = "success" | "error" | "info" | "notification";

export interface ToastOptions {
  title: string;
  description?: string;
  kind?: ToastKind;
  /** Milliseconds before auto-dismiss; 0 keeps it until dismissed. */
  duration?: number;
  action?: { label: string; onClick: () => void };
  /** Toasts sharing a key replace each other instead of stacking. */
  key?: string;
}

interface ToastItem extends Required<Pick<ToastOptions, "title" | "kind" | "duration">> {
  id: number;
  description?: string;
  action?: ToastOptions["action"];
  key?: string;
}

interface ToastCtx {
  /** `showToast("Saved", "success")` or `showToast({ title, description, action })`. */
  showToast: (message: string | ToastOptions, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastCtx>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const ICON: Record<ToastKind, typeof Info> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  notification: Bell,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string | ToastOptions, kind: ToastKind = "info") => {
      const opts: ToastOptions = typeof message === "string" ? { title: message, kind } : message;
      const id = Date.now() + Math.random();
      const item: ToastItem = {
        id,
        title: opts.title,
        description: opts.description,
        kind: opts.kind ?? kind,
        duration: opts.duration ?? (opts.kind === "notification" ? 7000 : 4500),
        action: opts.action,
        key: opts.key,
      };
      setToasts((prev) => {
        const kept = item.key ? prev.filter((x) => x.key !== item.key) : prev;
        for (const old of prev) {
          if (item.key && old.key === item.key) {
            const t = timers.current.get(old.id);
            if (t) clearTimeout(t);
            timers.current.delete(old.id);
          }
        }
        return [...kept, item];
      });
      if (item.duration > 0) {
        timers.current.set(id, setTimeout(() => dismiss(id), item.duration));
      }
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[9999] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((t) => {
          const Icon = ICON[t.kind];
          return (
            <div
              key={t.id}
              role={t.kind === "error" ? "alert" : "status"}
              className={cn(
                "pointer-events-auto flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm shadow-lg",
                t.kind === "success" && "bg-emerald-600 text-white",
                t.kind === "error" && "bg-rose-600 text-white",
                t.kind === "info" && "bg-slate-800 text-white",
                t.kind === "notification" && "bg-white text-slate-900 ring-1 ring-slate-900/10",
              )}
            >
              <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", t.kind === "notification" && "text-emerald-600")} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{t.title}</p>
                {t.description && (
                  <p className={cn("mt-0.5 line-clamp-2 text-xs", t.kind === "notification" ? "text-slate-500" : "opacity-85")}>
                    {t.description}
                  </p>
                )}
                {t.action && (
                  <button
                    type="button"
                    onClick={() => {
                      t.action?.onClick();
                      dismiss(t.id);
                    }}
                    className={cn(
                      "mt-1.5 text-xs font-semibold underline-offset-2 hover:underline",
                      t.kind === "notification" ? "text-emerald-700" : "text-white",
                    )}
                  >
                    {t.action.label}
                  </button>
                )}
              </div>
              <button onClick={() => dismiss(t.id)} className="shrink-0 opacity-70 hover:opacity-100" aria-label="Dismiss">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
