import { STORAGE_KEYS, syncOnce, type StepwellClient, type SyncPayload, type SyncState } from "@stepwell/shared";
import { getRandomBytes } from "expo-crypto";

import { readJSON, removeKeys, writeJSON } from "./storage";

/** Keys whose changes are synced (when the person has turned sync on). */
export const SYNCED_KEYS: readonly string[] = [STORAGE_KEYS.plan, STORAGE_KEYS.profile, STORAGE_KEYS.appointment];

/** Cryptographically secure random bytes from the platform (expo-crypto). */
export const randomBytes = (n: number): Uint8Array => getRandomBytes(n);

let running: Promise<SyncState | null> | null = null;
let applying = false;

export const isApplyingSync = () => applying;

async function localPayload(): Promise<SyncPayload> {
  return {
    v: 1,
    plan: await readJSON(STORAGE_KEYS.plan, []),
    profile: await readJSON(STORAGE_KEYS.profile, null),
    questions: await readJSON(STORAGE_KEYS.appointment, null),
  };
}

async function apply(payload: SyncPayload): Promise<void> {
  applying = true;
  try {
    await writeJSON(STORAGE_KEYS.plan, payload.plan);
    if (payload.profile) await writeJSON(STORAGE_KEYS.profile, payload.profile);
    if (payload.questions) await writeJSON(STORAGE_KEYS.appointment, payload.questions);
  } finally {
    applying = false;
  }
}

/** One sync round when sync is on (a no-op otherwise). Errors propagate; local data is never lost. */
export function runSync(api: StepwellClient): Promise<SyncState | null> {
  if (running) return running;
  running = (async () => {
    const state = await readJSON<SyncState | null>(STORAGE_KEYS.sync, null);
    if (!state) return null;
    const outcome = await syncOnce(api, state, await localPayload(), randomBytes);
    if (outcome.stopped) {
      await removeKeys([STORAGE_KEYS.sync]);
      return null;
    }
    if (outcome.changedLocal) await apply(outcome.payload);
    await writeJSON(STORAGE_KEYS.sync, outcome.state);
    return outcome.state;
  })().finally(() => {
    running = null;
  });
  return running;
}
