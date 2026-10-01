import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

type Listener = (key: string) => void;
const listeners = new Set<Listener>();

export async function readJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function writeJSON(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } finally {
    listeners.forEach((fn) => fn(key));
  }
}

export async function removeKeys(keys: string[]): Promise<void> {
  try {
    await AsyncStorage.multiRemove(keys);
  } finally {
    keys.forEach((key) => listeners.forEach((fn) => fn(key)));
  }
}

/** Persisted state shared by every screen that uses the same key (on-device only). */
export function useStored<T>(key: string, fallback: T): [T, (next: T | ((prev: T) => T)) => void, boolean] {
  const [value, setValue] = useState<T>(fallback);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    const load = () => readJSON(key, fallback).then((v) => alive && (setValue(v), setLoaded(true)));
    void load();
    const listener: Listener = (changed) => changed === key && void load();
    listeners.add(listener);
    return () => {
      alive = false;
      listeners.delete(listener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        void writeJSON(key, resolved);
        return resolved;
      });
    },
    [key],
  );
  return [value, update, loaded];
}
