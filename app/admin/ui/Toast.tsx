"use client";

import { Toaster } from "sonner";
import { useAdminTheme } from "../lib/theme-context";

/** Theme-aware sonner toaster. Mount once inside the admin shell. */
export function AdminToaster() {
  const { theme } = useAdminTheme();
  return (
    <Toaster
      theme={theme}
      position="top-right"
      richColors
      closeButton
      duration={4000}
      toastOptions={{
        classNames: {
          toast: "!rounded-xl !border-line !shadow-[var(--shadow-modal)] !font-sans",
          title: "!text-sm !font-medium",
          description: "!text-xs",
        },
      }}
    />
  );
}
