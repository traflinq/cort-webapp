"use client";

import { useState } from "react";
import { MailCheck } from "lucide-react";
import { apiClient } from "../../lib/services/api-client";
import { AuthLink, AuthShell } from "../components/AuthShell";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { InlineError } from "../ui/ErrorState";

export default function AdminForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await apiClient.forgotPassword(email);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset email. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      description="Enter your admin email and we'll send you a reset link."
      footer={<AuthLink href="/admin/login">← Back to sign in</AuthLink>}
    >
      {success ? (
        <div role="status" className="flex flex-col items-center gap-4 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-success-soft text-success-ink">
            <MailCheck className="size-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-base font-semibold text-fg">Check your inbox</p>
            <p className="mt-1 text-sm text-fg-muted">
              If <span className="font-medium text-fg">{email}</span> is registered, you&apos;ll receive a password reset link shortly.
            </p>
          </div>
        </div>
      ) : (
        <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
          <Field label="Email address" required>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" autoFocus required />
          </Field>
          {error && <InlineError>{error}</InlineError>}
          <Button type="submit" size="lg" className="w-full" loading={isSubmitting} disabled={!email}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
