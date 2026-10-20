"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/contexts/auth-context";
import { UserRole } from "../../lib/types/auth-types";
import { AuthShell } from "../../admin/components/AuthShell";
import { PasswordInput } from "../../admin/components/PasswordInput";
import { Button } from "../../admin/ui/Button";
import { Field } from "../../admin/ui/Field";
import { Input } from "../../admin/ui/Input";
import { InlineError } from "../../admin/ui/ErrorState";

export default function VendorLoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // If already logged in, redirect based on role
    if (!loading && isAuthenticated && user) {
      if (user.role === UserRole.COMPANY_VENDOR) {
        router.replace("/vendor");
      } else {
        // Non-vendor users shouldn't access this portal
        router.replace("/");
      }
    }
  }, [loading, isAuthenticated, user, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
      // Redirect happens in useEffect
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Login failed";
      if (errorMessage.includes("Invalid credentials")) {
        setError("Invalid email or password. Please try again.");
      } else if (errorMessage.includes("inactive")) {
        setError("Your account is inactive. Please contact support.");
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div data-theme="light">
      <AuthShell
        title="Vendor portal"
        description="Sign in to manage your fleet and services."
        brand={{
          eyebrow: "Vendor Portal",
          headline: "Your fleet, requests and routes in one place.",
          body: "Manage vehicles, drivers, bookings and analytics for your Traflinq contracts.",
        }}
      >
        <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
          <Field label="Email address" required>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" autoComplete="username" autoFocus required />
          </Field>
          <Field label="Password" required>
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="••••••••" required />
          </Field>

          {error && <InlineError>{error}</InlineError>}

          <Button type="submit" size="lg" className="w-full" loading={isSubmitting} disabled={!email || !password}>
            Sign in
          </Button>
        </form>
      </AuthShell>
    </div>
  );
}
