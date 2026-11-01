// Reseller → Website: the brand's own homepage content, section by section.
//
// The same editor the platform uses for its own site. Which rows it writes to is decided
// on the server by who is asking, so a reseller only ever edits its own brand's copy.

import { CmsSectionsOverview } from "@/components/admin/cms/SectionsOverview";

export const metadata = { title: "Website" };

export default function ResellerWebsitePage() {
  return <CmsSectionsOverview basePath="/reseller/website" />;
}
