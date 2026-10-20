"use client";

import type { ReactNode } from "react";
import { PageHeader } from "../ui/PageHeader";

type AdminPageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
};

/** Legacy wrapper; delegates to the design-system PageHeader. */
export function AdminPageHeader({ eyebrow, title, description, action }: AdminPageHeaderProps) {
  return <PageHeader title={title} description={description} actions={action} breadcrumbs={eyebrow ? [{ label: eyebrow }] : undefined} />;
}
