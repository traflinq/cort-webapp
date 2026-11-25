"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Info, Lock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFmt } from "./hooks";
import type { Basis, Figure } from "./types";

// ─── Basis badge: how much to trust a number ─────────────────────────────────

const BASIS_TONE: Record<Basis, string> = {
  MEASURED: "bg-success-soft text-success-ink",
  REPORTED: "bg-brand-soft text-brand-ink",
  CONTRACTED: "bg-subtle text-fg",
  ESTIMATED: "bg-warning-soft text-warning-ink",
  SIMULATED: "bg-purple-soft text-purple-ink",
  CALCULATED: "bg-subtle text-fg-muted",
};

export function BasisBadge({ basis, className }: { basis: Basis; className?: string }) {
  const t = useTranslations("company.costOptimization.basis");
  return (
    <span title={t(`${basis}_hint` as never)} className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", BASIS_TONE[basis], className)}>
      {t(basis as never)}
    </span>
  );
}

export function LockedValue({ className }: { className?: string }) {
  const t = useTranslations("company.costOptimization");
  return (
    <span className={cn("inline-flex items-center gap-1 text-fg-muted", className)} title={t("lockedHint")}>
      <Lock className="size-3.5" />
      <span className="text-xs font-medium">{t("locked")}</span>
    </span>
  );
}

/** A figure's value; click the info icon for its formula, inputs and sources. */
export function FigureValue({
  figure,
  className,
  showBasis = false,
  size = "md",
}: {
  figure: Figure | null | undefined;
  className?: string;
  showBasis?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const fmt = useFmt();
  if (!figure) return <span className="text-fg-muted">—</span>;
  if (figure.locked) return <LockedValue className={className} />;
  const sizeCls = size === "lg" ? "text-2xl font-semibold tracking-tight" : size === "sm" ? "text-sm" : "text-sm font-semibold";
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1.5 tabular-nums", className)}>
      <span className={cn(sizeCls, figure.value === null ? "text-fg-muted" : "text-fg")}>{fmt.fig(figure)}</span>
      {showBasis && <BasisBadge basis={figure.basis} />}
      <HowCalculated figure={figure} />
    </span>
  );
}

export function HowCalculated({ figure }: { figure: Figure }) {
  const t = useTranslations("company.costOptimization");
  const fmt = useFmt();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={t("howCalculated")}
        onClick={() => setOpen((o) => !o)}
        className="rounded-full p-0.5 text-fg-muted transition-colors hover:bg-subtle hover:text-fg"
      >
        <Info className="size-3.5" />
      </button>
      {open && (
        <span
          id={id}
          role="dialog"
          className="absolute end-0 top-6 z-30 w-[min(22rem,80vw)] rounded-xl border border-line bg-card p-3 text-start text-xs font-normal text-fg shadow-xl"
        >
          <span className="mb-2 flex items-center justify-between gap-2">
            <span className="font-semibold">{t("howCalculated")}</span>
            <BasisBadge basis={figure.basis} />
          </span>
          <span className="block rounded-lg bg-subtle px-2 py-1.5 font-mono text-[11px] leading-relaxed" dir="ltr">
            {figure.formula}
          </span>
          {figure.missing_reason && <span className="mt-2 block text-warning-ink">{figure.missing_reason}</span>}
          {figure.inputs.length > 0 && (
            <span className="mt-2 block divide-y divide-line">
              {figure.inputs.map((inp, i) => (
                <span key={i} className="flex items-start justify-between gap-3 py-1.5">
                  <span className="min-w-0">
                    <span className="block">{inp.label}</span>
                    <span className="block text-[10px] text-fg-muted">{inp.source}</span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums" dir="ltr">
                    {typeof inp.value === "number" ? (inp.unit ? fmt.value(inp.value, inp.unit) : fmt.n(inp.value, 2)) : (inp.value ?? "—")}
                  </span>
                </span>
              ))}
            </span>
          )}
        </span>
      )}
    </span>
  );
}

// ─── Drawer ──────────────────────────────────────────────────────────────────

export function Drawer({ open, onClose, title, subtitle, children, footer }: { open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  const t = useTranslations("company.costOptimization");
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative flex h-full w-full max-w-3xl flex-col bg-page shadow-2xl outline-none"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line bg-card px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-fg">
              {title}
            </h2>
            {subtitle && <div className="mt-0.5 text-sm text-fg-muted">{subtitle}</div>}
          </div>
          <button type="button" onClick={onClose} aria-label={t("close")} className="rounded-lg p-1.5 text-fg-muted hover:bg-subtle hover:text-fg">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="border-t border-line bg-card px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

// ─── Small pieces ────────────────────────────────────────────────────────────

export function Tag({ tone = "neutral", children }: { tone?: "neutral" | "success" | "warning" | "danger" | "brand"; children: ReactNode }) {
  const cls = {
    neutral: "bg-subtle text-fg-muted",
    success: "bg-success-soft text-success-ink",
    warning: "bg-warning-soft text-warning-ink",
    danger: "bg-danger-soft text-danger-ink",
    brand: "bg-brand-soft text-brand-ink",
  }[tone];
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold", cls)}>{children}</span>;
}

export function StatBlock({ label, figure, hint, showBasis = true }: { label: string; figure: Figure | null | undefined; hint?: string; showBasis?: boolean }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-line bg-card p-4">
      <p className="text-[13px] font-medium text-fg-muted">{label}</p>
      <FigureValue figure={figure} size="lg" />
      <div className="flex flex-wrap items-center gap-2">
        {showBasis && figure && !figure.locked && <BasisBadge basis={figure.basis} />}
        {hint && <span className="text-xs text-fg-muted">{hint}</span>}
      </div>
      {figure?.value === null && figure.missing_reason && !figure.locked && <p className="text-xs text-warning-ink">{figure.missing_reason}</p>}
    </div>
  );
}

export function MethodNote({ lines }: { lines: string[] }) {
  const t = useTranslations("company.costOptimization");
  if (!lines.length) return null;
  return (
    <details className="rounded-2xl border border-line bg-card px-4 py-3 text-sm text-fg-muted">
      <summary className="cursor-pointer font-medium text-fg">{t("method")}</summary>
      <ul className="mt-2 list-disc space-y-1 ps-5" dir="auto">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </details>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-line bg-card p-6 text-center text-sm text-fg-muted">{children}</div>;
}

export function ErrorNote({ message }: { message: string }) {
  return <div className="rounded-2xl border border-danger-line bg-danger-soft p-4 text-sm text-danger-ink">{message}</div>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl border border-line bg-card", className)} />;
}
