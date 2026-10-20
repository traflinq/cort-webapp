"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";
import { AdminToaster } from "../ui/Toast";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useWebPush } from "../../lib/hooks/useWebPush";

type BookingSocketPayload = {
  id: number;
  booking_type?: string;
  company_name: string;
  passenger_name: string;
  pickup_address: string;
  city: string;
  [key: string]: unknown;
};

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const beep = (freq: number, start: number, duration: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.frequency.value = freq;
      o.type = "sine";
      g.gain.setValueAtTime(0, ctx.currentTime + start);
      g.gain.linearRampToValueAtTime(0.4, ctx.currentTime + start + 0.01);
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + start + duration);
      o.start(ctx.currentTime + start);
      o.stop(ctx.currentTime + start + duration + 0.05);
    };
    beep(880, 0, 0.15);
    beep(660, 0.18, 0.15);
    beep(880, 0.36, 0.25);
  } catch {
    // Audio not supported — silently skip
  }
}

type ImmediateAlert = {
  id: number;
  company_name: string;
  passenger_name: string;
  pickup_address: string;
  city: string | null;
};

export function BookingNotificationProvider() {
  const socketRef = useRef<Socket | null>(null);
  const [immediateAlerts, setImmediateAlerts] = useState<ImmediateAlert[]>([]);
  const router = useRouter();

  const isAuthenticated =
    typeof window !== "undefined" ? !!localStorage.getItem("auth_token") : false;
  useWebPush(isAuthenticated);

  useEffect(() => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    if (!token) return;

    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

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

    socket.on("booking:new", (booking: BookingSocketPayload) => {
      const isImmediate = booking?.booking_type === "SPOT";

      // Broadcast a custom DOM event so any page (e.g. bookings list) can refresh
      window.dispatchEvent(new CustomEvent("booking:new", { detail: booking }));

      if (isImmediate) {
        playNotificationSound();
        setImmediateAlerts((prev) => [
          {
            id: booking.id,
            company_name: booking.company_name,
            passenger_name: booking.passenger_name,
            pickup_address: booking.pickup_address,
            city: booking.city,
          },
          ...prev,
        ]);
        toast.error(
          `🚨 Immediate Booking #${booking.id} — ${booking.company_name} · ${booking.passenger_name}`,
          { duration: 12000 }
        );
      } else {
        toast.success(
          `New Booking #${booking.id} — ${booking.company_name} · ${booking.passenger_name}`,
          { duration: 6000 }
        );
      }
    });

    socket.on("shuttle:lifecycle", (event: {
      type?: string;
      title?: string;
      body?: string;
      url?: string;
      tripId?: number;
    }) => {
      window.dispatchEvent(new CustomEvent("shuttle:lifecycle", { detail: event }));

      toast.info(event.title ?? "Shuttle update", {
        description: event.body,
        duration: 8000,
        action: event.url
          ? {
              label: "View",
              onClick: () => router.push(event.url!),
            }
          : undefined,
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [router]);

  const dismiss = (id: number) =>
    setImmediateAlerts((prev) => prev.filter((a) => a.id !== id));

  return (
    <>
      <AdminToaster />

      {/* Immediate booking alert banners — visible on every admin page */}
      {immediateAlerts.length > 0 && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 w-full max-w-lg px-4 pointer-events-none">
          {immediateAlerts.map((alert) => (
            <div
              key={alert.id}
              onClick={() => { router.push("/admin/bookings/pending"); dismiss(alert.id); }}
              className="pointer-events-auto cursor-pointer flex items-start gap-3 rounded-xl border-2 border-red-400 bg-red-50 px-4 py-3 shadow-xl animate-pulse hover:bg-red-100 transition-colors"
            >
              <div className="mt-0.5 flex-shrink-0 text-xl">🚨</div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-red-700 text-sm">
                  IMMEDIATE BOOKING #{alert.id} — Action Required Now
                </div>
                <div className="text-xs text-red-600 mt-0.5">
                  {alert.company_name} · {alert.passenger_name}
                  {alert.city ? ` · ${alert.city}` : ""}
                  {alert.pickup_address ? ` — ${alert.pickup_address}` : ""}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); dismiss(alert.id); }}
                className="flex-shrink-0 text-red-400 hover:text-red-600 transition-colors"
                aria-label="Dismiss alert"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
