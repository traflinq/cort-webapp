import * as React from "react";
import { cn } from "@/lib/utils";
import { iconTile, surface } from "./styles";

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
  /** Icon shown in a bordered tile before the title, e.g. <CardHeader icon={<Wallet />} … />. */
  icon?: React.ReactNode;
  /** No bottom border (e.g. KPI-style cards). */
  flush?: boolean;
}

const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, title, description, actions, icon, flush, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex justify-between gap-4 px-5 py-4",
        icon ? "items-center" : "items-start",
        !flush && "border-b border-line",
        className,
      )}
      {...props}
    >
      {title !== undefined || description !== undefined ? (
        <CardHeading icon={icon} title={title} description={description} className="flex-1">
          {children}
        </CardHeading>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {icon && <IconTile>{icon}</IconTile>}
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      )}
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  ),
);
CardHeader.displayName = "CardHeader";

/** Card heading. Defaults to h3; pass `as="h2"` when the card sits directly under the page's h1. */
const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement> & { as?: "h2" | "h3" | "h4" }
>(({ className, as: Tag = "h3", ...props }, ref) => (
  <Tag ref={ref} className={cn("text-sm font-semibold leading-5 text-fg", className)} {...props} />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("mt-0.5 text-xs text-fg-muted", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

function IconTile({ children }: { children: React.ReactNode }) {
  return (
    <span aria-hidden="true" className={cn(iconTile, "size-9 [&_svg]:size-[18px]")}>
      {children}
    </span>
  );
}

/**
 * Icon tile + title + description, the heading block of a card (used by CardHeader, and on its own
 * in cards that lay out their own header row).
 */
function CardHeading({
  icon,
  title,
  description,
  as,
  className,
  children,
}: {
  icon?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  as?: "h2" | "h3" | "h4";
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      {icon && <IconTile>{icon}</IconTile>}
      <div className="min-w-0">
        {title !== undefined && <CardTitle as={as}>{title}</CardTitle>}
        {description !== undefined && <CardDescription>{description}</CardDescription>}
        {children}
      </div>
    </div>
  );
}

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

export { Card, CardHeader, CardHeading, CardFooter, CardTitle, CardDescription, CardContent };
