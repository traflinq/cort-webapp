"use client";

import * as React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";
import { useUiLabels } from "./lib/labels";

export interface ErrorStateProps {
  title?: React.ReactNode;
  message?: React.ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  compact?: boolean;
  className?: string;
}

export function ErrorState({ title, message, onRetry, retryLabel, compact = false, className }: ErrorStateProps) {
  const L = useUiLabels();
  return (
    <div
      role="alert"
      className={cn("flex flex-col items-center justify-center text-center", compact ? "px-4 py-10" : "px-6 py-16", className)}
    >
      <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-danger-soft text-danger-ink">
        <AlertCircle className="size-5" aria-hidden="true" />
      </div>
      <p className="text-sm font-medium text-fg">{title ?? L.somethingWentWrong}</p>
      {message && <p className="mt-1 max-w-md break-words text-sm text-fg-muted">{message}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry} leftIcon={<RefreshCw />}>
          {retryLabel ?? L.retry}
        </Button>
      )}
    </div>
  );
}

/** Inline, single-line error for forms and panels. */
export function InlineError({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div role="alert" className={cn("flex items-start gap-2 rounded-lg border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger-ink", className)}>
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
