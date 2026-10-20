"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, type DialogPriority } from "./Dialog";
import { Button } from "./Button";
import { Field } from "./Field";
import { Input } from "./Input";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: React.ReactNode;
  /** Main question, e.g. "Delete Acme Logistics?" */
  message?: React.ReactNode;
  /** Secondary explanation. */
  description?: React.ReactNode;
  /** What will happen. Rendered as a highlighted list — always state consequences for destructive actions. */
  consequences?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** Require the user to type this exact string (high-risk: delete company, revoke keys). */
  typeToConfirm?: string;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  priority?: DialogPriority;
}

/** Accessible confirmation (role=alertdialog). Cancel receives initial focus. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  description,
  consequences,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  typeToConfirm,
  loading = false,
  onConfirm,
  priority = "top",
}: ConfirmDialogProps) {
  const [typed, setTyped] = React.useState("");
  // Reset the typed confirmation whenever the dialog closes (render-time state adjustment).
  const [prevOpen, setPrevOpen] = React.useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (!open) setTyped("");
  }

  const canConfirm = !typeToConfirm || typed.trim() === typeToConfirm;

  return (
    <Dialog open={open} onOpenChange={(next) => !loading && onOpenChange(next)}>
      <DialogContent
        role="alertdialog"
        size="sm"
        priority={priority}
        hideClose
        title={
          <span className="flex items-center gap-2">
            {destructive && <AlertTriangle className="size-5 shrink-0 text-danger-ink" aria-hidden="true" />}
            {title ?? (destructive ? "Are you sure?" : "Please confirm")}
          </span>
        }
        footer={
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              {cancelLabel}
            </Button>
            <Button
              variant={destructive ? "danger" : "primary"}
              onClick={() => void onConfirm()}
              loading={loading}
              disabled={!canConfirm}
            >
              {confirmLabel ?? (destructive ? "Delete" : "Confirm")}
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-fg-secondary">
          {message && <p className="whitespace-pre-wrap text-fg">{message}</p>}
          {description && <div>{description}</div>}
          {consequences && consequences.length > 0 && (
            <ul
              className={`space-y-1.5 rounded-lg border p-3 text-[13px] text-fg ${
                destructive ? "border-danger-line bg-danger-soft" : "border-warning-line bg-warning-soft"
              }`}
            >
              {consequences.map((c) => (
                <li key={c} className="flex gap-2">
                  <span aria-hidden="true" className="mt-[7px] size-1.5 shrink-0 rounded-full bg-current opacity-70" />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          )}
          {typeToConfirm && (
            <Field
              label={
                <>
                  Type <span className="font-mono font-semibold text-fg">{typeToConfirm}</span> to confirm
                </>
              }
            >
              <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} mono />
            </Field>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
