"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiClient } from "../../lib/services/api-client";
import { useAuth } from "../../lib/contexts/auth-context";
import { pillClasses } from "../ui/PillButton";

export default function CompanyImpersonatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshProfile } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const ticket = searchParams.get("ticket");
    if (!ticket) {
      setError("Missing login ticket.");
      return;
    }

    (async () => {
      try {
        await apiClient.exchangeImpersonationTicket(ticket);
        await refreshProfile();
        router.replace("/company");
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "This login link is invalid or has expired."
        );
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="company-portal relative flex min-h-screen w-full items-center justify-center bg-[var(--canvas)] px-4 font-sans text-[var(--text-primary)]">
      <div className="relative w-full max-w-md rounded-[var(--radius-card)] bg-[var(--bg-card)] px-8 py-10 text-center shadow-[var(--shadow-card)]">
        {error ? (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--tone-danger-soft)] text-[var(--tone-danger-ink)]">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            </div>
            <h2 className="text-xl font-medium text-[var(--text-primary)]">Login link expired</h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">{error}</p>
            <a
              href="/company/login"
              className={pillClasses("primary", "md", false, "mt-6")}
            >
              Back to login
            </a>
          </>
        ) : (
          <>
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[var(--tile-bg)] border-t-[var(--cort-orange)]" />
            <h2 className="text-xl font-medium text-[var(--text-primary)]">Signing you in&hellip;</h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">Redirecting to the company dashboard.</p>
          </>
        )}
      </div>
    </div>
  );
}
