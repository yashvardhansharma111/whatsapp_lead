import { CmsSectionsOverview } from "@/components/admin/cms/SectionsOverview";

export const metadata = { title: "Website CMS" };

/** The platform's own homepage content (SUPER_ADMIN). */
export default function CmsOverviewPage() {
  return <CmsSectionsOverview basePath="/admin/cms" />;
}
