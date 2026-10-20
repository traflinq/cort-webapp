import * as React from "react";
import { cn } from "@/lib/utils";
import { surface } from "./styles";

const paddings = { none: "", sm: "p-3", md: "p-4", lg: "p-5" } as const;

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: keyof typeof paddings;
  /** Lift on hover for clickable cards. */
  interactive?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(({ className, padding = "none", interactive, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      surface,
      paddings[padding],
      interactive && "transition-shadow duration-150 hover:shadow-[var(--shadow-card-hover)]",
      className,
    )}
    {...props}
  />
));
Card.displayName = "Card";

export interface CardHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** No bottom border (e.g. KPI-style cards). */
  flush?: boolean;
}

const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, title, description, actions, flush, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-start justify-between gap-4 px-5 py-4", !flush && "border-b border-line", className)}
      {...props}
    >
      {title !== undefined || description !== undefined ? (
        <div className="min-w-0">
          {title !== undefined && <CardTitle>{title}</CardTitle>}
          {description !== undefined && <CardDescription>{description}</CardDescription>}
          {children}
        </div>
      ) : (
        <div className="min-w-0 flex-1">{children}</div>
      )}
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-sm font-semibold leading-5 text-fg", className)} {...props} />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("mt-0.5 text-xs text-fg-muted", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-5", className)} {...props} />,
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center gap-2 border-t border-line px-5 py-3", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
