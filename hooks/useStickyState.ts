"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * A small piece of view state that outlives a refresh — which number an inbox is filtered
 * to, which tab was open.
 *
 * It lives in this browser and nowhere else: it never reaches the server, another device
 * or a colleague, so it is only ever used for a convenience the page can do without. The
 * page must still render correctly when it comes back empty, because in a private window,
 * with site data blocked, or during a thumbnail capture, it will.
 */

// localStorage has no event for same-tab writes, so writers announce their own changes.
// `storage` covers the other tabs, which keeps two open windows in step.
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  if (listeners.size === 1 && typeof window !== "undefined") {
    window.addEventListener("storage", announce);
  }
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0 && typeof window !== "undefined") {
      window.removeEventListener("storage", announce);
    }
  };
}

function announce() {
  listeners.forEach((l) => l());
}

function read(key: string, fallback: string): string {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function useStickyState(
  key: string,
  fallback = "",
): [string, (next: string) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key, fallback),
    // The server has no browser to ask, so it renders the fallback and the first client
    // paint matches it.
    () => fallback,
  );

  const set = useCallback(
    (next: string) => {
      try {
        if (next && next !== fallback) window.localStorage.setItem(key, next);
        else window.localStorage.removeItem(key);
      } catch {
        // A private window refuses to store; the choice simply does not outlive the page.
      }
      announce();
    },
    [key, fallback],
  );

  return [value, set];
}
