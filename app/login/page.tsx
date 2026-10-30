"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/contexts/auth-context";
import { UserRole } from "../lib/types/auth-types";
import { AuthShell } from "../admin/components/AuthShell";
import { PasswordInput } from "../admin/components/PasswordInput";
import { Button } from "../admin/ui/Button";
import { Field } from "../admin/ui/Field";
import { Input } from "../admin/ui/Input";
import { InlineError } from "../admin/ui/ErrorState";

export default function LoginPage() {
    const router = useRouter();
    const { login, isAuthenticated, user, loading, error: authError } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        // If already logged in, redirect based on role
        if (!loading && isAuthenticated && user) {
            if (user.role === UserRole.SUPER_ADMIN) {
                router.replace("/admin");
            } else if (user.role === UserRole.COMPANY_ADMIN || user.role === UserRole.EMPLOYEE) {
                router.replace("/company");
            } else if (user.role === UserRole.COMPANY_VENDOR) {
                router.replace("/vendor");
            } else if (user.role === UserRole.CORT_VENDOR) {
                router.replace("/cort-vendor");
            } else {
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

    // Keep user on login page during redirect - button spinner shows loading state

    return (
        <div data-theme="light">
            <AuthShell title="Welcome back" description="Sign in to access your mobility dashboard.">
                <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
                    <Field label="Email address" required>
                        <Input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="name@company.com"
                            autoComplete="username"
                            autoFocus
                            required
                        />
                    </Field>
                    <Field label="Password" required>
                        <PasswordInput
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="current-password"
                            placeholder="••••••••"
                            required
                        />
                    </Field>

                    {(error || authError) && <InlineError>{error || authError}</InlineError>}

                    <Button type="submit" size="lg" className="w-full" loading={isSubmitting} disabled={!email || !password}>
                        Sign in
                    </Button>
                </form>
            </AuthShell>
        </div>
    );
}
