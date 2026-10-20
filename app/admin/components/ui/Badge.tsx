"use client";

import React, { memo } from "react";
import { Badge as DsBadge, type BadgeTone } from "../../ui/Badge";
export type BadgeColor = "blue" | "green" | "red" | "orange" | "purple" | "gray";

const colorToTone: Record<BadgeColor, BadgeTone> = {
  blue: "info",
  green: "success",
  red: "danger",
  orange: "warning",
  purple: "purple",
  gray: "neutral",
};

/**
 * Legacy colour-named Badge; delegates to the design-system Badge (CSS-var tones,
 * no hydration flicker). New code: import { Badge, StatusBadge } from "@/app/admin/ui".
 */
export const Badge = memo(function Badge({ children, color = "blue" }: { children: React.ReactNode; color?: BadgeColor }) {
  return <DsBadge tone={colorToTone[color]}>{children}</DsBadge>;
});
