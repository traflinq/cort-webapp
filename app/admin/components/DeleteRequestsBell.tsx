"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Socket } from "socket.io-client";
import { acquireRidesSocket } from "../../lib/realtime/ridesSocket";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import { apiClient } from "../../lib/services/api-client";
import { useAuth } from "../../lib/contexts/auth-context";
import { DeleteRequestsModal } from "./DeleteRequestsModal";
import { cx } from "./ui/cx";
import { IconButton } from "../ui/IconButton";

type DeleteRequestSocketAlert = {
  id: number;
  entity_type: "FUEL" | "EXPENSE" | "MAINTENANCE";
  record_id: number;
  requested_by_name: string;
  created_at: string;
};

const ENTITY_LABEL: Record<DeleteRequestSocketAlert["entity_type"], string> = {
  FUEL: "fuel record",
  EXPENSE: "expense",
  MAINTENANCE: "maintenance record",
};

interface DeleteRequestsBellProps {
  /** Match the collapsed/expanded state of the surrounding sidebar nav (nav variant). */
  collapsed?: boolean;
  /** "nav": sidebar row (legacy). "icon": labelled icon button with a count badge for the top bar. */
  variant?: "nav" | "icon";
}

/**
 * Super-admin-only nav entry that surfaces pending fuel/expense/maintenance
 * delete requests — badge count updates live via socket, click opens the review modal.
 */
export function DeleteRequestsBell({ collapsed = false, variant = "nav" }: DeleteRequestsBellProps) {
  const { isSuperAdmin } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchPendingCount = useCallback(async () => {
    try {
      const pending = await apiClient.request<unknown[]>("/admin/record-delete-requests/pending");
      setPendingCount(Array.isArray(pending) ? pending.length : 0);
    } catch {
      // ignore — live socket updates still work
    }
  }, []);

  useEffect(() => {
    if (!isSuperAdmin) return;
    const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    if (!token) return;

    const countTimer = window.setTimeout(() => void fetchPendingCount(), 0);

    const { socket, release } = acquireRidesSocket(token);
    socketRef.current = socket;

    socket.on("record:delete_request", (payload: DeleteRequestSocketAlert) => {
      setPendingCount((n) => n + 1);
      toast.warning(
        `${payload.requested_by_name} requested to delete a ${ENTITY_LABEL[payload.entity_type]}`,
        { duration: 10000 },
      );
    });

    return () => {
      window.clearTimeout(countTimer);
      socket.off("record:delete_request");
      release();
      socketRef.current = null;
    };
  }, [isSuperAdmin, fetchPendingCount]);

  if (!isSuperAdmin) return null;

  if (variant === "icon") {
    const label = pendingCount > 0 ? `Delete requests, ${pendingCount} pending` : "Delete requests";
    return (
      <>
        <IconButton label={label} onClick={() => setIsModalOpen(true)} className="relative">
          <Bell />
          {pendingCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-none text-white"
            >
              {pendingCount > 99 ? "99+" : pendingCount}
            </span>
          )}
        </IconButton>
        <DeleteRequestsModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onChanged={fetchPendingCount} />
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        title={collapsed ? "Delete Requests" : undefined}
        className={cx(
          "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 relative",
          !collapsed ? "" : "justify-center px-2",
          "text-[var(--nav-inactive-text)] hover:text-[var(--text-primary)] hover:bg-[var(--nav-hover-bg)]",
        )}
      >
        <span className="relative shrink-0">
          <Bell size={18} strokeWidth={1.5} className="group-hover:text-[var(--text-primary)]" />
          {pendingCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {pendingCount > 99 ? "99+" : pendingCount}
            </span>
          )}
        </span>
        <span
          className={cx(
            "whitespace-nowrap transition-all duration-300 ease-in-out overflow-hidden",
            collapsed ? "max-w-0 opacity-0" : "max-w-[200px] opacity-100",
          )}
        >
          Delete Requests
        </span>
      </button>

      <DeleteRequestsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onChanged={fetchPendingCount}
      />
    </>
  );
}
