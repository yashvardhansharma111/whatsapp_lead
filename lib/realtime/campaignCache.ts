// Pure reducer applying `campaign:progress` to every cache shape that holds campaigns:
//   Campaign[]                       (["campaigns", status] on the campaigns page)
//   { data: Campaign[] }             (hooks/useCampaigns list)
//   { data: Campaign }               (hooks/useCampaigns detail)
//   { campaign: Campaign, … }        (["campaign", id] on the report page)

import type { RtCampaignProgress } from "./events";

type Row = Record<string, unknown> & { id?: string };

function patchRow(row: Row, p: RtCampaignProgress): Row {
  return {
    ...row,
    status: p.status,
    totalCount: p.totalCount,
    sentCount: p.sentCount,
    deliveredCount: p.deliveredCount,
    readCount: p.readCount,
    repliedCount: p.repliedCount,
    failedCount: p.failedCount,
    costMinor: p.costMinor,
    ...(p.completedAt ? { completedAt: p.completedAt } : {}),
  };
}

function patchArray(rows: Row[], p: RtCampaignProgress): Row[] | null {
  let touched = false;
  const next = rows.map((r) => {
    if (r?.id !== p.id) return r;
    touched = true;
    return patchRow(r, p);
  });
  return touched ? next : null;
}

export function applyCampaignProgress(cache: unknown, p: RtCampaignProgress): unknown {
  if (Array.isArray(cache)) return patchArray(cache as Row[], p) ?? cache;
  if (!cache || typeof cache !== "object") return cache;

  const env = cache as Record<string, unknown>;
  if (Array.isArray(env.data)) {
    const next = patchArray(env.data as Row[], p);
    return next ? { ...env, data: next } : cache;
  }
  if (env.data && typeof env.data === "object" && (env.data as Row).id === p.id) {
    return { ...env, data: patchRow(env.data as Row, p) };
  }
  if (env.campaign && typeof env.campaign === "object" && (env.campaign as Row).id === p.id) {
    return { ...env, campaign: patchRow(env.campaign as Row, p) };
  }
  if (env.id === p.id) return patchRow(env as Row, p);
  return cache;
}
