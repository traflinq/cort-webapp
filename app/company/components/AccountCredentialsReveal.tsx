"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy } from "lucide-react";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type AccountTypeKey = "account" | "employee" | "driver";

export function SaveCredentialsNote({ accountTypeKey = "account" }: { accountTypeKey?: AccountTypeKey }) {
  const t = useTranslations("company.credentials");
  const accountTypeLabels: Record<AccountTypeKey, string> = {
    account: t("accountTypeAccount"),
    employee: t("accountTypeEmployee"),
    driver: t("accountTypeDriver"),
  };

  return (
    <div className="alert-banner-warning">
      <span className="font-semibold">{t("important")}</span>{" "}
      {t("saveNote", { accountType: accountTypeLabels[accountTypeKey] })}
    </div>
  );
}

type CredentialRowProps = {
  label: string;
  value: string;
};

function CredentialRow({ label, value }: CredentialRowProps) {
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
    <div className="rounded-[var(--radius-tile)] bg-[var(--tile-bg)] px-4 py-3">
      <div className="text-xs text-[var(--text-muted)] mb-1">{label}</div>
      <div className="flex items-center justify-between gap-3">
        <code className="text-sm font-mono text-[var(--text-primary)] break-all ltr-content" dir="ltr">{value}</code>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--bg-card)] px-4 text-xs font-medium text-[var(--text-primary)] shadow-[var(--shadow-card)] hover:text-[var(--cort-orange)] transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? t("copied") : t("copy")}
        </button>
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

export function AccountCredentialsReveal({
  email,
  password,
  fullName,
  subtitle,
  accountTypeKey = "account",
  className,
}: AccountCredentialsRevealProps) {
  const t = useTranslations("company.credentials");

  return (
    <div className={cx("space-y-4", className)}>
      <div className="text-center">
        {fullName && <div className="font-medium text-[var(--text-primary)] text-lg">{fullName}</div>}
        {subtitle && <div className="text-sm text-[var(--text-muted)] mt-1">{subtitle}</div>}
      </div>
      <SaveCredentialsNote accountTypeKey={accountTypeKey} />
      <div className="space-y-3">
        <CredentialRow label={t("email")} value={email} />
        <CredentialRow label={t("password")} value={password} />
      </div>
    </div>
  );
}
