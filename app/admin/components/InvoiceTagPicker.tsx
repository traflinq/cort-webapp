"use client";

import { useEffect, useId, useState } from "react";
import { Search, X } from "lucide-react";
import { ExpensesApi, type TaggableInvoice } from "../../lib/services/api-client";
import { Input } from "../ui/Input";
import { IconButton } from "../ui/IconButton";
import { Spinner } from "../ui/Spinner";
import { focusRing } from "../ui/styles";

export interface TaggedInvoice {
  id: number;
  label: string;
}

export function taggableInvoiceLabel(inv: Pick<TaggableInvoice, "invoice_number" | "company_name" | "billing_month">) {
  return [inv.invoice_number, inv.company_name, inv.billing_month].filter(Boolean).join(" · ");
}

/**
 * Optional "tag to a shuttle invoice" picker. Lists the most recent shuttle
 * invoices straight away and narrows as you type (invoice number, company or
 * billing month). Chauffeur invoices are not offered — those take their costs
 * through the booking tag.
 */
export function InvoiceTagPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: TaggedInvoice | null;
  onChange: (invoice: TaggedInvoice | null) => void;
  disabled?: boolean;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState<TaggableInvoice[]>([]);
  const [searchKey, setSearchKey] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  const typed = query.trim();
  const active = focused && !value && !disabled;
  const isSearching = active && searchKey !== typed;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await ExpensesApi.taggableInvoices(typed || undefined);
        if (!cancelled) setResults(res?.data ?? []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) {
          setSearchKey(typed);
          setActiveIndex(-1);
        }
      }
    }, typed ? 350 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [active, typed]);

  const pick = (inv: TaggableInvoice) => {
    onChange({ id: inv.id, label: taggableInvoiceLabel(inv) });
    setQuery("");
    setResults([]);
    setSearchKey(null);
  };

  if (value) {
    return (
      <div className="flex h-9 items-center justify-between gap-2 rounded-lg border border-line bg-subtle px-3 text-sm">
        <span className="truncate text-fg">{value.label}</span>
        <IconButton label="Remove invoice tag" size="icon-xs" onClick={() => onChange(null)}>
          <X />
        </IconButton>
      </div>
    );
  }

  const showList = active && (isSearching || results.length > 0);

  return (
    <div>
      <Input
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        aria-autocomplete="list"
        disabled={disabled}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onKeyDown={(e) => {
          if (!results.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((i) => (i + 1) % results.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
          } else if (e.key === "Enter" && activeIndex >= 0) {
            e.preventDefault();
            pick(results[activeIndex]);
          } else if (e.key === "Escape") {
            setResults([]);
          }
        }}
        placeholder="Search by invoice number, company or month…"
        leftIcon={<Search aria-hidden="true" />}
        rightIcon={isSearching ? <Spinner size="sm" label="Searching" /> : undefined}
      />

      {showList && (
        <ul id={listId} role="listbox" className="mt-1.5 max-h-44 divide-y divide-line overflow-y-auto rounded-lg border border-line bg-popover">
          {isSearching && results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-fg-muted">Searching…</li>
          ) : (
            results.map((inv, i) => (
              <li key={inv.id} id={`${listId}-${i}`} role="option" aria-selected={i === activeIndex}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(inv)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`block w-full cursor-pointer truncate px-3 py-2 text-left text-sm text-fg hover:bg-subtle ${i === activeIndex ? "bg-subtle" : ""} ${focusRing}`}
                >
                  {taggableInvoiceLabel(inv)}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
      {active && !isSearching && results.length === 0 && (
        <p className="mt-1.5 px-1 text-xs text-fg-muted" role="status">
          {typed ? `No shuttle invoices found for "${typed}".` : "No shuttle invoices yet."}
        </p>
      )}
    </div>
  );
}
