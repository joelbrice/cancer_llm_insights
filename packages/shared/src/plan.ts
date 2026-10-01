/** "My plan": evidence-based actions the user chose, tracked weekly. Pure functions; storage is per platform. */
import type { EvidenceLevelId } from "./types";

export interface PlanItem {
  id: string;
  insightId: string;
  insightTitle: string;
  text: string;
  evidenceLevel: EvidenceLevelId;
  addedAt: string;
  /** ISO weeks ("2026-W40") marked as done. */
  checkins: string[];
}

export function isoWeek(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function previousWeek(week: string): string {
  const [yearText, weekText] = week.split("-W");
  const year = Number(yearText);
  const n = Number(weekText);
  // Thursday of the given ISO week, minus 7 days
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() || 7) - 1) + (n - 1) * 7);
  monday.setUTCDate(monday.getUTCDate() - 7);
  return isoWeek(new Date(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate()));
}

export function planItemId(insightId: string, text: string): string {
  let hash = 0;
  for (const ch of `${insightId}|${text}`) hash = (Math.imul(31, hash) + ch.charCodeAt(0)) | 0;
  return `p_${(hash >>> 0).toString(36)}`;
}

export function addToPlan(plan: PlanItem[], item: Omit<PlanItem, "id" | "addedAt" | "checkins">): PlanItem[] {
  const id = planItemId(item.insightId, item.text);
  if (plan.some((p) => p.id === id)) return plan;
  return [...plan, { ...item, id, addedAt: new Date().toISOString(), checkins: [] }];
}

export function removeFromPlan(plan: PlanItem[], id: string): PlanItem[] {
  return plan.filter((p) => p.id !== id);
}

export function toggleCheckin(plan: PlanItem[], id: string, week: string = isoWeek()): PlanItem[] {
  return plan.map((p) =>
    p.id !== id
      ? p
      : { ...p, checkins: p.checkins.includes(week) ? p.checkins.filter((w) => w !== week) : [...p.checkins, week] },
  );
}

/** Consecutive weeks done, counting back from the current week (or last week if this week is not yet done). */
export function streak(item: PlanItem, week: string = isoWeek()): number {
  const done = new Set(item.checkins);
  let cursor = done.has(week) ? week : previousWeek(week);
  let count = 0;
  while (done.has(cursor)) {
    count += 1;
    cursor = previousWeek(cursor);
  }
  return count;
}

export const STORAGE_KEYS = {
  profile: "stepwell.profile.v1",
  plan: "stepwell.plan.v1",
  check: "stepwell.check.v1",
  locale: "stepwell.locale",
  theme: "stepwell.theme",
  conversation: "stepwell.conversation.v1",
  /** Community member token (pseudonymous; deleting it signs this device out of the community). */
  communityToken: "stepwell.community.v1",
} as const;
