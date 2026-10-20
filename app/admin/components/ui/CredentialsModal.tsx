"use client";

import React, { memo } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "../../ui/Dialog";
import { Button } from "../../ui/Button";
import { IconButton } from "../../ui/IconButton";

function CopyField({ label, value, placeholder }: { label: string; value?: string; placeholder?: string }) {
  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Could not copy ${label.toLowerCase()}`);
    }
  };
  return (
    <div className="space-y-1.5">
      <p className="text-[13px] font-medium text-fg-secondary">{label}</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded-lg border border-line bg-subtle px-3 py-2 font-mono text-sm text-fg">
          {value || placeholder}
        </code>
        {value && (
          <IconButton label={`Copy ${label.toLowerCase()}`} variant="outline" size="icon-sm" onClick={copy}>
            <Copy />
          </IconButton>
        )}
      </div>
    </div>
  );
}

/** Shows freshly created credentials once. Props unchanged from the legacy modal. */
export const CredentialsModal = memo(function CredentialsModal({
  isOpen,
  onClose,
  title = "Credentials",
  successMessage = "Created successfully! Please share these credentials.",
  email,
  password,
}: {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  successMessage?: string;
  email: string;
  password?: string;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        size="sm"
        priority="elevated"
        title={title}
        footer={<Button onClick={onClose}>Done</Button>}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-lg border border-success-line bg-success-soft px-3 py-2 text-sm text-success-ink">
            <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{successMessage}</span>
          </div>
          <CopyField label="Email" value={email} />
          <CopyField label="Password" value={password} placeholder="• • • • • • • •" />
          {!password && <p className="text-xs text-fg-muted">Password was not returned from the server.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
});
