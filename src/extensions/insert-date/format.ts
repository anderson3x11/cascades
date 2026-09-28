const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];
const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

const pad = (n: number) => String(n).padStart(2, '0');
/** "janv.", "mar.": the first `length` letters and a dot; shorter words ("mai") stay whole. */
const short = (word: string, length: number) =>
  word.length <= length ? word : `${word.slice(0, length)}.`;

const TOKENS: Record<string, (d: Date) => string> = {
  YYYY: (d) => String(d.getFullYear()),
  YY: (d) => pad(d.getFullYear() % 100),
  MMMM: (d) => MONTHS[d.getMonth()] as string,
  MMM: (d) => short(MONTHS[d.getMonth()] as string, 4),
  MM: (d) => pad(d.getMonth() + 1),
  M: (d) => String(d.getMonth() + 1),
  dddd: (d) => DAYS[d.getDay()] as string,
  ddd: (d) => short(DAYS[d.getDay()] as string, 3),
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
 * "dddd D MMMM YYYY" -> "mardi 29 septembre 2026", "[le] D/M à HH:mm".
 */
export function formatDate(date: Date, format: string): string {
  return format.replace(PATTERN, (token, literal: string | undefined) =>
    literal !== undefined ? literal : (TOKENS[token] as (d: Date) => string)(date),
  );
}
