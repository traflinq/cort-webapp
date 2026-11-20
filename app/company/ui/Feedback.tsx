"use client";

import * as React from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Inbox, Info, Loader2, RotateCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Toaster as SonnerToaster } from "sonner";
import { cn } from "@/lib/utils";
import { useCompanyTheme } from "../lib/theme-context";
import { Button } from "./Button";
import type { Tone } from "./Badge";

/* ── Empty / error ─────────────────────────────────────────────────────────── */

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
}

export function EmptyState({ icon, title, description, action, compact, className }: EmptyStateProps) {
  const t = useTranslations("common.ui");
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "gap-2 px-4 py-8" : "gap-3 px-6 py-14", className)}>
      <span className="flex size-10 items-center justify-center rounded-full bg-subtle text-fg-muted [&_svg]:size-5" aria-hidden="true">
        {icon ?? <Inbox />}
      </span>
      <div>
        <p className="text-sm font-semibold text-fg">{title ?? t("noResults")}</p>
        {description && <p className="mx-auto mt-1 max-w-md text-[13px] text-fg-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  title,
  message,
  onRetry,
  compact,
  className,
}: {
  title?: React.ReactNode;
  message?: React.ReactNode;
  onRetry?: () => void;
  compact?: boolean;
  className?: string;
}) {
  const t = useTranslations("common.ui");
  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center text-center", compact ? "gap-2 px-4 py-8" : "gap-3 px-6 py-14", className)}>
      <span className="flex size-10 items-center justify-center rounded-full bg-danger-soft text-danger-ink" aria-hidden="true">
        <AlertCircle className="size-5" />
      </span>
      <div>
        <p className="text-sm font-semibold text-fg">{title ?? t("somethingWentWrong")}</p>
        {message && <p className="mx-auto mt-1 max-w-md text-[13px] text-fg-muted">{message}</p>}
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" leftIcon={<RotateCw />} onClick={onRetry}>
          {t("tryAgain")}
        </Button>
      )}
    </div>
  );
}

/* ── Inline alert / banner ─────────────────────────────────────────────────── */

const ALERT_TONE: Record<"info" | "success" | "warning" | "danger" | "brand", { cls: string; icon: React.ReactNode }> = {
  info: { cls: "border-info-line bg-info-soft text-info-ink", icon: <Info /> },
  success: { cls: "border-success-line bg-success-soft text-success-ink", icon: <CheckCircle2 /> },
  warning: { cls: "border-warning-line bg-warning-soft text-warning-ink", icon: <AlertTriangle /> },
  danger: { cls: "border-danger-line bg-danger-soft text-danger-ink", icon: <AlertCircle /> },
  brand: { cls: "border-brand-line bg-brand-soft text-brand-ink", icon: <Info /> },
};

export function Alert({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: keyof typeof ALERT_TONE;
  title?: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const s = ALERT_TONE[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex items-start gap-3 rounded-lg border px-4 py-3 text-sm", s.cls, className)}>
      <span className="mt-0.5 shrink-0 [&_svg]:size-4" aria-hidden="true">
        {s.icon}
      </span>
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn("text-fg-secondary", title && "mt-0.5")}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ── Loading ───────────────────────────────────────────────────────────────── */

export function Spinner({ className }: { className?: string }) {
  const t = useTranslations("common.ui");
  return <Loader2 role="status" aria-label={t("loading")} className={cn("size-4 animate-spin text-fg-muted", className)} />;
}

export function LoadingBlock({ label, className }: { label?: React.ReactNode; className?: string }) {
  const t = useTranslations("common.ui");
  return (
    <div className={cn("flex items-center justify-center gap-2 px-6 py-14 text-sm text-fg-muted", className)} aria-busy="true">
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      {label ?? t("loading")}
    </div>
  );
}

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" {...props} className={cn("animate-pulse rounded-md bg-subtle", className)} />;
}

export function StatSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border border-line bg-card p-4">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="mt-3 h-7 w-20" />
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ lines = 4, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-line bg-card p-5", className)} aria-busy="true">
      <Skeleton className="h-4 w-40" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-3.5" style={{ width: `${90 - i * 12}%` }} />
        ))}
      </div>
    </div>
  );
}

/* ── Toasts ────────────────────────────────────────────────────────────────── */

export function Toaster() {
  const { theme } = useCompanyTheme();
  return <SonnerToaster theme={theme} position="top-center" richColors closeButton toastOptions={{ className: "!rounded-lg !text-sm" }} />;
}

/** Small dot + label for inline status that is not a badge (e.g. "Live"). */
export function ToneDot({ tone = "neutral", pulse, className }: { tone?: Tone; pulse?: boolean; className?: string }) {
  const color = {
    neutral: "bg-neutral-ink",
    brand: "bg-highlight",
    success: "bg-success-ink",
    warning: "bg-warning-ink",
    danger: "bg-danger-ink",
    info: "bg-info-ink",
    purple: "bg-purple-ink",
  }[tone];
  return <span aria-hidden="true" className={cn("inline-block size-2 shrink-0 rounded-full", color, pulse && "animate-pulse", className)} />;
}
