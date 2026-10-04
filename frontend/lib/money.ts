/**
 * Money helpers for display.
 *
 * Amounts arrive from the API as decimal strings (the backend uses BigDecimal),
 * e.g. "1234.56". They are converted to a number only for formatting – never
 * do arithmetic on floats in the frontend; let the backend compute.
 */

export type AmountTone = "gain" | "loss" | "neutral";

export function formatMoney(amount: string | number, currency = "EUR", locale = "de-DE"): string {
  const value = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(value)) {
    throw new TypeError(`Invalid amount: ${String(amount)}`);
  }
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);
}

/** Gains are teal (glacier), losses amber – never red vs. green, see docs/brand. */
export function amountTone(amount: string | number): AmountTone {
  const value = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(value) || value === 0) return "neutral";
  return value > 0 ? "gain" : "loss";
}

export const toneClass: Record<AmountTone, string> = {
  gain: "text-glacier-deep dark:text-glacier",
  loss: "text-amber-deep dark:text-amber",
  neutral: "text-muted",
};
