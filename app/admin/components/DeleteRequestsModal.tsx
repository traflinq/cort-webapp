"use client";

import { useEffect, useState } from "react";
import { Check, Fuel, Receipt, Wrench, X } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "../../lib/services/api-client";
import { useConfirm } from "../../lib/hooks/useConfirm";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Dialog, DialogContent } from "../ui/Dialog";
import { EmptyState } from "../ui/EmptyState";
import { ErrorState } from "../ui/ErrorState";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { CardSkeleton } from "../ui/Skeleton";
import { StatusBadge } from "../ui/StatusBadge";
import { formatDateTime } from "../lib/format";

type EntityType = "FUEL" | "EXPENSE" | "MAINTENANCE";

type DeleteRequest = {
  id: number;
  entity_type: EntityType;
  record_id: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requested_by: string;
  requested_by_name: string;
  created_at: string;
  summary: string;
};

const ENTITY_LABEL: Record<EntityType, string> = {
  FUEL: "Fuel record",
  EXPENSE: "Expense",
  MAINTENANCE: "Maintenance record",
};

const ENTITY_ICON: Record<EntityType, typeof Fuel> = {
  FUEL: Fuel,
  EXPENSE: Receipt,
  MAINTENANCE: Wrench,
};

interface DeleteRequestsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after any approve/reject decision so the caller can refresh a pending count. */
  onChanged?: () => void;
}

export function DeleteRequestsModal({ isOpen, onClose, onChanged }: DeleteRequestsModalProps) {
  const confirm = useConfirm();
  const [requests, setRequests] = useState<DeleteRequest[]>([]);
  const [loadedKey, setLoadedKey] = useState(0);
  const [requestKey, setRequestKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<number | null>(null);
  const [notesById, setNotesById] = useState<Record<number, string>>({});

  // Each open (or retry) bumps requestKey; loading = loadedKey !== requestKey.
  const [prevOpen, setPrevOpen] = useState(isOpen);
  if (prevOpen !== isOpen) {
    setPrevOpen(isOpen);
    if (isOpen) setRequestKey((k) => k + 1);
  }
  const loading = isOpen && loadedKey !== requestKey;

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiClient.request<DeleteRequest[]>("/admin/record-delete-requests/pending");
        if (cancelled) return;
        setRequests(Array.isArray(data) ? data : []);
        setError(null);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load delete requests");
      } finally {
        if (!cancelled) setLoadedKey(requestKey);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, requestKey]);

  async function handleDecision(r: DeleteRequest, decision: "approve" | "reject") {
    if (decision === "approve") {
      const ok = await confirm({
        title: `Approve and delete this ${ENTITY_LABEL[r.entity_type].toLowerCase()}?`,
        message: r.summary,
        consequences: ["The record is permanently deleted", `${r.requested_by_name} is notified of the decision`],
        confirmLabel: "Approve & delete",
        destructive: true,
      });
      if (!ok) return;
    }
    setActingId(r.id);
    try {
      await apiClient.request(`/admin/record-delete-requests/${r.id}/${decision}`, {
        method: "POST",
        body: JSON.stringify({ notes: notesById[r.id] || undefined }),
      });
      toast.success(decision === "approve" ? "Request approved and record deleted" : "Request rejected");
      setRequestKey((k) => k + 1);
      onChanged?.();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : `Failed to ${decision} request`);
    } finally {
      setActingId(null);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        size="lg"
        title="Delete requests"
        description="Fuel, expense and maintenance records that staff who didn't add them have asked to delete."
      >
        {loading ? (
          <div className="space-y-3">
            <CardSkeleton lines={3} />
            <CardSkeleton lines={3} />
          </div>
        ) : error ? (
          <ErrorState compact message={error} onRetry={() => setRequestKey((k) => k + 1)} />
        ) : requests.length === 0 ? (
          <EmptyState compact title="No pending delete requests" description="Requests from staff will appear here for review." />
        ) : (
          <ul className="space-y-3">
            {requests.map((r) => {
              const Icon = ENTITY_ICON[r.entity_type];
              const busy = actingId === r.id;
              return (
                <li key={r.id} className="rounded-xl border border-line bg-card p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <StatusBadge status={r.status} size="sm" />
                    <Badge tone="neutral" size="sm" icon={<Icon aria-hidden="true" />}>
                      {ENTITY_LABEL[r.entity_type]}
                    </Badge>
                    <span className="text-xs text-fg-muted">{formatDateTime(r.created_at)}</span>
                  </div>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg border border-line bg-subtle px-3 py-2.5 text-xs">
                    <dt className="font-medium text-fg-muted">Record</dt>
                    <dd className="text-fg">{r.summary}</dd>
                    <dt className="font-medium text-fg-muted">Requested by</dt>
                    <dd className="text-fg">{r.requested_by_name}</dd>
                  </dl>
                  <div className="mt-3">
                    <Field label="Review notes" hint="Optional. Included in the decision.">
                      <Input value={notesById[r.id] ?? ""} onChange={(e) => setNotesById((n) => ({ ...n, [r.id]: e.target.value }))} disabled={busy} />
                    </Field>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="danger" leftIcon={<Check />} loading={busy} onClick={() => void handleDecision(r, "approve")}>
                      Approve &amp; delete
                    </Button>
                    <Button size="sm" variant="outline" leftIcon={<X />} disabled={busy} onClick={() => void handleDecision(r, "reject")}>
                      Reject
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
