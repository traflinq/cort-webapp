"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/app/lib/services/api-client";

/**
 * GET `url` whenever it changes (or `reload()` is called).
 * `loading` is derived (the last settled request is not the current one), so the effect only sets state
 * after the request settles. The previous data stays available while the next one loads.
 */
export function useSavingsFetch<T>(url: string) {
  const [tick, setTick] = useState(0);
  const key = `${url}#${tick}`;
  const [state, setState] = useState<{ key: string; data: T | null; error: string | null }>({
    key: "",
    data: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    apiClient.request<T>(url).then(
      (data) => {
        if (!cancelled) setState({ key, data, error: null });
      },
      (e: unknown) => {
        if (!cancelled) setState((s) => ({ key, data: s.data, error: e instanceof Error ? e.message : "Request failed" }));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [url, key]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const setData = useCallback((data: T) => setState((s) => ({ ...s, data })), []);

  return { data: state.data, error: state.key === key ? state.error : null, loading: state.key !== key, reload, setData };
}
