"use client";

import { useMemo } from "react";
import { Badge, StatusBadge, type DataTableColumn } from "../../ui";
import { formatCurrency, formatDate, formatDateTime, formatTime } from "../../lib/format";
import { PAYMENT_STATUS_OVERRIDES, referenceLabel, type VendorLogRow } from "./types";

export function useVendorLogColumns({ showVendor = false, showDriver = false, showDistance = false }: { showVendor?: boolean; showDriver?: boolean; showDistance?: boolean }) {
  return useMemo<DataTableColumn<VendorLogRow>[]>(() => {
    const cols: DataTableColumn<VendorLogRow>[] = [
      {
        key: "date",
        header: "Date",
        cell: (log) => (
          <div className="whitespace-nowrap">
            <div className="text-fg">{formatDate(log.date)}</div>
            <div className="text-xs text-fg-muted">{formatTime(log.date)}</div>
          </div>
        ),
      },
      {
        key: "settled_at",
        header: "Settled",
        hideBelow: "lg",
        cell: (log) => (log.settled_at ? <span className="whitespace-nowrap text-fg-secondary">{formatDateTime(log.settled_at)}</span> : <span className="text-fg-muted">—</span>),
      },
      { key: "type", header: "Type", cell: (log) => <StatusBadge status={log.type} dot={false} size="sm" /> },
      {
        key: "vehicle",
        header: showVendor ? "Vehicle / vendor" : "Vehicle",
        cell: (log) => (
          <div className="min-w-0">
            <div className="font-medium text-fg">{log.vehicle || "—"}</div>
            {showVendor && <div className="truncate text-xs text-fg-muted">{log.vendor_name || "Unknown vendor"}</div>}
          </div>
        ),
      },
      {
        key: "passenger",
        header: "Reference / passenger",
        cell: (log) => (
          <div className="min-w-0">
            <div className="font-medium text-fg">{log.passenger || "—"}</div>
            <div className="truncate text-xs text-fg-muted">{log.details || "—"}</div>
          </div>
        ),
      },
    ];
    if (showDriver) {
      cols.push({ key: "driver", header: "Driver", hideBelow: "md", cell: (log) => <span className="text-fg">{log.driver || "—"}</span> });
    }
    cols.push({
      key: "reference",
      header: "Charged against",
      hideBelow: "md",
      cell: (log) => {
        const ref = referenceLabel(log);
        return ref ? (
          <Badge tone={log.invoice_id ? "purple" : "info"} size="sm" className="font-mono">
            {ref}
          </Badge>
        ) : (
          <span className="text-fg-muted">—</span>
        );
      },
    });
    if (showDistance) {
      cols.push({
        key: "distance",
        header: "Vendor distance",
        align: "right",
        mono: true,
        hideBelow: "lg",
        cell: (log) => (log.distance != null ? `${Number(log.distance).toFixed(1)} km` : "—"),
      });
    }
    cols.push(
      {
        key: "cost",
        header: "Vendor cost",
        align: "right",
        cell: (log) => (
          <div className="whitespace-nowrap">
            <div className="font-mono font-medium tabular-nums text-fg">{formatCurrency(log.cost)}</div>
            {Number(log.amount_paid || 0) > 0 && (
              <div className="font-mono text-[11px] tabular-nums">
                <div className="text-success-ink">Paid {formatCurrency(log.amount_paid)}</div>
                <div className="text-fg-muted">Due {formatCurrency(log.amount_remaining)}</div>
              </div>
            )}
          </div>
        ),
      },
      {
        key: "status",
        header: "Status",
        cell: (log) => <StatusBadge status={log.status || "UNPAID"} overrides={PAYMENT_STATUS_OVERRIDES} />,
      },
    );
    return cols;
  }, [showVendor, showDriver, showDistance]);
}
