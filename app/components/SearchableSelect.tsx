"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Fuse from "fuse.js";
import { ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { inputBase } from "../admin/ui/styles";

export type SearchableSelectOption = {
  value: string;
  label: string;
  searchText?: string;
};

type SearchableSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
  disabled?: boolean;
  /** Which side of the input the list opens on. */
  placement?: "bottom" | "top";
};

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Search...",
  emptyMessage = "No results found.",
  className,
  disabled = false,
  placement = "bottom",
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(
    () => options.find((o) => o.value === value),
    [options, value]
  );

  const fuse = useMemo(
    () =>
      new Fuse(options, {
        keys: ["label", "searchText"],
        threshold: 0.35,
        distance: 100,
      }),
    [options]
  );

  const filteredOptions = useMemo(() => {
    const q = query.trim();
    if (!q) return options;
    return fuse.search(q).map((r) => r.item);
  }, [query, options, fuse]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery("");
        setHighlightedIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleFocus = () => {
    if (disabled) return;
    setIsOpen(true);
    setQuery(selectedOption?.label ?? "");
    setHighlightedIndex(-1);
  };

  const handleSelect = (opt: SearchableSelectOption) => {
    onChange(opt.value);
    setQuery("");
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.blur();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange("");
    setQuery("");
    setIsOpen(true);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) setIsOpen(true);
      setHighlightedIndex((prev) =>
        prev < filteredOptions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter") {
      if (isOpen && highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
        e.preventDefault();
        handleSelect(filteredOptions[highlightedIndex]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setQuery("");
      setHighlightedIndex(-1);
      inputRef.current?.blur();
    }
  };

  const displayValue = isOpen ? query : selectedOption?.label ?? "";

  return (
    <div ref={wrapperRef} className={`relative w-full ${className ?? ""}`}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(-1);
            if (value) onChange("");
          }}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(inputBase, "h-10 pl-9 pr-16")}
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {value && !disabled && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleClear}
              className="rounded p-0.5 text-fg-muted hover:bg-subtle hover:text-fg"
              aria-label="Clear selection"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <ChevronDown
            className={`h-4 w-4 text-fg-muted transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </div>
      </div>

      {isOpen && !disabled && (
        <div className={`absolute left-0 z-50 max-h-60 w-full overflow-hidden rounded-lg border border-line bg-card text-fg shadow-lg ${placement === "top" ? "bottom-full mb-1" : "top-full mt-1"}`}>
          <ul className="max-h-60 overflow-y-auto py-1">
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-2 text-sm text-fg-muted">{emptyMessage}</li>
            ) : (
              filteredOptions.map((opt, index) => (
                <li
                  key={opt.value}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(opt)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`cursor-pointer px-3 py-2 text-sm transition-colors ${
                    opt.value === value
                      ? "bg-brand-soft text-brand-ink font-medium"
                      : index === highlightedIndex
                        ? "bg-subtle text-fg"
                        : "text-fg hover:bg-subtle"
                  }`}
                >
                  {opt.label}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
