/** Name of the month or day of `d` in `locale`, as Intl writes it ("septembre", "mardi"). */
const monthName = (d: Date, locale: string) =>
  new Intl.DateTimeFormat(locale, { month: 'long' }).format(d);
const dayName = (d: Date, locale: string) =>
  new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(d);

const pad = (n: number) => String(n).padStart(2, '0');
/** "janv.", "mar.": the first `length` letters and a dot; shorter words ("mai") stay whole. */
const short = (word: string, length: number) =>
  word.length <= length ? word : `${word.slice(0, length)}.`;

const TOKENS: Record<string, (d: Date, locale: string) => string> = {
  YYYY: (d) => String(d.getFullYear()),
  YY: (d) => pad(d.getFullYear() % 100),
  MMMM: (d, locale) => monthName(d, locale),
  MMM: (d, locale) => short(monthName(d, locale), 4),
  MM: (d) => pad(d.getMonth() + 1),
  M: (d) => String(d.getMonth() + 1),
  dddd: (d, locale) => dayName(d, locale),
  ddd: (d, locale) => short(dayName(d, locale), 3),
  DD: (d) => pad(d.getDate()),
  D: (d) => String(d.getDate()),
  HH: (d) => pad(d.getHours()),
  H: (d) => String(d.getHours()),
  mm: (d) => pad(d.getMinutes()),
  ss: (d) => pad(d.getSeconds()),
};

/** Longest tokens first; text in [brackets] is kept as is. */
const PATTERN = /\[([^\]]*)\]|YYYY|YY|MMMM|MMM|MM|M|dddd|ddd|DD|D|HH|H|mm|ss/g;

/**
 * A date written with a format: "DD/MM/YYYY" -> "29/09/2026",
 * "dddd D MMMM YYYY" -> "mardi 29 septembre 2026" in French, "[le] D/M à HH:mm".
 * Month and day names are in `locale`.
 */
export function formatDate(date: Date, format: string, locale = 'en'): string {
  return format.replace(PATTERN, (token, literal: string | undefined) =>
    literal !== undefined
      ? literal
      : (TOKENS[token] as (d: Date, locale: string) => string)(date, locale),
  );
}
