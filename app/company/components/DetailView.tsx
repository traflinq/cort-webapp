"use client";

/**
 * Building blocks for read-only detail modals (trip, booking, shuttle run).
 * Flat sections separated by hairlines: no boxes inside the modal box, labels in muted text,
 * values in the text colour, numbers tabular. See design.md → "Detail modals".
 */
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/** Stack of sections divided by hairlines. */
export function DetailSections({ children }: { children: ReactNode }) {
  return <div className="flex flex-col divide-y divide-line">{children}</div>;
}

export function DetailSection({ title, aside, children, className }: { title?: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("py-5 first:pt-0 last:pb-0", className)}>
      {(title || aside) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h3 className="text-sm font-semibold text-fg">{title}</h3>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

/** Headline facts in one row (2 columns on phones). */
export function FactRow({ items }: { items: { label: string; value: ReactNode; hint?: ReactNode; muted?: boolean }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-flow-col sm:auto-cols-fr sm:grid-cols-none">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs text-fg-muted">{item.label}</dt>
          <dd className={cn("mt-1 truncate tabular-nums", item.muted ? "text-sm text-fg-muted" : "text-base font-semibold text-fg")}>{item.value}</dd>
          {item.hint && <dd className="mt-0.5 truncate text-xs text-fg-muted">{item.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}

/** Label / value list; label column on the start side from `sm` up. */
export function DetailRows({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-1 gap-y-3 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-x-4">{children}</dl>;
}

export function DetailRow({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="contents">
      <dt className="text-sm text-fg-muted">{label}</dt>
      <dd className="-mt-2 min-w-0 text-sm text-fg sm:mt-0">
        <span className="block break-words">{children}</span>
        {hint && <span className="mt-0.5 block text-xs text-fg-muted">{hint}</span>}
      </dd>
    </div>
  );
}

/** Muted placeholder for a value the system did not record. */
export function NotRecorded() {
  const t = useTranslations("company.detail");
  return <span className="text-fg-muted">{t("notRecorded")}</span>;
}

/** Vertical stop list: filled dot = start, ring = end, plain dots between. */
export function RouteSteps({ steps }: { steps: { label: string; place: ReactNode; meta?: ReactNode }[] }) {
  return (
    <ol className="flex flex-col">
      {steps.map((step, i) => {
        const first = i === 0;
        const last = i === steps.length - 1;
        return (
          <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
            {!last && <span className="absolute start-[5px] top-4 bottom-0 w-px bg-line" aria-hidden="true" />}
            <span
              aria-hidden="true"
              className={cn(
                "relative mt-1 size-[11px] shrink-0 rounded-full",
                first ? "bg-fg" : last ? "border-2 border-fg bg-card" : "border border-line-strong bg-card",
              )}
            />
            <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-fg-muted">{step.label}</div>
                <div className="mt-0.5 text-sm text-fg break-words">{step.place}</div>
              </div>
              {step.meta && <div className="shrink-0 text-end text-xs text-fg-secondary tabular-nums">{step.meta}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Money lines that add up to a total. `sub` lines are components of the line above (not added again). */
export function Ledger({ lines, total }: { lines: { label: ReactNode; value: string; sub?: boolean }[]; total?: { label: string; value: string } }) {
  return (
    <dl className="flex flex-col text-sm">
      {lines.map((line, i) => (
        <div key={i} className={cn("flex items-baseline justify-between gap-4", line.sub ? "py-1 ps-4 text-xs text-fg-muted" : "py-1.5 text-fg-secondary")}>
          <dt className="min-w-0">{line.label}</dt>
          <dd className={cn("whitespace-nowrap tabular-nums", !line.sub && "text-fg")}>{line.value}</dd>
        </div>
      ))}
      {total && (
        <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-line pt-3">
          <dt className="font-semibold text-fg">{total.label}</dt>
          <dd className="whitespace-nowrap font-semibold text-fg tabular-nums">{total.value}</dd>
        </div>
      )}
    </dl>
  );
}

/** "9 min", "2 h", "2 h 40 min" from minutes. */
export function useDurationFormat() {
  const t = useTranslations("company.detail");
  return (minutes: number | null | undefined) => {
    if (minutes == null || !Number.isFinite(minutes)) return null;
    const total = Math.max(0, Math.round(minutes));
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (h === 0) return t("minutes", { count: m });
    if (m === 0) return t("hours", { count: h });
    return t("hoursMinutes", { h, m });
  };
}
