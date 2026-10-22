"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";
import { focusRing } from "./styles";

type TabsVariant = "underline" | "pills";
const VariantContext = React.createContext<TabsVariant>("underline");

const Tabs = TabsPrimitive.Root;

export interface TabsListProps extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> {
  variant?: TabsVariant;
}

const TabsList = React.forwardRef<React.ElementRef<typeof TabsPrimitive.List>, TabsListProps>(
  ({ className, variant = "underline", ...props }, ref) => (
    <VariantContext.Provider value={variant}>
      <TabsPrimitive.List
        ref={ref}
        className={cn(
          "flex items-center",
          variant === "underline"
            ? "-mb-px w-full gap-1 overflow-x-auto border-b border-line"
            : "w-fit gap-1 rounded-lg bg-subtle p-1",
          className,
        )}
        {...props}
      />
    </VariantContext.Provider>
  ),
);
TabsList.displayName = "TabsList";

export interface TabsTriggerProps extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> {
  /** Optional count pill. */
  count?: number | string;
  icon?: React.ReactNode;
}

const TabsTrigger = React.forwardRef<React.ElementRef<typeof TabsPrimitive.Trigger>, TabsTriggerProps>(
  ({ className, count, icon, children, ...props }, ref) => {
    const variant = React.useContext(VariantContext);
    return (
      <TabsPrimitive.Trigger
        ref={ref}
        className={cn(
          "group inline-flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap text-sm font-medium text-fg-muted transition-colors hover:text-fg disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4",
          focusRing,
          variant === "underline"
            ? "rounded-t-md border-b-2 border-transparent px-3 py-2.5 data-[state=active]:border-brand data-[state=active]:text-fg"
            : "h-8 rounded-md px-3 data-[state=active]:bg-card data-[state=active]:text-fg data-[state=active]:shadow-xs",
          className,
        )}
        {...props}
      >
        {icon}
        {children}
        {count !== undefined && (
          <span className="rounded-full bg-subtle px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-fg-muted group-data-[state=active]:bg-brand-soft group-data-[state=active]:text-brand-ink">
            {count}
          </span>
        )}
      </TabsPrimitive.Trigger>
    );
  },
);
TabsTrigger.displayName = "TabsTrigger";

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content ref={ref} className={cn("mt-4 outline-none", className)} {...props} />
));
TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent };
