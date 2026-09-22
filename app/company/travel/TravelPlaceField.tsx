"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { useGooglePlacesAutocomplete } from "../../hooks/useGooglePlacesAutocomplete";

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  country?: string;
};

export function TravelPlaceField({ value, onChange, placeholder, country }: Props) {
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

  return (
    <div ref={containerRef} className="relative">
      <input
        className="w-full border rounded-lg px-3 py-2 bg-transparent"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
        autoComplete="off"
      />
      {open && (suggestions.length > 0 || isLoading) ? (
        <ul className="absolute z-50 top-full mt-1 w-full bg-white border rounded-lg shadow-xl overflow-hidden max-h-64 overflow-y-auto">
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
                className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-start gap-2 border-b last:border-b-0"
              >
                <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span className="text-sm leading-snug">{suggestion.display_name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
