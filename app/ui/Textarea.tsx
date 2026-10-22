"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { inputBase } from "./styles";
import { useFieldContext } from "./Field";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, invalid, id, ...props }, ref) => {
  const field = useFieldContext();
  const resolvedId = id ?? field?.id;
  const ariaInvalid = invalid ?? field?.invalid ?? props["aria-invalid"];
  const describedBy = [props["aria-describedby"], field?.describedBy].filter(Boolean).join(" ") || undefined;
  return (
    <textarea
      ref={ref}
      id={resolvedId}
      aria-invalid={ariaInvalid ? true : undefined}
      aria-describedby={describedBy}
      className={cn(inputBase, "h-auto min-h-20 resize-y py-2 leading-relaxed", className)}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
