import { downloadOfflinePack, LOCALES, offlinePackKey, type Locale, type OfflinePack, type StepwellClient } from "@stepwell/shared";

import { readJSON, removeKeys, writeJSON } from "./storage";

export function readOfflinePack(locale: Locale): Promise<OfflinePack | null> {
  return readJSON<OfflinePack | null>(offlinePackKey(locale), null);
}

export async function saveOfflinePack(api: StepwellClient, locale: Locale, onProgress: (done: number, total: number) => void): Promise<OfflinePack> {
  const pack = await downloadOfflinePack(api, locale, onProgress);
  await writeJSON(offlinePackKey(locale), pack);
  return pack;
}

export const offlinePackKeys = (): string[] => LOCALES.map((l) => offlinePackKey(l));

export const removeOfflinePacks = () => removeKeys(offlinePackKeys());
