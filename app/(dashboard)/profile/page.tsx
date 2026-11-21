"use client";

// Your own account: who you are, your invite code and your password.
//
// It was the first tab of Settings, which is otherwise about the workspace — the one
// page there that nobody else's permissions could hide, sitting among a dozen that
// theirs could. It is its own entry now.

import { PageHeader } from "@/components/ui";
import { AccountTab } from "@/components/settings/AccountTab";

export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="My profile" description="Your account, invite code and password." />
      <AccountTab />
    </div>
  );
}
