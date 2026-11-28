"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Moon, Sun } from "@/app/components/icons";
import { setThemeAnimated, useTheme } from "@/app/lib/theme-store";
import { centerOf } from "@/app/lib/theme-transition";
import { IconButton } from "../ui/IconButton";
import { focusRing, roundIconButton } from "../ui/styles";
import { AuthRouteMap } from "./AuthRouteMap";

export interface AuthShellProps {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  /** Links under the card, e.g. "Back to sign in". */
  footer?: React.ReactNode;
  /**
   * Brand panel copy; defaults to the admin portal text. Pass translated strings for other portals.
   * `portal` names the portal beside the logo; `before` / `after` label the map key.
   */
  brand?: { portal?: string; headline: string; body: string; before?: string; after?: string };
  /** Copyright line text (without the year). */
  copyright?: string;
  /** Top corner slot, e.g. a language switcher. The theme switch always sits beside it. */
  corner?: React.ReactNode;
  /** Theme switch labels; pass translated strings on translated pages. */
  themeLabels?: { toLight: string; toDark: string };
}

const DEFAULT_BRAND = {
  portal: "Super Admin",
  headline: "The operating system for corporate mobility.",
  body: "Companies, routes, bookings, fleet and invoicing, managed from one place.",
};

/**
 * Sign-in pages sit outside the portal theme providers, so they apply the app-wide theme themselves
 * (dark by default; the pre-paint script has already set it on a full page load).
 */
function useAuthTheme() {
  const theme = useTheme();
  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  return theme;
}

/**
 * Shared layout for every sign-in, forgot-password and reset-password page: on desktop, a full-height
 * route-map visual with the brand line; on phones, a short band of the same map above the form.
 */
export function AuthShell({
  title,
  description,
  children,
  footer,
  brand = DEFAULT_BRAND,
  copyright = "Traflinq. All rights reserved.",
  corner,
  themeLabels = { toLight: "Switch to light theme", toDark: "Switch to dark theme" },
}: AuthShellProps) {
  const theme = useAuthTheme();
  const year = new Date().getFullYear();
  const before = brand.before ?? "Before";
  const after = brand.after ?? "After";

  return (
    <div className="admin-portal flex min-h-screen bg-page text-fg">
      <aside className="relative hidden w-[46%] max-w-2xl flex-col justify-between overflow-hidden border-e border-line bg-[var(--bg-sidebar)] p-10 lg:flex">
        <AuthRouteMap className="absolute inset-0" />
        {/* Darkens the map under the copy so the text stays readable. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#0b0b0b] via-[#0b0b0b]/80 to-transparent" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#0b0b0b]/80 to-transparent" />

        <div className="relative flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/traflinq_dark_no_tagline-Photoroom.png" alt="Traflinq" className="h-9 w-auto" />
          {brand.portal && (
            <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-xs font-medium text-white/75">{brand.portal}</span>
          )}
        </div>

        <div className="relative space-y-5">
          <div className="space-y-3">
            <h2 className="max-w-md text-3xl font-semibold leading-tight tracking-tight text-white text-balance">{brand.headline}</h2>
            <p className="max-w-md text-sm leading-relaxed text-white/65">{brand.body}</p>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-5">
            <ul className="flex items-center gap-5 text-xs text-white/60" aria-hidden="true">
              <li className="flex items-center gap-2">
                <svg width="22" height="4" viewBox="0 0 22 4" className="overflow-visible">
                  <line x1="1" y1="2" x2="21" y2="2" stroke="white" strokeOpacity="0.45" strokeWidth="2" strokeDasharray="2 5" strokeLinecap="round" />
                </svg>
                {before}
              </li>
              <li className="flex items-center gap-2 text-white/85">
                <span className="h-[3px] w-5 rounded-full bg-[#e8692e]" />
                {after}
              </li>
            </ul>
            <p className="text-xs text-white/45">&copy; {year} {copyright}</p>
          </div>
        </div>
      </aside>

      <main className="relative flex min-w-0 flex-1 flex-col">
        {/* Phones and tablets: a short band of the map, with the logo on it. */}
        <div className="relative h-40 shrink-0 overflow-hidden lg:hidden">
          <AuthRouteMap className="absolute inset-0" animate={false} framing="band" />
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-[#0b0b0b]/30 via-transparent to-[var(--bg-page)]" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/traflinq_dark_no_tagline-Photoroom.png" alt="Traflinq" className="absolute start-4 top-4 h-8 w-auto sm:start-6" />
        </div>

        <div className="absolute end-4 top-4 z-10 flex items-center gap-2">
          {corner}
          {/* Sign-in pages have no TooltipProvider, so use the native title for the hover hint. */}
          <IconButton
            label={theme === "dark" ? themeLabels.toLight : themeLabels.toDark}
            title={theme === "dark" ? themeLabels.toLight : themeLabels.toDark}
            tooltip={false}
            className={roundIconButton}
            onClick={(e) => setThemeAnimated(theme === "dark" ? "light" : "dark", centerOf(e.currentTarget))}
          >
            {theme === "dark" ? <Sun /> : <Moon />}
          </IconButton>
        </div>

        <div className="flex flex-1 items-start justify-center px-4 pb-10 sm:px-6 lg:items-center lg:py-10">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
              {description && <p className="mt-1.5 text-sm text-fg-muted">{description}</p>}
            </div>
            <div className="rounded-[14px] border border-line bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">{children}</div>
            {footer && <div className="mt-6 text-center text-sm text-fg-muted">{footer}</div>}
            <p className="mt-10 text-center text-xs text-fg-muted lg:hidden">&copy; {year} {copyright}</p>
          </div>
        </div>
      </main>
    </div>
  );
}

export function AuthLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn("rounded font-medium text-brand-ink hover:underline", focusRing, className)}>
      {children}
    </Link>
  );
}
