/** "+12.5%" / "-3%" / "0%" → 12.5 / -3 / 0; null when the API string is not numeric. */
export function parseTrend(value: string | null | undefined): number | null {
  if (!value) return null;
  const n = Number.parseFloat(String(value).replace(/[%\s,]/g, ""));
  return Number.isFinite(n) ? n : null;
}
