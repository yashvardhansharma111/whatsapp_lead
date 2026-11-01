// Drops the cached copy of the homepage content after a CMS save.
//
// The public page reads the sections through `unstable_cache`, tagged so it can be
// invalidated. Nothing was invalidating it, so an edit saved in the admin was written to
// the database and then never shown — the page kept serving whatever it had cached,
// which looked like the save had not worked.

import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { auth } from "@/lib/auth";
import { CMS_CACHE_TAG } from "@/lib/cms/content";

export async function POST() {
  const session = await auth();
  // Only the people who can edit the content can clear its cache.
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // The second argument is required in this version; the one-argument form is
  // deprecated. "max" gives stale-while-revalidate, so the next visitor is served the
  // old copy once rather than waiting on the refetch.
  revalidateTag(CMS_CACHE_TAG, "max");
  return NextResponse.json({ success: true, revalidated: CMS_CACHE_TAG });
}
