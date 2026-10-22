"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button, Field, InlineError, Input } from "@/app/ui";
import { useAppDispatch } from "../../lib/store/hooks";
import { clearDashboardCache, fetchDashboardStats } from "../../lib/store/slices/dashboardSlice";
import { apiClient } from "../../lib/services/api-client";

interface EditBudgetFormProps {
  companyId: string;
  currentBudget: number | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function EditBudgetForm({ companyId, currentBudget, onSuccess, onCancel }: EditBudgetFormProps) {
  const t = useTranslations("company.dashboard");
  const tEmployees = useTranslations("company.employees");
  const tCommon = useTranslations("common");
  const dispatch = useAppDispatch();
  const [budget, setBudget] = useState<string>(currentBudget ? String(currentBudget) : "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const newBudget = Number.parseInt(budget.replace(/,/g, ""), 10);
    if (Number.isNaN(newBudget) || newBudget < 0) {
      setError(tCommon("validation.validPositiveNumber"));
      return;
    }
    setIsSubmitting(true);
    try {
      await apiClient.updateCompany(companyId, { monthly_budget: newBudget });
      dispatch(clearDashboardCache());
      dispatch(fetchDashboardStats(companyId));
      toast.success(tEmployees("saveBudget"));
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : tEmployees("failedUpdateBudget"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <InlineError>{error}</InlineError>}
      <Field label={t("monthlyBudgetLabel")} hint={tEmployees("budgetHint")} required>
        <Input
          type="text"
          inputMode="numeric"
          required
          value={budget}
          onChange={(e) => setBudget(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder={t("budgetPlaceholder")}
          dir="ltr"
          mono
        />
      </Field>
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          {tCommon("actions.cancel")}
        </Button>
        <Button type="submit" loading={isSubmitting} disabled={!budget}>
          {tEmployees("saveBudget")}
        </Button>
      </div>
    </form>
  );
}
