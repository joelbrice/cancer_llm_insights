import { ApiError } from "@vitacite/shared";
import { useCallback, useEffect, useRef, useState } from "react";

import { useSettings } from "./settings";

/** Minimal data hook: loads on mount / when deps change, exposes reload, never throws into render. */
export function useApi<T>(load: () => Promise<T>, deps: unknown[]) {
  const { t } = useSettings();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const run = useCallback(async () => {
    const id = ++seq.current;
    setLoading(true);
    try {
      const value = await load();
      if (id === seq.current) {
        setData(value);
        setError(null);
      }
    } catch (err) {
      if (id === seq.current) setError(err instanceof ApiError && err.status === 404 ? t("common.notFound") : t("common.apiUnreachable"));
    } finally {
      if (id === seq.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    void run();
  }, [run]);
  return { data, error, loading, reload: run };
}
