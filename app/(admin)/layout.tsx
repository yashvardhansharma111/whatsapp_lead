// Admin panel layout — white theme, ink text.
//
// The Super Admin, and anyone they have taken on to help. Staff are ordinary users on
// the platform account holding one or more `platform.*` permissions, so the test is
// whether they hold any at all rather than what their role is called: a client's own
// ADMIN holds none of these and never can, the ceiling sees to that.

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";
  const isStaff =
    session?.user?.accountType === "PLATFORM" &&
    (session.user.permissions ?? []).some((p) => p.startsWith("platform."));

  if (!session?.user || (!isSuperAdmin && !isStaff)) {
    redirect("/login");
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-white text-slate-900">
      <AdminSidebar
        name={session.user.name}
        email={session.user.email}
        permissions={isSuperAdmin ? null : session.user.permissions ?? []}
      />

      <main className="scrollbar-slim flex-1 overflow-y-auto bg-[#FAFAFA]">
        <div className="mx-auto max-w-[1400px] px-4 pb-12 pt-16 sm:px-6 lg:px-8 lg:pt-8">
          {children}
        </div>
      </main>
    </div>
  );
}