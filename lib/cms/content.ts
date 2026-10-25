// ============================================================================
// MODULE : Website CMS — server loader (reads from NestJS, not Prisma)
// ============================================================================

import { unstable_cache } from "next/cache";
import { CMS_SECTION_KEYS, type HomeContent, type PublicSection, type SectionKey } from "./sections";
import { toPublicSection, type StoredSection } from "./store";

export const CMS_PAGE = "home";
export const CMS_CACHE_TAG = "cms:home";

const BACKEND = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:4000";

export function buildHomeContent(stored: Map<string, StoredSection>): HomeContent {
  return Object.fromEntries(
    CMS_SECTION_KEYS.map((key) => [key, toPublicSection(key, stored.get(key) ?? null)]),
  ) as HomeContent;
}

type CachedSection = Omit<StoredSection, "updatedAt"> & { key: string; updatedAt: string };

const loadSavedSections = unstable_cache(
  async (): Promise<CachedSection[]> => {
    const res = await fetch(`${BACKEND}/cms/sections/public`, { cache: "no-store" });
    if (!res.ok) throw new Error(`CMS fetch failed: ${res.status}`);
    const json = await res.json();
    const rows: any[] = json?.data ?? [];
    return rows.map((r) => ({
      key:       r.key,
      isActive:  r.isActive,
      content:   r.content,
      itemKinds: r.itemKinds,
      updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : new Date(r.updatedAt).toISOString(),
      items:     r.items ?? [],
    }));
  },
  ["cms-home-sections-v1"],
  { tags: [CMS_CACHE_TAG] },
);

/** Published homepage content: active sections and items, in order, defaults filled in. */
export async function getHomeContent(): Promise<HomeContent> {
  try {
    const saved = await loadSavedSections();
    return buildHomeContent(
      new Map(saved.map(({ key, updatedAt, ...row }) => [key, { ...row, updatedAt: new Date(updatedAt) }])),
    );
  } catch (error) {
    console.warn(
      "[CMS] Rendering default website content — could not read saved content:",
      error instanceof Error ? error.message.split("\n")[0] : error,
    );
    return buildHomeContent(new Map());
  }
}

export async function getSection<K extends SectionKey>(key: K): Promise<PublicSection<K>> {
  const content = await getHomeContent();
  return content[key];
}

/** One section straight from the backend, uncached — for the admin editor. */
export async function readStoredSection(key: SectionKey): Promise<StoredSection | null> {
  const res = await fetch(`${BACKEND}/cms/sections/public`, { cache: "no-store" });
  if (!res.ok) return null;
  const json = await res.json();
  const rows: any[] = json?.data ?? [];
  const row = rows.find((r) => r.key === key);
  if (!row) return null;
  return { isActive: row.isActive, content: row.content, itemKinds: row.itemKinds, updatedAt: new Date(row.updatedAt), items: row.items ?? [] };
}

/** Every saved section, uncached — for the admin overview. */
export async function readStoredSections(): Promise<Map<string, StoredSection>> {
  const res = await fetch(`${BACKEND}/cms/sections/public`, { cache: "no-store" });
  if (!res.ok) return new Map();
  const json = await res.json();
  const rows: any[] = json?.data ?? [];
  return new Map(rows.map((r) => [r.key, { isActive: r.isActive, content: r.content, itemKinds: r.itemKinds, updatedAt: new Date(r.updatedAt), items: r.items ?? [] }]));
}
