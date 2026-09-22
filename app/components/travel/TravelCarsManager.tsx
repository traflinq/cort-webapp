"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { TravelCarInput, TravelCarListing } from "../../lib/services/api-client";

type Props = {
  title: string;
  description: string;
  load: () => Promise<TravelCarListing[]>;
  save: (body: TravelCarInput, id?: number) => Promise<void>;
  remove: (id: number) => Promise<void>;
};

type FormState = {
  name: string;
  travel_class: TravelCarInput["travel_class"];
  rental_amount: string;
  cost_per_km: string;
  estimated_toll: string;
  duration: string;
  bag_allowance: string;
  is_active: boolean;
};

const emptyForm: FormState = {
  name: "",
  travel_class: "ECONOMY",
  rental_amount: "",
  cost_per_km: "",
  estimated_toll: "",
  duration: "",
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

export function TravelCarsManager({ title, description, load, save, remove }: Props) {
  const [cars, setCars] = useState<TravelCarListing[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      setCars(await load());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load cars");
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
    const rental = Number(form.rental_amount);
    const costPerKm = Number(form.cost_per_km);
    const toll = Number(form.estimated_toll || 0);
    if (!Number.isFinite(rental) || rental <= 0) {
      toast.error("Enter a rental amount");
      return;
    }
    if (!Number.isFinite(costPerKm) || costPerKm <= 0) {
      toast.error("Enter a fuel cost per km");
      return;
    }
    setSaving(true);
    try {
      await save(
        {
          name: form.name.trim(),
          travel_class: form.travel_class,
          rental_amount: rental,
          cost_per_km: costPerKm,
          estimated_toll: Number.isFinite(toll) ? toll : 0,
          bag_allowance: Number(form.bag_allowance || 3),
          duration: form.duration.trim() || undefined,
          is_active: form.is_active,
        },
        editingId ?? undefined,
      );
      toast.success(editingId ? "Car updated" : "Car added");
      setForm(emptyForm);
      setEditingId(null);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save car");
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
              {editingId ? "Edit car" : "Add a car"}
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Employees see rental + fuel (distance x cost per km) + estimated toll.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            Listed for search
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Vehicle name" hint="Shown on the search results, e.g. Toyota Corolla">
            <input
              className={inputClass}
              placeholder="Toyota Corolla"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Class">
            <select
              className={inputClass}
              value={form.travel_class}
              onChange={(e) => setForm({ ...form, travel_class: e.target.value as TravelCarInput["travel_class"] })}
            >
              <option value="ECONOMY">Economy</option>
              <option value="BUSINESS">Business</option>
            </select>
          </Field>
          <Field label="Rental amount (PKR)" hint="Flat rental for the trip. This does not change with distance.">
            <input
              className={inputClass}
              type="number"
              min={0}
              placeholder="8000"
              value={form.rental_amount}
              onChange={(e) => setForm({ ...form, rental_amount: e.target.value })}
            />
          </Field>
          <Field label="Fuel cost per km (PKR)" hint="Fuel = trip km x this rate. Round trip uses twice the one-way km.">
            <input
              className={inputClass}
              type="number"
              min={0}
              placeholder="25"
              value={form.cost_per_km}
              onChange={(e) => setForm({ ...form, cost_per_km: e.target.value })}
            />
          </Field>
          <Field label="Estimated toll (PKR)" hint="Flat estimate. This is not calculated from distance.">
            <input
              className={inputClass}
              type="number"
              min={0}
              placeholder="1500"
              value={form.estimated_toll}
              onChange={(e) => setForm({ ...form, estimated_toll: e.target.value })}
            />
          </Field>
          <Field label="Typical duration" hint="Optional, e.g. 12-14 hours">
            <input
              className={inputClass}
              placeholder="12-14 hours"
              value={form.duration}
              onChange={(e) => setForm({ ...form, duration: e.target.value })}
            />
          </Field>
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
            {saving ? "Saving..." : editingId ? "Save changes" : "Add car"}
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
        <p className="text-sm text-[var(--text-muted)]">Loading cars...</p>
      ) : cars.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border-default)] bg-[var(--bg-card)] px-6 py-12 text-center">
          <p className="font-bold text-[var(--text-primary)]">No cars listed yet</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Add a vehicle above. It will appear in car search with rental, fuel, and estimated toll.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {cars.map((car) => (
            <div
              key={car.id}
              className="flex flex-col gap-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-5 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-[var(--text-primary)]">{car.name}</p>
                  <span className="rounded-full bg-[var(--bg-subtle)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
                    {car.travel_class === "BUSINESS" ? "Business" : "Economy"}
                  </span>
                  {!car.is_active ? (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                      Hidden
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                  <p><span className="text-[var(--text-muted)]">Rental</span> {money(car.rental_amount)}</p>
                  <p><span className="text-[var(--text-muted)]">Fuel / km</span> {money(car.cost_per_km)}</p>
                  <p><span className="text-[var(--text-muted)]">Est. toll</span> {money(car.estimated_toll)}</p>
                  <p><span className="text-[var(--text-muted)]">Bags</span> {car.bag_allowance}</p>
                </div>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{car.duration || "Duration not set"}</p>
              </div>
              <div className="flex gap-2">
                <button
                  className="rounded-xl border border-[var(--border-default)] px-3 py-2 text-sm font-semibold"
                  onClick={() => {
                    setEditingId(car.id);
                    setForm({
                      name: car.name,
                      travel_class: car.travel_class,
                      rental_amount: String(car.rental_amount),
                      cost_per_km: String(car.cost_per_km),
                      estimated_toll: String(car.estimated_toll),
                      duration: car.duration || "",
                      bag_allowance: String(car.bag_allowance),
                      is_active: car.is_active,
                    });
                  }}
                >
                  Edit
                </button>
                <button
                  className="rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-600"
                  onClick={async () => {
                    try {
                      await remove(car.id);
                      toast.success("Car removed");
                      await refresh();
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Could not remove car");
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
