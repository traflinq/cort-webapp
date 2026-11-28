import * as React from "react";

/**
 * A headline figure with its trailing unit set smaller and muted, as in the reference
 * ("PKR 18.4M" → "PKR 18.4" + "M", "74%" → "74" + "%", "9.6 km/L" → "9.6" + "km/L").
 * Non-string values (and strings without a short trailing unit) render unchanged, so it is safe
 * to wrap any `value` prop.
 */
// Everything up to the last digit, then a short unit made of letters, %, or "/" (any script).
const UNIT = /^(.*\p{Nd})(\s?)([\p{L}%٪][\p{L}%٪/]{0,5})$/u;

export function Figure({ value }: { value: React.ReactNode }) {
  if (typeof value !== "string") return <>{value}</>;
  const m = UNIT.exec(value.trim());
  if (!m) return <>{value}</>;
  const [, amount, space, unit] = m;
  return (
    <>
      {amount}
      <span className="ms-0.5 text-[0.6em] font-medium tracking-normal text-fg-muted">
        {space}
        {unit}
      </span>
    </>
  );
}
