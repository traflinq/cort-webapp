"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Whether a portal's desktop sidebar is collapsed to the icon rail. Open by default and remembered
 * per browser (localStorage), so each portal keeps the viewer's choice across visits.
 * Read through useSyncExternalStore so the server render and first paint agree (open), then the
 * stored choice applies without a setState-in-effect.
 */
const listeners = new Set<() => void>();
/** This tab's latest choice; also covers browsers where storage is blocked. */
const memory = new Map<string, boolean>();

function subscribe(listener: () => void) {
  const onStorage = (e: StorageEvent) => {
    // Another tab changed it: drop our cached value so the stored one is read again.
    if (e.key) memory.delete(e.key);
    listener();
  };
  listeners.add(listener);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function read(key: string) {
  const cached = memory.get(key);
  if (cached !== undefined) return cached;
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function useSidebarCollapsed(storageKey: string) {
  const collapsed = useSyncExternalStore(
    subscribe,
    () => read(storageKey),
    () => false,
  );

  const setCollapsed = useCallback(
    (next: boolean) => {
      memory.set(storageKey, next);
      try {
        window.localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {
        // Storage blocked (private mode): the in-memory value keeps the choice for this visit.
      }
      listeners.forEach((l) => l());
    },
    [storageKey],
  );

  return [collapsed, setCollapsed] as const;
}
