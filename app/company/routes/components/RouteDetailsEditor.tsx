"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Car, Pencil, Save, User, X } from "lucide-react";
import { toast } from "sonner";
import { apiClient, canServeShuttle } from "@/app/lib/services/api-client";
import type { PoolDriver, PoolVehicle } from "@/app/lib/services/types/multi-mode";
import { Button, Card, CardContent, CardHeader, Field, Input, Select } from "@/app/ui";

type RouteDetailsEditorProps = {
  routeId: number;
  companyId: number;
  name: string;
  vehicle: { plate_number: string; model: string | null; capacity?: number | null } | null;
  driver: { full_name: string; phone: string; id?: string } | null;
  assignedVehicleId?: number | null;
  assignedDriverId?: string | null;
  /** False renders the read-only summary (no edit button). */
  canEdit?: boolean;
  onUpdated: () => void;
};

export function RouteDetailsEditor({ routeId, companyId, name, vehicle, driver, assignedVehicleId, assignedDriverId, canEdit = true, onUpdated }: RouteDetailsEditorProps) {
  const t = useTranslations("company.routes");
  const tCommon = useTranslations("common");

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [vehicles, setVehicles] = useState<PoolVehicle[]>([]);
  const [drivers, setDrivers] = useState<PoolDriver[]>([]);
  const [form, setForm] = useState({ name, assigned_vehicle_id: assignedVehicleId?.toString() ?? "", assigned_driver_id: assignedDriverId ?? "" });

  const startEditing = () => {
    setForm({ name, assigned_vehicle_id: assignedVehicleId?.toString() ?? "", assigned_driver_id: assignedDriverId ?? "" });
    setEditing(true);
  };

  useEffect(() => {
    if (!editing || !companyId) return;
    Promise.all([apiClient.getPoolVehicles(companyId), apiClient.getPoolDrivers(companyId)])
      .then(([vehicleRes, driverRes]) => {
        setVehicles(vehicleRes.data);
        setDrivers(driverRes.data.filter((d) => canServeShuttle(d.driver_type)));
      })
      .catch(() => toast.error(t("failedLoadFleetOptions")));
  }, [editing, companyId, t]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error(t("routeNameRequired"));
      return;
    }
    setSaving(true);
    try {
      await apiClient.updateCompanyRoute(routeId, {
        name: form.name.trim(),
        assigned_vehicle_id: form.assigned_vehicle_id ? Number(form.assigned_vehicle_id) : null,
        assigned_driver_id: form.assigned_driver_id || null,
      });
      toast.success(t("routeDetailsUpdated"));
      setEditing(false);
      onUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("failedUpdateRouteDetails"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title={t("vehicleAndDriver")}
        actions={
          canEdit && !editing ? (
            <Button variant="outline" size="sm" leftIcon={<Pencil />} onClick={startEditing}>
              {tCommon("actions.edit")}
            </Button>
          ) : undefined
        }
      />
      <CardContent>
        {editing ? (
          <form onSubmit={handleSave} className="space-y-4">
            <Field label={t("routeName")} required>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </Field>
            <Field label={t("vehicle")}>
              <Select placeholder={t("noneUnassigned")} value={form.assigned_vehicle_id} onChange={(e) => setForm((f) => ({ ...f, assigned_vehicle_id: e.target.value }))}>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate_number}
                    {v.model ? ` · ${v.model}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("driver")}>
              <Select placeholder={t("noneUnassigned")} value={form.assigned_driver_id} onChange={(e) => setForm((f) => ({ ...f, assigned_driver_id: e.target.value }))}>
                {drivers.map((d) => (
                  <option key={d.user_id} value={d.user_id}>
                    {d.users?.full_name}
                    {d.users?.phone ? ` · ${d.users.phone}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" leftIcon={<X />} onClick={() => setEditing(false)} disabled={saving}>
                {tCommon("actions.cancel")}
              </Button>
              <Button type="submit" size="sm" leftIcon={<Save />} loading={saving}>
                {tCommon("actions.save")}
              </Button>
            </div>
          </form>
        ) : (
          <dl className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-info-soft text-info-ink">
                <Car className="size-4" aria-hidden="true" />
              </span>
              <div>
                <dt className="text-xs text-fg-muted">{t("vehicle")}</dt>
                <dd className="text-sm font-semibold text-fg">{vehicle ? `${vehicle.plate_number}${vehicle.model ? ` · ${vehicle.model}` : ""}` : t("notAssigned")}</dd>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-purple-soft text-purple-ink">
                <User className="size-4" aria-hidden="true" />
              </span>
              <div>
                <dt className="text-xs text-fg-muted">{t("driver")}</dt>
                <dd className="text-sm font-semibold text-fg">{driver?.full_name ?? t("notAssigned")}</dd>
                {driver?.phone && (
                  <dd className="text-xs text-fg-muted" dir="ltr">
                    {driver.phone}
                  </dd>
                )}
              </div>
            </div>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
