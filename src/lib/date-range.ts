/** Experience date column (FR-03): "Mon YYYY — Present", omitting whatever is unknown. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Dates are stored as UTC midnight (ISO date strings); format in UTC so the month never shifts. */
export function formatMonthYear(d: Date): string {
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

const YEAR_MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** "2023-03" → "Mar 2023", through the same formatter as the experience dates (UTC, so no local-time shift). */
function formatYearMonth(value: string): string | undefined {
  const m = YEAR_MONTH.exec(value);
  return m ? formatMonthYear(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1))) : undefined;
}

/**
 * Project timeline (month precision), same style as the experience range:
 * "Mar 2023 — Jun 2024", "Mar 2023 — Present" (end "present"), a single "Mar 2023" when start equals end.
 * Anything that is not YYYY-MM (or "present" for the end) gives undefined, so callers render nothing.
 */
export function formatMonthRange(start: string, end: string): string | undefined {
  const from = formatYearMonth(start);
  if (!from) return undefined;
  if (end === 'present') return `${from} — Present`;
  const to = formatYearMonth(end);
  if (!to) return undefined;
  return end === start ? from : `${from} — ${to}`;
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
