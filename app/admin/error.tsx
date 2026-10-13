"use client";

import { useEffect } from "react";

export default function AdminError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("[Admin Error Boundary]", error);
    }, [error]);

    return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="flex flex-col items-center gap-4 max-w-md text-center px-4">
                <div className="h-14 w-14 rounded-full bg-red-500/10 flex items-center justify-center">
                    <svg className="h-7 w-7 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">Something went wrong</h2>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                        {error.message || "An unexpected error occurred. Please try again."}
                    </p>
                </div>
                <button
                    onClick={reset}
                    className="px-4 py-2 text-sm font-medium text-white bg-[var(--cort-orange)] rounded-lg hover:bg-[var(--cort-orange-hover)] active:scale-[0.98] transition-all"
                >
                    Try again
                </button>
            </div>
        </div>
    );
}
