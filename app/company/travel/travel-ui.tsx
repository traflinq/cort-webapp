"use client";

import React from "react";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export const INPUT_CLASS =
  "h-12 w-full rounded-xl border border-[var(--border-input)] bg-[var(--bg-card)] px-4 text-sm font-medium outline-none transition-all placeholder:text-[var(--text-placeholder)] focus:bg-[var(--bg-input-focus)] focus:border-[#fe8503] focus:ring-4 focus:ring-[#fe8503]/10 text-[var(--text-primary)]";

export const PRIMARY_BUTTON_CLASS =
  "inline-flex items-center justify-center bg-[#f47f00] text-white px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-60";

export const SECONDARY_BUTTON_CLASS =
  "inline-flex items-center justify-center bg-[#0c225e] text-white px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-60";

export function Field({
  label,
  children,
  required,
  className,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  className?: string;
  hint?: string;
}) {
  return (
    <label className={cx("flex flex-col gap-2", className)}>
      <span className="text-[10px] font-black uppercase tracking-wider text-[var(--text-secondary)] px-1">
        {label}
        {required ? <span className="text-[#fe8503] ms-0.5"> *</span> : null}
      </span>
      {children}
      {hint ? <span className="text-xs text-[var(--text-muted)] px-1">{hint}</span> : null}
    </label>
  );
}

export function CardSection({
  title,
  children,
  grid = true,
}: {
  title: string;
  children: React.ReactNode;
  grid?: boolean;
}) {
  return (
    <div className="bg-[var(--bg-card)] rounded-3xl border border-[var(--border-default)] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.3)]">
      <div className="flex items-center gap-2.5 mb-6 px-1">
        <h3 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em]">{title}</h3>
      </div>
      <div className={grid ? "grid gap-x-6 gap-y-6 sm:grid-cols-2" : "space-y-4"}>{children}</div>
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(INPUT_CLASS, props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative group">
      <select
        {...props}
        className={cx(INPUT_CLASS, "appearance-none font-bold pe-10", props.className)}
      />
      <div className="absolute end-4 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)] group-focus-within:text-[#fe8503] transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  REVIEW: { bg: "bg-amber-500/10", text: "text-amber-600", border: "border-amber-200/50", dot: "bg-amber-500" },
  APPROVAL: { bg: "bg-blue-500/10", text: "text-blue-600", border: "border-blue-200/50", dot: "bg-blue-500" },
  CONFIRMED: { bg: "bg-emerald-500/10", text: "text-emerald-600", border: "border-emerald-200/50", dot: "bg-emerald-500" },
  REJECTED: { bg: "bg-rose-500/10", text: "text-rose-600", border: "border-rose-200/50", dot: "bg-rose-500" },
};

export function StatusChip({ status, label }: { status?: string; label?: string }) {
  const key = status || "";
  const style = STATUS_STYLES[key] || { bg: "bg-slate-500/10", text: "text-slate-400", border: "border-slate-500/20", dot: "bg-slate-500" };
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black border ${style.bg} ${style.text} ${style.border} uppercase tracking-widest`}>
      <span className={`w-1.5 h-1.5 rounded-full me-2 ${style.dot}`} />
      {label || key || "-"}
    </span>
  );
}

export function KpiCard({
  label,
  value,
  loading,
  children,
}: {
  label: string;
  value?: React.ReactNode;
  loading?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5">
      <p className="text-xs uppercase text-[var(--text-muted)]">{label}</p>
      {loading ? (
        <div className="mt-2 h-8 w-32 animate-pulse rounded-lg bg-[var(--surface-subtle)]" />
      ) : children ? (
        children
      ) : (
        <p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{value}</p>
      )}
    </div>
  );
}

export function parseTravelRows(res: unknown): any[] {
  const envelope = res as { data?: { data?: unknown } | unknown[] };
  const nested = envelope?.data;
  if (nested && typeof nested === "object" && "data" in nested && Array.isArray((nested as { data?: unknown }).data)) {
    return (nested as { data: any[] }).data;
  }
  if (Array.isArray(nested)) return nested;
  return [];
}

export function money(value: number | string | null | undefined) {
  return `PKR ${Number(value ?? 0).toLocaleString()}`;
}

export function shortDate(value?: string | Date | null) {
  if (!value) return "-";
  return String(value).slice(0, 10);
}

export function bookingTrip(row: any) {
  const snapshot = row?.offer_snapshot || {};
  const quote = row?.quote || {};
  const profile = row?.employee?.travel_passenger_profile;
  const miles: any[] = Array.isArray(row?.miles) ? row.miles : [];
  const first = miles.find((m) => m.mile === "FIRST");
  const last = miles.find((m) => m.mile === "LAST");
  return {
    origin: quote.origin as string | undefined,
    destination: quote.destination as string | undefined,
    travel_date: quote.travel_date as string | undefined,
    transport_type: (snapshot.mode || snapshot.transport_type) as string | undefined,
    travel_class: snapshot.class as string | undefined,
    operator_name: snapshot.operator as string | undefined,
    traveler: profile as
      | { first_name?: string; last_name?: string; email?: string; passport_number?: string | null }
      | undefined,
    first,
    last,
  };
}

export function mileLabel(type?: string | null, provider?: string | null, transport?: string | null) {
  if (transport === "CAR" || !type || type === "NONE") return "-";
  return provider ? `${type} / ${provider}` : type;
}

export function bookingMileLabel(row: any, leg: "FIRST" | "LAST") {
  const trip = bookingTrip(row);
  const mile = leg === "FIRST" ? trip.first : trip.last;
  return mileLabel(mile?.type, mile?.provider, trip.transport_type);
}

export function routeTitle(origin?: string | null, destination?: string | null) {
  const from = origin?.trim() || "-";
  const to = destination?.trim() || "-";
  return `${from} -> ${to}`;
}
