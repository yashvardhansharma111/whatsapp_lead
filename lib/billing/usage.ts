// Billing usage — stub for Next.js (all usage logic lives in NestJS now)
//
// This file satisfies the TypeScript interface that lib/billing/guard.ts imports.
// None of these functions are called in production — the catch-all proxy routes
// all billing API calls to NestJS. They exist so the module graph compiles.

import type { LimitResource, PlanFeature } from "@/lib/billing/limits";
export { LimitError, FeatureError } from "@/lib/billing/limits";
export type { LimitResource, PlanFeature };

export interface ResolvedPlan {
  subscription: null;
  planName: string;
  limits: Record<string, number>;
  grants: Record<string, unknown>;
}

export interface UsageMetric { used: number; limit: number }
export interface Usage {
  users: UsageMetric; contacts: UsageMetric; campaigns: UsageMetric;
  messages: UsageMetric; storageMb: UsageMetric; aiCredits: UsageMetric;
  businesses: UsageMetric; knowledgeDocs: UsageMetric;
  messagesToday: UsageMetric; messagesThisHour: UsageMetric;
  templates: UsageMetric; quickReplies: UsageMetric;
}

export interface AgentAiBudget { limit: number | null; used: number; periodStart: Date | null }

const NOT_IMPL = () => { throw new Error("Usage checks run in NestJS, not Next.js"); };

export async function resolveTenantPlan(_tenantId: string): Promise<ResolvedPlan> { NOT_IMPL(); }
export async function assertFeature(_tenantId: string, _feature: PlanFeature): Promise<void> { NOT_IMPL(); }
export async function assertWithinLimit(_tenantId: string, _resource: LimitResource, _increment?: number): Promise<void> { NOT_IMPL(); }
export async function assertAgentAiCredits(_tenantId: string, _userId: string, _increment?: number): Promise<void> { NOT_IMPL(); }
export function assertBelowCeiling(_resource: LimitResource, _value: number, _limit: number, _planName: string): void { NOT_IMPL(); }
export async function planAllows(_tenantId: string, _feature: PlanFeature): Promise<boolean> { NOT_IMPL(); }
export async function hasCapacity(_tenantId: string, _resource: LimitResource, _increment?: number): Promise<boolean> { NOT_IMPL(); }
export async function getUsage(_tenantId: string): Promise<Usage> { NOT_IMPL(); }
export async function incrementAiUsage(_tenantId: string, _amount?: number, _userId?: string | null): Promise<void> { NOT_IMPL(); }
export async function resolveAgentAiBudget(_tenantId: string, _userId: string): Promise<AgentAiBudget> { NOT_IMPL(); }
export function modelAllowed(_grants: Record<string, unknown>, _model?: string | null): boolean { NOT_IMPL(); }
