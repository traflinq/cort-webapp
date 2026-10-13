"use client";

import React, { memo } from "react";
import { useAdminTheme } from "../../lib/theme-context";
import {
  badgeColorsDark,
  badgeColorsLight,
  type BadgeColor,
} from "./admin-styles";
import { cx } from "./cx";

export const Badge = memo(function Badge({
  children,
  color = "blue",
}: {
  children: React.ReactNode;
  color?: BadgeColor;
}) {
  const { theme } = useAdminTheme();
  const colors = theme === "dark" ? badgeColorsDark : badgeColorsLight;

  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        colors[color],
      )}
    >
      {children}
    </span>
  );
});
