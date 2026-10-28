"use client";

import * as React from "react";
import { toast } from "sonner";
import { apiClient } from "../../../lib/services/api-client";
import type { ProblemReport } from "../../../lib/types/admin-dashboard";
import { Button, Dialog, DialogContent, Field, InlineError, Textarea } from "..";

const MIN_NOTE = 3;
const MAX_NOTE = 1000;

interface ResolveProblemDialogProps {
  report: ProblemReport | null;
  onClose: () => void;
  /** Called once the report is closed server-side. */
  onResolved: (id: number) => void;
}

/** Asks for a resolution note, closes the report, and tells the reporter via push. */
export function ResolveProblemDialog({ report, onClose, onResolved }: ResolveProblemDialogProps) {
  const [note, setNote] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Start every report with a clean form (render-time state adjustment, as ConfirmDialog does).
  const [prevId, setPrevId] = React.useState<number | null>(null);
  const currentId = report?.id ?? null;
  if (prevId !== currentId) {
    setPrevId(currentId);
    setNote("");
    setError(null);
  }

  const trimmed = note.trim();
  const canSubmit = trimmed.length >= MIN_NOTE && !submitting;

  const submit = async () => {
    if (!report || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiClient.resolveProblemReport(report.id, trimmed);
      toast.success(res.alreadyResolved ? "Already resolved by someone else" : `Resolved. ${report.reporter_name} has been notified.`);
      onResolved(report.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not resolve this report");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!report} onOpenChange={(open) => !open && !submitting && onClose()}>
      <DialogContent
        size="md"
        title="Resolve problem report"
        description={report ? `Reported by ${report.reporter_name}. They will be notified and the report will be closed.` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={() => void submit()} loading={submitting} disabled={!canSubmit}>
              Resolve and notify
            </Button>
          </>
        }
      >
        {report && (
          <div className="space-y-4">
            <blockquote className="whitespace-pre-wrap rounded-lg border border-line bg-subtle px-3 py-2 text-sm text-fg-secondary">{report.message}</blockquote>
            <Field label="Resolution note" required hint="Sent to the reporter in the notification.">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={MAX_NOTE} placeholder="What was done to fix this?" autoFocus />
            </Field>
            {error && <InlineError>{error}</InlineError>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
