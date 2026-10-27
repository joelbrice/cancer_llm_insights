"use client";

import { useCallback, useEffect, useState } from "react";

/** localStorage/sessionStorage can throw (private mode, blocked storage): every access is guarded. */
export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeLocal(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("stepwell-storage", { detail: key }));
  } catch {
    /* storage unavailable: keep working in memory */
  }
}

export function removeLocal(key: string): void {
  try {
    window.localStorage.removeItem(key);
    window.dispatchEvent(new CustomEvent("stepwell-storage", { detail: key }));
  } catch {
    /* ignore */
  }
}

export function readSession(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeSession(key: string, value: string | null): void {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

/**
 * State persisted in localStorage and synchronised across components/tabs.
 * Starts from `fallback` on the server and first client render (no hydration mismatch), then loads.
 */
export function useLocalState<T>(key: string, fallback: T): [T, (next: T | ((prev: T) => T)) => void, boolean] {
  const [value, setValue] = useState<T>(fallback);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setValue(readLocal(key, fallback));
    setLoaded(true);
    const sync = (event: Event) => {
      const changed = event instanceof StorageEvent ? event.key : (event as CustomEvent<string>).detail;
      if (changed === key) setValue(readLocal(key, fallback));
    };
    window.addEventListener("storage", sync);
    window.addEventListener("stepwell-storage", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("stepwell-storage", sync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fallback is a constant default
  }, [key]);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        writeLocal(key, resolved);
        return resolved;
      });
    },
    [key],
  );

  return [value, update, loaded];
}
