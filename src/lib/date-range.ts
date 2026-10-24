/** Experience date column (FR-03): "Mon YYYY — Present", omitting whatever is unknown. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Dates are stored as UTC midnight (ISO date strings); format in UTC so the month never shifts. */
export function formatMonthYear(d: Date): string {
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export interface DateRangeInput {
  startDate?: Date;
  /** null/undefined with `current` = still in the role */
  endDate?: Date | null;
  current: boolean;
}

/**
 * - current + start  → "Mar 2022 — Present"
 * - current, no start → undefined (the "Current" badge already says it; no invented dates)
 * - start + end       → "Mar 2020 — Feb 2022"
 * - start only        → "Mar 2020"
 * - end only          → "Until Feb 2022"
 * - nothing known     → undefined (caller hides the element)
 */
export function formatDateRange({ startDate, endDate, current }: DateRangeInput): string | undefined {
  if (current) return startDate ? `${formatMonthYear(startDate)} — Present` : undefined;
  if (startDate && endDate) return `${formatMonthYear(startDate)} — ${formatMonthYear(endDate)}`;
  if (startDate) return formatMonthYear(startDate);
  if (endDate) return `Until ${formatMonthYear(endDate)}`;
  return undefined;
}
