"use client";

import { memo, useState } from "react";
import { toast } from "sonner";
import { apiClient } from "../../../../lib/services/api-client";
import { Button, Field, FormGrid, Input, Select, Textarea } from "../../../ui";
import { todayYmd } from "../../../lib/dates";
import { errorMessage } from "./booking-status";

export const PaymentForm = memo(function PaymentForm({ bookingId, onSuccess }: { bookingId: number; onSuccess: () => void }) {
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [notes, setNotes] = useState("");
  const [paymentDate, setPaymentDate] = useState<string>(todayYmd());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [amountError, setAmountError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      setAmountError("Enter an amount greater than zero.");
      return;
    }
    setAmountError(null);
    setIsSubmitting(true);
    try {
      await apiClient.addPayment(bookingId, {
        amount: parseFloat(amount),
        payment_type: "PARTIAL",
        payment_method: paymentMethod,
        notes: notes || undefined,
        payment_date: paymentDate || undefined,
      });
      toast.success("Payment recorded");
      setAmount("");
      setNotes("");
      onSuccess();
    } catch (error) {
      toast.error(errorMessage(error, "Failed to record payment"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-info-line bg-info-soft/40 p-4">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">Record payment</h4>
      <FormGrid cols={2}>
        <Field label="Amount (PKR)" required error={amountError}>
          <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" mono />
        </Field>
        <Field label="Payment date" required>
          <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required />
        </Field>
        <Field label="Payment method">
          <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="CASH">Cash</option>
            <option value="BANK_TRANSFER">Bank transfer</option>
            <option value="CARD">Card</option>
            <option value="CHEQUE">Cheque</option>
          </Select>
        </Field>
        <Field label="Notes (optional)">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Reference, cheque number…" className="min-h-9" />
        </Field>
      </FormGrid>
      <div className="flex justify-end">
        <Button type="submit" loading={isSubmitting}>
          Record payment
        </Button>
      </div>
    </form>
  );
});
