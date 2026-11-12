// Admin panel layout — white theme, ink text.
//
// The Super Admin, and anyone they have taken on to help. Staff are ordinary users on
// the platform account holding one or more `platform.*` permissions, so the test is
// whether they hold any at all rather than what their role is called: a client's own
// ADMIN holds none of these and never can, the ceiling sees to that.

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { canUseAdminPanel } from "@/lib/adminAccess";
import { getBrandForTenant } from "@/lib/branding";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";

  if (!session?.user) redirect("/login");
  // Sent back to their own workspace rather than to login: they are signed in, and
  // telling someone to sign in when they already have only loops.
  if (!canUseAdminPanel(session.user)) redirect("/inbox");

  // The operator's own brand. The panel printed a hardcoded name and a shield, so the
  // screen where the logo is uploaded was the one screen that never showed it.
  const brand = await getBrandForTenant(session.user.tenantId);

  return (
    <div className="flex h-dvh overflow-hidden bg-white text-slate-900">
      <AdminSidebar
        name={session.user.name}
        email={session.user.email}
        permissions={isSuperAdmin ? null : session.user.permissions ?? []}
        brand={{ name: brand.name, logoUrl: brand.logoUrl, primaryColor: brand.primaryColor }}
      />

      <main className="scrollbar-slim flex-1 overflow-y-auto bg-[#FAFAFA]">
        <div className="mx-auto max-w-[1400px] px-4 pb-12 pt-16 sm:px-6 lg:px-8 lg:pt-8">
          {children}
        </div>
      </main>
    </div>
  );
}