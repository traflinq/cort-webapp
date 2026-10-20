"use client";

import { Switch } from "../ui/Switch";

type ToggleSwitchProps = {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Accessible name (required for screen readers when no visible label). */
  label?: string;
};

/** Legacy wrapper; delegates to the design-system Switch. */
export function ToggleSwitch({ checked, onChange, disabled = false, loading = false, label }: ToggleSwitchProps) {
  return <Switch checked={checked} onCheckedChange={() => onChange()} disabled={disabled} loading={loading} aria-label={label ?? "Toggle"} />;
}
