"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CalendarClock, ChevronRight, CircleCheck, FileWarning, TrendingDown, UserX } from "@/app/components/icons";
import { CardDescription, CardTitle, focusRingInset } from "@/app/admin/ui";
import { cn } from "@/lib/utils";
import { Card } from "../Card";

export interface AttentionItem {
  key: string;
  tone: "danger" | "warning" | "neutral";
  icon: "unassigned" | "invoice" | "leakage" | "upcoming";
  title: string;
  detail?: ReactNode;
  href: string;
}

const ICONS = { unassigned: UserX, invoice: FileWarning, leakage: TrendingDown, upcoming: CalendarClock };
const TONE = {
  danger: "bg-danger-soft text-danger-ink",
  warning: "bg-warning-soft text-warning-ink",
  neutral: "bg-subtle text-fg-muted",
};

/** What someone should act on today, most urgent first. Every row links to where it gets resolved. */
export function AttentionList({ items }: { items: AttentionItem[] }) {
  const t = useTranslations("company.overview.attention");
  const order = { danger: 0, warning: 1, neutral: 2 };
  const sorted = [...items].sort((a, b) => order[a.tone] - order[b.tone]);
  const actionable = items.filter((i) => i.tone !== "neutral").length;

  return (
    <Card className="flex flex-col p-0 sm:p-0">
      <div className="px-4 pt-4 sm:px-5 sm:pt-5">
        <CardTitle as="h2">{t("title")}</CardTitle>
        <CardDescription>{actionable > 0 ? t("countNeedAction", { count: actionable }) : t("nothingUrgent")}</CardDescription>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5 py-10 text-center">
          <span className="flex size-9 items-center justify-center rounded-full bg-success-soft text-success-ink">
            <CircleCheck className="size-4" aria-hidden="true" />
          </span>
          <p className="text-sm font-medium text-fg">{t("allClearTitle")}</p>
          <p className="max-w-xs text-xs text-fg-muted">{t("allClearBody")}</p>
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-line border-t border-line">
          {sorted.map((item) => {
            const Icon = ICONS[item.icon];
            return (
              <li key={item.key}>
                <Link href={item.href} className={cn("group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-row-hover sm:px-5", focusRingInset)}>
                  <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md", TONE[item.tone])}>
                    <Icon className="size-3.5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-fg">{item.title}</span>
                    {item.detail && <span className="mt-0.5 block text-xs text-fg-muted">{item.detail}</span>}
                  </span>
                  <ChevronRight className="mt-1 size-4 shrink-0 text-fg-muted transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
