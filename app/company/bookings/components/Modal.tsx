"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { IconButton } from "@/app/admin/ui";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
    const tActions = useTranslations("common.actions");
    const titleId = useId();
    const [isMounted, setIsMounted] = useState(isOpen);
    const [isClosing, setIsClosing] = useState(false);

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

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        if (isOpen) window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, [isOpen, onClose]);

    if (!isMounted) return null;

    return createPortal(
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4 modal-overlay ${isClosing ? "modal-overlay-closing" : ""}`}>
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className={`flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-line bg-card text-fg shadow-[var(--shadow-modal)] modal-panel ${isClosing ? "modal-panel-closing" : ""}`}
            >
                <div className="flex shrink-0 items-center justify-between gap-4 border-b border-line px-5 py-4">
                    <h2 id={titleId} className="min-w-0 truncate text-base font-semibold text-fg">{title}</h2>
                    <IconButton type="button" label={tActions("close")} size="icon-sm" tooltip={false} onClick={onClose} className="-me-1.5">
                        <X />
                    </IconButton>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-5">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
}
