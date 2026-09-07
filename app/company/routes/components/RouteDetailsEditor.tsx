"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Car, Edit, Save, User, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/app/admin/ui/Button";
import { Card } from "../../components/DashboardComponents";
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

const selectCls =
  "w-full h-10 rounded-lg border border-[var(--border-input)] bg-[var(--bg-input)] px-3 text-sm text-[var(--text-primary)] focus:border-[var(--cort-orange)] focus:ring-1 focus:ring-[var(--cort-orange)] outline-none transition-all";
const inputCls = selectCls;

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
    <Card className="!p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          {t("vehicleAndDriver")}
        </div>
        {!editing ? (
          <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => setEditing(true)}>
            <Edit className="w-3.5 h-3.5" />
            {tCommon("actions.edit")}
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => setEditing(false)} disabled={saving}>
              <X className="w-3.5 h-3.5" />
              {tCommon("actions.cancel")}
            </Button>
            <Button size="sm" className="gap-1.5 h-8 bg-[var(--cort-orange)] hover:bg-[var(--cort-orange-hover)] text-white" onClick={handleSave} disabled={saving}>
              <Save className="w-3.5 h-3.5" />
              {saving ? t("savingRouteDetails") : tCommon("actions.save")}
            </Button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">{t("routeName")}</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">{t("vehicle")}</label>
            <select
              value={form.assigned_vehicle_id}
              onChange={(e) => setForm((f) => ({ ...f, assigned_vehicle_id: e.target.value }))}
              className={selectCls}
            >
              <option value="">{t("noneUnassigned")}</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate_number}{v.model ? ` · ${v.model}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">{t("driver")}</label>
            <select
              value={form.assigned_driver_id}
              onChange={(e) => setForm((f) => ({ ...f, assigned_driver_id: e.target.value }))}
              className={selectCls}
            >
              <option value="">{t("noneUnassigned")}</option>
              {drivers.map((d) => (
                <option key={d.user_id} value={d.user_id}>
                  {d.users?.full_name}{d.users?.phone ? ` · ${d.users.phone}` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[var(--bg-subtle)] text-blue-400">
              <Car className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-[var(--text-muted)]">{t("vehicle")}</div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">
                {vehicle ? `${vehicle.plate_number}${vehicle.model ? ` · ${vehicle.model}` : ""}` : t("notAssigned")}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[var(--bg-subtle)] text-purple-400">
              <User className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs text-[var(--text-muted)]">{t("driver")}</div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">
                {driver?.full_name ?? t("notAssigned")}
              </div>
              {driver?.phone && (
                <div className="text-xs text-[var(--text-muted)]">{driver.phone}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
