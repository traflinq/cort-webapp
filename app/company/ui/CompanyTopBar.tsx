"use client";

import { useTranslations } from "next-intl";
import { ChevronDown, Languages, LogOut, Menu, Moon, Sun } from "@/app/components/icons";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
  focusRing,
  roundIconButton,
} from "@/app/admin/ui";
import { centerOf } from "../../lib/theme-transition";

export interface CompanyTopBarProps {
  onOpenMenu: () => void;
  theme: "light" | "dark";
  onToggleTheme: (origin?: { x: number; y: number }) => void;
  company: { name?: string | null; logo_url?: string | null } | null;
  email?: string | null;
  onLogout: () => void;
  /** Language switch, shown on Saudi routes only. */
  locale?: { title: string; onToggle: () => void } | null;
  wordmark: string;
}

function CompanyMark({ company, className }: { company: CompanyTopBarProps["company"]; className?: string }) {
  if (company?.logo_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={company.logo_url} alt="" className={cn("rounded-full border border-line object-cover", className)} />;
  }
  return (
    <span aria-hidden="true" className={cn("flex items-center justify-center rounded-full border border-line bg-subtle text-xs font-semibold text-fg-secondary", className)}>
      {company?.name?.[0]?.toUpperCase() || "·"}
    </span>
  );
}

/** Company portal top bar: sits at the top of the content panel, like the Super Admin one. */
export function CompanyTopBar({ onOpenMenu, theme, onToggleTheme, company, email, onLogout, locale, wordmark }: CompanyTopBarProps) {
  const t = useTranslations("company");
  const themeLabel = theme === "dark" ? t("shell.switchToLight") : t("shell.switchToDark");

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-line bg-page/85 px-3 backdrop-blur md:px-6">
      <IconButton label={t("shell.openMenu")} tooltip={false} className="md:hidden" onClick={onOpenMenu}>
        <Menu />
      </IconButton>
      {/* Mobile only: on desktop the wordmark lives in the sidebar. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={wordmark} alt="TrafLinq" className="h-7 w-auto md:hidden" />

      {company?.name && (
        <div className="hidden h-9 min-w-0 items-center gap-2 rounded-[10px] border border-line bg-card pe-3 ps-1.5 shadow-xs md:flex">
          <CompanyMark company={company} className="size-6 text-[11px]" />
          <span className="truncate text-sm font-medium text-fg">{company.name}</span>
        </div>
      )}

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        {locale && (
          <IconButton label={locale.title} className={roundIconButton} onClick={locale.onToggle}>
            <Languages />
          </IconButton>
        )}
        <IconButton label={themeLabel} className={roundIconButton} onClick={(e) => onToggleTheme(centerOf(e.currentTarget))}>
          {theme === "dark" ? <Sun /> : <Moon />}
        </IconButton>

        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t("shell.accountMenu")}
              className={cn("ms-1 flex h-10 cursor-pointer items-center gap-2.5 rounded-full py-1 pe-2 ps-1 text-start hover:bg-subtle", focusRing)}
            >
              <CompanyMark company={company} className="size-8 shrink-0" />
              <span className="hidden min-w-0 flex-col leading-tight md:flex">
                <span className="ltr-content max-w-[14rem] truncate text-sm font-medium text-fg">{email}</span>
                <span className="text-xs text-fg-muted">{t("shell.companyAccount")}</span>
              </span>
              <ChevronDown className="hidden size-4 text-fg-muted md:inline" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="normal-case tracking-normal">
              {company?.name && <span className="block truncate text-sm font-medium text-fg">{company.name}</span>}
              <span className="ltr-content block truncate text-xs font-normal text-fg-muted">{email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={(e) => onToggleTheme(e.target instanceof Element ? centerOf(e.target) : undefined)}>
              {theme === "dark" ? <Sun /> : <Moon />}
              {themeLabel}
            </DropdownMenuItem>
            {locale && (
              <DropdownMenuItem onSelect={locale.onToggle}>
                <Languages />
                {locale.title}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={onLogout}>
              <LogOut className="rtl:rotate-180" />
              {t("shell.signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
