"use client";

import { useState } from "react";
import { AlertCircle, Check, Loader2, Pencil, Plus, Star, Trash2, Users } from "lucide-react";
import { Avatar, Button, Card, EmptyState, Field, Modal, SkeletonRows, inputClass } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { CardHead, SettingsIntro } from "@/components/settings/SettingsPrimitives";
import {
  useDeleteDepartment, useDepartmentMembers, useDepartments, useSaveDepartment, type Department,
} from "@/hooks/useHandovers";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";

const COLORS = ["slate", "blue", "emerald", "amber", "rose", "violet", "sky", "indigo", "teal", "orange"] as const;

const SWATCH: Record<string, string> = {
  slate: "bg-slate-400", blue: "bg-blue-500", emerald: "bg-emerald-500", amber: "bg-amber-500",
  rose: "bg-rose-500", violet: "bg-violet-500", sky: "bg-sky-500", indigo: "bg-indigo-500",
  teal: "bg-teal-500", orange: "bg-orange-500",
};

/**
 * Departments: Sales, Support, Billing.
 *
 * A department is where a handover goes, not a permission boundary. Being in Support does
 * not change what somebody can see — their permissions decide that — it decides which
 * conversations reach them.
 */
export function DepartmentsTab() {
  const { can } = usePermissions();
  const canManage = can("settings.manage");
  const { data: departments = [], isLoading, isError, error } = useDepartments();
  const remove = useDeleteDepartment();
  const { showToast } = useToast();

  const [editing, setEditing] = useState<Department | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Department | null>(null);

  return (
    <div className="space-y-4">
      <SettingsIntro icon={Users} title="Who picks up a transfer" storageKey="departments">
        When the AI steps aside, the conversation has to land with someone. A department is that
        destination — a flow can name one, and transfer settings can send everything to one.
      </SettingsIntro>

      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardHead
              icon={Users}
              bordered={false}
              title="Departments"
              description="Where a transferred conversation goes. A flow can name one, and transfer settings can route everything to one."
            />
          </div>
          {canManage && (
            <Button size="sm" onClick={() => setCreating(true)} className="shrink-0">
              <Plus className="h-3.5 w-3.5" />
              New department
            </Button>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-4"><SkeletonRows rows={3} /></div>
        ) : isError ? (
          <EmptyState
            icon={AlertCircle}
            title="Couldn't load departments"
            description={(error as Error)?.message ?? "Something went wrong. Try again in a moment."}
          />
        ) : departments.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No departments yet"
            description="Without one, a transfer goes to whoever in the workspace is least busy. Add Sales and Support to route them separately."
            action={canManage ? (
              <Button onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" />
                New department
              </Button>
            ) : undefined}
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {departments.map((d) => (
              <li key={d.id} className="flex flex-wrap items-start gap-3 p-4">
                <span className={cn("mt-1 h-3 w-3 shrink-0 rounded-full", SWATCH[d.color] ?? SWATCH.slate)} />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-900">{d.name}</p>
                    {d.isDefault && (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">
                        <Star className="h-3 w-3" />
                        Default
                      </span>
                    )}
                    {!d.enabled && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">Off</span>
                    )}
                    {d.waitingCount > 0 && (
                      <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium text-rose-700">
                        {d.waitingCount} waiting
                      </span>
                    )}
                  </div>
                  {d.description && <p className="mt-0.5 text-sm text-slate-500">{d.description}</p>}

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {d.members.length === 0 ? (
                      <span className="text-xs text-amber-700">
                        Nobody in it yet, so handovers fall back to the whole workspace.
                      </span>
                    ) : (
                      d.members.map((m) => (
                        <span key={m.id} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-0.5 pl-0.5 pr-2">
                          <Avatar name={m.name} src={m.avatar} size="xs" />
                          <span className="text-xs text-slate-700">{m.name}</span>
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {canManage && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(d)} aria-label={`Edit ${d.name}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      className="text-rose-600 hover:bg-rose-50"
                      onClick={() => setConfirmDelete(d)}
                      aria-label={`Delete ${d.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {(creating || editing) && (
        <DepartmentModal
          department={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
        />
      )}

      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => { if (!remove.isPending) setConfirmDelete(null); }}
        title="Delete this department?"
        description={confirmDelete
          ? `"${confirmDelete.name}" will be removed. Conversations already handed over keep their history.`
          : ""}
      >
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setConfirmDelete(null)} disabled={remove.isPending}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={remove.isPending}
            onClick={() => {
              if (!confirmDelete) return;
              remove.mutateAsync(confirmDelete.id)
                .then(() => { showToast("Department deleted.", "success"); setConfirmDelete(null); })
                .catch((e: Error) => showToast(e.message, "error"));
            }}
          >
            {remove.isPending ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function DepartmentModal({ department, onClose }: { department: Department | null; onClose: () => void }) {
  const save = useSaveDepartment();
  const { showToast } = useToast();
  const { data: people = [] } = useDepartmentMembers();

  const [name, setName] = useState(department?.name ?? "");
  const [description, setDescription] = useState(department?.description ?? "");
  const [color, setColor] = useState(department?.color ?? "slate");
  const [isDefault, setIsDefault] = useState(department?.isDefault ?? false);
  const [enabled, setEnabled] = useState(department?.enabled ?? true);
  const [memberIds, setMemberIds] = useState<string[]>(department?.members.map((m) => m.id) ?? []);

  function submit() {
    if (!name.trim()) { showToast("Give the department a name.", "error"); return; }
    save.mutateAsync({
      id: department?.id,
      name: name.trim(),
      description: description.trim() || null,
      color, isDefault, enabled, memberIds,
    })
      .then(() => { showToast(department ? "Department saved." : "Department created.", "success"); onClose(); })
      .catch((e: Error) => showToast(e.message, "error"));
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={department ? "Edit department" : "New department"}
      description="Who should pick up a conversation handed to this group."
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Field label="Name" htmlFor="dept-name" required>
          <input
            id="dept-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            className={inputClass}
            placeholder="Sales"
          />
        </Field>

        <Field label="What it covers" htmlFor="dept-description">
          <input
            id="dept-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={200}
            className={inputClass}
            placeholder="New business enquiries and pricing"
          />
        </Field>

        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-700">Colour</p>
          <div className="flex flex-wrap gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={c}
                aria-pressed={color === c}
                className={cn(
                  "h-7 w-7 rounded-full transition",
                  SWATCH[c],
                  color === c ? "ring-2 ring-slate-900 ring-offset-2" : "hover:scale-110",
                )}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-700">
            Who is in it
            {memberIds.length > 0 && <span className="ml-1 font-normal text-slate-400">· {memberIds.length} chosen</span>}
          </p>
          {people.length === 0 ? (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              Loading the people in this workspace…
            </p>
          ) : (
            <div className="scrollbar-slim max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-1.5">
              {people.map((p) => {
                const chosen = memberIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setMemberIds((ids) => chosen ? ids.filter((i) => i !== p.id) : [...ids, p.id])}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition",
                      chosen ? "bg-emerald-50 text-emerald-800" : "text-slate-700 hover:bg-slate-50",
                    )}
                  >
                    <span className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      chosen ? "border-emerald-500 bg-emerald-500" : "border-slate-300",
                    )}>
                      {chosen && <Check className="h-3 w-3 text-white" />}
                    </span>
                    {p.name}
                  </button>
                );
              })}
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">
            An empty department falls back to the whole workspace rather than leaving a customer waiting.
          </p>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-emerald-600" />
            Send handovers here when nothing more specific was chosen
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-emerald-600" />
            In use
          </label>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {department ? "Save changes" : "Create department"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
