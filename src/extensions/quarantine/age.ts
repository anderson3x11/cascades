import { t } from '../../api';
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "just now", "5 min ago", "3 h ago", "2 d ago". */
export function formatAge(createdAt: number, now = Date.now()): string {
  const elapsed = Math.max(0, now - createdAt);
  if (elapsed < MINUTE) return t('just now');
  if (elapsed < HOUR) return t('{count} min ago', { count: Math.floor(elapsed / MINUTE) });
  if (elapsed < DAY) return t('{count} h ago', { count: Math.floor(elapsed / HOUR) });
  return t('{count} d ago', { count: Math.floor(elapsed / DAY) });
}
