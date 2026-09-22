"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { useGooglePlacesAutocomplete } from "../../hooks/useGooglePlacesAutocomplete";
import { Field, INPUT_CLASS } from "./travel-ui";

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  country?: string;
  label?: string;
  required?: boolean;
  className?: string;
};

export function TravelPlaceField({
  value,
  onChange,
  placeholder,
  country,
  label,
  required,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const skipSearchRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { suggestions, isLoading, search, clearSuggestions, refreshToken } = useGooglePlacesAutocomplete({
    apiKey: GOOGLE_MAPS_API_KEY,
    country,
  });

  useEffect(() => {
    if (skipSearchRef.current) {
      skipSearchRef.current = false;
      return;
    }
    if (value.trim().length >= 3) {
      search(value);
      setOpen(true);
    } else {
      clearSuggestions();
      setOpen(false);
    }
  }, [value, search, clearSuggestions]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const input = (
    <div ref={containerRef} className="relative">
      <input
        className={INPUT_CLASS}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
        autoComplete="off"
      />
      {open && (suggestions.length > 0 || isLoading) ? (
        <ul className="absolute z-50 top-full mt-1 w-full bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto">
          {isLoading && suggestions.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-[var(--text-muted)]">Searching...</li>
          ) : null}
          {suggestions.map((suggestion) => (
            <li key={suggestion.place_id}>
              <button
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  skipSearchRef.current = true;
                  onChange(suggestion.name || suggestion.display_name);
                  setOpen(false);
                  clearSuggestions();
                  refreshToken();
                }}
                className="w-full text-left px-3 py-2.5 hover:bg-[var(--surface-subtle)] flex items-start gap-2 border-b border-[var(--border-light)] last:border-b-0"
              >
                <MapPin className="w-4 h-4 text-[var(--text-muted)] shrink-0 mt-0.5" />
                <span className="text-sm leading-snug text-[var(--text-primary)]">{suggestion.display_name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );

  if (!label) return input;

  return (
    <Field label={label} required={required} className={className}>
      {input}
    </Field>
  );
}
