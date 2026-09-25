"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MileVehicleInput, MileVehicleListing, MileVehiclePurpose } from "../../lib/services/api-client";

type Props = {
  title: string;
  description: string;
  load: () => Promise<MileVehicleListing[]>;
  save: (body: MileVehicleInput, id?: number) => Promise<void>;
  remove: (id: number) => Promise<void>;
};

type FormState = {
  purpose: MileVehiclePurpose;
  name: string;
  fixed_amount: string;
  cost_per_km: string;
  bag_allowance: string;
  is_active: boolean;
};

const emptyForm: FormState = {
  purpose: "AIRPORT_TRANSFER",
  name: "",
  fixed_amount: "",
  cost_per_km: "",
  bag_allowance: "3",
  is_active: true,
};

const inputClass =
  "h-11 w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] px-3 text-sm text-[var(--text-primary)] outline-none focus:border-[#f47f00]";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{label}</span>
      {children}
      {hint ? <span className="text-xs text-[var(--text-muted)]">{hint}</span> : null}
    </label>
  );
}

function money(value: number) {
  return `PKR ${Number(value).toLocaleString()}`;
}

function purposeLabel(purpose: MileVehiclePurpose) {
  return purpose === "RENTAL_10HR" ? "Rental 10 hours" : "Airport transfer";
}

export function MileVehiclesManager({ title, description, load, save, remove }: Props) {
  const [vehicles, setVehicles] = useState<MileVehicleListing[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      setVehicles(await load());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load vehicles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const submit = async () => {
    if (!form.name.trim()) {
      toast.error("Vehicle name is required");
      return;
    }
    const fixed = Number(form.fixed_amount);
    if (!Number.isFinite(fixed) || fixed <= 0) {
      toast.error("Enter a fixed amount");
      return;
    }
    const costPerKm = Number(form.cost_per_km || 0);
    if (form.purpose === "RENTAL_10HR" && (!Number.isFinite(costPerKm) || costPerKm < 0)) {
      toast.error("Enter a fuel cost per km");
      return;
    }
    setSaving(true);
    try {
      await save(
        {
          purpose: form.purpose,
          name: form.name.trim(),
          fixed_amount: fixed,
          cost_per_km: form.purpose === "RENTAL_10HR" ? costPerKm : 0,
          bag_allowance: Number(form.bag_allowance || 3),
          is_active: form.is_active,
        },
        editingId ?? undefined,
      );
      toast.success(editingId ? "Vehicle updated" : "Vehicle added");
      setForm(emptyForm);
      setEditingId(null);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save vehicle");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#f47f00]">Travel</p>
        <h1 className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">{description}</p>
      </div>

      <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)]">
              {editingId ? "Edit vehicle" : "Add a vehicle"}
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Airport transfer is a fixed price. Rental 10 hours adds fuel from trip km x cost per km.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            Listed for booking
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Purpose">
            <select
              className={inputClass}
              value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value as MileVehiclePurpose })}
            >
              <option value="AIRPORT_TRANSFER">Airport transfer</option>
              <option value="RENTAL_10HR">Rental 10 hours</option>
            </select>
          </Field>
          <Field label="Vehicle name" hint="Shown to travelers, e.g. Toyota Corolla">
            <input
              className={inputClass}
              placeholder="Toyota Corolla"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field
            label="Fixed amount (PKR)"
            hint={form.purpose === "RENTAL_10HR" ? "Base rental for 10 hours." : "Total charged for the airport transfer."}
          >
            <input
              className={inputClass}
              type="number"
              min={0}
              placeholder="4500"
              value={form.fixed_amount}
              onChange={(e) => setForm({ ...form, fixed_amount: e.target.value })}
            />
          </Field>
          {form.purpose === "RENTAL_10HR" ? (
            <Field label="Fuel cost per km (PKR)" hint="Fuel = km from destination to drop-off x this rate.">
              <input
                className={inputClass}
                type="number"
                min={0}
                placeholder="25"
                value={form.cost_per_km}
                onChange={(e) => setForm({ ...form, cost_per_km: e.target.value })}
              />
            </Field>
          ) : null}
          <Field label="Bag allowance">
            <input
              className={inputClass}
              type="number"
              min={0}
              max={8}
              value={form.bag_allowance}
              onChange={(e) => setForm({ ...form, bag_allowance: e.target.value })}
            />
          </Field>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={submit}
            disabled={saving}
            className="rounded-xl bg-[#f47f00] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {saving ? "Saving..." : editingId ? "Save changes" : "Add vehicle"}
          </button>
          {editingId ? (
            <button
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
              }}
              className="rounded-xl border border-[var(--border-default)] px-5 py-2.5 text-sm font-semibold"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Loading vehicles...</p>
      ) : vehicles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-card)] px-6 py-12 text-center">
          <p className="font-bold text-[var(--text-primary)]">No vehicles listed yet</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Add an airport transfer or 10-hour rental above. It will appear in first/last mile options.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {vehicles.map((vehicle) => (
            <div
              key={vehicle.id}
              className="flex flex-col gap-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-[var(--text-primary)]">{vehicle.name}</p>
                  <span className="rounded-full bg-[var(--bg-subtle)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                    {purposeLabel(vehicle.purpose)}
                  </span>
                  {!vehicle.is_active ? (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                      Hidden
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                  <p><span className="text-[var(--text-muted)]">Fixed</span> {money(vehicle.fixed_amount)}</p>
                  {vehicle.purpose === "RENTAL_10HR" ? (
                    <p><span className="text-[var(--text-muted)]">Fuel / km</span> {money(vehicle.cost_per_km)}</p>
                  ) : null}
                  <p><span className="text-[var(--text-muted)]">Bags</span> {vehicle.bag_allowance}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  className="rounded-xl border border-[var(--border-default)] px-3 py-2 text-sm font-semibold"
                  onClick={() => {
                    setEditingId(vehicle.id);
                    setForm({
                      purpose: vehicle.purpose,
                      name: vehicle.name,
                      fixed_amount: String(vehicle.fixed_amount),
                      cost_per_km: String(vehicle.cost_per_km),
                      bag_allowance: String(vehicle.bag_allowance),
                      is_active: vehicle.is_active,
                    });
                  }}
                >
                  Edit
                </button>
                <button
                  className="rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-600"
                  onClick={async () => {
                    try {
                      await remove(vehicle.id);
                      toast.success("Vehicle removed");
                      await refresh();
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Could not remove vehicle");
                    }
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
