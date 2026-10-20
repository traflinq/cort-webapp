"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MapPin, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGooglePlacesAutocomplete } from "@/app/hooks/useGooglePlacesAutocomplete";
import { inputBase, focusRingInset } from "./styles";
import { Spinner } from "./Spinner";

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

export interface StopSelection {
  name: string;
  lat: number;
  lng: number;
  fullAddress: string;
}

interface StopAddressSearchProps {
  /** Called when the user picks a suggestion from the dropdown */
  onSelect: (stop: StopSelection) => void;
  /** Pre-fill the text input (e.g. existing stop name when editing) */
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  /** Clear input after selection (useful when adding multiple stops) */
  clearOnSelect?: boolean;
  /** Accessible name when no visible <label> is associated. */
  "aria-label"?: string;
  id?: string;
}

/** Shorten a geocode display_name to a human-friendly stop label. */
function shortenDisplayName(displayName: string): string {
  const parts = displayName
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  // Use first 2 parts (usually the landmark + neighbourhood)
  return parts.slice(0, 2).join(", ");
}

type Suggestion = { place_id: string; display_name: string; lat: number; lng: number; name: string };

/**
 * Google Places address search as an accessible combobox:
 * arrow keys move through suggestions, Enter selects, Escape closes, click/tap selects.
 */
export default function StopAddressSearch({
  onSelect,
  defaultValue = "",
  placeholder = "Search address or place…",
  className = "",
  clearOnSelect = false,
  "aria-label": ariaLabel,
  id,
}: StopAddressSearchProps) {
  const listId = useId();
  const [query, setQuery] = useState(defaultValue);
  const [dismissed, setDismissed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Follow defaultValue changes (editing a different stop) without an effect.
  const [prevDefault, setPrevDefault] = useState(defaultValue);
  if (prevDefault !== defaultValue) {
    setPrevDefault(defaultValue);
    setQuery(defaultValue);
  }

  const { suggestions, isLoading, search, clearSuggestions, refreshToken } = useGooglePlacesAutocomplete({
    apiKey: GOOGLE_MAPS_API_KEY,
  });

  useEffect(() => {
    if (query.length >= 3) search(query);
    else clearSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDismissed(true);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const open = !dismissed && query.length >= 3;
  const items = suggestions as Suggestion[];

  const handleSelect = (suggestion: Suggestion) => {
    const name = suggestion.name || shortenDisplayName(suggestion.display_name);
    onSelect({ name, lat: suggestion.lat, lng: suggestion.lng, fullAddress: suggestion.display_name });
    setQuery(clearOnSelect ? "" : name);
    setDismissed(true);
    setActiveIndex(-1);
    clearSuggestions();
    refreshToken();
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
        <input
          id={id}
          type="text"
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open && items.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setDismissed(false);
            setActiveIndex(-1);
          }}
          onFocus={() => setDismissed(false)}
          onKeyDown={(e) => {
            if (!open || items.length === 0) {
              if (e.key === "Escape") setDismissed(true);
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIndex((i) => (i + 1) % items.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((i) => (i <= 0 ? items.length - 1 : i - 1));
            } else if (e.key === "Enter") {
              if (activeIndex >= 0) {
                e.preventDefault();
                handleSelect(items[activeIndex]);
              }
            } else if (e.key === "Escape") {
              e.preventDefault();
              setDismissed(true);
            }
          }}
          placeholder={placeholder}
          className={cn(inputBase, "pl-9 pr-9")}
          autoComplete="off"
        />
        {isLoading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <Spinner size="sm" label="Searching addresses" />
          </span>
        )}
      </div>

      {open && items.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-full z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-line bg-popover shadow-[var(--shadow-modal)]"
        >
          {items.map((s, i) => (
            <li key={s.place_id} id={`${listId}-${i}`} role="option" aria-selected={i === activeIndex} className="border-b border-line last:border-b-0">
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(s)}
                onMouseEnter={() => setActiveIndex(i)}
                className={cn(
                  "flex w-full cursor-pointer items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-subtle",
                  i === activeIndex && "bg-subtle",
                  focusRingInset,
                )}
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-fg-muted" aria-hidden="true" />
                <span className="text-sm leading-snug text-fg">{s.display_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && !isLoading && items.length === 0 && (
        <div role="status" className="absolute top-full z-50 mt-1 w-full rounded-lg border border-line bg-popover px-3 py-2.5 text-sm text-fg-muted shadow-[var(--shadow-card)]">
          No results found
        </div>
      )}
    </div>
  );
}
