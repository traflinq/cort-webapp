"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "./Button";
import { Input } from "./Form";
import { focusRing } from "./styles";

const OVERLAY = "fixed inset-0 z-[60] bg-overlay data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out";

function CloseButton() {
  const t = useTranslations("common.ui");
  return (
    <DialogPrimitive.Close
      aria-label={t("close")}
      className={cn("flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-subtle hover:text-fg", focusRing)}
    >
      <X className="size-4" aria-hidden="true" />
    </DialogPrimitive.Close>
  );
}

function Header({ title, description, extra }: { title: React.ReactNode; description?: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <DialogPrimitive.Title className="text-base font-semibold text-fg">{title}</DialogPrimitive.Title>
        {description ? (
          <DialogPrimitive.Description className="mt-0.5 text-[13px] text-fg-muted">{description}</DialogPrimitive.Description>
        ) : (
          <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
        )}
        {extra}
      </div>
      <CloseButton />
    </div>
  );
}

const DIALOG_SIZE = { sm: "sm:max-w-md", md: "sm:max-w-xl", lg: "sm:max-w-3xl", xl: "sm:max-w-5xl" } as const;

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  size?: keyof typeof DIALOG_SIZE;
  /** Sticky action row. */
  footer?: React.ReactNode;
  /** Remove body padding (tables, maps). */
  flush?: boolean;
  /** Keep open on outside click (forms with unsaved input). */
  persistent?: boolean;
  children: React.ReactNode;
}

/** Centred modal for create / edit / short detail. Focus-trapped, Esc closes, scroll locked. */
export function Dialog({ open, onOpenChange, title, description, size = "md", footer, flush, persistent, children }: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={OVERLAY} />
        <DialogPrimitive.Content
          onInteractOutside={persistent ? (e) => e.preventDefault() : undefined}
          className={cn(
            "fixed left-1/2 top-1/2 z-[61] flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden",
            "rounded-lg border border-line bg-elevated shadow-[var(--shadow-modal)] outline-none",
            "data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out",
            DIALOG_SIZE[size],
          )}
        >
          <Header title={title} description={description} />
          <div className={cn("min-h-0 flex-1 overflow-y-auto", !flush && "p-5")}>{children}</div>
          {footer && <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line bg-elevated px-5 py-3">{footer}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

const DRAWER_SIZE = { sm: "sm:max-w-md", md: "sm:max-w-xl", lg: "sm:max-w-3xl" } as const;

export interface DrawerProps extends Omit<DialogProps, "size"> {
  size?: keyof typeof DRAWER_SIZE;
  /** Rendered under the title (status badges, meta). */
  headerExtra?: React.ReactNode;
}

/** Side panel on the inline-end edge, for record details and longer forms. */
export function Drawer({ open, onOpenChange, title, description, size = "md", footer, flush, persistent, headerExtra, children }: DrawerProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={OVERLAY} />
        <DialogPrimitive.Content
          onInteractOutside={persistent ? (e) => e.preventDefault() : undefined}
          className={cn(
            "co-sheet-end fixed inset-y-0 end-0 z-[61] flex w-full flex-col border-s border-line bg-elevated shadow-[var(--shadow-modal)] outline-none",
            "data-[state=open]:animate-sheet-in data-[state=closed]:animate-sheet-out",
            DRAWER_SIZE[size],
          )}
        >
          <Header title={title} description={description} extra={headerExtra && <div className="mt-2 flex flex-wrap items-center gap-2">{headerExtra}</div>} />
          <div className={cn("min-h-0 flex-1 overflow-y-auto", !flush && "p-5")}>{children}</div>
          {footer && <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/* ── Confirm ───────────────────────────────────────────────────────────────── */

export interface ConfirmOptions {
  title: React.ReactNode;
  message?: React.ReactNode;
  /** What will happen, as a short list. */
  consequences?: React.ReactNode[];
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** Require typing this text before confirming (irreversible actions). */
  typeToConfirm?: string;
}

const ConfirmContext = React.createContext<(options: ConfirmOptions) => Promise<boolean>>(() => Promise.resolve(false));

/** `const confirm = useConfirm(); if (await confirm({ title, destructive: true })) …` */
export const useConfirm = () => React.useContext(ConfirmContext);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations("common.ui");
  const [state, setState] = React.useState<{ options: ConfirmOptions; resolve: (v: boolean) => void } | null>(null);
  const [typed, setTyped] = React.useState("");

  const confirm = React.useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setTyped("");
        setState({ options, resolve });
      }),
    [],
  );

  const settle = (value: boolean) => {
    state?.resolve(value);
    setState(null);
  };

  const o = state?.options;
  const blocked = !!o?.typeToConfirm && typed.trim() !== o.typeToConfirm;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <DialogPrimitive.Root open={!!state} onOpenChange={(open) => !open && settle(false)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className={cn(OVERLAY, "z-[70]")} />
          <DialogPrimitive.Content
            role="alertdialog"
            className="fixed left-1/2 top-1/2 z-[71] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-line bg-elevated p-5 shadow-[var(--shadow-modal)] outline-none data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out sm:max-w-md"
          >
            <DialogPrimitive.Title className="text-base font-semibold text-fg">{o?.title ?? t("areYouSure")}</DialogPrimitive.Title>
            <DialogPrimitive.Description asChild>
              <div className="mt-2 text-sm text-fg-secondary">
                {o?.message}
                {o?.consequences && o.consequences.length > 0 && (
                  <ul className="mt-2 list-disc space-y-1 ps-5 text-[13px] text-fg-muted">
                    {o.consequences.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                )}
              </div>
            </DialogPrimitive.Description>
            {o?.typeToConfirm && (
              <div className="mt-4">
                <label className="mb-1.5 block text-[13px] text-fg-muted">{t("typeToConfirm", { text: o.typeToConfirm })}</label>
                <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
              </div>
            )}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => settle(false)}>
                {o?.cancelLabel ?? t("cancel")}
              </Button>
              <Button variant={o?.destructive ? "danger" : "primary"} disabled={blocked} onClick={() => settle(true)}>
                {o?.confirmLabel ?? (o?.destructive ? t("delete") : t("confirm"))}
              </Button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </ConfirmContext.Provider>
  );
}
