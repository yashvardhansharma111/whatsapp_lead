"use client";

import {
  Zap,
  MessageSquare,
  FileCheck,
  HelpCircle,
  ListTree,
  GitBranch,
  Webhook,
  Clock,
  Equal,
  UserCheck,
  Gauge,
  Tags,
  KanbanSquare,
  BellRing,
  Sparkles,
  Flag,
  type LucideIcon,
} from "lucide-react";
import type { NodeKind } from "@/lib/chatbot/types";

/** Client-side icon mapping for each node kind. Kept out of lib/chatbot/types.ts so
 *  that module stays framework-free and usable server-side. */
export const NODE_ICON: Record<NodeKind, LucideIcon> = {
  start: Zap,
  message: MessageSquare,
  template: FileCheck,
  question: HelpCircle,
  menu: ListTree,
  condition: GitBranch,
  api: Webhook,
  delay: Clock,
  set_variable: Equal,
  handoff: UserCheck,
  qualify_lead: Gauge,
  tag: Tags,
  lead_stage: KanbanSquare,
  notify: BellRing,
  ai: Sparkles,
  end: Flag,
};
