"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import {
  ExpensesApi,
  Expense,
  ExpenseCategory,
  CreateExpenseRequest,
  UpdateExpenseRequest,
} from "../../lib/services/api-client";
import { useAuth } from "../../lib/contexts/auth-context";
import { PermissionGate } from "../components/PermissionGate";
import { AdminCan, useAdminAbility } from "../../lib/abilities/AdminAbilityProvider";
import { ADMIN_SUBJECTS } from "../../lib/abilities/admin-subjects";
import { useConfirm } from "../../lib/hooks/useConfirm";
import { BookingTagPicker, TaggedBooking } from "../components/BookingTagPicker";
import {
  Badge,
  Button,
  Card,
  CardContent,
  DataTable,
  DateRangePicker,
  Dialog,
  DialogContent,
  Field,
  FilterBar,
  FilterField,
  FormGrid,
  Input,
  KpiCard,
  KpiGrid,
  PageHeader,
  Select,
  StatusBadge,
  Textarea,
  Tooltip,
  type ActionMenuItem,
  type DataTableColumn,
  type DateRange,
} from "../ui";
import { formatCurrency, formatDate, formatDateTime, humanize } from "../lib/format";
import { currentMonthRange, formatRangeLabel, parseYmd, todayYmd, toYmd } from "../lib/dates";

const PAGE_SIZE = 10;

interface PaginationMeta {
  page: number;
  pages: number;
  total: number;
}

type ExpensesFilters = {
  range: DateRange | null;
  category: ExpenseCategory | "";
};

/** Extract a readable message from an unknown thrown value. */
function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === "string" && e.trim()) return e;
  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === "string" && m.trim()) return m;
  }
  return fallback;
}

/**
 * The backend compares `date <= new Date(endDate)`, so the end bound must be the END of the
 * selected day in local time (sending "YYYY-MM-DD" or midnight ISO drops that day's expenses).
 */
function rangeToApiParams(range: DateRange | null): { startDate?: string; endDate?: string } {
  const out: { startDate?: string; endDate?: string } = {};
  const start = range?.start ? parseYmd(range.start) : null;
  const end = range?.end ? parseYmd(range.end) : null;
  if (start) out.startDate = start.toISOString();
  if (end) {
    end.setHours(23, 59, 59, 999);
    out.endDate = end.toISOString();
  }
  return out;
}

type ListEnvelope = {
  data?: { data?: Expense[]; pagination?: Partial<PaginationMeta>; totalAmount?: number | string } | Expense[];
  pagination?: Partial<PaginationMeta>;
};

function unwrapExpenseList(res: unknown): { rows: Expense[]; meta: Partial<PaginationMeta>; totalAmount: number } {
  const env = res as ListEnvelope | undefined;
  const inner = env?.data;
  if (Array.isArray(inner)) return { rows: inner, meta: env?.pagination ?? {}, totalAmount: 0 };
  return { rows: inner?.data ?? [], meta: inner?.pagination ?? env?.pagination ?? {}, totalAmount: Number(inner?.totalAmount ?? 0) };
}

export default function ExpensesPage() {
  return (
    <PermissionGate permission="expenses">
      <AdminCan I="read" a="Expenses">
        <ExpensesPageContent />
      </AdminCan>
    </PermissionGate>
  );
}

function ExpensesPageContent() {
  const { user, isSuperAdmin } = useAuth();
  const ability = useAdminAbility();
  const confirm = useConfirm();
  const canCreate = ability.can("create", ADMIN_SUBJECTS.expenses);
  const canUpdate = ability.can("update", ADMIN_SUBJECTS.expenses);
  const canDelete = ability.can("delete", ADMIN_SUBJECTS.expenses);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, pages: 1, total: 0 });
  const [totalAmount, setTotalAmount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const [filters, setFilters] = useState<ExpensesFilters>({ range: currentMonthRange(), category: "" });
  const [currentPage, setCurrentPage] = useState(1);
  const [markingPaidId, setMarkingPaidId] = useState<number | null>(null);

  // One request per key change (page, filters, refetch nonce). Loading is derived from
  // "requested key ≠ loaded key"; state is only set in promise callbacks; stale responses are ignored.
  const [nonce, setNonce] = useState(0);
  const requestKey = `${currentPage}|${filters.range?.start ?? ""}|${filters.range?.end ?? ""}|${filters.category}|${nonce}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const isLoading = loadedKey !== requestKey;

  useEffect(() => {
    let cancelled = false;
    const page = currentPage;
    ExpensesApi.getAll({
      page,
      limit: PAGE_SIZE,
      ...rangeToApiParams(filters.range),
      ...(filters.category ? { category: filters.category } : {}),
    })
      .then((res) => {
        if (cancelled) return;
        const { rows, meta, totalAmount: sum } = unwrapExpenseList(res);
        setExpenses(rows);
        setPagination({ page: meta.page ?? page, pages: meta.pages ?? 1, total: meta.total ?? 0 });
        setTotalAmount(sum);
        setError(null);
        setLoadedKey(requestKey);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(errorMessage(e, "Could not load expenses."));
        setLoadedKey(requestKey);
      });
    return () => {
      cancelled = true;
    };
    // requestKey encodes page/filters/nonce
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  const setRange = (range: DateRange | null) => {
    setFilters((f) => ({ ...f, range }));
    setCurrentPage(1);
  };
  const setCategory = (category: ExpenseCategory | "") => {
    setFilters((f) => ({ ...f, category }));
    setCurrentPage(1);
  };
  const clearFilters = () => {
    setFilters({ range: null, category: "" });
    setCurrentPage(1);
  };
  const activeFilters = (filters.range ? 1 : 0) + (filters.category ? 1 : 0);

  const openCreateModal = () => {
    setModalMode("create");
    setEditingExpense(null);
    setIsModalOpen(true);
  };

  const openEditModal = (expense: Expense) => {
    setModalMode("edit");
    setEditingExpense(expense);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingExpense(null);
    setModalMode("create");
  };

  const handleCreate = async (data: CreateExpenseRequest) => {
    await ExpensesApi.create(data);
    closeModal();
    toast.success("Expense added.");
    refetch();
  };

  const handleUpdate = async (data: UpdateExpenseRequest) => {
    if (!editingExpense) return;
    await ExpensesApi.update(editingExpense.id, data);
    closeModal();
    toast.success("Expense updated.");
    refetch();
  };

  const handleDelete = async (expense: Expense) => {
    const isOwner = isSuperAdmin || expense.created_by === user?.id;
    const label = `${humanize(expense.category)} · ${formatCurrency(Number(expense.amount))} on ${formatDate(expense.date)}`;
    const ok = await confirm(
      isOwner
        ? {
            title: "Delete this expense?",
            message: label,
            consequences: [
              "The amount is removed from expense totals and reports",
              ...(expense.booking_id ? [`Booking #${expense.booking_id} no longer counts this cost in its chauffeur COGS`] : []),
              "This cannot be undone",
            ],
            destructive: true,
            confirmLabel: "Delete expense",
          }
        : {
            title: "Request deletion?",
            message: label,
            description: "You didn't add this record, so it is not deleted immediately.",
            consequences: ["A delete request is sent to a super admin for approval", "The expense stays in the ledger until it is approved"],
            confirmLabel: "Send request",
          },
    );
    if (!ok) return;

    try {
      const response = await ExpensesApi.delete(expense.id);
      const result = response?.data;
      if (result?.requiresApproval) {
        toast.success(result.message || "Delete request sent for super admin approval.");
      } else {
        toast.success("Expense deleted.");
      }
      refetch();
    } catch (e) {
      toast.error("Could not delete the expense", { description: errorMessage(e, "Please try again.") });
    }
  };

  const handleMarkAsPaid = async (expense: Expense) => {
    const ok = await confirm({
      title: "Mark this expense as paid?",
      message: `${humanize(expense.category)} · ${formatCurrency(Number(expense.amount))}`,
      consequences: ["The paid date is set to now", "This cannot be reverted from the portal"],
      confirmLabel: "Mark as paid",
    });
    if (!ok) return;
    setMarkingPaidId(expense.id);
    try {
      await ExpensesApi.markAsPaid(expense.id);
      toast.success("Expense marked as paid.");
      refetch();
    } catch (e) {
      toast.error("Could not mark the expense as paid", { description: errorMessage(e, "Please try again.") });
    } finally {
      setMarkingPaidId(null);
    }
  };

  const columns: DataTableColumn<Expense>[] = [
    { key: "date", header: "Date", cell: (row) => <span className="whitespace-nowrap text-fg">{formatDate(row.date)}</span> },
    {
      key: "category",
      header: "Category",
      cell: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="info" size="sm">
            {humanize(row.category)}
          </Badge>
          {row.booking_id && (
            <Tooltip content={`Tagged to booking #${row.booking_id} — counted in that booking's chauffeur COGS`}>
              <Badge tone="purple" size="sm" tabIndex={0}>
                #{row.booking_id}
              </Badge>
            </Tooltip>
          )}
        </div>
      ),
    },
    {
      key: "description",
      header: "Description",
      hideBelow: "md",
      cell: (row) => <span className="line-clamp-2 max-w-md text-fg-secondary">{row.description || <span className="text-fg-muted">—</span>}</span>,
    },
    { key: "status", header: "Status", cell: (row) => <StatusBadge status={row.payment_status || "UNPAID"} /> },
    {
      key: "paid_at",
      header: "Paid at",
      hideBelow: "lg",
      cell: (row) => <span className="whitespace-nowrap text-fg-secondary">{row.paid_at ? formatDateTime(row.paid_at) : "—"}</span>,
    },
    { key: "added_by", header: "Added by", hideBelow: "lg", cell: (row) => <span className="text-fg-secondary">{row.added_by_name || "—"}</span> },
    { key: "amount", header: "Amount", align: "right", mono: true, cell: (row) => formatCurrency(Number(row.amount)) },
  ];

  const rowActions = (row: Expense): ActionMenuItem[] => [
    { label: "Edit", icon: <Pencil />, disabled: !canUpdate, onSelect: () => openEditModal(row) },
    {
      label: markingPaidId === row.id ? "Marking…" : "Mark as paid",
      icon: <CheckCircle2 />,
      hidden: row.payment_status === "PAID",
      disabled: !canUpdate || markingPaidId === row.id,
      onSelect: () => handleMarkAsPaid(row),
    },
    { label: "Delete", icon: <Trash2 />, destructive: true, separatorBefore: true, disabled: !canDelete, onSelect: () => handleDelete(row) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        description="General expenses. Tag an expense to a booking to count it in that booking's chauffeur COGS."
        actions={
          <Button leftIcon={<Plus />} onClick={openCreateModal} disabled={!canCreate}>
            Add expense
          </Button>
        }
      />

      <KpiGrid cols={3}>
        <KpiCard
          label="Total expenses"
          value={formatCurrency(totalAmount)}
          hint={`${formatRangeLabel(filters.range)}${pagination.total > 0 ? ` · ${pagination.total} expense${pagination.total === 1 ? "" : "s"}` : ""}`}
          icon={<Receipt />}
          tone="brand"
          loading={isLoading && expenses.length === 0 && !error}
        />
      </KpiGrid>

      <Card>
        <CardContent className="border-b border-line py-3">
          <FilterBar activeCount={activeFilters} onClear={clearFilters}>
            <FilterField label="Period">
              <DateRangePicker value={filters.range} onChange={setRange} size="sm" allowClear label="Expense period" />
            </FilterField>
            <FilterField label="Category">
              <Select value={filters.category} onChange={(e) => setCategory(e.target.value as ExpenseCategory | "")} placeholder="All categories" className="h-8 text-xs">
                {Object.values(ExpenseCategory).map((cat) => (
                  <option key={cat} value={cat}>
                    {humanize(cat)}
                  </option>
                ))}
              </Select>
            </FilterField>
          </FilterBar>
        </CardContent>

        <DataTable<Expense>
          caption="Expenses"
          columns={columns}
          rows={expenses}
          rowKey={(row) => row.id}
          loading={isLoading}
          error={error}
          onRetry={refetch}
          empty={{
            icon: <Receipt aria-hidden="true" />,
            title: activeFilters > 0 ? "No expenses in this period" : "No expenses yet",
            description: activeFilters > 0 ? "Try a different period or category." : "Add your first expense to start tracking spend.",
            action:
              activeFilters > 0 ? (
                <Button size="sm" variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : canCreate ? (
                <Button size="sm" leftIcon={<Plus />} onClick={openCreateModal}>
                  Add expense
                </Button>
              ) : undefined,
          }}
          rowActions={rowActions}
          pagination={{
            page: currentPage,
            totalPages: pagination.pages,
            total: pagination.total,
            pageSize: PAGE_SIZE,
            onPageChange: setCurrentPage,
          }}
        />
      </Card>

      <ExpenseFormDialog
        key={`${modalMode}-${editingExpense?.id ?? "new"}`}
        open={isModalOpen}
        mode={modalMode}
        expense={editingExpense}
        onClose={closeModal}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        submitDisabled={modalMode === "create" ? !canCreate : !canUpdate}
      />
    </div>
  );
}

function ExpenseFormDialog({
  open,
  mode,
  expense,
  onClose,
  onCreate,
  onUpdate,
  submitDisabled = false,
}: {
  open: boolean;
  mode: "create" | "edit";
  expense: Expense | null;
  onClose: () => void;
  onCreate: (data: CreateExpenseRequest) => Promise<void>;
  onUpdate: (data: UpdateExpenseRequest) => Promise<void>;
  submitDisabled?: boolean;
}) {
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [category, setCategory] = useState<ExpenseCategory | "">(expense?.category ?? "");
  const [date, setDate] = useState(expense ? toYmd(new Date(expense.date)) : todayYmd());
  const [description, setDescription] = useState(expense?.description ?? "");
  const [taggedBooking, setTaggedBooking] = useState<TaggedBooking | null>(
    expense?.booking_id ? { id: expense.booking_id, label: `Booking #${expense.booking_id}` } : null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);

  const amountError = touched && (!amount || Number(amount) <= 0) ? "Enter an amount greater than 0." : undefined;
  const categoryError = touched && !category ? "Select a category." : undefined;
  const dateError = touched && !date ? "Select a date." : undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!amount || Number(amount) <= 0 || !category || !date) return;

    setIsSubmitting(true);
    try {
      const payload = {
        amount: Number(amount),
        category: category as ExpenseCategory,
        date: new Date(date).toISOString(),
        description,
        booking_id: taggedBooking?.id ?? null,
      };
      if (mode === "edit") {
        await onUpdate(payload);
      } else {
        await onCreate(payload);
      }
    } catch (err) {
      toast.error(`Could not ${mode === "edit" ? "update" : "add"} the expense`, { description: errorMessage(err, "Please try again.") });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formId = "expense-form";

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !isSubmitting && onClose()}>
      <DialogContent
        size="md"
        title={mode === "edit" ? "Edit expense" : "Add expense"}
        description={mode === "edit" ? "Changes apply to reports immediately." : "Amounts are in PKR."}
        footer={
          <>
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form={formId} loading={isSubmitting} disabled={submitDisabled}>
              {mode === "edit" ? "Save changes" : "Save expense"}
            </Button>
          </>
        }
      >
        <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-4">
          <FormGrid cols={2}>
            <Field label="Category" required error={categoryError}>
              <Select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)} placeholder="Select category">
                {Object.values(ExpenseCategory).map((cat) => (
                  <option key={cat} value={cat}>
                    {humanize(cat)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Date" required error={dateError}>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Amount (PKR)" required error={amountError}>
              <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} mono />
            </Field>
          </FormGrid>

          <Field
            label="Tag to a booking"
            hint="Optional. If this expense was for a specific ride, its cost counts toward that booking's chauffeur COGS. Customer billing is unchanged."
          >
            <BookingTagPicker value={taggedBooking} onChange={setTaggedBooking} />
          </Field>

          <Field label="Description">
            <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
