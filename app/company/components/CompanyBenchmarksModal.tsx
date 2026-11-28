"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Lock, Clock } from "@/app/components/icons";
import { apiClient } from "../../lib/services/api-client";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  Field,
  InlineError,
  Input,
  Select,
  Spinner,
  Textarea,
} from "@/app/admin/ui";

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
  fuel_type?: FuelType | null;
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
  fuel_type: FuelType;
  notes: string;
};

type FuelType = "PETROL" | "DIESEL";

const VEHICLE_CATEGORIES = ["SEDAN", "HATCHBACK", "SUV", "DOUBLE_CABIN", "VAN", "COASTER", "HIACE", "BUS"];
const COASTER_SEATER_OPTIONS = ["7 Seater", "14 Seater", "24 Seater", "32 Seater", "48 Seater", "62 Seater"];
const VAN_SEATER_OPTIONS = ["7 Seater", "14 Seater"];

function seaterOptionsFor(category: string) {
  if (category === "COASTER") return COASTER_SEATER_OPTIONS;
  if (category === "VAN") return VAN_SEATER_OPTIONS;
  return [];
}

const EMPTY_FORM: FormState = {
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
  fuel_type: "PETROL",
  notes: "",
};

function pkr(n: number) {
  return `PKR ${Math.abs(n).toLocaleString("en-PK")}`;
}

function formToPayload(form: FormState) {
  return {
    service_type: "SHUTTLE" as const,
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
    fuel_type: form.fuel_type,
    notes: form.notes || null,
  };
}

function rowToForm(row: BenchmarkRow): FormState {
  return {
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
    fuel_type: row.fuel_type ?? (row.vehicle_category === "COASTER" || row.vehicle_category === "BUS" ? "DIESEL" : "PETROL"),
    notes: row.notes ?? "",
  };
}

function BenchmarkFields({ form, setForm }: { form: FormState; setForm: (f: FormState) => void }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Vehicle category" required>
        <Select
          value={form.vehicle_category}
          onChange={(e) =>
            setForm({ ...form, vehicle_category: e.target.value, coaster_seater_size: "" })
          }
        >
          <option value="">Select category</option>
          {VEHICLE_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
      </Field>

      {(form.vehicle_category === "COASTER" || form.vehicle_category === "VAN") && (
        <Field label={form.vehicle_category === "VAN" ? "Van seater size" : "Coaster seater size"} required>
          <Select
            value={form.coaster_seater_size}
            onChange={(e) => setForm({ ...form, coaster_seater_size: e.target.value })}
            required
          >
            <option value="">Select size</option>
            {seaterOptionsFor(form.vehicle_category).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </Field>
      )}

      <Field label="Current vendor">
        <Input
          type="text"
          placeholder="e.g. Careem for Business"
          value={form.vendor_name}
          onChange={(e) => setForm({ ...form, vendor_name: e.target.value })}
        />
      </Field>

      <Field label="Cost type" required>
        <Select
          value={form.cost_type}
          onChange={(e) => setForm({ ...form, cost_type: e.target.value as FormState["cost_type"] })}
        >
          <option value="VARIABLE">Variable (monthly rental + fuel)</option>
          <option value="FIXED">Fixed (lump sum)</option>
        </Select>
      </Field>

      <Field label={form.cost_type === "FIXED" ? "Monthly lump sum (PKR)" : "Monthly rental per vehicle (PKR)"} required>
        <Input
          type="number"
          min="0"
          required
          className="tabular-nums"
          value={form.monthly_cost}
          onChange={(e) => setForm({ ...form, monthly_cost: e.target.value })}
        />
      </Field>

      <Field label="Number of vehicles" required>
        <Input
          type="number"
          min="1"
          required
          className="tabular-nums"
          value={form.quantity}
          onChange={(e) => setForm({ ...form, quantity: e.target.value })}
        />
      </Field>

      <Field label="Fuel type" required className="border-t border-line pt-4 sm:col-span-2">
        <Select
          value={form.fuel_type}
          onChange={(e) => setForm({ ...form, fuel_type: e.target.value as FuelType })}
        >
          <option value="PETROL">Petrol</option>
          <option value="DIESEL">Diesel</option>
        </Select>
      </Field>

      <Field label="Fuel benchmark mode" required className="sm:col-span-2">
        <Select
          value={form.fuel_mode}
          onChange={(e) => setForm({ ...form, fuel_mode: e.target.value as FuelMode })}
        >
          <option value="LITRES">Litres: claimed litres per month</option>
          <option value="AVERAGE">Average: claimed daily distance and km/L</option>
        </Select>
      </Field>

      {form.fuel_mode === "LITRES" ? (
        <Field label="Claimed litres per vehicle / month" required className="sm:col-span-2">
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="e.g. 350"
            className="tabular-nums"
            value={form.fuel_litres}
            onChange={(e) => setForm({ ...form, fuel_litres: e.target.value })}
          />
        </Field>
      ) : (
        <>
          <Field
            label="Claimed avg distance (km/vehicle/day)"
            required
            hint="Daily km, multiplied by analysed operating days when computing savings."
          >
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 75"
              className="tabular-nums"
              value={form.claimed_avg_distance_km}
              onChange={(e) => setForm({ ...form, claimed_avg_distance_km: e.target.value })}
            />
          </Field>
          <Field label="Fuel avg (km/L)" required>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 5"
              className="tabular-nums"
              value={form.fuel_avg_kmpl}
              onChange={(e) => setForm({ ...form, fuel_avg_kmpl: e.target.value })}
            />
          </Field>
        </>
      )}

      <Field label="Notes" className="sm:col-span-2">
        <Textarea
          rows={2}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          className="min-h-16 resize-none"
        />
      </Field>
    </div>
  );
}

interface CompanyBenchmarksModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChanged?: () => void;
  /**
   * vendorRates: a company running its own vendors on Traflinq enters the rates it pays them now.
   * preTraflinq: a Cort-managed company enters what it paid its vendor before switching (the savings baseline).
   */
  purpose?: "vendorRates" | "preTraflinq";
}

const COPY = {
  vendorRates: {
    title: "Your Vendor Rates",
    description:
      "The monthly rate and claimed fuel your vendors charge you per vehicle type. Used to price your routes, compare fuel and work out savings. Once saved, rows are locked — submit a change request for superadmin review.",
    list: "Your Vendor Rates",
    add: "New Vendor Rate",
    save: "Save Vendor Rate",
  },
  preTraflinq: {
    title: "Vendor Cost Benchmarks",
    description:
      "What you paid before Traflinq, including claimed fuel. Once saved, rows are locked — submit a change request for superadmin review.",
    list: "Your Benchmarks",
    add: "New Benchmark",
    save: "Save Benchmark",
  },
} as const;

export function CompanyBenchmarksModal({ isOpen, onClose, onChanged, purpose = "preTraflinq" }: CompanyBenchmarksModalProps) {
  const copy = COPY[purpose];
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        size="lg"
        title={copy.title}
        description={copy.description}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div className="space-y-4">
          {error && <InlineError>{error}</InlineError>}

          {loading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-line">
              <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
                <p className="text-sm font-semibold text-fg">{copy.list}</p>
                <Button
                  type="button"
                  size="sm"
                  leftIcon={<Plus />}
                  onClick={() => {
                    setShowCreateForm((v) => !v);
                    setRequestModalRow(null);
                  }}
                >
                  Add
                </Button>
              </div>

              {benchmarks.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-fg-muted">
                  No benchmarks yet. Click Add to create your first one.
                </div>
              ) : (
                <div className="divide-y divide-line">
                  {benchmarks.map((b) => {
                    const pending = pendingByBenchmarkId.get(b.id);
                    return (
                      <div
                        key={b.id}
                        className="flex flex-col justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-row-hover sm:flex-row sm:items-center"
                      >
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {b.vehicle_category && (
                              <span className="me-1 text-sm font-medium text-fg">
                                {(b.vehicle_category === "COASTER" || b.vehicle_category === "VAN") &&
                                b.coaster_seater_size
                                  ? `${b.vehicle_category === "COASTER" ? "Coaster" : "Van"} (${b.coaster_seater_size})`
                                  : b.vehicle_category}
                              </span>
                            )}
                            {b.service_type !== "SHUTTLE" && (
                              <Badge tone="warning" dot size="sm">
                                {b.service_type}: not applicable
                              </Badge>
                            )}
                            <Badge size="sm" variant="outline">
                              {b.cost_type === "FIXED" ? "Fixed" : "Variable"}
                            </Badge>
                            {b.fuel_type && (
                              <Badge size="sm" variant="outline">
                                {b.fuel_type === "DIESEL" ? "Diesel" : "Petrol"}
                              </Badge>
                            )}
                            <Badge size="sm" icon={<Lock />}>
                              Locked
                            </Badge>
                            {pending && (
                              <Badge tone="warning" size="sm" icon={<Clock />}>
                                Change pending review
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm font-medium tabular-nums text-fg">
                            {b.cost_type === "FIXED" ? (
                              <>
                                {pkr(b.monthly_cost)}
                                <span className="font-normal text-fg-muted">
                                  /month lump sum · {b.quantity} vehicle{b.quantity === 1 ? "" : "s"}
                                </span>
                              </>
                            ) : (
                              <>
                                {pkr(b.monthly_cost * b.quantity)}
                                <span className="font-normal text-fg-muted">
                                  /month ({b.quantity} × {pkr(b.monthly_cost)} rental)
                                </span>
                              </>
                            )}
                          </p>
                        </div>

                        {pending ? (
                          <span className="self-start text-xs text-fg-muted sm:self-center">
                            Awaiting review
                          </span>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="self-start sm:self-center"
                            onClick={() => openRequestModal(b)}
                          >
                            Request change
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {showCreateForm && (
            <form onSubmit={handleCreate} className="space-y-4 rounded-xl border border-line p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-fg">{copy.add}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowCreateForm(false);
                    setCreateForm(EMPTY_FORM);
                  }}
                >
                  Cancel
                </Button>
              </div>
              <BenchmarkFields form={createForm} setForm={setCreateForm} />
              <div className="flex justify-end">
                <Button type="submit" loading={saving}>
                  {saving ? "Saving…" : copy.save}
                </Button>
              </div>
            </form>
          )}

          {requestModalRow && (
            <div className="space-y-4 rounded-xl border border-line p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-fg">Request change</p>
                <Button type="button" variant="ghost" size="sm" onClick={() => setRequestModalRow(null)}>
                  Cancel
                </Button>
              </div>
              <form onSubmit={handleSubmitRequest} className="space-y-4">
                <Field label="Request type">
                  <Select
                    value={requestAction}
                    onChange={(e) => setRequestAction(e.target.value as "UPDATE" | "DELETE")}
                  >
                    <option value="UPDATE">Update this benchmark</option>
                    <option value="DELETE">Delete this benchmark</option>
                  </Select>
                </Field>
                {requestAction === "UPDATE" && (
                  <BenchmarkFields form={requestForm} setForm={setRequestForm} />
                )}
                <div className="flex justify-end">
                  <Button type="submit" variant={requestAction === "DELETE" ? "danger" : "primary"} loading={saving}>
                    {saving ? "Submitting…" : "Submit request"}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
