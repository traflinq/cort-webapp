"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Car, Edit, Save, User } from "@/app/components/icons";
import { toast } from "sonner";
import { Badge, Button, Field, Input, Select } from "@/app/admin/ui";
import { Card } from "../../components/Card";
import { apiClient, canServeShuttle } from "../../../lib/services/api-client";
import { PoolDriver, PoolVehicle } from "../../../lib/services/types/multi-mode";

type RouteDetailsEditorProps = {
  routeId: number;
  companyId: number;
  name: string;
  vehicle: { plate_number: string; model: string | null; capacity?: number | null } | null;
  driver: { full_name: string; phone: string; id?: string } | null;
  assignedVehicleId?: number | null;
  assignedDriverId?: string | null;
  onUpdated: () => void;
};

export function RouteDetailsEditor({
  routeId,
  companyId,
  name,
  vehicle,
  driver,
  assignedVehicleId,
  assignedDriverId,
  onUpdated,
}: RouteDetailsEditorProps) {
  const t = useTranslations("company.routes");
  const tCommon = useTranslations("common");

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [vehicles, setVehicles] = useState<PoolVehicle[]>([]);
  const [drivers, setDrivers] = useState<PoolDriver[]>([]);
  const [form, setForm] = useState({
    name,
    assigned_vehicle_id: assignedVehicleId?.toString() ?? "",
    assigned_driver_id: assignedDriverId ?? "",
  });

  useEffect(() => {
    if (!editing) {
      setForm({
        name,
        assigned_vehicle_id: assignedVehicleId?.toString() ?? "",
        assigned_driver_id: assignedDriverId ?? "",
      });
    }
  }, [name, assignedVehicleId, assignedDriverId, editing]);

  useEffect(() => {
    if (!editing || !companyId) return;
    Promise.all([
      apiClient.getPoolVehicles(companyId),
      apiClient.getPoolDrivers(companyId),
    ])
      .then(([vehicleRes, driverRes]) => {
        setVehicles(vehicleRes.data);
        setDrivers(driverRes.data.filter((d) => canServeShuttle(d.driver_type)));
      })
      .catch(() => toast.error(t("failedLoadFleetOptions")));
  }, [editing, companyId, t]);

  async function handleSave() {
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
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-fg">{t("vehicleAndDriver")}</h3>
        {!editing ? (
          <Button variant="outline" size="sm" leftIcon={<Edit />} onClick={() => setEditing(true)}>
            {tCommon("actions.edit")}
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving}>
              {tCommon("actions.cancel")}
            </Button>
            <Button size="sm" leftIcon={<Save />} onClick={handleSave} loading={saving}>
              {saving ? t("savingRouteDetails") : tCommon("actions.save")}
            </Button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-4">
          <Field label={t("routeName")}>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </Field>
          <Field label={t("vehicle")}>
            <Select
              value={form.assigned_vehicle_id}
              onChange={(e) => setForm((f) => ({ ...f, assigned_vehicle_id: e.target.value }))}
            >
              <option value="">{t("noneUnassigned")}</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate_number}{v.model ? ` · ${v.model}` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("driver")}>
            <Select
              value={form.assigned_driver_id}
              onChange={(e) => setForm((f) => ({ ...f, assigned_driver_id: e.target.value }))}
            >
              <option value="">{t("noneUnassigned")}</option>
              {drivers.map((d) => (
                <option key={d.user_id} value={d.user_id}>
                  {d.users?.full_name}{d.users?.phone ? ` · ${d.users.phone}` : ""}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      ) : (
        <div className="divide-y divide-line border-t border-line">
          <div className="flex items-start gap-3 py-3">
            <Car className="mt-0.5 size-4 shrink-0 text-fg-muted" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-fg-muted">{t("vehicle")}</p>
              <div className="mt-0.5 text-sm font-medium text-fg">
                {vehicle ? (
                  <>
                    <span className="font-mono">{vehicle.plate_number}</span>
                    {vehicle.model ? <span className="text-fg-secondary"> · {vehicle.model}</span> : null}
                  </>
                ) : (
                  <Badge tone="warning" dot>{t("notAssigned")}</Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3 pt-3">
            <User className="mt-0.5 size-4 shrink-0 text-fg-muted" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-fg-muted">{t("driver")}</p>
              <div className="mt-0.5 text-sm font-medium text-fg">
                {driver?.full_name ?? <Badge tone="warning" dot>{t("notAssigned")}</Badge>}
              </div>
              {driver?.phone && (
                <div className="text-xs text-fg-muted tabular-nums">{driver.phone}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
