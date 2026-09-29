/** The system Cascades runs on, as the webview reports it. */
export type Platform = 'windows' | 'macos' | 'linux';

function detect(): Platform {
  const agent = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  if (/Macintosh|Mac OS X/.test(agent)) return 'macos';
  if (/Linux|X11/.test(agent) && !/Android/.test(agent)) return 'linux';
  return 'windows';
}

let current = detect();

export function platform(): Platform {
  return current;
}

/** For tests. */
export function setPlatform(value: Platform): void {
  current = value;
}

/**
 * A path in a form that compares equal for the same file: forward slashes,
 * and lower case except on Linux, whose file names are case-sensitive.
 */
export function samePath(path: string): string {
  const slashes = path.replace(/\\/g, '/');
  return current === 'linux' ? slashes : slashes.toLowerCase();
}
