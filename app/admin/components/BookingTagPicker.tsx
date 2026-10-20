"use client";

import { useEffect, useId, useState } from "react";
import { Search, X } from "lucide-react";
import { apiClient, type ChauffeurBooking } from "../../lib/services/api-client";
import { Input } from "../ui/Input";
import { IconButton } from "../ui/IconButton";
import { Spinner } from "../ui/Spinner";
import { focusRing } from "../ui/styles";
import { formatDate } from "../lib/format";

export interface TaggedBooking {
  id: number;
  label: string;
}

/**
 * Optional "tag to a booking" picker. Only searches COMPLETED bookings —
 * tagging an in-flight booking's cost doesn't make sense, and only completed
 * bookings can be recalculated on the backend.
 *
 * When `vehicleId` is provided, results are ALWAYS constrained to that
 * vehicle's bookings (a real backend filter, not just a search suggestion),
 * so typing further just refines within that vehicle rather than escaping
 * to an unscoped global search. Without a vehicle, the box requires typing.
 */
export function BookingTagPicker({
  value,
  onChange,
  vehicleId,
}: {
  value: TaggedBooking | null;
  onChange: (booking: TaggedBooking | null) => void;
  vehicleId?: number;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ChauffeurBooking[]>([]);
  const [searchKey, setSearchKey] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);

  const typed = query.trim();
  const hasCriteria = !!typed || !!vehicleId;
  const key = value || !hasCriteria ? "" : `${typed}|${vehicleId ?? ""}`;
  const isSearching = key !== "" && searchKey !== key;

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = (await apiClient.getAllBookings({
          status: "COMPLETED",
          search: typed || undefined,
          vehicle_id: vehicleId,
          limit: 6,
        })) as unknown as { data?: { data?: ChauffeurBooking[] } | ChauffeurBooking[] };
        if (cancelled) return;
        const raw = res?.data;
        setResults(Array.isArray(raw) ? raw : (raw?.data ?? []));
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) {
          setSearchKey(key);
          setActiveIndex(-1);
        }
      }
    }, typed ? 350 : 0); // no debounce when it's just the vehicle filter loading
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key, typed, vehicleId]);

  const label = (b: ChauffeurBooking) => {
    const passenger = b.users_chauffeur_bookings_passenger_idTousers?.full_name ?? "Unknown passenger";
    const plate = b.vehicles?.plate_number ? ` · ${b.vehicles.plate_number}` : "";
    const date = b.scheduled_for ? ` · ${formatDate(b.scheduled_for)}` : "";
    return `#${b.id} — ${passenger}${plate}${date}`;
  };

  if (value) {
    return (
      <div className="flex h-9 items-center justify-between gap-2 rounded-lg border border-line bg-subtle px-3 text-sm">
        <span className="truncate text-fg">{value.label}</span>
        <IconButton label="Remove booking tag" size="icon-xs" onClick={() => onChange(null)}>
          <X />
        </IconButton>
      </div>
    );
  }

  const showList = !!key && (isSearching || results.length > 0);

  return (
    <div>
      <Input
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        aria-autocomplete="list"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
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
            const b = results[activeIndex];
            onChange({ id: b.id, label: label(b) });
          } else if (e.key === "Escape") {
            setResults([]);
          }
        }}
        placeholder={vehicleId ? "Search within this vehicle's completed bookings…" : "Search by passenger, plate number, or booking ID…"}
        leftIcon={<Search aria-hidden="true" />}
        rightIcon={isSearching ? <Spinner size="sm" label="Searching" /> : undefined}
      />

      {showList && (
        <ul id={listId} role="listbox" className="mt-1.5 max-h-44 divide-y divide-line overflow-y-auto rounded-lg border border-line bg-popover">
          {isSearching && results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-fg-muted">Searching…</li>
          ) : (
            results.map((b, i) => (
              <li key={b.id} id={`${listId}-${i}`} role="option" aria-selected={i === activeIndex}>
                <button
                  type="button"
                  onClick={() => onChange({ id: b.id, label: label(b) })}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`block w-full cursor-pointer truncate px-3 py-2 text-left text-sm text-fg hover:bg-subtle ${i === activeIndex ? "bg-subtle" : ""} ${focusRing}`}
                >
                  {label(b)}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
      {!isSearching && hasCriteria && key && results.length === 0 && (
        <p className="mt-1.5 px-1 text-xs text-fg-muted" role="status">
          {vehicleId ? "No completed bookings found for this vehicle." : `No completed bookings found for "${typed}".`}
        </p>
      )}
    </div>
  );
}
