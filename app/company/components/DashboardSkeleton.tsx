"use client";

import { useTranslations } from "next-intl";
import { Skeleton } from "@/app/admin/ui";

/** Mirrors the overview layout so nothing jumps when data arrives. */
export default function DashboardSkeleton() {
  const t = useTranslations("common.status");
  const block = "rounded-xl border border-line bg-card";
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-12" role="status" aria-busy="true">
      <span className="sr-only">{t("loading")}</span>
      <div className="flex items-end justify-between gap-4" aria-hidden="true">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`${block} space-y-3 p-4`}>
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-7 w-36" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className={`${block} h-72 lg:col-span-2`} />
        <div className={`${block} h-72`} />
      </div>
      <div className={`${block} h-64`} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className={`${block} h-64`} />
        <div className={`${block} h-64`} />
        <div className={`${block} h-64`} />
      </div>
    </div>
  );
}
