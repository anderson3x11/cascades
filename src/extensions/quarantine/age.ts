const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "à l'instant", "il y a 5 min", "il y a 3 h", "il y a 2 j". */
export function formatAge(createdAt: number, now = Date.now()): string {
  const elapsed = Math.max(0, now - createdAt);
  if (elapsed < MINUTE) return 'à l’instant';
  if (elapsed < HOUR) return `il y a ${Math.floor(elapsed / MINUTE)} min`;
  if (elapsed < DAY) return `il y a ${Math.floor(elapsed / HOUR)} h`;
  return `il y a ${Math.floor(elapsed / DAY)} j`;
}
