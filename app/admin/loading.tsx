import { AdminSkeleton } from "./components/ui/AdminSkeleton";

export default function AdminLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading">
      <div className="space-y-2">
        <AdminSkeleton className="h-7 w-48" />
        <AdminSkeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <AdminSkeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <AdminSkeleton className="h-72 rounded-xl" />
    </div>
  );
}
