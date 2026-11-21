"use client";

import { useQuery } from "@tanstack/react-query";

export interface AssignableAgent {
  id: string;
  name: string | null;
  avatar?: string | null;
}

/**
 * The teammates a conversation can be handed to.
 *
 * Its own endpoint rather than the settings one: that needs permission to manage users,
 * which an agent reassigning a chat does not have, and it carries emails and credit
 * counters a dropdown has no use for.
 */
export function useAssignableAgents() {
  return useQuery({
    queryKey: ["conversation-agents"],
    queryFn: async () => {
      const res = await fetch("/api/conversations/agents");
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "Couldn't load the team");
      const data = (json as { data?: unknown }).data ?? json;
      return data as { agents: AssignableAgent[] };
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
}
