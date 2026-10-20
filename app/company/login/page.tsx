"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "../../lib/contexts/auth-context";
import { UserRole } from "../../lib/types/auth-types";
import { useCompanyLocale } from "../lib/locale-context";
import { useCompanyBasePath } from "../lib/use-company-base-path";
import { Languages } from "lucide-react";
import { AuthShell } from "../../admin/components/AuthShell";
import { PasswordInput } from "../../admin/components/PasswordInput";
import { Button } from "../../admin/ui/Button";
import { Field } from "../../admin/ui/Field";
import { Input } from "../../admin/ui/Input";
import { InlineError } from "../../admin/ui/ErrorState";

export default function CompanyLoginPage() {
  const router = useRouter();
  const { companyPath } = useCompanyBasePath();
  const { login, isAuthenticated, user, loading, error: authError } = useAuth();
  const { locale, setLocale, isSaudiRoute: onSaudiRoute } = useCompanyLocale();
  const t = useTranslations("company.login");
  const tCommon = useTranslations("common");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated && user) {
      if (user.role === UserRole.COMPANY_ADMIN || user.role === UserRole.EMPLOYEE) {
        router.replace(companyPath("/company"));
      } else {
        router.replace("/");
      }
    }
  }, [loading, isAuthenticated, user, router, companyPath]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : tCommon("errors.loginFailed");
      if (errorMessage.includes("Invalid credentials")) {
        setError(tCommon("errors.invalidCredentials"));
      } else if (errorMessage.includes("inactive")) {
        setError(tCommon("errors.accountInactive"));
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
        title={t("title")}
        description={t("subtitle")}
        copyright={tCommon("misc.copyright")}
        brand={{ eyebrow: t("brandEyebrow"), headline: t("brandHeadline"), body: t("brandBody") }}
        corner={
          onSaudiRoute ? (
            <Button variant="outline" size="sm" leftIcon={<Languages />} onClick={() => setLocale(locale === "en" ? "ar" : "en")}>
              {locale === "en" ? "عربي" : "EN"}
            </Button>
          ) : undefined
        }
      >
        <form className="flex flex-col gap-5" onSubmit={onSubmit} noValidate>
          <Field label={t("emailLabel")} required>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("emailPlaceholder")}
              autoComplete="username"
              autoFocus
              required
              dir="ltr"
              className="ltr-content"
            />
          </Field>
          <Field label={t("passwordLabel")} required>
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="••••••••" required dir="ltr" />
          </Field>

          {(error || authError) && <InlineError>{error || authError}</InlineError>}

          <Button type="submit" size="lg" className="w-full" loading={isSubmitting} disabled={!email || !password}>
            {tCommon("actions.signIn")}
          </Button>
        </form>
      </AuthShell>
    </div>
  );
}
