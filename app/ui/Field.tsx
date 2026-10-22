"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "./Label";

type FieldContextValue = {
  id: string;
  describedBy?: string;
  invalid: boolean;
};

const FieldContext = React.createContext<FieldContextValue | null>(null);

/** Form controls call this to pick up id / aria-describedby / aria-invalid from the nearest Field. */
export const useFieldContext = () => React.useContext(FieldContext);

export interface FieldProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  /** Override the generated control id. */
  id?: string;
  /** Label beside the control instead of above (filter bars). */
  inline?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Wires a label, hint and error message to the single control inside it.
 * The control must be one of the admin ui primitives (Input, Select, Textarea, Checkbox, Switch…)
 * or read `useFieldContext()` itself.
 */
export function Field({ label, hint, error, required, id: idProp, inline = false, className, children }: FieldProps) {
  const reactId = React.useId();
  const id = idProp ?? `field-${reactId}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  const value = React.useMemo<FieldContextValue>(() => ({ id, describedBy, invalid: !!error }), [id, describedBy, error]);

  return (
    <FieldContext.Provider value={value}>
      <div className={cn(inline ? "flex items-center gap-2" : "flex flex-col gap-1.5", className)}>
        {label !== undefined && label !== null && (
          <Label htmlFor={id} required={required} className={cn(inline && "whitespace-nowrap text-fg-muted")}>
            {label}
          </Label>
        )}
        {children}
        {error ? (
          <p id={errorId} role="alert" className="text-xs text-danger-ink">
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className="text-xs text-fg-muted">
            {hint}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

/** Responsive form grid: 1 column on phones, `cols` from the sm breakpoint up. */
export function FormGrid({ cols = 2, className, children }: { cols?: 1 | 2 | 3 | 4; className?: string; children: React.ReactNode }) {
  const colCls = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[cols];
  return <div className={cn("grid grid-cols-1 gap-4", colCls, className)}>{children}</div>;
}
