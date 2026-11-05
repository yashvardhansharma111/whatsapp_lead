"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

/**
 * Hand-picked contact groups.
 *
 * Distinct from a segment, which is a saved rule re-evaluated on every use. A list is a
 * set someone chose by hand and which stays as they left it — the thing people mean when
 * they say "send it to my group".
 */
export interface ContactListDTO {
  id: string;
  name: string;
  description: string | null;
  contactCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ContactListMemberDTO {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  addedAt: string;
}

export interface ContactListDetailDTO extends Omit<ContactListDTO, "contactCount"> {
  contactCount: number;
  contacts: ContactListMemberDTO[];
}

const KEY = ["contact-lists"] as const;

async function readJson<T>(res: Response, fallback: string): Promise<T> {
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? json?.message ?? fallback);
  return (json?.data ?? json) as T;
}

export function useContactLists() {
  return useQuery<ContactListDTO[]>({
    queryKey: KEY,
    queryFn: async () =>
      readJson<ContactListDTO[]>(await fetch("/api/contact-lists"), "Failed to load contact lists"),
  });
}

export function useContactList(id: string | null) {
  return useQuery<ContactListDetailDTO>({
    queryKey: [...KEY, id],
    enabled: Boolean(id),
    queryFn: async () =>
      readJson<ContactListDetailDTO>(
        await fetch(`/api/contact-lists/${id}`),
        "Failed to load the list",
      ),
  });
}

/** Both the list index and the open list change when members move, so both are refreshed. */
function useListMutation<TVars>(
  run: (vars: TVars) => Promise<Response>,
  fallback: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: TVars) => readJson<unknown>(await run(vars), fallback),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useCreateContactList() {
  return useListMutation<{ name: string; description?: string }>(
    (body) =>
      fetch("/api/contact-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    "Failed to create the list",
  );
}

export function useUpdateContactList() {
  return useListMutation<{ id: string; name?: string; description?: string }>(
    ({ id, ...body }) =>
      fetch(`/api/contact-lists/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    "Failed to update the list",
  );
}

export function useDeleteContactList() {
  return useListMutation<string>(
    (id) => fetch(`/api/contact-lists/${id}`, { method: "DELETE" }),
    "Failed to delete the list",
  );
}

export function useAddToContactList() {
  return useListMutation<{ id: string; contactIds: string[] }>(
    ({ id, contactIds }) =>
      fetch(`/api/contact-lists/${id}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds }),
      }),
    "Failed to add contacts",
  );
}

export function useRemoveFromContactList() {
  return useListMutation<{ id: string; contactIds: string[] }>(
    ({ id, contactIds }) =>
      fetch(`/api/contact-lists/${id}/contacts`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds }),
      }),
    "Failed to remove contacts",
  );
}
