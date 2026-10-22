"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/app/ui";

type AccountTypeKey = "account" | "employee" | "driver";

export function SaveCredentialsNote({ accountTypeKey = "account" }: { accountTypeKey?: AccountTypeKey }) {
  const t = useTranslations("company.credentials");
  const accountTypeLabels: Record<AccountTypeKey, string> = {
    account: t("accountTypeAccount"),
    employee: t("accountTypeEmployee"),
    driver: t("accountTypeDriver"),
  };

  return (
    <div role="note" className="flex items-start gap-2 rounded-lg border border-warning-line bg-warning-soft px-3 py-2.5 text-sm text-fg">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-ink" aria-hidden="true" />
      <p>
        <span className="font-semibold">{t("important")}</span> {t("saveNote", { accountType: accountTypeLabels[accountTypeKey] })}
      </p>
    </div>
  );
}

function CredentialRow({ label, value }: { label: string; value: string }) {
  const t = useTranslations("company.credentials");
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable
    }
  }

  return (
    <div className="rounded-lg border border-line bg-subtle px-4 py-3">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">{label}</div>
      <div className="flex items-center justify-between gap-3">
        <code dir="ltr" className="break-all font-mono text-sm text-fg">
          {value}
        </code>
        <Button type="button" variant="outline" size="sm" onClick={handleCopy} leftIcon={copied ? <Check /> : <Copy />} aria-live="polite">
          {copied ? t("copied") : t("copy")}
        </Button>
      </div>
    </div>
  );
}

type AccountCredentialsRevealProps = {
  email: string;
  password: string;
  fullName?: string;
  subtitle?: string;
  accountTypeKey?: AccountTypeKey;
  className?: string;
};

export function AccountCredentialsReveal({ email, password, fullName, subtitle, accountTypeKey = "account", className }: AccountCredentialsRevealProps) {
  const t = useTranslations("company.credentials");

  return (
    <div className={cn("space-y-4", className)}>
      {(fullName || subtitle) && (
        <div className="text-center">
          {fullName && <div className="text-lg font-semibold text-fg">{fullName}</div>}
          {subtitle && <div className="mt-1 text-sm text-fg-muted">{subtitle}</div>}
        </div>
      )}
      <SaveCredentialsNote accountTypeKey={accountTypeKey} />
      <div className="space-y-3">
        <CredentialRow label={t("email")} value={email} />
        <CredentialRow label={t("password")} value={password} />
      </div>
    </div>
  );
}
