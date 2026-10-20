"use client";

import React, { useState, memo } from "react";
import { KeyRound } from "lucide-react";
import { Driver } from "../../../lib/services/api-client";
import { displayDriverEmail } from "../../../lib/utils/driverEmailDisplay";
import { generatePassword } from "../../lib/format";
import { Button, Dialog, DialogContent, Field, Input } from "../../ui";

const MIN_LENGTH = 8;

export const DriverPasswordResetModal = memo(function DriverPasswordResetModal({
  isOpen,
  onClose,
  driver,
  onReset,
}: {
  isOpen: boolean;
  onClose: () => void;
  driver: Driver | null;
  onReset: (password: string) => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const close = () => {
    setPassword("");
    setError(null);
    onClose();
  };

  const handleReset = async () => {
    if (!password || password.length < MIN_LENGTH) {
      setError(`Password must be at least ${MIN_LENGTH} characters long.`);
      return;
    }
    setIsResetting(true);
    try {
      await onReset(password);
      close();
    } catch {
      // Error toast handled by parent
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <Dialog open={isOpen && !!driver} onOpenChange={(open) => !open && !isResetting && close()}>
      <DialogContent
        size="sm"
        title="Reset driver password"
        description={driver ? `${driver.full_name} · ${displayDriverEmail(driver.email)}` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={close} disabled={isResetting}>
              Cancel
            </Button>
            <Button onClick={handleReset} loading={isResetting} disabled={!password}>
              Reset password
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="rounded-lg border border-warning-line bg-warning-soft px-3 py-2 text-sm text-fg">
            The driver will need to sign in again with the new password. Share it with them securely.
          </p>
          <Field label="New password" hint={`Minimum ${MIN_LENGTH} characters.`} error={error} required>
            <div className="flex gap-2">
              <Input
                mono
                autoComplete="new-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                placeholder="Enter or generate a password"
                disabled={isResetting}
              />
              <Button
                type="button"
                variant="outline"
                leftIcon={<KeyRound />}
                onClick={() => {
                  setPassword(generatePassword(12));
                  setError(null);
                }}
                disabled={isResetting}
                className="shrink-0"
              >
                Generate
              </Button>
            </div>
          </Field>
        </div>
      </DialogContent>
    </Dialog>
  );
});
