import { Card } from "./Card";
import { Skeleton, TableSkeletonRows } from "@/app/admin/ui/Skeleton";

export default function TablePageSkeleton() {
    return (
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-12" aria-busy="true">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-7 w-48" />
                </div>
                <Skeleton className="h-9 w-32 rounded-lg" />
            </div>

            <Card className="min-h-[500px] overflow-hidden !p-0">
                <div className="flex gap-3 border-b border-line px-4 py-3 sm:px-5">
                    <Skeleton className="h-9 w-64 rounded-lg" />
                    <Skeleton className="h-9 w-48 rounded-lg" />
                </div>
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-line">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <th key={i} className="px-4 py-3">
                                    <Skeleton className="h-3 w-20" />
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                        <TableSkeletonRows rows={8} columns={6} />
                    </tbody>
                </table>
            </Card>
        </div>
    );
}
