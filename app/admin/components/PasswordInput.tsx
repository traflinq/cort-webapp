"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input, type InputProps } from "../ui/Input";

/** Password field with an accessible show/hide toggle (kept in the tab order). */
export const PasswordInput = React.forwardRef<HTMLInputElement, Omit<InputProps, "type" | "rightIcon">>((props, ref) => {
  const [visible, setVisible] = React.useState(false);
  return (
    <Input
      ref={ref}
      type={visible ? "text" : "password"}
      rightIcon={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="cursor-pointer rounded p-0.5 text-fg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {visible ? <EyeOff /> : <Eye />}
        </button>
      }
      {...props}
    />
  );
});
PasswordInput.displayName = "PasswordInput";
