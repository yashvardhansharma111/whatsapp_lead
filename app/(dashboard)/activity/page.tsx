"use client";

// Who did what, and when.
//
// It was a tab inside Settings, which is where you go to change things rather than to
// read what has already happened. It is its own entry now, next to the other screens
// that answer questions about the workspace.

import { PageHeader } from "@/components/ui";
import { ActivityTab } from "@/components/settings/ActivityTab";

export default function ActivityPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Activity log"
        description="Every change anyone on the team made in this workspace, newest first."
      />
      <ActivityTab />
    </div>
  );
}
