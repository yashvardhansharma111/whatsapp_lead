"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Trash2, Users, X, Search } from "lucide-react";
import {
  Button,
  Card,
  EmptyState,
  Modal,
  PageHeader,
  Skeleton,
  inputClass,
} from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import {
  useAddToContactList,
  useContactList,
  useContactLists,
  useCreateContactList,
  useDeleteContactList,
  useRemoveFromContactList,
} from "@/hooks/useContactLists";
import { useContacts } from "@/hooks/useContacts";

/**
 * Contact lists: groups someone assembles by hand and then broadcasts to.
 *
 * The page is deliberately two panes rather than a list and a separate detail route.
 * Building a group is a back-and-forth — add a few, check the count, add a few more —
 * and a page change between each step makes that feel like filing rather than choosing.
 */
export default function ContactListsPage() {
  const { showToast } = useToast();
  const { data: lists = [], isLoading } = useContactLists();

  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const selectedId = openId ?? lists[0]?.id ?? null;
  const { data: detail, isLoading: detailLoading } = useContactList(selectedId);

  const create = useCreateContactList();
  const remove = useDeleteContactList();
  const removeMembers = useRemoveFromContactList();

  const onCreate = () => {
    create.mutate(
      { name: name.trim(), description: description.trim() || undefined },
      {
        onSuccess: () => {
          setCreating(false);
          setName("");
          setDescription("");
          showToast("List created.", "success");
        },
        onError: (err: Error) => showToast(err.message, "error"),
      },
    );
  };

  const onDelete = (id: string) => {
    remove.mutate(id, {
      onSuccess: () => {
        setConfirmDelete(null);
        if (selectedId === id) setOpenId(null);
        showToast("List deleted. The contacts themselves are untouched.", "success");
      },
      onError: (err: Error) => showToast(err.message, "error"),
    });
  };

  return (
    <div>
      <PageHeader
        title="Contact lists"
        description="Groups you build by hand and send to. Unlike a segment, a list stays exactly as you left it."
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            New list
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl lg:col-span-2" />
        </div>
      ) : lists.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No contact lists yet"
          description="Build a group once, then broadcast to it as often as you like."
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              New list
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Left: the lists */}
          <div className="space-y-2">
            {lists.map((l) => (
              <button
                key={l.id}
                onClick={() => setOpenId(l.id)}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                  l.id === selectedId
                    ? "border-emerald-300 bg-emerald-50/60"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                  <Users className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-900">{l.name}</span>
                  <span className="block text-[11px] text-slate-500">
                    {l.contactCount.toLocaleString()} contact{l.contactCount === 1 ? "" : "s"}
                  </span>
                </span>
              </button>
            ))}
          </div>

          {/* Right: the open list */}
          <Card className="p-5 lg:col-span-2">
            {detailLoading || !detail ? (
              <Skeleton className="h-48 rounded-lg" />
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-slate-900">{detail.name}</h2>
                    {detail.description && (
                      <p className="mt-0.5 text-sm text-slate-500">{detail.description}</p>
                    )}
                    <p className="mt-1 text-xs text-slate-500">
                      {detail.contactCount.toLocaleString()} contact
                      {detail.contactCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="secondary" onClick={() => setAdding(true)}>
                      <Plus className="h-4 w-4" />
                      Add contacts
                    </Button>
                    <Link href={`/broadcast?listId=${detail.id}`}>
                      <Button>Broadcast to this list</Button>
                    </Link>
                    <Button variant="secondary" onClick={() => setConfirmDelete(detail.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="mt-4 border-t border-slate-100 pt-3">
                  {detail.contacts.length === 0 ? (
                    <p className="py-6 text-center text-sm text-slate-500">
                      Nobody in this list yet. Add contacts to start.
                    </p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {detail.contacts.map((c) => (
                        <li key={c.id} className="flex items-center gap-3 py-2">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-slate-800">
                              {c.name || c.phone}
                            </span>
                            <span className="block text-[11px] text-slate-400">{c.phone}</span>
                          </span>
                          <button
                            aria-label={`Remove ${c.name || c.phone}`}
                            onClick={() =>
                              removeMembers.mutate(
                                { id: detail.id, contactIds: [c.id] },
                                { onError: (e: Error) => showToast(e.message, "error") },
                              )
                            }
                            className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="New contact list">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="list-name">
              Name
            </label>
            <input
              id="list-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Diwali offer — Delhi"
              className={inputClass}
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="list-desc">
              Description <span className="text-slate-400">(optional)</span>
            </label>
            <input
              id="list-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this group is for"
              className={inputClass}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button onClick={onCreate} disabled={!name.trim() || create.isPending}>
              {create.isPending ? "Creating…" : "Create list"}
            </Button>
          </div>
        </div>
      </Modal>

      {selectedId && (
        <AddContactsModal
          open={adding}
          listId={selectedId}
          alreadyIn={new Set((detail?.contacts ?? []).map((c) => c.id))}
          onClose={() => setAdding(false)}
        />
      )}

      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Delete this list?"
        description="The list goes; the contacts in it stay exactly as they are."
      >
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmDelete(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => confirmDelete && onDelete(confirmDelete)}>
            Delete list
          </Button>
        </div>
      </Modal>
    </div>
  );
}

/** Picks contacts to add, hiding the ones already in the list so nothing is a no-op. */
function AddContactsModal({
  open,
  listId,
  alreadyIn,
  onClose,
}: {
  open: boolean;
  listId: string;
  alreadyIn: Set<string>;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const add = useAddToContactList();

  const { data } = useContacts({ search: search.trim() || undefined, status: "active", page: 1, limit: 50 });
  const rows = useMemo(() => {
    const list = (data as { data?: unknown } | undefined)?.data;
    return (Array.isArray(list) ? list : []) as { id: string; name: string | null; phone: string }[];
  }, [data]);

  const selectable = rows.filter((r) => !alreadyIn.has(r.id));

  const submit = () => {
    add.mutate(
      { id: listId, contactIds: picked },
      {
        onSuccess: (res) => {
          const r = res as { added?: number; alreadyIn?: number } | undefined;
          setPicked([]);
          onClose();
          const already = r?.alreadyIn ? `, ${r.alreadyIn} already in` : "";
          showToast(`${r?.added ?? picked.length} added${already}.`, "success");
        },
        onError: (err: Error) => showToast(err.message, "error"),
      },
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Add contacts to this list">
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or number"
            className={`${inputClass} pl-9`}
            autoFocus
          />
        </div>

        <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
          {selectable.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-500">
              {rows.length === 0 ? "No contacts match." : "Everyone here is already in the list."}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {selectable.map((c) => {
                const on = picked.includes(c.id);
                return (
                  <li key={c.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() =>
                          setPicked((p) => (on ? p.filter((x) => x !== c.id) : [...p, c.id]))
                        }
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-slate-800">
                          {c.name || c.phone}
                        </span>
                        <span className="block text-[11px] text-slate-400">{c.phone}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-xs text-slate-500">
            {picked.length} selected
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={picked.length === 0 || add.isPending}>
              {add.isPending ? "Adding…" : `Add ${picked.length || ""}`.trim()}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
