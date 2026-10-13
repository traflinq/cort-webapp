"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import { apiClient } from "../../lib/services/api-client";
import { useAuth } from "../../lib/contexts/auth-context";
import { DeleteRequestsModal } from "./DeleteRequestsModal";
import { navItemClass, NavHover, NavLabel } from "../ui/nav/SidebarItem";

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
  /** Match the collapsed/expanded state of the surrounding sidebar nav. */
  collapsed?: boolean;
}

/**
 * Super-admin-only nav entry that surfaces pending fuel/expense/maintenance
 * delete requests — badge count updates live via socket, click opens the review modal.
 */
export function DeleteRequestsBell({ collapsed = false }: DeleteRequestsBellProps) {
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

    fetchPendingCount();

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

    socket.on("record:delete_request", (payload: DeleteRequestSocketAlert) => {
      setPendingCount((n) => n + 1);
      toast.warning(
        `${payload.requested_by_name} requested to delete a ${ENTITY_LABEL[payload.entity_type]}`,
        { duration: 10000 },
      );
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isSuperAdmin, fetchPendingCount]);

  if (!isSuperAdmin) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        title={collapsed ? "Delete Requests" : undefined}
        className={navItemClass({ rail: collapsed })}
      >
        <NavHover />
        <span className="relative z-10 shrink-0">
          <Bell size={17} strokeWidth={1.6} />
          {pendingCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {pendingCount > 99 ? "99+" : pendingCount}
            </span>
          )}
        </span>
        <NavLabel rail={collapsed}>Delete Requests</NavLabel>
      </button>

      <DeleteRequestsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onChanged={fetchPendingCount}
      />
    </>
  );
}
