"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { focusRing } from "../ui/styles";

export interface AuthShellProps {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  /** Links under the card, e.g. "Back to sign in". */
  footer?: React.ReactNode;
  /** Brand panel copy; defaults to the admin portal text. Pass translated strings for other portals. */
  brand?: { eyebrow: string; headline: string; body: string };
  /** Copyright line text (without the year). */
  copyright?: string;
  /** Top corner slot, e.g. a language switcher. */
  corner?: React.ReactNode;
}

const DEFAULT_BRAND = {
  eyebrow: "Super Admin Portal",
  headline: "The operating system for corporate mobility.",
  body: "Companies, routes, bookings, fleet and invoicing, managed from one place.",
};

/**
 * Shared layout for the admin auth pages: brand panel on the left (desktop),
 * form card on the right. Replaces three copies of the same dark hero markup.
 */
export function AuthShell({ title, description, children, footer, brand = DEFAULT_BRAND, copyright = "Traflinq. All rights reserved.", corner }: AuthShellProps) {
  return (
    <div className="portal admin-portal flex min-h-screen bg-page text-fg">
      <aside className="relative hidden w-[42%] max-w-xl flex-col justify-between overflow-hidden bg-navy p-10 text-white lg:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -right-40 size-[28rem] rounded-full bg-brand/15 blur-[120px]" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/traflinq_dark_no_tagline-Photoroom.png" alt="Traflinq" className="relative h-10 w-auto self-start" />
        <div className="relative space-y-4">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/60">{brand.eyebrow}</p>
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">{brand.headline}</h2>
          <p className="max-w-md text-sm leading-relaxed text-white/65">{brand.body}</p>
        </div>
        <p className="relative text-xs text-white/45">&copy; {new Date().getFullYear()} {copyright}</p>
      </aside>

      <main className="relative flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6">
        {corner && <div className="absolute end-4 top-4 z-10">{corner}</div>}
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-start gap-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/traflinq_light_no_tagline-Photoroom.png" alt="Traflinq" className="h-9 w-auto lg:hidden" />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
              {description && <p className="mt-1.5 text-sm text-fg-muted">{description}</p>}
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-fg-muted">{footer}</div>}
          <p className="mt-10 text-center text-xs text-fg-muted lg:hidden">&copy; {new Date().getFullYear()} {copyright}</p>
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
