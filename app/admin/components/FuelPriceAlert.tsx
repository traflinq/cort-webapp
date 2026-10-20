"use client";

import Link from "next/link";
import { AlertTriangle, X } from "lucide-react";
import { useFuelPriceAlert } from "../../hooks/useFuelPriceAlert";
import { Button } from "../ui/Button";
import { IconButton } from "../ui/IconButton";

export const FuelPriceAlert = () => {
  const { showAlert, alertMessage, handleDismiss } = useFuelPriceAlert();

  if (!showAlert) return null;

  return (
    <div role="status" className="flex flex-col gap-3 rounded-xl border border-warning-line bg-warning-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning-ink" aria-hidden="true" />
        <p className="text-sm font-medium text-fg">{alertMessage}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/pricing">Update fuel price</Link>
        </Button>
        <IconButton label="Dismiss alert" size="icon-sm" onClick={handleDismiss}>
          <X />
        </IconButton>
      </div>
    </div>
  );
};
