import { notFound } from "next/navigation";
import { CmsSectionPage } from "@/components/admin/cms/SectionEditor";
import { isSectionKey } from "@/lib/cms/sections";

export default async function ResellerWebsiteSection({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!isSectionKey(section)) notFound();
  return <CmsSectionPage sectionKey={section} basePath="/reseller/website" />;
}
