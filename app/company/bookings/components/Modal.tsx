"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { X } from "@/app/components/icons";
import { IconButton } from "@/app/admin/ui";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    /** One muted line under the title (date, route…). */
    description?: ReactNode;
    /** Shown next to the title, e.g. a status badge. */
    titleAside?: ReactNode;
    children: React.ReactNode;
}

const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({ isOpen, onClose, title, description, titleAside, children }: ModalProps) {
    const tActions = useTranslations("common.actions");
    const titleId = useId();
    const descriptionId = useId();
    const panelRef = useRef<HTMLDivElement>(null);
    const onCloseRef = useRef(onClose);
    const [isMounted, setIsMounted] = useState(isOpen);
    const [isClosing, setIsClosing] = useState(false);

    // Callers pass inline handlers; keep the latest without re-running the focus effect on every render.
    useEffect(() => {
        onCloseRef.current = onClose;
    });

    // Handle mount/unmount with close animation
    useEffect(() => {
        if (isOpen) {
            setIsMounted(true);
            setIsClosing(false);
            return;
        }

        if (isMounted) {
            setIsClosing(true);
            const timeout = setTimeout(() => {
                setIsMounted(false);
                setIsClosing(false);
            }, 380); // match CSS animation duration
            return () => clearTimeout(timeout);
        }
    }, [isOpen, isMounted]);

    // Move focus into the dialog once it is on screen (unless something inside already has it).
    useEffect(() => {
        const panel = panelRef.current;
        if (isOpen && isMounted && panel && !panel.contains(document.activeElement)) {
            panel.focus({ preventScroll: true });
        }
    }, [isOpen, isMounted]);

    // While open: keep Tab inside the dialog, close on Esc, lock page scroll,
    // and give focus back to whatever opened it.
    useEffect(() => {
        if (!isOpen) return;
        const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onCloseRef.current();
                return;
            }
            const panel = panelRef.current;
            if (e.key !== "Tab" || !panel) return;
            const active = document.activeElement;
            // Focus inside a portalled popover (date picker, map suggestions) manages itself.
            if (active && active !== panel && !panel.contains(active)) return;
            const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
            if (items.length === 0) {
                e.preventDefault();
                return;
            }
            const first = items[0];
            const last = items[items.length - 1];
            if (e.shiftKey && (active === first || active === panel)) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && active === last) {
                e.preventDefault();
                first.focus();
            }
        };
        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = previousOverflow;
            if (opener?.isConnected) opener.focus({ preventScroll: true });
        };
    }, [isOpen]);

    if (!isMounted) return null;

    return createPortal(
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4 modal-overlay ${isClosing ? "modal-overlay-closing" : ""}`}>
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={description ? descriptionId : undefined}
                tabIndex={-1}
                className={`flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-line bg-card text-fg shadow-[var(--shadow-modal)] outline-none modal-panel ${isClosing ? "modal-panel-closing" : ""}`}
            >
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-5 py-4">
                    <div className="min-w-0">
                        <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
                            <h2 id={titleId} className="min-w-0 truncate text-base font-semibold text-fg">{title}</h2>
                            {titleAside}
                        </div>
                        {description && (
                            <p id={descriptionId} className="mt-0.5 text-sm text-fg-muted">{description}</p>
                        )}
                    </div>
                    <IconButton type="button" label={tActions("close")} size="icon-sm" tooltip={false} onClick={onClose} className="-me-1.5 shrink-0">
                        <X />
                    </IconButton>
                </div>
                <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
}
