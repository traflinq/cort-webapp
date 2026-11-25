'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/app/lib/services/api-client';
import { Plus, Trash2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import {
  Badge,
  Button,
  ConfirmDialog,
  Dialog,
  DialogContent,
  EmptyState,
  Field,
  FormGrid,
  IconButton,
  InlineError,
  Input,
  Select,
  Skeleton,
  Textarea,
} from '../../ui';

// ── Types ─────────────────────────────────────────────────────────────────────

type FuelMode = 'LITRES' | 'AVERAGE';

type BenchmarkRow = {
  id: number;
  service_type: 'SHUTTLE' | 'CHAUFFEUR';
  vehicle_category: string | null;
  coaster_seater_size: string | null;
  cost_type: 'FIXED' | 'VARIABLE';
  monthly_cost: number;
  quantity: number;
  vendor_name: string | null;
  fuel_mode: FuelMode | null;
  fuel_litres: number | null;
  claimed_avg_distance_km: number | null;
  fuel_avg_kmpl: number | null;
  fuel_type?: 'PETROL' | 'DIESEL' | null;
  notes: string | null;
};

type NewBenchmarkForm = {
  vehicle_category: string;
  coaster_seater_size: string;
  cost_type: 'FIXED' | 'VARIABLE';
  monthly_cost: string;
  quantity: string;
  vendor_name: string;
  fuel_mode: FuelMode;
  fuel_litres: string;
  claimed_avg_distance_km: string;
  fuel_avg_kmpl: string;
  fuel_type: 'PETROL' | 'DIESEL';
  notes: string;
};

const VEHICLE_CATEGORIES = ['SEDAN', 'HATCHBACK', 'SUV', 'DOUBLE_CABIN', 'VAN', 'COASTER', 'HIACE', 'BUS'];

const COASTER_SEATER_OPTIONS = ['7 Seater', '14 Seater', '24 Seater', '32 Seater', '48 Seater', '62 Seater'];
const VAN_SEATER_OPTIONS = ['7 Seater', '14 Seater'];

function seaterOptionsFor(category: string) {
  if (category === 'COASTER') return COASTER_SEATER_OPTIONS;
  if (category === 'VAN') return VAN_SEATER_OPTIONS;
  return [];
}

const EMPTY_FORM: NewBenchmarkForm = {
  vehicle_category: '',
  coaster_seater_size: '',
  cost_type: 'VARIABLE',
  monthly_cost: '',
  quantity: '1',
  vendor_name: '',
  fuel_mode: 'LITRES',
  fuel_litres: '',
  claimed_avg_distance_km: '',
  fuel_avg_kmpl: '',
  fuel_type: 'PETROL',
  notes: '',
};

function pkr(n: number) {
  return `PKR ${Math.abs(n).toLocaleString('en-PK')}`;
}

function categoryLabel(b: Pick<BenchmarkRow, 'vehicle_category' | 'coaster_seater_size'>) {
  if (!b.vehicle_category) return null;
  const sized = b.vehicle_category === 'COASTER' || b.vehicle_category === 'VAN';
  if (sized && b.coaster_seater_size) {
    const name = b.vehicle_category === 'COASTER' ? 'Coaster' : 'Van';
    return `${name} (${b.coaster_seater_size})`;
  }
  return b.vehicle_category;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface BenchmarksModalProps {
  companyId: number;
  companyName: string;
  isOpen: boolean;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BenchmarksModal({ companyId, companyName, isOpen, onClose }: BenchmarksModalProps) {
  const [benchmarks, setBenchmarks] = useState<BenchmarkRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<BenchmarkRow | null>(null);
  const [form, setForm] = useState<NewBenchmarkForm>(EMPTY_FORM);

  const fetchBenchmarks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.request<BenchmarkRow[] | { data: BenchmarkRow[] }>(
        `/admin/companies/${companyId}/benchmarks`,
      );
      setBenchmarks(Array.isArray(data) ? data : data?.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load benchmarks');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (!isOpen) return;
    void fetchBenchmarks();
    setShowForm(false);
    setForm(EMPTY_FORM);
  }, [isOpen, fetchBenchmarks]);

  const needsSeater = form.vehicle_category === 'COASTER' || form.vehicle_category === 'VAN';

  function resetForm() {
    setShowForm(false);
    setForm(EMPTY_FORM);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.monthly_cost || !form.vehicle_category) return;
    if (needsSeater && !form.coaster_seater_size) return;
    if (form.fuel_mode === 'LITRES' && !form.fuel_litres) return;
    if (form.fuel_mode === 'AVERAGE' && (!form.claimed_avg_distance_km || !form.fuel_avg_kmpl)) return;
    setSaving(true);
    setError(null);
    try {
      await apiClient.request(`/admin/companies/${companyId}/benchmarks`, {
        method: 'POST',
        body: JSON.stringify({
          service_type: 'SHUTTLE',
          vehicle_category: form.vehicle_category || null,
          coaster_seater_size: needsSeater ? form.coaster_seater_size || null : null,
          cost_type: form.cost_type,
          monthly_cost: parseFloat(form.monthly_cost),
          quantity: parseInt(form.quantity, 10) || 1,
          vendor_name: form.vendor_name || null,
          fuel_mode: form.fuel_mode,
          fuel_litres: form.fuel_mode === 'LITRES' ? parseFloat(form.fuel_litres) : null,
          claimed_avg_distance_km:
            form.fuel_mode === 'AVERAGE' ? parseFloat(form.claimed_avg_distance_km) : null,
          fuel_avg_kmpl: form.fuel_mode === 'AVERAGE' ? parseFloat(form.fuel_avg_kmpl) : null,
          fuel_type: form.fuel_type,
          notes: form.notes || null,
        }),
      });
      resetForm();
      await fetchBenchmarks();
      toast.success('Benchmark saved');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to save benchmark';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await apiClient.request(`/admin/companies/${companyId}/benchmarks/${pendingDelete.id}`, {
        method: 'DELETE',
      });
      setPendingDelete(null);
      await fetchBenchmarks();
      toast.success('Benchmark deleted');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to delete benchmark';
      setError(message);
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  }

  const monthlyTotal =
    form.cost_type === 'FIXED'
      ? parseFloat(form.monthly_cost) || 0
      : (parseFloat(form.monthly_cost) || 0) * (parseInt(form.quantity, 10) || 1);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && !saving && onClose()}>
        <DialogContent
          size="xl"
          scrollable
          title="Pre-Traflinq benchmarks"
          description={`${companyName} — what they paid before Traflinq`}
          footer={
            showForm ? (
              <>
                <Button variant="outline" onClick={resetForm} disabled={saving}>
                  Cancel
                </Button>
                <Button type="submit" form="benchmark-form" loading={saving}>
                  Save benchmark
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={onClose}>
                  Close
                </Button>
                {benchmarks.length > 0 && (
                  <Button onClick={() => setShowForm(true)} leftIcon={<Plus />}>
                    Add benchmark
                  </Button>
                )}
              </>
            )
          }
        >
          <div className="space-y-5">
            <p className="rounded-xl border border-line bg-subtle px-4 py-3 text-xs leading-relaxed text-fg-secondary">
              Enter each vendor or service line the company had before switching to CORT, including their
              claimed fuel consumption. The system compares this against actual GPS-measured utilisation to
              compute a verified fuel-cost saving each month.
            </p>

            {error && <InlineError>{error}</InlineError>}

            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
              </div>
            ) : benchmarks.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-line">
                <div className="border-b border-line bg-subtle px-4 py-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-fg-secondary">
                    Configured benchmarks
                  </p>
                </div>
                <ul className="divide-y divide-line">
                  {benchmarks.map((b) => (
                    <li key={b.id} className="flex items-start justify-between gap-4 px-4 py-3">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {b.service_type !== 'SHUTTLE' && (
                            <Badge tone="warning">{b.service_type} — not applicable</Badge>
                          )}
                          {categoryLabel(b) && <Badge tone="neutral">{categoryLabel(b)}</Badge>}
                          <Badge tone={b.cost_type === 'FIXED' ? 'warning' : 'brand'} variant="outline">
                            {b.cost_type === 'FIXED' ? 'Fixed' : 'Variable'}
                          </Badge>
                          {b.fuel_mode && (
                            <Badge tone="success" variant="outline">
                              Fuel: {b.fuel_mode === 'LITRES' ? 'Litres' : 'Average'}
                            </Badge>
                          )}
                          {b.vendor_name && (
                            <span className="truncate text-xs text-fg-muted">— {b.vendor_name}</span>
                          )}
                        </div>
                        <p className="text-xs text-fg-secondary">
                          {b.cost_type === 'FIXED' ? (
                            <>
                              <span className="font-medium text-fg">{pkr(b.monthly_cost)}</span>
                              <span className="text-fg-muted">
                                {' '}
                                /month lump sum · {b.quantity} vehicle{b.quantity === 1 ? '' : 's'}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="font-medium text-fg">{pkr(b.monthly_cost * b.quantity)}</span>
                              <span className="text-fg-muted">
                                {' '}
                                /month · {b.quantity} × {pkr(b.monthly_cost)} rental
                              </span>
                            </>
                          )}
                          {b.fuel_mode === 'LITRES' && b.fuel_litres != null && (
                            <span className="text-fg-muted"> · {b.fuel_litres} L/vehicle/month claimed</span>
                          )}
                          {b.fuel_mode === 'AVERAGE' &&
                            b.claimed_avg_distance_km != null &&
                            b.fuel_avg_kmpl != null && (
                              <span className="text-fg-muted">
                                {' '}
                                · {b.claimed_avg_distance_km} km/vehicle/day @ {b.fuel_avg_kmpl} km/L claimed
                              </span>
                            )}
                        </p>
                        {b.notes && <p className="text-xs italic text-fg-muted">{b.notes}</p>}
                      </div>
                      <IconButton
                        label="Delete benchmark"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setPendingDelete(b)}
                      >
                        <Trash2 />
                      </IconButton>
                    </li>
                  ))}
                </ul>
              </div>
            ) : !showForm ? (
              <EmptyState
                icon={<Wallet />}
                title="No benchmarks yet"
                description="Add what this company paid before Traflinq — vendor, monthly cost, vehicle count and claimed fuel consumption. Savings are calculated from actual GPS utilisation."
                action={
                  <Button onClick={() => setShowForm(true)} leftIcon={<Plus />}>
                    Add first benchmark
                  </Button>
                }
              />
            ) : null}

            {showForm && (
              <form
                id="benchmark-form"
                onSubmit={handleAdd}
                className="space-y-4 rounded-xl border border-line bg-subtle/50 p-4"
              >
                <p className="text-sm font-semibold text-fg">New benchmark</p>

                <FormGrid cols={2}>
                  <Field
                    label="Vehicle category"
                    required
                    hint="Shuttle only — chauffeur costs are audited against vendor contracts."
                  >
                    <Select
                      required
                      placeholder="Select category"
                      value={form.vehicle_category}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, vehicle_category: e.target.value, coaster_seater_size: '' }))
                      }
                    >
                      {VEHICLE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  {needsSeater && (
                    <Field label={form.vehicle_category === 'VAN' ? 'Van seater size' : 'Coaster seater size'} required>
                      <Select
                        required
                        placeholder="Select size"
                        value={form.coaster_seater_size}
                        onChange={(e) => setForm((f) => ({ ...f, coaster_seater_size: e.target.value }))}
                      >
                        {seaterOptionsFor(form.vehicle_category).map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  )}

                  <Field label="Current vendor">
                    <Input
                      placeholder="e.g. Careem for Business"
                      value={form.vendor_name}
                      onChange={(e) => setForm((f) => ({ ...f, vendor_name: e.target.value }))}
                    />
                  </Field>

                  <Field label="Cost type" required>
                    <Select
                      value={form.cost_type}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, cost_type: e.target.value as 'FIXED' | 'VARIABLE' }))
                      }
                    >
                      <option value="VARIABLE">Variable (monthly rental + fuel)</option>
                      <option value="FIXED">Fixed (lump sum)</option>
                    </Select>
                  </Field>

                  <Field
                    label={form.cost_type === 'FIXED' ? 'Monthly lump sum (PKR)' : 'Monthly rental per vehicle (PKR)'}
                    required
                  >
                    <Input
                      type="number"
                      min="0"
                      required
                      placeholder="e.g. 150000"
                      value={form.monthly_cost}
                      onChange={(e) => setForm((f) => ({ ...f, monthly_cost: e.target.value }))}
                    />
                  </Field>

                  <Field label="Number of vehicles / units" required>
                    <Input
                      type="number"
                      min="1"
                      required
                      value={form.quantity}
                      onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                    />
                  </Field>
                </FormGrid>

                {form.monthly_cost && (
                  <p className="rounded-lg border border-line bg-card px-3 py-2 text-xs text-fg-secondary">
                    Total monthly: <span className="font-semibold text-fg">{pkr(monthlyTotal)}</span>
                    {form.cost_type === 'VARIABLE' &&
                      ` · ${parseInt(form.quantity, 10) || 1} × ${pkr(parseFloat(form.monthly_cost) || 0)}`}
                    {form.cost_type === 'FIXED' &&
                      ` · ${parseInt(form.quantity, 10) || 1} vehicle${(parseInt(form.quantity, 10) || 1) === 1 ? '' : 's'}`}
                  </p>
                )}

                <div className="border-t border-line pt-4">
                  <FormGrid cols={2}>
                    <Field label="Fuel type" required className="sm:col-span-2">
                      <Select
                        value={form.fuel_type}
                        onChange={(e) => setForm((f) => ({ ...f, fuel_type: e.target.value as 'PETROL' | 'DIESEL' }))}
                      >
                        <option value="PETROL">Petrol</option>
                        <option value="DIESEL">Diesel</option>
                      </Select>
                    </Field>
                    <Field label="Fuel benchmark mode" required className="sm:col-span-2">
                      <Select
                        value={form.fuel_mode}
                        onChange={(e) => setForm((f) => ({ ...f, fuel_mode: e.target.value as FuelMode }))}
                      >
                        <option value="LITRES">Litres — company entered claimed litres/month</option>
                        <option value="AVERAGE">Average — claimed daily distance + their own km/L</option>
                      </Select>
                    </Field>

                    {form.fuel_mode === 'LITRES' ? (
                      <Field
                        label="Claimed litres per vehicle / month"
                        required
                        className="sm:col-span-2"
                        hint="Compared against the admin-set km/L average for this vehicle category."
                      >
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          placeholder="e.g. 350"
                          value={form.fuel_litres}
                          onChange={(e) => setForm((f) => ({ ...f, fuel_litres: e.target.value }))}
                        />
                      </Field>
                    ) : (
                      <>
                        <Field
                          label="Claimed avg distance (km/vehicle/day)"
                          required
                          hint="Daily km — multiplied by analysed operating days when computing savings."
                        >
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            required
                            placeholder="e.g. 75"
                            value={form.claimed_avg_distance_km}
                            onChange={(e) =>
                              setForm((f) => ({ ...f, claimed_avg_distance_km: e.target.value }))
                            }
                          />
                        </Field>
                        <Field label="Company's claimed fuel avg (km/L)" required>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            required
                            placeholder="e.g. 5"
                            value={form.fuel_avg_kmpl}
                            onChange={(e) => setForm((f) => ({ ...f, fuel_avg_kmpl: e.target.value }))}
                          />
                        </Field>
                      </>
                    )}
                  </FormGrid>
                </div>

                <Field label="Notes">
                  <Textarea
                    rows={2}
                    placeholder="e.g. Included 3 dedicated Coasters + driver salaries"
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  />
                </Field>
              </form>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        priority="elevated"
        destructive
        title="Delete benchmark?"
        message={
          pendingDelete
            ? `${categoryLabel(pendingDelete) || 'This benchmark'} will be removed.`
            : undefined
        }
        consequences={['Savings for this category stop being calculated.']}
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </>
  );
}
