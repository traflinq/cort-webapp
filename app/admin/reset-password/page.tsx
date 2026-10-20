"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiClient } from "../../lib/services/api-client";
import { AuthLink, AuthShell } from "../components/AuthShell";
import { PasswordInput } from "../components/PasswordInput";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { InlineError } from "../ui/ErrorState";

export default function AdminResetPasswordPage() {
  // useSearchParams needs a Suspense boundary for static prerendering (Next 15+).
  return (
    <Suspense fallback={<AuthShell title="Set a new password">{null}</AuthShell>}>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resetToken = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!resetToken) {
      setError("Invalid or expired reset link. Please request a new one.");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.resetPassword(resetToken, password);
      setSuccess(true);
      setTimeout(() => router.push("/admin/login"), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

  return (
    <AuthShell
      title="Set a new password"
      description="Choose a strong password for your admin account."
      footer={!success && <AuthLink href="/admin/login">← Back to sign in</AuthLink>}
    >
      {success ? (
        <div role="status" className="flex flex-col items-center gap-4 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-success-soft text-success-ink">
            <CheckCircle2 className="size-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-base font-semibold text-fg">Password updated</p>
            <p className="mt-1 text-sm text-fg-muted">Your password has been changed. Redirecting you to sign in…</p>
          </div>
        </div>
      ) : !resetToken ? (
        <div className="text-center text-sm text-fg-muted">
          Invalid or missing reset link. <AuthLink href="/admin/forgot-password">Request a new one</AuthLink>.
        </div>
      ) : (
        <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
          <Field label="New password" required hint="At least 8 characters.">
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="Min. 8 characters" autoFocus required />
          </Field>
          {password && <PasswordStrengthBar password={password} />}
          <Field label="Confirm password" required error={mismatch ? "Passwords do not match." : undefined}>
            <PasswordInput value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" placeholder="Repeat new password" required />
          </Field>
          {error && <InlineError>{error}</InlineError>}
          <Button type="submit" size="lg" className="w-full" loading={isSubmitting} disabled={!password || !confirmPassword}>
            Update password
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

function getStrength(pwd: string): { label: string; tone: string; steps: number } {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;

  if (score <= 1) return { label: "Weak", tone: "bg-danger", steps: 1 };
  if (score <= 2) return { label: "Fair", tone: "bg-warning", steps: 2 };
  if (score <= 3) return { label: "Good", tone: "bg-info", steps: 3 };
  return { label: "Strong", tone: "bg-success", steps: 4 };
}

function PasswordStrengthBar({ password }: { password: string }) {
  const { label, tone, steps } = getStrength(password);
  return (
    <div className="-mt-2 space-y-1.5">
      <div className="grid grid-cols-4 gap-1" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={cn("h-1.5 rounded-full transition-colors", i < steps ? tone : "bg-line")} />
        ))}
      </div>
      <p className="text-xs text-fg-muted" aria-live="polite">
        Password strength: <span className="font-medium text-fg">{label}</span>
      </p>
    </div>
  );
}
