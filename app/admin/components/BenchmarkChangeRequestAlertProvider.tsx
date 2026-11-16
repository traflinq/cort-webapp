"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";
import { Fuel, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { apiClient } from "../../lib/services/api-client";
import { IconButton, focusRing } from "../ui";

type BenchmarkSnapshot = {
  id?: number;
  service_type?: string | null;
  vehicle_category?: string | null;
  coaster_seater_size?: string | null;
  cost_type?: string | null;
  monthly_cost?: number | null;
  quantity?: number | null;
  vendor_name?: string | null;
  fuel_mode?: string | null;
  fuel_litres?: number | null;
  claimed_avg_distance_km?: number | null;
  fuel_avg_kmpl?: number | null;
};

type BenchmarkChangeAlert = {
  id: number;
  company_id: number;
  company_name: string;
  action: string;
  status?: string;
  previous: BenchmarkSnapshot | null;
  proposed: BenchmarkSnapshot | Record<string, unknown>;
  created_at?: string;
};

function pkr(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `PKR ${Number(n).toLocaleString("en-PK")}`;
}

function summarizeSnapshot(s: BenchmarkSnapshot | Record<string, unknown> | null | undefined): string {
  if (!s || Object.keys(s).length === 0) return "—";
  const snap = s as BenchmarkSnapshot;
  const parts: string[] = [];
  if (snap.cost_type) parts.push(String(snap.cost_type));
  if (snap.vehicle_category) {
    parts.push(
      snap.coaster_seater_size
        ? `${snap.vehicle_category} (${snap.coaster_seater_size})`
        : String(snap.vehicle_category),
    );
  }
  if (snap.monthly_cost != null) {
    if (snap.cost_type === "FIXED") {
      parts.push(`lump ${pkr(snap.monthly_cost)}`);
    } else {
      parts.push(`${snap.quantity ?? 1} × ${pkr(snap.monthly_cost)}`);
    }
  }
  if (snap.fuel_mode === "LITRES" && snap.fuel_litres != null) {
    parts.push(`${snap.fuel_litres} L/mo`);
  }
  if (snap.fuel_mode === "AVERAGE") {
    const dist = snap.claimed_avg_distance_km != null ? `${snap.claimed_avg_distance_km} km/day` : null;
    const avg = snap.fuel_avg_kmpl != null ? `${snap.fuel_avg_kmpl} km/L` : null;
    if (dist || avg) parts.push([dist, avg].filter(Boolean).join(" @ "));
  }
  return parts.length ? parts.join(" · ") : "—";
}

export function BenchmarkChangeRequestAlertProvider() {
  const socketRef = useRef<Socket | null>(null);
  const [alerts, setAlerts] = useState<BenchmarkChangeAlert[]>([]);
  const router = useRouter();

  const upsertAlert = useCallback((alert: BenchmarkChangeAlert) => {
    setAlerts((prev) => {
      if (prev.some((a) => a.id === alert.id)) return prev;
      return [alert, ...prev];
    });
  }, []);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    if (!token) return;

    let cancelled = false;

    (async () => {
      try {
        const pending = await apiClient.request<BenchmarkChangeAlert[]>(
          "/admin/benchmark-change-requests/pending",
        );
        if (cancelled || !Array.isArray(pending)) return;
        setAlerts(pending);
      } catch {
        // ignore — toast alerts still work via socket
      }
    })();

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
    const socket = io(`${apiUrl}/rides`, {
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30_000,
      randomizationFactor: 0.5,
    });
    socketRef.current = socket;

    socket.on("benchmark:change_request", (payload: BenchmarkChangeAlert) => {
      window.dispatchEvent(new CustomEvent("benchmark:change_request", { detail: payload }));
      upsertAlert(payload);
      toast.warning(
        `Benchmark change request — ${payload.company_name} (${payload.action})`,
        { duration: 10000 },
      );
    });

    return () => {
      cancelled = true;
      socket.disconnect();
      socketRef.current = null;
    };
  }, [upsertAlert]);

  const dismiss = (id: number) => setAlerts((prev) => prev.filter((a) => a.id !== id));

  if (alerts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed left-1/2 top-4 z-[9998] flex w-full max-w-xl -translate-x-1/2 flex-col gap-2 px-4">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          role="button"
          tabIndex={0}
          onClick={() => {
            router.push(`/admin/companies/${alert.company_id}?benchmarkRequests=1`);
            dismiss(alert.id);
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.preventDefault();
            router.push(`/admin/companies/${alert.company_id}?benchmarkRequests=1`);
            dismiss(alert.id);
          }}
          className={cn(
            "pointer-events-auto flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3",
            "border-warning-line bg-warning-soft text-warning-ink shadow-[var(--shadow-card)]",
            "transition-colors hover:brightness-[0.98]",
            focusRing,
          )}
        >
          <Fuel className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              Benchmark {alert.action} request — {alert.company_name}
            </p>
            <div className="mt-1 space-y-0.5 text-xs opacity-90">
              <p>
                <span className="font-semibold">Current:</span> {summarizeSnapshot(alert.previous)}
              </p>
              <p>
                <span className="font-semibold">Proposed:</span>{" "}
                {alert.action === "DELETE" ? "Delete benchmark" : summarizeSnapshot(alert.proposed)}
              </p>
            </div>
          </div>
          <IconButton
            label="Dismiss alert"
            variant="ghost"
            size="icon-xs"
            tooltip={false}
            onClick={(e) => {
              e.stopPropagation();
              dismiss(alert.id);
            }}
          >
            <X />
          </IconButton>
        </div>
      ))}
    </div>
  );
}
