/**
 * Offline insight packs (roadmap 1.1): every published insight in one language, saved on the device so people can
 * read during hospital stays, travel or poor coverage. The pack is a snapshot; "Update" fetches a new one.
 */
import type { StepwellClient } from "./client";
import type { Insight, InsightSummary, Locale } from "./types";

export interface OfflinePack {
  language: Locale;
  saved_at: string;
  list: InsightSummary[];
  insights: Record<string, Insight>;
}

export const offlinePackKey = (language: string) => `stepwell.offline.${language}.v1`;

export async function downloadOfflinePack(
  api: StepwellClient,
  language: Locale,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<OfflinePack> {
  const list: InsightSummary[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const result = await api.insights({ lang: language, page, page_size: 100 }, signal);
    list.push(...result.items);
    if (list.length >= result.total || !result.items.length) break;
  }
  const insights: Record<string, Insight> = {};
  let done = 0;
  onProgress?.(0, list.length);
  const queue = [...list];
  const worker = async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      insights[item.id] = await api.insight(item.id, signal);
      done += 1;
      onProgress?.(done, list.length);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return { language, saved_at: new Date().toISOString(), list, insights };
}
