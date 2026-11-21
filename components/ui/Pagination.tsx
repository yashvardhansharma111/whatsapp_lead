"use client";

// One pager for every list in the product.
//
// Each screen used to draw its own, and they had drifted: contacts showed 50 a page,
// campaigns 20, the admin tables 100, and none of them let anyone change it. Somebody
// going through two thousand contacts clicked Next forty times.
//
// So: twenty by default, and a choice of twenty, fifty, a hundred or two hundred. Two
// hundred is also the server's ceiling, so the number on the screen is the number that
// comes back.

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const PAGE_SIZES = [20, 50, 100, 200] as const;
export const DEFAULT_PAGE_SIZE = 20;

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
  className,
  busy,
}: {
  page: number;
  pageSize: number;
  /** Rows in the whole list, not on this page. */
  total: number;
  onPage: (page: number) => void;
  /** Omit to hide the size picker — a list with one short page has no use for it. */
  onPageSize?: (size: number) => void;
  className?: string;
  busy?: boolean;
}) {
  const pages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-slate-100 px-4 py-3 text-sm",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-slate-500 tabular-nums">
          {total === 0 ? "Nothing to show" : `${from}–${to} of ${total.toLocaleString("en-IN")}`}
        </span>
        {onPageSize && total > PAGE_SIZES[0] && (
          <label className="flex items-center gap-1.5 text-slate-500">
            <span className="sr-only sm:not-sr-only">Per page</span>
            <select
              value={pageSize}
              onChange={(e) => {
                // Back to the first page: the row someone was looking at is not on
                // page 7 any more once a page holds ten times as much.
                onPageSize(Number(e.target.value));
                onPage(1);
              }}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none transition focus:border-slate-400"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="flex items-center gap-1">
        <span className="mr-2 text-slate-500 tabular-nums">
          Page {page} / {pages}
        </span>
        <PagerButton label="Previous page" disabled={page <= 1 || busy} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </PagerButton>
        <PagerButton label="Next page" disabled={page >= pages || busy} onClick={() => onPage(page + 1)}>
          <ChevronRight className="h-4 w-4" />
        </PagerButton>
      </div>
    </div>
  );
}

function PagerButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 ring-1 ring-inset ring-slate-200 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
