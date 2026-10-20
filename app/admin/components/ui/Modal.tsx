"use client";

import React, { memo } from "react";
import { Dialog, DialogContent, type DialogSize } from "../../ui/Dialog";

/**
 * Legacy API kept for existing pages; now backed by the accessible Dialog
 * (focus trap, Esc, scroll lock, labelled title, close button with a name).
 * New code should import { Dialog, DialogContent } from "@/app/admin/ui".
 */
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
  size?: DialogSize;
  /** Use elevated when stacking above another open modal (e.g. image zoom). */
  priority?: "default" | "elevated" | "high";
}) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent title={title} size={size} priority={priority}>
        {children}
      </DialogContent>
    </Dialog>
  );
});
