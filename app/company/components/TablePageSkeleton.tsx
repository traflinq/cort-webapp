
import { Card } from "./DashboardComponents";
import { Skeleton } from "@/app/components/ui/Skeleton";
import TableSkeleton from "@/app/components/ui/TableSkeleton";

export default function TablePageSkeleton() {
    return (
        <div className="flex flex-col gap-6 max-w-[1600px] mx-auto pb-12 animate-in fade-in duration-500">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <Skeleton className="h-4 w-24 mb-3" />
                    <Skeleton className="h-11 w-64 rounded-xl" />
                </div>
                <Skeleton className="h-12 w-44 rounded-full" />
            </div>

            <Card className="min-h-[500px] !p-0 overflow-hidden">
                <div className="p-5 border-b border-[var(--divider)] flex gap-4">
                    <Skeleton className="h-11 w-64 rounded-full" />
                    <Skeleton className="h-11 w-48 rounded-full" />
                </div>
                <div className="p-0">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-[var(--divider)]">
                                {[1, 2, 3, 4, 5, 6].map(i => (
                                    <th key={i} className="px-6 py-4">
                                        <Skeleton className="h-4 w-24" />
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            <TableSkeleton rows={8} columns={6} />
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
