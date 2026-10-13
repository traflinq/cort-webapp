"use client";

import React, { memo, useEffect } from "react";
import {
  adminModalBody,
  adminModalHeader,
  adminModalShell,
  adminModalTitle,
} from "./admin-styles";
import { cx } from "./cx";

export const Modal = memo(function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  priority = "default",
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  /** Use elevated when stacking above another open modal (e.g. image zoom). */
  priority?: "default" | "elevated" | "high";
}) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClass =
    size === "sm"
      ? "max-w-md"
      : size === "lg"
        ? "max-w-2xl"
        : size === "xl"
          ? "max-w-4xl"
          : "max-w-lg";

  const zClass =
    priority === "high" ? "z-[70]" : priority === "elevated" ? "z-[60]" : "z-50";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className={`admin-fade-in fixed inset-0 ${zClass} flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto`}
    >
      <div className={cx(adminModalShell, sizeClass)}>
        <div className={adminModalHeader}>
          <h3 className={adminModalTitle}>{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-[var(--text-muted)] hover:bg-[var(--row-hover)] hover:text-[var(--text-primary)]"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className={adminModalBody}>{children}</div>
      </div>
    </div>
  );
});
