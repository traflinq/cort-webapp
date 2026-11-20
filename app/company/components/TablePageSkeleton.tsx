
import { Card } from "./DashboardComponents";
import { Skeleton } from "@/app/components/ui/Skeleton";
import TableSkeleton from "@/app/components/ui/TableSkeleton";

export default function TablePageSkeleton() {
    return (
        <div className="flex flex-col gap-6 mx-auto max-w-[1440px] pb-10">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-10 w-48" />
                </div>
                <Skeleton className="h-10 w-32 rounded-xl" />
            </div>

            <Card className="min-h-[500px] !p-0 overflow-hidden">
                <div className="p-5 border-b border-line flex gap-4">
                    <Skeleton className="h-11 w-64 rounded-xl" />
                    <Skeleton className="h-11 w-48 rounded-xl" />
                </div>
                <div className="p-0">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-line">
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
