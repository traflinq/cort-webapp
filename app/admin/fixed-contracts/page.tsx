"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Power, PowerOff, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useAppDispatch, useAppSelector } from "../../lib/store/hooks";
import { PermissionGate } from "../components/PermissionGate";
import { AdminCan, useAdminAbility } from "../../lib/abilities/AdminAbilityProvider";
import { ADMIN_SUBJECTS } from "../../lib/abilities/admin-subjects";
import { useConfirm } from "../../lib/hooks/useConfirm";
import {
  fetchFixedTermContracts,
  createFixedTermContractAsync,
  updateFixedTermContractAsync,
  deleteFixedTermContractAsync,
  selectAdminPricingState,
  resetActionStatus,
} from "../../lib/store/slices/adminPricingSlice";
import { apiClient, type FixedTermContract } from "../../lib/services/api-client";
import {
  Button,
  Card,
  DataTable,
  Dialog,
  DialogContent,
  Field,
  FormGrid,
  Input,
  PageHeader,
  PageSkeleton,
  Select,
  StatusBadge,
  Textarea,
  type ActionMenuItem,
  type DataTableColumn,
  type StatusEntry,
} from "../ui";
import { formatCurrency } from "../lib/format";
import { todayYmd } from "../lib/dates";

const PAYMENT_STATUS: Record<string, StatusEntry> = {
  FULLY_PAID: { tone: "success", label: "Fully paid" },
  PARTIALLY_PAID: { tone: "warning", label: "Partially paid" },
  UNPAID: { tone: "danger", label: "Unpaid" },
};

type FormState = { carDescription: string; ownerName: string; monthlyAmount: string; category: "CHAUFFEUR" | "SHUTTLE" };
const EMPTY_FORM: FormState = { carDescription: "", ownerName: "", monthlyAmount: "", category: "CHAUFFEUR" };

type SettlementState = { amount: string; billingMonth: string; paymentMethod: string; notes: string };
const EMPTY_SETTLEMENT: SettlementState = { amount: "", billingMonth: "", paymentMethod: "", notes: "" };

// Helpers to avoid timezone month shifts when displaying month-start dates (backend works with UTC month starts).
const toUtcMonthValue = (value: string | Date) => {
  const d = value instanceof Date ? value : new Date(value);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
};
const formatUtcMonthLabel = (value: string | Date) => {
  const d = value instanceof Date ? value : new Date(value);
  return d.toLocaleDateString("en-GB", { timeZone: "UTC", year: "numeric", month: "short" });
};

export default function FixedTermContractsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PermissionGate permission="fixed_contracts">
        <AdminCan I="read" a="FixedContracts">
          <FixedTermContractsContent />
        </AdminCan>
      </PermissionGate>
    </Suspense>
  );
}

function FixedTermContractsContent() {
  const dispatch = useAppDispatch();
  const confirm = useConfirm();
  const { fixedTermContracts, status, actionStatus, error } = useAppSelector(selectAdminPricingState);
  const ability = useAdminAbility();
  // The page is gated on FixedContracts, so actions use the same subject (previously checked Pricing by mistake).
  const canCreate = ability.can("create", ADMIN_SUBJECTS.fixed_contracts);
  const canUpdate = ability.can("update", ADMIN_SUBJECTS.fixed_contracts);
  const canDelete = ability.can("delete", ADMIN_SUBJECTS.fixed_contracts);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [settlingContract, setSettlingContract] = useState<FixedTermContract | null>(null);
  const [settlementData, setSettlementData] = useState<SettlementState>(EMPTY_SETTLEMENT);
  const [settlementError, setSettlementError] = useState<string | null>(null);
  const [isSubmittingSettlement, setIsSubmittingSettlement] = useState(false);

  const load = useCallback(() => {
    dispatch(fetchFixedTermContracts());
  }, [dispatch]);

  useEffect(() => {
    load();
  }, [load]);

  const errorMessage = (result: { payload?: unknown; error?: { message?: string } }, fallback: string) =>
    typeof result.payload === "string" ? result.payload : result.error?.message || fallback;

  const openCreate = () => {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setFormErrors({});
    setFormOpen(true);
  };

  const openEdit = (contract: FixedTermContract) => {
    setEditingId(contract.id);
    setFormData({
      carDescription: contract.car_description,
      ownerName: contract.owner_name,
      monthlyAmount: contract.monthly_amount.toString(),
      category: contract.category ?? "CHAUFFEUR",
    });
    setFormErrors({});
    setFormOpen(true);
  };

  const validateForm = () => {
    const errors: Partial<Record<keyof FormState, string>> = {};
    if (!formData.carDescription.trim()) errors.carDescription = "Enter the car description.";
    if (!formData.ownerName.trim()) errors.ownerName = "Enter the owner's name.";
    if (!formData.monthlyAmount || Number(formData.monthlyAmount) <= 0) errors.monthlyAmount = "Enter a monthly amount greater than 0.";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitForm = async () => {
    if (!validateForm()) return;
    const result = editingId
      ? await dispatch(
          updateFixedTermContractAsync({
            id: editingId,
            data: {
              carDescription: formData.carDescription,
              ownerName: formData.ownerName,
              monthlyAmount: Number(formData.monthlyAmount),
              category: formData.category,
            },
          }),
        )
      : await dispatch(
          createFixedTermContractAsync({
            carDescription: formData.carDescription,
            ownerName: formData.ownerName,
            monthlyAmount: Number(formData.monthlyAmount),
            category: formData.category,
            startDate: todayYmd(),
          }),
        );
    if (updateFixedTermContractAsync.fulfilled.match(result) || createFixedTermContractAsync.fulfilled.match(result)) {
      toast.success(editingId ? "Contract updated" : "Contract created");
      setFormOpen(false);
      setEditingId(null);
      setFormData(EMPTY_FORM);
    } else {
      toast.error(errorMessage(result, "Failed to save contract"));
    }
    dispatch(resetActionStatus());
  };

  const handleToggleActive = async (contract: FixedTermContract) => {
    if (contract.is_active) {
      const ok = await confirm({
        title: `Deactivate ${contract.car_description}?`,
        message: "The contract stays on record but stops accruing.",
        consequences: ["Its monthly amount is no longer included in monthly payables", "Existing dues and payments are kept"],
        destructive: true,
        confirmLabel: "Deactivate",
      });
      if (!ok) return;
    }
    setTogglingId(contract.id);
    const result = await dispatch(updateFixedTermContractAsync({ id: contract.id, data: { isActive: !contract.is_active } }));
    setTogglingId(null);
    if (updateFixedTermContractAsync.fulfilled.match(result)) {
      toast.success(contract.is_active ? "Contract deactivated" : "Contract activated");
    } else {
      toast.error(errorMessage(result, "Failed to update contract"));
    }
    dispatch(resetActionStatus());
  };

  const handleDelete = async (contract: FixedTermContract) => {
    const ok = await confirm({
      title: `Delete ${contract.car_description}?`,
      message: `This permanently deletes the fixed-term contract with ${contract.owner_name}.`,
      consequences: ["Its monthly dues and payment history are deleted", "It is removed from monthly payables immediately", "This cannot be undone"],
      destructive: true,
      confirmLabel: "Delete contract",
    });
    if (!ok) return;
    const result = await dispatch(deleteFixedTermContractAsync(contract.id));
    if (deleteFixedTermContractAsync.fulfilled.match(result)) {
      toast.success("Contract deleted");
    } else {
      toast.error(errorMessage(result, "Failed to delete contract"));
    }
    dispatch(resetActionStatus());
  };

  const openSettlement = (contract: FixedTermContract) => {
    setSettlingContract(contract);
    setSettlementError(null);
    setSettlementData({
      amount: Number(contract.current_month_due?.amount_remaining ?? contract.monthly_amount).toString(),
      billingMonth: contract.current_month_due?.billing_month ? toUtcMonthValue(contract.current_month_due.billing_month) : "",
      paymentMethod: "",
      notes: "",
    });
  };

  const handleSubmitSettlement = async () => {
    if (!settlingContract) return;
    if (!settlementData.amount || Number(settlementData.amount) <= 0) {
      setSettlementError("Enter a payment amount greater than 0.");
      return;
    }
    setSettlementError(null);
    try {
      setIsSubmittingSettlement(true);
      await apiClient.settleFixedTermContract(settlingContract.id, {
        amount: Number(settlementData.amount),
        billingMonth: settlementData.billingMonth || undefined,
        paymentMethod: settlementData.paymentMethod || undefined,
        notes: settlementData.notes || undefined,
      });
      await dispatch(fetchFixedTermContracts());
      toast.success("Payment recorded");
      setSettlingContract(null);
      setSettlementData(EMPTY_SETTLEMENT);
    } catch (err: unknown) {
      setSettlementError(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setIsSubmittingSettlement(false);
    }
  };

  const isLoading = status === "loading";
  const isSaving = actionStatus === "loading";
  const active = fixedTermContracts.filter((c) => c.is_active);
  const totals = {
    monthly: active.reduce((sum, c) => sum + Number(c.monthly_amount), 0),
    paid: active.reduce((sum, c) => sum + Number(c.current_month_due?.amount_paid ?? 0), 0),
    remaining: active.reduce((sum, c) => sum + Number(c.current_month_due?.amount_remaining ?? c.monthly_amount), 0),
  };

  const columns: DataTableColumn<FixedTermContract>[] = [
    { key: "status", header: "Status", width: "1%", cell: (c) => <StatusBadge status={c.is_active ? "ACTIVE" : "INACTIVE"} /> },
    { key: "category", header: "Category", width: "1%", hideBelow: "sm", cell: (c) => <StatusBadge status={c.category ?? "CHAUFFEUR"} dot={false} /> },
    {
      key: "car",
      header: "Car",
      cell: (c) => (
        <div className="min-w-0">
          <div className="font-medium text-fg">{c.car_description}</div>
          <div className="text-xs text-fg-muted">{c.owner_name}</div>
        </div>
      ),
    },
    { key: "monthly_amount", header: "Monthly", align: "right", mono: true, cell: (c) => formatCurrency(c.monthly_amount) },
    { key: "paid", header: "Paid this month", align: "right", mono: true, hideBelow: "md", cell: (c) => <span className="text-fg-secondary">{formatCurrency(c.current_month_due?.amount_paid ?? 0)}</span> },
    {
      key: "remaining",
      header: "Remaining",
      align: "right",
      mono: true,
      cell: (c) => (
        <div>
          <div className="font-semibold text-fg">{formatCurrency(c.current_month_due?.amount_remaining ?? c.monthly_amount)}</div>
          {Number(c.overdue_amount ?? 0) > 0 && <div className="text-xs text-danger-ink">Overdue {formatCurrency(c.overdue_amount)}</div>}
        </div>
      ),
    },
    { key: "payment_status", header: "Payment", width: "1%", cell: (c) => <StatusBadge status={c.payment_status ?? "UNPAID"} overrides={PAYMENT_STATUS} /> },
  ];

  const rowActions = (c: FixedTermContract): ActionMenuItem[] => [
    { label: "Record payment", icon: <Wallet />, onSelect: () => openSettlement(c), disabled: !canUpdate || isSaving },
    { label: "Edit", icon: <Pencil />, onSelect: () => openEdit(c), disabled: !canUpdate || isSaving },
    {
      label: c.is_active ? "Deactivate" : "Activate",
      icon: c.is_active ? <PowerOff /> : <Power />,
      onSelect: () => handleToggleActive(c),
      disabled: !canUpdate || isSaving || togglingId === c.id,
    },
    { label: "Delete", icon: <Trash2 />, destructive: true, separatorBefore: true, onSelect: () => handleDelete(c), disabled: !canDelete || isSaving },
  ];

  const selectedForSettlement = settlingContract ? fixedTermContracts.find((c) => c.id === settlingContract.id) ?? settlingContract : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fixed-Term Cars"
        description="Monthly vendor-independent car contracts. Active amounts are included in monthly payables automatically."
        actions={
          <Button leftIcon={<Plus />} onClick={openCreate} disabled={!canCreate}>
            Add contract
          </Button>
        }
      />

      <Card>
        <DataTable<FixedTermContract>
          caption="Fixed-term contracts"
          rows={fixedTermContracts}
          rowKey={(c) => c.id}
          columns={columns}
          loading={isLoading}
          error={status === "failed" ? error : null}
          onRetry={load}
          empty={{
            title: "No fixed-term contracts",
            description: "Add a contract to include its monthly amount in payables.",
            action: canCreate ? (
              <Button size="sm" leftIcon={<Plus />} onClick={openCreate}>
                Add contract
              </Button>
            ) : undefined,
          }}
          rowActions={rowActions}
          footer={
            fixedTermContracts.length > 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-3 text-right text-xs uppercase tracking-wider text-fg-muted">
                  Active totals
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-fg">{formatCurrency(totals.monthly)}</td>
                <td className="hidden px-4 py-3 text-right font-mono tabular-nums text-success-ink md:table-cell">{formatCurrency(totals.paid)}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-warning-ink">{formatCurrency(totals.remaining)}</td>
                <td colSpan={2} />
              </tr>
            ) : undefined
          }
        />
      </Card>

      <Dialog open={formOpen} onOpenChange={(o) => !o && setFormOpen(false)}>
        <DialogContent
          title={editingId ? "Edit contract" : "New contract"}
          description={editingId ? undefined : "The contract starts today and accrues monthly."}
          footer={
            <>
              <Button variant="outline" onClick={() => setFormOpen(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleSubmitForm} loading={isSaving}>
                {editingId ? "Save changes" : "Create contract"}
              </Button>
            </>
          }
        >
          <FormGrid cols={2}>
            <Field label="Car description" required error={formErrors.carDescription} className="sm:col-span-2">
              <Input value={formData.carDescription} onChange={(e) => setFormData({ ...formData, carDescription: e.target.value })} placeholder="e.g. Toyota Corolla (ABC-123)" />
            </Field>
            <Field label="Owner name" required error={formErrors.ownerName}>
              <Input value={formData.ownerName} onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })} placeholder="e.g. John Doe" />
            </Field>
            <Field label="Monthly amount (PKR)" required error={formErrors.monthlyAmount}>
              <Input type="number" min={0} mono value={formData.monthlyAmount} onChange={(e) => setFormData({ ...formData, monthlyAmount: e.target.value })} placeholder="0" />
            </Field>
            <Field label="Category">
              <Select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value as FormState["category"] })}>
                <option value="CHAUFFEUR">Chauffeur</option>
                <option value="SHUTTLE">Shuttle</option>
              </Select>
            </Field>
          </FormGrid>
        </DialogContent>
      </Dialog>

      <Dialog open={!!settlingContract} onOpenChange={(o) => !o && !isSubmittingSettlement && setSettlingContract(null)}>
        <DialogContent
          title="Record payment"
          description={settlingContract ? `${settlingContract.car_description} · ${settlingContract.owner_name}` : undefined}
          footer={
            <>
              <Button variant="outline" onClick={() => setSettlingContract(null)} disabled={isSubmittingSettlement}>
                Cancel
              </Button>
              <Button onClick={handleSubmitSettlement} loading={isSubmittingSettlement}>
                Save payment
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Field label="Amount (PKR)" required error={settlementError ?? undefined}>
              <Input type="number" min={0} mono value={settlementData.amount} onChange={(e) => setSettlementData((prev) => ({ ...prev, amount: e.target.value }))} />
            </Field>
            <Field label="Billing month" hint="Leave as 'Oldest unpaid month' to settle dues in order.">
              <Select value={settlementData.billingMonth} onChange={(e) => setSettlementData((prev) => ({ ...prev, billingMonth: e.target.value }))}>
                <option value="">Oldest unpaid month</option>
                {(selectedForSettlement?.monthly_dues ?? [])
                  .filter((due) => Number(String(due.amount_remaining ?? 0).trim()) > 0)
                  .map((due) => (
                    <option key={due.id} value={toUtcMonthValue(due.billing_month)}>
                      {formatUtcMonthLabel(due.billing_month)} — remaining {formatCurrency(due.amount_remaining)}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Payment method" hint="Optional">
              <Input value={settlementData.paymentMethod} onChange={(e) => setSettlementData((prev) => ({ ...prev, paymentMethod: e.target.value }))} placeholder="e.g. Bank transfer" />
            </Field>
            <Field label="Notes" hint="Optional">
              <Textarea rows={3} value={settlementData.notes} onChange={(e) => setSettlementData((prev) => ({ ...prev, notes: e.target.value }))} />
            </Field>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
