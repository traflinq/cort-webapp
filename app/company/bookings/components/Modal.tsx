"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
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
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-overlay)] backdrop-blur-[2px] p-4 modal-overlay ${isClosing ? "modal-overlay-closing" : ""}`}>
            <div className={`w-full max-w-2xl transform overflow-hidden rounded-[var(--radius-card,2rem)] bg-[var(--bg-card)] shadow-[var(--shadow-modal)] transition-all max-h-[90vh] flex flex-col modal-panel ${isClosing ? "modal-panel-closing" : ""}`}>
                <div className="flex items-center justify-between gap-4 px-6 pt-6 pb-4 sm:px-8 bg-[var(--bg-card)] shrink-0">
                    <h3 className="text-xl font-medium text-[var(--text-primary)]">{title}</h3>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-[var(--pill-line,var(--border-input))] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto px-6 pb-6 pt-2 sm:px-8 sm:pb-8 bg-[var(--bg-card)]">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
}
