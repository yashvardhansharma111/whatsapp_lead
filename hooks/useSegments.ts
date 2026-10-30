"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchAllPages } from "@/lib/fetchAll";

/** A saved filter over contacts, as every picker in the app reads it. */
export interface Segment {
  id: string;
  name: string;
  description?: string | null;
  /** How many contacts match right now — a segment is a live query, not a fixed list. */
  count: number;
  updatedAt?: string;
}

/**
 * The workspace's segments.
 *
 * One hook for every caller on purpose: the contacts filter, the campaign composer and
 * the broadcast picker each used to fetch this themselves under the same react-query key,
 * which meant one cache entry with three different fetchers writing to it — whichever ran
 * first decided what the others saw.
 *
 * @param enabled false holds the request until a picker is actually opened.
 */
export function useSegments(enabled = true) {
  return useQuery<Segment[]>({
    queryKey: ["segments"],
    queryFn: () => fetchAllPages<Segment>("/api/segments"),
    enabled,
    staleTime: 60_000,
  });
}
