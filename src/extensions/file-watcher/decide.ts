export type ExternalChange =
  /** Nothing to do (e.g. only metadata changed). */
  | 'none'
  /** The disk now holds what the editor shows (our own save, or the same edit): mark it saved. */
  | 'markSaved'
  /** Changed on disk and the tab has no unsaved work: reload silently. */
  | 'reload'
  /** Changed on disk and the tab has unsaved work: ask. */
  | 'ask'
  /** The file is gone. */
  | 'removed';

/**
 * What to do after the file of a tab changed on disk.
 * `disk` is the new file content, or null if it can no longer be read.
 */
export function decide(disk: string | null, current: string, saved: string): ExternalChange {
  if (disk === null) return 'removed';
  if (disk === current) return disk === saved ? 'none' : 'markSaved';
  if (disk === saved) return 'none';
  return current === saved ? 'reload' : 'ask';
}
