"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { Check, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { controlBase, controlHeight, focusRing } from "./styles";

/* ── Field: label + hint + error, wired to its control ─────────────────────── */

type FieldContextValue = { id: string; describedBy?: string; invalid: boolean; required: boolean };
const FieldContext = React.createContext<FieldContextValue | null>(null);
const useField = () => React.useContext(FieldContext);

export function Field({
  label,
  hint,
  error,
  required = false,
  optional = false,
  className,
  children,
}: {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  /** Shows "(Optional)" after the label. */
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("common.ui");
  const id = React.useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
  return (
    <FieldContext.Provider value={{ id, describedBy, invalid: !!error, required }}>
      <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
        {label && (
          <label htmlFor={id} className="text-[13px] font-medium text-fg">
            {label}
            {required && (
              <span className="ms-0.5 text-danger-ink" aria-hidden="true">
                *
              </span>
            )}
            {optional && <span className="ms-1 font-normal text-fg-muted">({t("optional")})</span>}
          </label>
        )}
        {children}
        {error ? (
          <p id={errorId} role="alert" className="text-xs font-medium text-danger-ink">
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

export function FormGrid({ cols = 2, className, children }: { cols?: 1 | 2 | 3 | 4; className?: string; children: React.ReactNode }) {
  const grid = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[cols];
  return <div className={cn("grid grid-cols-1 gap-4", grid, className)}>{children}</div>;
}

function fieldProps(ctx: FieldContextValue | null, own: { id?: string; "aria-invalid"?: unknown; "aria-describedby"?: string; required?: boolean }) {
  return {
    id: own.id ?? ctx?.id,
    "aria-describedby": own["aria-describedby"] ?? ctx?.describedBy,
    "aria-invalid": (own["aria-invalid"] as boolean | undefined) ?? (ctx?.invalid || undefined),
    required: own.required ?? (ctx?.required || undefined),
  };
}

/* ── Input ─────────────────────────────────────────────────────────────────── */

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  size?: "sm" | "md";
  leftIcon?: React.ReactNode;
  rightSlot?: React.ReactNode;
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = "md", leftIcon, rightSlot, invalid, className, ...props },
  ref,
) {
  const ctx = useField();
  const wired = fieldProps(ctx, { ...props, "aria-invalid": invalid ?? props["aria-invalid"] });
  const input = (
    <input
      ref={ref}
      {...props}
      {...wired}
      className={cn(controlBase, controlHeight[size], "px-3", leftIcon && "ps-9", rightSlot && "pe-9", !leftIcon && !rightSlot && className)}
    />
  );
  if (!leftIcon && !rightSlot) return input;
  return (
    <div className={cn("relative", className)}>
      {leftIcon && (
        <span className="pointer-events-none absolute inset-y-0 start-0 flex w-9 items-center justify-center text-fg-muted [&_svg]:size-4" aria-hidden="true">
          {leftIcon}
        </span>
      )}
      {input}
      {rightSlot && <span className="absolute inset-y-0 end-0 flex items-center pe-1.5">{rightSlot}</span>}
    </div>
  );
});

/* ── Select (native: correct on mobile, RTL and with screen readers) ───────── */

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  size?: "sm" | "md";
  /** Disabled first option shown when the value is empty. */
  placeholder?: string;
  invalid?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { size = "md", placeholder, invalid, className, children, ...props },
  ref,
) {
  const ctx = useField();
  const wired = fieldProps(ctx, { ...props, "aria-invalid": invalid ?? props["aria-invalid"] });
  return (
    <div className={cn("relative", className)}>
      <select ref={ref} {...props} {...wired} className={cn(controlBase, controlHeight[size], "cursor-pointer appearance-none ps-3 pe-9")}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
    </div>
  );
});

/* ── Textarea ──────────────────────────────────────────────────────────────── */

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  function Textarea({ invalid, className, rows = 3, ...props }, ref) {
    const ctx = useField();
    const wired = fieldProps(ctx, { ...props, "aria-invalid": invalid ?? props["aria-invalid"] });
    return <textarea ref={ref} rows={rows} {...props} {...wired} className={cn(controlBase, "px-3 py-2", className)} />;
  },
);

/* ── Checkbox / Switch ─────────────────────────────────────────────────────── */

export function Checkbox({
  label,
  description,
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> & { label?: React.ReactNode; description?: React.ReactNode }) {
  const id = React.useId();
  const box = (
    <CheckboxPrimitive.Root
      id={id}
      {...props}
      className={cn(
        "flex size-[18px] shrink-0 cursor-pointer items-center justify-center rounded border border-line-strong bg-[var(--bg-input)] transition-colors",
        "data-[state=checked]:border-action data-[state=checked]:bg-action data-[state=checked]:text-on-action disabled:cursor-not-allowed disabled:opacity-50",
        focusRing,
        !label && className,
      )}
    >
      <CheckboxPrimitive.Indicator>
        <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
  if (!label) return box;
  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      <span className="mt-0.5">{box}</span>
      <label htmlFor={id} className="cursor-pointer text-sm text-fg">
        {label}
        {description && <span className="mt-0.5 block text-xs text-fg-muted">{description}</span>}
      </label>
    </div>
  );
}

export function Switch({
  label,
  description,
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> & { label?: React.ReactNode; description?: React.ReactNode }) {
  const id = React.useId();
  const control = (
    <SwitchPrimitive.Root
      id={id}
      {...props}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full bg-line-strong transition-colors",
        "data-[state=checked]:bg-action disabled:cursor-not-allowed disabled:opacity-50",
        focusRing,
        !label && className,
      )}
    >
      <SwitchPrimitive.Thumb className="block size-4 translate-x-0.5 rounded-full bg-card shadow-sm transition-transform data-[state=checked]:translate-x-[18px] rtl:-translate-x-0.5 rtl:data-[state=checked]:-translate-x-[18px]" />
    </SwitchPrimitive.Root>
  );
  if (!label) return control;
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <label htmlFor={id} className="cursor-pointer text-sm text-fg">
        {label}
        {description && <span className="mt-0.5 block text-xs text-fg-muted">{description}</span>}
      </label>
      {control}
    </div>
  );
}
