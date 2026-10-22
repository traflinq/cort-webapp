"use client";

import { Toaster, type ToasterProps } from "sonner";
import { usePortalTheme } from "./lib/theme-context";

export interface PortalToasterProps {
  /** Reading direction; toasts and their layout mirror in RTL. */
  dir?: "ltr" | "rtl";
  position?: ToasterProps["position"];
}

/** Theme-aware sonner toaster. Mount once inside a portal shell. */
export function PortalToaster({ dir = "ltr", position }: PortalToasterProps) {
  const { theme } = usePortalTheme();
  return (
    <Toaster
      theme={theme}
      dir={dir}
      position={position ?? (dir === "rtl" ? "top-left" : "top-right")}
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

/** @deprecated alias kept for admin code; prefer PortalToaster. */
export const AdminToaster = PortalToaster;
