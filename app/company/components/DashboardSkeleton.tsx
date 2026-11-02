import { Skeleton } from "@/app/components/ui/Skeleton";

const card = "rounded-[var(--radius-card)] bg-[var(--bg-card)] p-5 sm:p-6 shadow-[var(--shadow-card)]";

/** Mirrors the dashboard: title row, then the reference grid (map / promo / live / ring / tabs / insights). */
export default function DashboardSkeleton() {
    return (
        <div className="flex flex-col gap-6 pb-12 w-full min-w-0 animate-in fade-in duration-500" aria-busy="true">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
                <div className="min-w-0">
                    <Skeleton className="h-11 w-72 max-w-full rounded-xl" />
                    <Skeleton className="mt-3 h-4 w-96 max-w-full" />
                </div>
                <div className="flex items-center gap-3">
                    <Skeleton className="h-12 w-44 rounded-full" />
                    <Skeleton className="h-12 w-40 rounded-full" />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-[minmax(0,24fr)_minmax(0,25fr)_minmax(0,17fr)_minmax(0,34fr)]">
                {/* Map tile */}
                <Skeleton className="min-h-[340px] rounded-[var(--radius-card)] xl:col-start-1 xl:row-start-1" />

                {/* Promo card */}
                <Skeleton className="min-h-[260px] rounded-[var(--radius-card)] xl:col-start-1 xl:row-start-2" />

                {/* Live mobility */}
                <div className={`${card} flex flex-col gap-6 xl:col-start-2 xl:row-start-1`}>
                    <div>
                        <Skeleton className="h-6 w-40" />
                        <Skeleton className="mt-2 h-4 w-24" />
                    </div>
                    <div className="grid grid-cols-3 gap-2.5">
                        {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-[76px] rounded-[var(--radius-tile)]" />
                        ))}
                    </div>
                    <div className="mt-auto flex items-center gap-4">
                        <Skeleton className="size-14 shrink-0 rounded-full" />
                        <div className="flex-1">
                            <Skeleton className="h-5 w-32" />
                            <Skeleton className="mt-2 h-4 w-24" />
                        </div>
                        <Skeleton className="size-14 shrink-0 rounded-full" />
                    </div>
                </div>

                {/* Ring */}
                <div className={`${card} flex flex-col xl:col-start-3 xl:row-start-1`}>
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="mt-3 h-4 w-40" />
                    <Skeleton className="mx-auto mt-6 aspect-square w-full max-w-[200px] rounded-full" />
                </div>

                {/* Service tabs */}
                <div className={`${card} flex flex-col gap-5 md:col-span-2 xl:col-start-2 xl:col-end-4 xl:row-start-2`}>
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex gap-6">
                            {[1, 2, 3].map((i) => (
                                <Skeleton key={i} className="h-7 w-24" />
                            ))}
                        </div>
                        <div className="flex gap-2.5">
                            <Skeleton className="size-12 rounded-full" />
                            <Skeleton className="size-12 rounded-full" />
                        </div>
                    </div>
                    <div className="grid min-h-[180px] grid-cols-1 items-center gap-5 sm:grid-cols-[1fr_auto]">
                        <Skeleton className="h-40 w-full rounded-[var(--radius-tile)]" />
                        <div className="grid grid-cols-3 gap-2.5 sm:w-36 sm:grid-cols-1">
                            {[1, 2, 3].map((i) => (
                                <Skeleton key={i} className="h-16 rounded-[var(--radius-tile)]" />
                            ))}
                        </div>
                    </div>
                    <div className="flex items-end justify-between gap-6 border-t border-[var(--divider)] pt-4">
                        <Skeleton className="h-7 w-48" />
                        <Skeleton className="h-5 w-40" />
                    </div>
                </div>

                {/* Insights */}
                <div className={`${card} flex flex-col gap-5 md:col-span-2 xl:col-span-1 xl:col-start-4 xl:row-start-1 xl:row-end-3`}>
                    <div>
                        <Skeleton className="h-6 w-28" />
                        <Skeleton className="mt-2 h-4 w-36" />
                    </div>
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex items-center gap-4 p-3">
                            <Skeleton className="size-[84px] shrink-0 rounded-2xl" />
                            <div className="flex-1">
                                <Skeleton className="h-5 w-3/4" />
                                <Skeleton className="mt-2 h-4 w-1/2" />
                            </div>
                        </div>
                    ))}
                    <div className="mt-auto flex gap-3">
                        <Skeleton className="h-12 w-36 rounded-full" />
                        <Skeleton className="h-12 w-32 rounded-full" />
                    </div>
                </div>
            </div>
        </div>
    );
}
