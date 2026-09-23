"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";

const spring = { type: "spring" as const, stiffness: 380, damping: 32 };

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  panelClassName?: string;
  layoutId?: string;
}

export function ModalTrigger({
  layoutId,
  className,
  children,
  onClick,
  disabled,
  title,
  type = "button",
}: {
  layoutId: string;
  className?: string;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  type?: "button" | "submit";
}) {
  return (
    <motion.button
      type={type}
      layoutId={layoutId}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={className}
      transition={spring}
    >
      {children}
    </motion.button>
  );
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  panelClassName,
  layoutId,
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.button
            type="button"
            aria-label="Close"
            className="absolute inset-0 cursor-default"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
            style={{
              background:
                "radial-gradient(circle at 50% 10%, rgba(244, 127, 0, 0.22), transparent 42%), rgba(6, 10, 24, 0.72)",
              backdropFilter: "blur(10px)",
            }}
          />
          <motion.div
            layoutId={layoutId}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={`relative z-10 flex w-full max-w-2xl max-h-[90vh] flex-col overflow-hidden rounded-[2.5rem] bg-[var(--bg-card)] shadow-2xl ring-1 ring-white/[0.07] ${panelClassName || ""}`}
            initial={layoutId ? false : { opacity: 0, scale: 0.92, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={spring}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-input)] bg-[var(--bg-card)] px-8 py-6">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                {title}
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-2.5 text-[var(--text-muted)] transition-all hover:rotate-90 hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto bg-[var(--bg-page)] p-8">{children}</div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
