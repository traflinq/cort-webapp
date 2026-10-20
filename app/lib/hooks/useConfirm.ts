"use client";

import { createContext, useContext, type ReactNode } from "react";

export type ConfirmOptions = {
  title?: ReactNode;
  /** The question. Keep it specific: "Delete Acme Logistics?" */
  message: ReactNode;
  /** Secondary explanation under the question. */
  description?: ReactNode;
  /** What will happen if the user confirms. Always set for destructive actions. */
  consequences?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** Require typing this exact string before confirming (high-risk actions). */
  typeToConfirm?: string;
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error("useConfirm must be used within ConfirmProvider");
  }
  return confirm;
}

export { ConfirmContext };
