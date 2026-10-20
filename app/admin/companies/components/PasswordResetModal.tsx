"use client";

import React, { useState, memo } from "react";
import { KeyRound, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Company } from "../../../lib/services/api-client";
import { Dialog, DialogContent } from "../../ui/Dialog";
import { Button } from "../../ui/Button";
import { Field } from "../../ui/Field";
import { Input } from "../../ui/Input";
import { generatePassword } from "../../lib/format";

export const PasswordResetModal = memo(function PasswordResetModal({
  isOpen,
  onClose,
  company,
  onReset,
}: {
  isOpen: boolean;
  onClose: () => void;
  company: Company | null;
  onReset: (password: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  const tooShort = password.length > 0 && password.length < 8;

  const handleReset = async () => {
    if (!password || password.length < 8) {
      toast.error("Password must be at least 8 characters long");
      return;
    }
    setIsResetting(true);
    try {
      await onReset(password);
      setPassword("");
      onClose();
    } catch {
      // Error toast is shown by the parent
    } finally {
      setIsResetting(false);
    }
  };

  const close = () => {
    if (isResetting) return;
    setPassword("");
    onClose();
  };

  if (!company) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent
        size="sm"
        title="Reset company password"
        description={`${company.name} · ${company.email}`}
        footer={
          <>
            <Button variant="outline" onClick={close} disabled={isResetting}>
              Cancel
            </Button>
            <Button onClick={handleReset} loading={isResetting} disabled={!password || tooShort} leftIcon={<KeyRound />}>
              Reset password
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-warning-line bg-warning-soft px-3 py-2 text-sm text-warning-ink">
            The company admin&apos;s current password stops working immediately. Share the new one securely.
          </div>
          <Field label="New password" hint="At least 8 characters." error={tooShort ? "Password must be at least 8 characters long." : undefined}>
            <div className="flex gap-2">
              <Input
                type="text"
                mono
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new password"
                disabled={isResetting}
                autoComplete="off"
                spellCheck={false}
              />
              <Button type="button" variant="outline" onClick={() => setPassword(generatePassword())} disabled={isResetting} leftIcon={<Wand2 />}>
                Generate
              </Button>
            </div>
          </Field>
        </div>
      </DialogContent>
    </Dialog>
  );
});
