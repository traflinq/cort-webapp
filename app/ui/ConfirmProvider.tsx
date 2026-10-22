"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { ConfirmContext, type ConfirmOptions } from "@/app/lib/hooks/useConfirm";
import { ConfirmDialog } from "./ConfirmDialog";

type PendingConfirm = ConfirmOptions & {
  key: number;
  resolve: (value: boolean) => void;
};

/**
 * Provides `useConfirm()`. Requests are queued, so two confirms in flight
 * resolve one after the other instead of the first promise being dropped.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<PendingConfirm[]>([]);
  const counter = useRef(0);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      counter.current += 1;
      setQueue((q) => [...q, { ...options, key: counter.current, resolve }]);
    });
  }, []);

  const current = queue[0];

  const settle = (value: boolean) => {
    current?.resolve(value);
    setQueue((q) => q.slice(1));
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {current && (
        <ConfirmDialog
          key={current.key}
          open
          onOpenChange={(open) => {
            if (!open) settle(false);
          }}
          title={current.title}
          message={current.message}
          description={current.description}
          consequences={current.consequences}
          confirmLabel={current.confirmLabel}
          cancelLabel={current.cancelLabel}
          destructive={current.destructive}
          typeToConfirm={current.typeToConfirm}
          onConfirm={() => settle(true)}
        />
      )}
    </ConfirmContext.Provider>
  );
}
