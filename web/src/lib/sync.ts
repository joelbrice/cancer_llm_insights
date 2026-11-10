"use client";

import { STORAGE_KEYS, syncOnce, type SyncPayload, type SyncState } from "@stepwell/shared";

import { browserApi } from "./browser-api";
import { readLocal, removeLocal, writeLocal } from "./storage";

/** Keys whose changes are synced (when the person has turned sync on). */
export const SYNCED_KEYS: readonly string[] = [STORAGE_KEYS.plan, STORAGE_KEYS.profile, STORAGE_KEYS.appointment];

export const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));

let running: Promise<SyncState | null> | null = null;
let applying = false;

export function isApplyingSync(): boolean {
  return applying;
}

function localPayload(): SyncPayload {
  return {
    v: 1,
    plan: readLocal(STORAGE_KEYS.plan, []),
    profile: readLocal(STORAGE_KEYS.profile, null),
    questions: readLocal(STORAGE_KEYS.appointment, null),
  };
}

function apply(payload: SyncPayload): void {
  applying = true;
  try {
    writeLocal(STORAGE_KEYS.plan, payload.plan);
    if (payload.profile) writeLocal(STORAGE_KEYS.profile, payload.profile);
    if (payload.questions) writeLocal(STORAGE_KEYS.appointment, payload.questions);
  } finally {
    applying = false;
  }
}

/**
 * One sync round (pull → merge → push) when the person has turned sync on; a no-op otherwise. Concurrent calls
 * share the same round. Errors propagate so the caller can say "try again later"; local data is never lost.
 */
export function runSync(): Promise<SyncState | null> {
  if (running) return running;
  running = (async () => {
    const state = readLocal<SyncState | null>(STORAGE_KEYS.sync, null);
    if (!state) return null;
    const outcome = await syncOnce(browserApi(), state, localPayload(), randomBytes);
    if (outcome.stopped) {
      removeLocal(STORAGE_KEYS.sync);
      return null;
    }
    if (outcome.changedLocal) apply(outcome.payload);
    writeLocal(STORAGE_KEYS.sync, outcome.state);
    return outcome.state;
  })().finally(() => {
    running = null;
  });
  return running;
}
