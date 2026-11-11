/** Date helpers for partial dates ("YYYY" | "YYYY-MM" | ""). */

const MONTHS_EN = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function formatPartialDate(value: string, locale = 'en-GB'): string {
  if (!value) return '';
  const [y, m] = value.split('-');
  if (!m) return y ?? '';
  const month = Number(m);
  if (locale.startsWith('en')) return `${MONTHS_EN[month - 1]} ${y}`;
  try {
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(Number(y), month - 1, 1)));
  } catch {
    return `${MONTHS_EN[month - 1]} ${y}`;
  }
}

/** "Mar 2019 – Present", "2015 – 2018", "2020", "" */
export function formatRange(
  start: string,
  end: string,
  current: boolean,
  locale = 'en-GB',
): string {
  const s = formatPartialDate(start, locale);
  const e = current ? 'Present' : formatPartialDate(end, locale);
  if (s && e) return s === e ? s : `${s} – ${e}`;
  return s || e;
}
