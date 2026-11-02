"use client";

import { Button, Dialog, DialogContent, Switch } from "../../ui";
import type { InvoicesController } from "../hooks/useInvoices";

export function EditInvoiceDialog({ inv }: { inv: InvoicesController }) {
  const invoice = inv.editingInvoice;
  const sstChanged = !!invoice && inv.editIncludeSst !== (invoice.include_sst ?? true);

  return (
    <Dialog open={!!invoice} onOpenChange={(open) => !open && inv.closeEditModal()}>
      <DialogContent
        size="sm"
        title="Edit invoice"
        description={invoice ? `Invoice ${invoice.invoice_number}` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={inv.closeEditModal} disabled={inv.isSavingEdit}>
              Cancel
            </Button>
            <Button onClick={inv.handleSaveEdit} loading={inv.isSavingEdit}>
              Save changes
            </Button>
          </>
        }
      >
        {invoice && (
          <div className="space-y-4">
            <Switch
              label="Include SST"
              description="When off, SST is removed from the total and the PDF no longer shows it."
              checked={inv.editIncludeSst}
              onCheckedChange={inv.setEditIncludeSst}
            />
            <Switch
              label="Show stamp"
              description="Print the company stamp on the PDF."
              checked={inv.editShowStamp}
              onCheckedChange={inv.setEditShowStamp}
            />
            {sstChanged && (
              <p className="rounded-lg border border-warning-line bg-warning-soft p-3 text-xs text-warning-ink">
                The invoice total will change after saving.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
