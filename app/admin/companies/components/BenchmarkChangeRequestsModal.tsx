'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/app/lib/services/api-client';
import { ArrowRight, Check, Inbox, X } from "@/app/components/icons";
import { toast } from 'sonner';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  EmptyState,
  InlineError,
  Input,
  Skeleton,
} from '../../ui';

type BenchmarkSnapshot = {
  service_type?: string | null;
  vehicle_category?: string | null;
  coaster_seater_size?: string | null;
  cost_type?: string | null;
  monthly_cost?: number | null;
  quantity?: number | null;
  fuel_mode?: string | null;
  fuel_litres?: number | null;
  claimed_avg_distance_km?: number | null;
  fuel_avg_kmpl?: number | null;
};

type ChangeRequest = {
  id: number;
  company_id?: number;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  previous: BenchmarkSnapshot | null;
  proposed: BenchmarkSnapshot | Record<string, unknown>;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
};

interface BenchmarkChangeRequestsModalProps {
  companyId: number;
  companyName: string;
  isOpen: boolean;
  onClose: () => void;
}

function pkr(n: number | null | undefined) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return `PKR ${Number(n).toLocaleString('en-PK')}`;
}

function summarize(s: BenchmarkSnapshot | Record<string, unknown> | null | undefined): string {
  if (!s || Object.keys(s).length === 0) return '—';
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
    if (snap.cost_type === 'FIXED') parts.push(`lump ${pkr(snap.monthly_cost)}`);
    else parts.push(`${snap.quantity ?? 1} × ${pkr(snap.monthly_cost)}`);
  }
  if (snap.fuel_mode === 'LITRES' && snap.fuel_litres != null) parts.push(`${snap.fuel_litres} L/mo`);
  if (snap.fuel_mode === 'AVERAGE') {
    const dist = snap.claimed_avg_distance_km != null ? `${snap.claimed_avg_distance_km} km/day` : null;
    const avg = snap.fuel_avg_kmpl != null ? `${snap.fuel_avg_kmpl} km/L` : null;
    if (dist || avg) parts.push([dist, avg].filter(Boolean).join(' @ '));
  }
  return parts.length ? parts.join(' · ') : '—';
}

const ACTION_TONE = {
  CREATE: 'success',
  UPDATE: 'info',
  DELETE: 'danger',
} as const;

const STATUS_TONE = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
} as const;

export function BenchmarkChangeRequestsModal({
  companyId,
  companyName,
  isOpen,
  onClose,
}: BenchmarkChangeRequestsModalProps) {
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<number | null>(null);
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);
  const [notesById, setNotesById] = useState<Record<number, string>>({});

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.request<ChangeRequest[]>(
        `/admin/companies/${companyId}/benchmark-change-requests`,
      );
      setRequests(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load change requests');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (isOpen) void fetchRequests();
  }, [isOpen, fetchRequests]);

  async function handleDecision(id: number, verdict: 'approve' | 'reject') {
    setActingId(id);
    setDecision(verdict);
    try {
      await apiClient.request(`/admin/companies/${companyId}/benchmark-change-requests/${id}/${verdict}`, {
        method: 'POST',
        body: JSON.stringify({ notes: notesById[id] || undefined }),
      });
      await fetchRequests();
      toast.success(verdict === 'approve' ? 'Change request approved' : 'Change request rejected');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : `Failed to ${verdict} request`;
      setError(message);
      toast.error(message);
    } finally {
      setActingId(null);
      setDecision(null);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && actingId === null && onClose()}>
      <DialogContent
        size="lg"
        scrollable
        title="Benchmark change requests"
        description={`${companyName} — review company-submitted changes`}
        footer={
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        }
      >
        <div className="space-y-4">
          {error && <InlineError>{error}</InlineError>}

          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-32 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
            </div>
          ) : requests.length === 0 ? (
            <EmptyState
              icon={<Inbox />}
              title="No change requests"
              description="When this company asks to change a locked benchmark, it will appear here for review."
              compact
            />
          ) : (
            <ul className="space-y-3">
              {requests.map((r) => (
                <li key={r.id} className="rounded-xl border border-line p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                    <Badge tone={ACTION_TONE[r.action]} variant="outline">
                      {r.action}
                    </Badge>
                    <span className="text-xs text-fg-muted">
                      {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="grid gap-2 rounded-lg border border-line bg-subtle px-3 py-2.5 text-xs sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                    <div>
                      <p className="font-semibold uppercase tracking-wide text-fg-muted">Current</p>
                      <p className="mt-0.5 text-fg">{summarize(r.previous)}</p>
                    </div>
                    <ArrowRight className="hidden size-4 shrink-0 text-fg-muted sm:block" aria-hidden />
                    <div>
                      <p className="font-semibold uppercase tracking-wide text-fg-muted">Proposed</p>
                      <p className="mt-0.5 text-fg">
                        {r.action === 'DELETE' ? 'Delete benchmark' : summarize(r.proposed)}
                      </p>
                    </div>
                  </div>

                  {r.status === 'PENDING' && (
                    <div className="mt-3 space-y-2">
                      <Input
                        placeholder="Review notes (optional)"
                        aria-label="Review notes"
                        value={notesById[r.id] ?? ''}
                        onChange={(e) => setNotesById((n) => ({ ...n, [r.id]: e.target.value }))}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleDecision(r.id, 'approve')}
                          loading={actingId === r.id && decision === 'approve'}
                          disabled={actingId !== null}
                          leftIcon={<Check />}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="danger-outline"
                          onClick={() => handleDecision(r.id, 'reject')}
                          loading={actingId === r.id && decision === 'reject'}
                          disabled={actingId !== null}
                          leftIcon={<X />}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
