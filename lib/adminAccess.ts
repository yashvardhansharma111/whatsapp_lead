/**
 * Who belongs in the admin panel.
 *
 * Asked by both layouts, and it has to be the *same* question in both or they bounce
 * someone between them. That is what happened when the dashboard started sending every
 * PLATFORM-account user to the admin panel while the admin panel still only admitted the
 * Super Admin and granted staff: the platform account's own owner was pushed out of the
 * inbox, refused by the admin panel, sent to login, and — already signed in — sent back.
 * A blank page and an endless redirect, for the one account that runs the product.
 *
 * The platform account is also an ordinary workspace here: it has contacts, chats and a
 * WhatsApp number, and most of its people work in them. Being on it is therefore not a
 * reason to be sent anywhere — holding the power to run the platform is.
 */
export function canUseAdminPanel(user?: {
  role?: string | null;
  accountType?: string | null;
  permissions?: string[] | null;
} | null): boolean {
  if (!user) return false;
  if (user.role === "SUPER_ADMIN") return true;
  return (
    user.accountType === "PLATFORM" &&
    (user.permissions ?? []).some((p) => p.startsWith("platform."))
  );
}
