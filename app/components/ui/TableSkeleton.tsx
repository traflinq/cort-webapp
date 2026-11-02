
import { Skeleton } from "@/app/components/ui/Skeleton";

interface TableSkeletonProps {
    columns?: number;
    rows?: number;
}

export default function TableSkeleton({ columns = 5, rows = 5 }: TableSkeletonProps) {
    return (
        <>
            {Array.from({ length: rows }).map((_, rowIndex) => (
                <tr key={rowIndex} className="border-b border-[var(--divider)]">
                    {Array.from({ length: columns }).map((_, colIndex) => (
                        <td key={colIndex} className="px-6 py-4">
                            <Skeleton className="h-5 w-full" />
                        </td>
                    ))}
                </tr>
            ))}
        </>
    );
}
