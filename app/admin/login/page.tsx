"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/contexts/auth-context";
import { firstAccessibleRoute } from "../lib/nav";
import { AuthLink, AuthShell } from "../components/AuthShell";
import { Button } from "../ui/Button";
import { Field } from "../ui/Field";
import { Input } from "../ui/Input";
import { InlineError } from "../ui/ErrorState";
import { PasswordInput } from "../components/PasswordInput";

export default function AdminLoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, user, loading, error: authError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /** Landing page after login — driven by the shared nav config so it can't drift from the sidebar. */
  function getRedirectPath(loginUser: typeof user): string {
    return firstAccessibleRoute(loginUser);
  }

  useEffect(() => {
    // If already authenticated on page load, redirect immediately
    if (!loading && isAuthenticated && user) {
      router.replace(getRedirectPath(user));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isAuthenticated, user, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
      // We still push to /admin here; for INTERNAL_STAFF the useEffect will correct it.
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
    <AuthShell title="Sign in" description="Use your admin or staff account.">
      <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
        <Field label="Email address" required>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            autoComplete="username"
            autoFocus
            required
          />
        </Field>

        <Field label="Password" required>
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="••••••••" required />
        </Field>
        <div className="-mt-3 text-right">
          <AuthLink href="/admin/forgot-password" className="text-xs">
            Forgot password?
          </AuthLink>
        </div>

        {(error || authError) && <InlineError>{error || authError}</InlineError>}

        <Button type="submit" size="lg" className="w-full" loading={isSubmitting} disabled={!email || !password}>
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}
