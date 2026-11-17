"use client";

import { Dialog } from "../../ui";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

/**
 * Legacy modal API, now backed by the design-system Dialog (focus trap, Esc, scroll lock,
 * dialog semantics). New code should use `Dialog` / `Drawer` from "@/app/company/ui".
 */
export default function Modal({ isOpen, onClose, title, children, size = "lg" }: ModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()} title={title} size={size} persistent>
      {children}
    </Dialog>
  );
}
