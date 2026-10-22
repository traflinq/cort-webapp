"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUiLabels } from "./lib/labels";

const sizes = { xs: "size-3", sm: "size-4", md: "size-5", lg: "size-8" } as const;

export interface SpinnerProps {
  size?: keyof typeof sizes;
  /** Screen-reader text (default "Loading"). */
  label?: string;
  className?: string;
}

export function Spinner({ size = "md", label, className }: SpinnerProps) {
  const L = useUiLabels();
  return (
    <span role="status" className={cn("inline-flex items-center justify-center text-fg-muted", className)}>
      <Loader2 className={cn("animate-spin", sizes[size])} aria-hidden="true" />
      <span className="sr-only">{label ?? L.loading}</span>
    </span>
  );
}

/** Centred spinner with optional caption for whole-panel loading. */
export function LoadingBlock({ label, className }: { label?: string; className?: string }) {
  const L = useUiLabels();
  const text = label ?? L.loading;
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-16 text-sm text-fg-muted", className)}>
      <Spinner size="lg" label={text} />
      <span aria-hidden="true">{text}</span>
    </div>
  );
}
