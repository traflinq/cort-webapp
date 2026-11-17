"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "./Button";
import { Input } from "./Form";

export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Accessible name (defaults to the placeholder). */
  label?: string;
}) {
  const t = useTranslations("common.ui");
  const text = placeholder ?? t("search");
  return (
    <Input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={text}
      aria-label={label ?? text}
      leftIcon={<Search />}
      className={cn("w-full sm:w-72", className)}
      rightSlot={
        value ? (
          <button
            type="button"
            aria-label={t("clearSearch")}
            onClick={() => onChange("")}
            className="flex size-7 cursor-pointer items-center justify-center rounded text-fg-muted hover:bg-subtle hover:text-fg"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : undefined
      }
    />
  );
}

/**
 * Row of filters above a table: search first, then selects / date fields, actions at the end.
 * Wraps on small screens; controls go full-width on mobile.
 */
export function FilterBar({
  children,
  actions,
  activeCount = 0,
  onClear,
  className,
}: {
  children: React.ReactNode;
  /** End-aligned (export, view switch). */
  actions?: React.ReactNode;
  activeCount?: number;
  onClear?: () => void;
  className?: string;
}) {
  const t = useTranslations("common.ui");
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 [&>*]:w-full sm:[&>*]:w-auto">
        {children}
        {activeCount > 0 && onClear && (
          <Button variant="ghost" size="sm" onClick={onClear} leftIcon={<X />} className="!w-auto">
            {t("clearFilters")}
          </Button>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Start / end date pair (YYYY-MM-DD). */
export function DateRangeField({
  from,
  to,
  onChange,
  className,
}: {
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
  className?: string;
}) {
  const t = useTranslations("common.ui");
  return (
    <div role="group" aria-label={t("dateRange")} className={cn("flex items-center gap-1.5", className)}>
      <Input type="date" aria-label={t("from")} value={from} max={to || undefined} onChange={(e) => onChange({ from: e.target.value, to })} className="min-w-0 flex-1 sm:w-40 sm:flex-none" />
      <span className="text-fg-muted" aria-hidden="true">
        –
      </span>
      <Input type="date" aria-label={t("to")} value={to} min={from || undefined} onChange={(e) => onChange({ from, to: e.target.value })} className="min-w-0 flex-1 sm:w-40 sm:flex-none" />
    </div>
  );
}
