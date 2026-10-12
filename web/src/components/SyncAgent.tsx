"use client";

import { STORAGE_KEYS } from "@stepwell/shared";
import { useEffect } from "react";

import { readLocal } from "@/lib/storage";
import { isApplyingSync, runSync, SYNCED_KEYS } from "@/lib/sync";

/**
 * Background sync for people who turned it on: shortly after a change, when the tab becomes visible and when the
 * connection returns. Does nothing at all when sync is off.
 */
export function SyncAgent() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const enabled = () => readLocal(STORAGE_KEYS.sync, null) !== null;
    const soon = (delay: number) => {
      if (!enabled()) return;
      clearTimeout(timer);
      timer = setTimeout(() => void runSync().catch(() => undefined), delay);
    };
    const onStorage = (event: Event) => {
      const key = event instanceof StorageEvent ? event.key : (event as CustomEvent<string>).detail;
      if (key && SYNCED_KEYS.includes(key) && !isApplyingSync()) soon(3000);
    };
    const onVisible = () => document.visibilityState === "visible" && soon(500);
    const onOnline = () => soon(500);
    soon(1500);
    window.addEventListener("stepwell-storage", onStorage);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("stepwell-storage", onStorage);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, []);
  return null;
}
