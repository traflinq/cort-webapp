"use client";

import { useCallback, useEffect, useState } from "react";
import { errorMessage } from "../lib";

type Result<T> = { key: string; data: T | null; error: string | null };

/**
 * Minimal fetch state for the read-only portal pages. Refetches when `deps` change or on
 * `reload()`; the previous data stays visible while the next request is in flight.
 */
export function useLoad<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<Result<T>>({ key: "", data: null, error: null });
  const requestKey = `${JSON.stringify(deps)}#${version}`;

  useEffect(() => {
    let cancelled = false;
    fetcher()
      .then((data) => !cancelled && setResult({ key: requestKey, data, error: null }))
      .catch((err) => !cancelled && setResult((prev) => ({ key: requestKey, data: prev.data, error: errorMessage(err, "Failed to load data") })));
    return () => {
      cancelled = true;
    };
    // The caller's deps (folded into requestKey) decide when to refetch, not the fetcher's identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return { data: result.data, error: result.error, loading: result.key !== requestKey, reload };
}
