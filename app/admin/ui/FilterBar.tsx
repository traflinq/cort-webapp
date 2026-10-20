"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input, type InputProps } from "./Input";
import { Button } from "./Button";
import { Field } from "./Field";

export interface SearchInputProps extends Omit<InputProps, "value" | "onChange" | "type"> {
  value: string;
  onChange: (value: string) => void;
}

export function SearchInput({ value, onChange, placeholder = "Search…", className, ...props }: SearchInputProps) {
  return (
    <Input
      type="search"
      role="searchbox"
      aria-label={props["aria-label"] ?? placeholder}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      leftIcon={<Search aria-hidden="true" />}
      rightIcon={
        value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear search"
            className="cursor-pointer rounded p-0.5 text-fg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X />
          </button>
        ) : undefined
      }
      className={cn("[&::-webkit-search-cancel-button]:hidden", className)}
      {...props}
    />
  );
}

export interface FilterBarProps {
  /** Search box on the left. */
  search?: SearchInputProps;
  /** Filter controls (use <FilterField> for labelled selects / dates). */
  children?: React.ReactNode;
  /** Number of non-default filters; shows the Clear button when > 0. */
  activeCount?: number;
  onClear?: () => void;
  /** Right-aligned actions (Add, Export…). */
  actions?: React.ReactNode;
  className?: string;
}

/** Responsive toolbar: search · filters · clear · actions. Wraps on small screens. */
export function FilterBar({ search, children, activeCount = 0, onClear, actions, className }: FilterBarProps) {
  return (
    <div className={cn("flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center", className)}>
      {search && (
        <div className="w-full lg:w-64">
          <SearchInput {...search} />
        </div>
      )}
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
      {activeCount > 0 && onClear && (
        <Button variant="ghost" size="sm" onClick={onClear} leftIcon={<X />} className="self-start lg:self-auto">
          Clear {activeCount > 1 ? `${activeCount} filters` : "filter"}
        </Button>
      )}
      {actions && <div className="flex flex-wrap items-center gap-2 lg:ml-auto">{actions}</div>}
    </div>
  );
}

/** A labelled filter control. The label is visually inline and wired via Field. */
export function FilterField({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <Field inline label={label} className={cn("[&_select]:w-auto [&_input]:w-auto", className)}>
      {children}
    </Field>
  );
}

/** Active-filter chip (optional, for showing applied filters with remove buttons). */
export function FilterChip({ label, onRemove }: { label: React.ReactNode; onRemove?: () => void }) {
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-md border border-line bg-card pl-2 pr-1 text-xs text-fg">
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove filter"
          className="cursor-pointer rounded p-0.5 text-fg-muted hover:bg-subtle hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  );
}
