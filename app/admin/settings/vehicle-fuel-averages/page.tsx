"use client";

import { useEffect, useState, useCallback } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { AdminProtectedPage } from "../../components/AdminProtectedPage";
import { ADMIN_SUBJECTS } from "../../../lib/abilities/admin-subjects";
import { apiClient } from "../../../lib/services/api-client";
import { usePageBreadcrumbs } from "../../ui/shell/breadcrumbs-context";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardSkeleton,
  ErrorState,
  Input,
  PageHeader,
} from "../../ui";

type FuelAverageRow = {
  id: number;
  vehicle_category: string;
  fuel_avg_kmpl: number;
  updated_at: string;
};

const VEHICLE_CATEGORIES = ["SEDAN", "HATCHBACK", "SUV", "DOUBLE_CABIN", "VAN", "COASTER", "HIACE", "BUS"];

export default function VehicleFuelAveragesPage() {
  return (
    <AdminProtectedPage permission="ops_shuttle" subject={ADMIN_SUBJECTS.ops_shuttle}>
      <VehicleFuelAveragesContent />
    </AdminProtectedPage>
  );
}

function VehicleFuelAveragesContent() {
  const [rows, setRows] = useState<FuelAverageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingCategory, setSavingCategory] = useState<string | null>(null);

  usePageBreadcrumbs([{ label: "Fuel averages" }]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.request<FuelAverageRow[]>("/admin/vehicle-category-fuel-averages");
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load fuel averages");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const existingByCategory = new Map(rows.map((r) => [r.vehicle_category, r]));

  async function handleSave(category: string) {
    const value = parseFloat(drafts[category] ?? "");
    if (!value || value <= 0) return;
    setSavingCategory(category);
    setError(null);
    try {
      await apiClient.request("/admin/vehicle-category-fuel-averages", {
        method: "POST",
        body: JSON.stringify({ vehicle_category: category, fuel_avg_kmpl: value }),
      });
      await fetchRows();
      setDrafts((d) => {
        const next = { ...d };
        delete next[category];
        return next;
      });
      toast.success(`${category} set to ${value} km/L`);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to save";
      setError(message);
      toast.error(message);
    } finally {
      setSavingCategory(null);
    }
  }

  const configuredCount = rows.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fuel averages"
        description="Default km/L per vehicle category, used to calculate expected fuel consumption for LITRES-mode benchmarks. This is a category-wide assumption for savings comparisons — not the actual per-vehicle spec."
        meta={
          <Badge tone={configuredCount > 0 ? "success" : "warning"} variant="soft">
            {configuredCount} of {VEHICLE_CATEGORIES.length} configured
          </Badge>
        }
      />

      {error && <ErrorState message={error} onRetry={fetchRows} />}

      {loading ? (
        <CardSkeleton lines={8} />
      ) : (
        <Card>
          <CardHeader
            title="Category averages"
            description="A category with no average set makes its LITRES-mode benchmarks report “No fleet data”."
          />
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-subtle">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-fg-secondary">
                      Category
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-fg-secondary">
                      km/L
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-fg-secondary">
                      Last updated
                    </th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {VEHICLE_CATEGORIES.map((category) => {
                    const existing = existingByCategory.get(category);
                    const draft = drafts[category] ?? (existing ? String(existing.fuel_avg_kmpl) : "");
                    const dirty = drafts[category] !== undefined && drafts[category] !== String(existing?.fuel_avg_kmpl ?? "");
                    return (
                      <tr key={category}>
                        <td className="px-4 py-3">
                          <span className="font-medium text-fg">{category}</span>
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="e.g. 5"
                            aria-label={`${category} fuel average in km per litre`}
                            value={draft}
                            onChange={(e) => setDrafts((d) => ({ ...d, [category]: e.target.value }))}
                            className="w-28"
                          />
                        </td>
                        <td className="px-4 py-3 text-xs text-fg-muted">
                          {existing ? (
                            new Date(existing.updated_at).toLocaleDateString()
                          ) : (
                            <Badge tone="neutral" variant="outline">
                              Not set
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant={dirty ? "primary" : "outline"}
                            onClick={() => handleSave(category)}
                            loading={savingCategory === category}
                            disabled={!draft || !dirty}
                            leftIcon={<Check />}
                          >
                            Save
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
