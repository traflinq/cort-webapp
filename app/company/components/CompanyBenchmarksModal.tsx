"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Plus, Lock, Clock, X } from "lucide-react";
import { apiClient } from "../../lib/services/api-client";

type FuelMode = "LITRES" | "AVERAGE";

type BenchmarkRow = {
  id: number;
  service_type: "SHUTTLE" | "CHAUFFEUR";
  vehicle_category: string | null;
  coaster_seater_size: string | null;
  cost_type: "FIXED" | "VARIABLE";
  monthly_cost: number;
  quantity: number;
  vendor_name: string | null;
  fuel_mode: FuelMode | null;
  fuel_litres: number | null;
  claimed_avg_distance_km: number | null;
  fuel_avg_kmpl: number | null;
  notes: string | null;
  locked_at: string | null;
};

type ChangeRequest = {
  id: number;
  benchmark_id: number | null;
  action: "CREATE" | "UPDATE" | "DELETE";
  status: "PENDING" | "APPROVED" | "REJECTED";
  created_at: string;
};

type FormState = {
  service_type: "SHUTTLE" | "CHAUFFEUR";
  vehicle_category: string;
  coaster_seater_size: string;
  cost_type: "FIXED" | "VARIABLE";
  monthly_cost: string;
  quantity: string;
  vendor_name: string;
  fuel_mode: FuelMode;
  fuel_litres: string;
  claimed_avg_distance_km: string;
  fuel_avg_kmpl: string;
  notes: string;
};

const VEHICLE_CATEGORIES = ["SEDAN", "HATCHBACK", "SUV", "DOUBLE_CABIN", "VAN", "COASTER", "BUS"];
const COASTER_SEATER_OPTIONS = ["7 Seater", "14 Seater", "24 Seater", "32 Seater", "48 Seater", "62 Seater"];
const VAN_SEATER_OPTIONS = ["7 Seater", "14 Seater"];

function seaterOptionsFor(category: string) {
  if (category === "COASTER") return COASTER_SEATER_OPTIONS;
  if (category === "VAN") return VAN_SEATER_OPTIONS;
  return [];
}

const EMPTY_FORM: FormState = {
  service_type: "SHUTTLE",
  vehicle_category: "",
  coaster_seater_size: "",
  cost_type: "VARIABLE",
  monthly_cost: "",
  quantity: "1",
  vendor_name: "",
  fuel_mode: "LITRES",
  fuel_litres: "",
  claimed_avg_distance_km: "",
  fuel_avg_kmpl: "",
  notes: "",
};

const fieldClass =
  "w-full text-sm border border-[var(--border-input)] rounded-xl px-3 py-2.5 bg-[var(--bg-input)] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--cort-orange)]/40 focus:border-[var(--cort-orange)]";
const labelClass = "text-xs text-[var(--text-secondary)] mb-1.5 block font-semibold";

function pkr(n: number) {
  return `PKR ${Math.abs(n).toLocaleString("en-PK")}`;
}

function formToPayload(form: FormState) {
  return {
    service_type: form.service_type,
    vehicle_category: form.vehicle_category || null,
    coaster_seater_size:
      form.vehicle_category === "COASTER" || form.vehicle_category === "VAN"
        ? form.coaster_seater_size || null
        : null,
    cost_type: form.cost_type,
    monthly_cost: parseFloat(form.monthly_cost),
    quantity: parseInt(form.quantity, 10) || 1,
    vendor_name: form.vendor_name || null,
    fuel_mode: form.fuel_mode,
    fuel_litres: form.fuel_mode === "LITRES" ? parseFloat(form.fuel_litres) : null,
    claimed_avg_distance_km: form.fuel_mode === "AVERAGE" ? parseFloat(form.claimed_avg_distance_km) : null,
    fuel_avg_kmpl: form.fuel_mode === "AVERAGE" ? parseFloat(form.fuel_avg_kmpl) : null,
    notes: form.notes || null,
  };
}

function rowToForm(row: BenchmarkRow): FormState {
  return {
    service_type: row.service_type,
    vehicle_category: row.vehicle_category ?? "",
    coaster_seater_size: row.coaster_seater_size ?? "",
    cost_type: row.cost_type,
    monthly_cost: String(row.monthly_cost),
    quantity: String(row.quantity),
    vendor_name: row.vendor_name ?? "",
    fuel_mode: row.fuel_mode ?? "LITRES",
    fuel_litres: row.fuel_litres != null ? String(row.fuel_litres) : "",
    claimed_avg_distance_km: row.claimed_avg_distance_km != null ? String(row.claimed_avg_distance_km) : "",
    fuel_avg_kmpl: row.fuel_avg_kmpl != null ? String(row.fuel_avg_kmpl) : "",
    notes: row.notes ?? "",
  };
}

function BenchmarkFields({ form, setForm }: { form: FormState; setForm: (f: FormState) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className={labelClass}>Service type *</label>
        <select
          value={form.service_type}
          onChange={(e) => setForm({ ...form, service_type: e.target.value as FormState["service_type"] })}
          className={fieldClass}
        >
          <option value="SHUTTLE">Shuttle</option>
          <option value="CHAUFFEUR">Chauffeur</option>
        </select>
      </div>

      <div>
        <label className={labelClass}>Vehicle category *</label>
        <select
          value={form.vehicle_category}
          onChange={(e) =>
            setForm({ ...form, vehicle_category: e.target.value, coaster_seater_size: "" })
          }
          className={fieldClass}
        >
          <option value="">— Select category —</option>
          {VEHICLE_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {(form.vehicle_category === "COASTER" || form.vehicle_category === "VAN") && (
        <div>
          <label className={labelClass}>
            {form.vehicle_category === "VAN" ? "Van seater size *" : "Coaster seater size *"}
          </label>
          <select
            value={form.coaster_seater_size}
            onChange={(e) => setForm({ ...form, coaster_seater_size: e.target.value })}
            required
            className={fieldClass}
          >
            <option value="">— Select size —</option>
            {seaterOptionsFor(form.vehicle_category).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className={labelClass}>Current vendor</label>
        <input
          type="text"
          placeholder="e.g. Careem for Business"
          value={form.vendor_name}
          onChange={(e) => setForm({ ...form, vendor_name: e.target.value })}
          className={fieldClass}
        />
      </div>

      <div>
        <label className={labelClass}>Cost type *</label>
        <select
          value={form.cost_type}
          onChange={(e) => setForm({ ...form, cost_type: e.target.value as FormState["cost_type"] })}
          className={fieldClass}
        >
          <option value="VARIABLE">Variable (monthly rental + fuel)</option>
          <option value="FIXED">Fixed (lump sum)</option>
        </select>
      </div>

      <div>
        <label className={labelClass}>
          {form.cost_type === "FIXED" ? "Monthly lump sum (PKR) *" : "Monthly rental per vehicle (PKR) *"}
        </label>
        <input
          type="number"
          min="0"
          required
          value={form.monthly_cost}
          onChange={(e) => setForm({ ...form, monthly_cost: e.target.value })}
          className={fieldClass}
        />
      </div>

      <div>
        <label className={labelClass}>Number of vehicles *</label>
        <input
          type="number"
          min="1"
          required
          value={form.quantity}
          onChange={(e) => setForm({ ...form, quantity: e.target.value })}
          className={fieldClass}
        />
      </div>

      <div className="col-span-2 border-t border-[var(--border-default)] pt-3 mt-1">
        <label className={labelClass}>Fuel benchmark mode *</label>
        <select
          value={form.fuel_mode}
          onChange={(e) => setForm({ ...form, fuel_mode: e.target.value as FuelMode })}
          className={fieldClass}
        >
          <option value="LITRES">Litres — claimed litres/month</option>
          <option value="AVERAGE">Average — claimed daily distance + km/L</option>
        </select>
      </div>

      {form.fuel_mode === "LITRES" ? (
        <div className="col-span-2">
          <label className={labelClass}>Claimed litres per vehicle / month *</label>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="e.g. 350"
            value={form.fuel_litres}
            onChange={(e) => setForm({ ...form, fuel_litres: e.target.value })}
            className={fieldClass}
          />
        </div>
      ) : (
        <>
          <div>
            <label className={labelClass}>Claimed avg distance (km/vehicle/day) *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 75"
              value={form.claimed_avg_distance_km}
              onChange={(e) => setForm({ ...form, claimed_avg_distance_km: e.target.value })}
              className={fieldClass}
            />
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Daily km — multiplied by analysed operating days when computing savings.
            </p>
          </div>
          <div>
            <label className={labelClass}>Fuel avg (km/L) *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 5"
              value={form.fuel_avg_kmpl}
              onChange={(e) => setForm({ ...form, fuel_avg_kmpl: e.target.value })}
              className={fieldClass}
            />
          </div>
        </>
      )}

      <div className="col-span-2">
        <label className={labelClass}>Notes</label>
        <textarea
          rows={2}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          className={`${fieldClass} resize-none`}
        />
      </div>
    </div>
  );
}

interface CompanyBenchmarksModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChanged?: () => void;
}

export function CompanyBenchmarksModal({ isOpen, onClose, onChanged }: CompanyBenchmarksModalProps) {
  const [benchmarks, setBenchmarks] = useState<BenchmarkRow[]>([]);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<FormState>(EMPTY_FORM);
  const [requestModalRow, setRequestModalRow] = useState<BenchmarkRow | null>(null);
  const [requestForm, setRequestForm] = useState<FormState>(EMPTY_FORM);
  const [requestAction, setRequestAction] = useState<"UPDATE" | "DELETE">("UPDATE");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rows, requests] = await Promise.all([
        apiClient.request<BenchmarkRow[]>("/company/benchmarks"),
        apiClient.request<ChangeRequest[]>("/company/benchmarks/change-requests"),
      ]);
      setBenchmarks(Array.isArray(rows) ? rows : []);
      setChangeRequests(Array.isArray(requests) ? requests : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load benchmarks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchAll();
      setShowCreateForm(false);
      setCreateForm(EMPTY_FORM);
      setRequestModalRow(null);
    }
  }, [isOpen, fetchAll]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiClient.request("/company/benchmarks", {
        method: "POST",
        body: JSON.stringify(formToPayload(createForm)),
      });
      setShowCreateForm(false);
      setCreateForm(EMPTY_FORM);
      await fetchAll();
      onChanged?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save benchmark");
    } finally {
      setSaving(false);
    }
  }

  function openRequestModal(row: BenchmarkRow) {
    setRequestModalRow(row);
    setRequestForm(rowToForm(row));
    setRequestAction("UPDATE");
    setShowCreateForm(false);
  }

  async function handleSubmitRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!requestModalRow) return;
    setSaving(true);
    setError(null);
    try {
      await apiClient.request("/company/benchmarks/change-requests", {
        method: "POST",
        body: JSON.stringify({
          benchmark_id: requestModalRow.id,
          action: requestAction,
          proposed_payload: requestAction === "DELETE" ? {} : formToPayload(requestForm),
        }),
      });
      setRequestModalRow(null);
      await fetchAll();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to submit change request");
    } finally {
      setSaving(false);
    }
  }

  const pendingByBenchmarkId = new Map(
    changeRequests.filter((r) => r.status === "PENDING" && r.benchmark_id).map((r) => [r.benchmark_id, r]),
  );

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 modal-overlay overflow-y-auto">
      <div className="my-auto w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden rounded-[2.5rem] bg-[var(--bg-card)] shadow-2xl ring-1 ring-[var(--border-default)] modal-panel">
        <div className="flex items-start justify-between border-b border-[var(--border-input)] px-6 py-5 gap-4 shrink-0">
          <div>
            <h3 className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em]">
              Vendor Cost Benchmarks
            </h3>
            <p className="text-sm text-[var(--text-secondary)] mt-2 max-w-lg font-normal normal-case tracking-normal">
              What you paid before Traflinq, including claimed fuel. Once saved, rows are locked — submit a
              change request for superadmin review.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2.5 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] flex-shrink-0 transition-all border border-transparent hover:border-[var(--border-input)]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1 bg-[var(--bg-page)]">
          {error && (
            <p className="text-sm text-[var(--accent-danger)] bg-[var(--accent-danger)]/10 border border-[var(--accent-danger)]/20 rounded-xl px-3 py-2.5">
              {error}
            </p>
          )}

          {loading ? (
            <div className="py-10 text-center text-sm text-[var(--text-muted)]">Loading…</div>
          ) : (
            <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-default)]">
                <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wide">
                  Your Benchmarks
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm((v) => !v);
                    setRequestModalRow(null);
                  }}
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-white bg-[var(--cort-orange)] hover:bg-[var(--cort-orange-hover)] rounded-xl px-3 py-1.5 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </div>

              {benchmarks.length === 0 ? (
                <div className="py-10 text-center text-sm text-[var(--text-muted)] px-4">
                  No benchmarks yet — click Add to create your first one.
                </div>
              ) : (
                <div className="divide-y divide-[var(--border-default)]">
                  {benchmarks.map((b) => {
                    const pending = pendingByBenchmarkId.get(b.id);
                    return (
                      <div
                        key={b.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-4 hover:bg-[var(--row-hover)] transition-colors"
                      >
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                b.service_type === "SHUTTLE"
                                  ? "bg-blue-500/15 text-blue-400"
                                  : "bg-purple-500/15 text-purple-400"
                              }`}
                            >
                              {b.service_type}
                            </span>
                            {b.vehicle_category && (
                              <span className="text-xs text-[var(--text-secondary)] font-medium">
                                {(b.vehicle_category === "COASTER" || b.vehicle_category === "VAN") &&
                                b.coaster_seater_size
                                  ? `${b.vehicle_category === "COASTER" ? "Coaster" : "Van"} (${b.coaster_seater_size})`
                                  : b.vehicle_category}
                              </span>
                            )}
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                                b.cost_type === "FIXED"
                                  ? "bg-orange-500/15 text-orange-400"
                                  : "bg-sky-500/15 text-sky-400"
                              }`}
                            >
                              {b.cost_type === "FIXED" ? "Fixed" : "Variable"}
                            </span>
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border-default)]">
                              <Lock className="h-3 w-3" /> Locked
                            </span>
                            {pending && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-[var(--accent-warning)]/15 text-[var(--accent-warning)]">
                                <Clock className="h-3 w-3" /> Change pending review
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-[var(--text-primary)] font-medium">
                            {b.cost_type === "FIXED" ? (
                              <>
                                {pkr(b.monthly_cost)}
                                <span className="text-[var(--text-muted)] font-normal">
                                  /month lump sum · {b.quantity} vehicle{b.quantity === 1 ? "" : "s"}
                                </span>
                              </>
                            ) : (
                              <>
                                {pkr(b.monthly_cost * b.quantity)}
                                <span className="text-[var(--text-muted)] font-normal">
                                  /month ({b.quantity} × {pkr(b.monthly_cost)} rental)
                                </span>
                              </>
                            )}
                          </p>
                        </div>

                        {pending ? (
                          <span className="self-start sm:self-center text-xs font-semibold text-[var(--accent-warning)]/80 px-3 py-2">
                            Awaiting review
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openRequestModal(b)}
                            className="self-start sm:self-center flex-shrink-0 text-sm font-bold text-white bg-[var(--cort-orange)] hover:bg-[var(--cort-orange-hover)] rounded-xl px-3.5 py-2 transition-colors"
                          >
                            Request Change
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {showCreateForm && (
            <form
              onSubmit={handleCreate}
              className="rounded-2xl border border-[var(--accent-success)]/25 bg-[var(--accent-success)]/5 p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-[var(--text-primary)]">New Benchmark</p>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setCreateForm(EMPTY_FORM);
                  }}
                  className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  Cancel
                </button>
              </div>
              <BenchmarkFields form={createForm} setForm={setCreateForm} />
              <button
                type="submit"
                disabled={saving}
                className="text-sm bg-[var(--cort-orange)] text-white px-4 py-2.5 rounded-xl hover:bg-[var(--cort-orange-hover)] disabled:opacity-50 font-bold"
              >
                {saving ? "Saving…" : "Save Benchmark"}
              </button>
            </form>
          )}

          {requestModalRow && (
            <div className="rounded-2xl border border-[var(--accent-warning)]/25 bg-[var(--accent-warning)]/5 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-[var(--text-primary)]">Request Change</p>
                <button
                  type="button"
                  onClick={() => setRequestModalRow(null)}
                  className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  Cancel
                </button>
              </div>
              <form onSubmit={handleSubmitRequest} className="space-y-4">
                <div>
                  <label className={labelClass}>Request type</label>
                  <select
                    value={requestAction}
                    onChange={(e) => setRequestAction(e.target.value as "UPDATE" | "DELETE")}
                    className={fieldClass}
                  >
                    <option value="UPDATE">Update this benchmark</option>
                    <option value="DELETE">Delete this benchmark</option>
                  </select>
                </div>
                {requestAction === "UPDATE" && (
                  <BenchmarkFields form={requestForm} setForm={setRequestForm} />
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="text-sm bg-[var(--cort-orange)] text-white px-4 py-2.5 rounded-xl hover:bg-[var(--cort-orange-hover)] disabled:opacity-50 font-bold"
                >
                  {saving ? "Submitting…" : "Submit Request"}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
