/** Fonts offered by the font menu when installed, with the generic family to fall back on. */
const CANDIDATES: [name: string, generic: 'monospace' | 'serif' | 'sans-serif'][] = [
  ['Cascadia Code', 'monospace'],
  ['Cascadia Mono', 'monospace'],
  ['Consolas', 'monospace'],
  ['JetBrains Mono', 'monospace'],
  ['Fira Code', 'monospace'],
  ['Source Code Pro', 'monospace'],
  ['IBM Plex Mono', 'monospace'],
  ['Roboto Mono', 'monospace'],
  ['iA Writer Mono S', 'monospace'],
  ['iA Writer Duo S', 'monospace'],
  ['Courier Prime', 'monospace'],
  ['Courier New', 'monospace'],
  ['Lucida Console', 'monospace'],
  ['SF Mono', 'monospace'],
  ['Menlo', 'monospace'],
  ['Monaco', 'monospace'],
  ['Hack', 'monospace'],
  ['Inconsolata', 'monospace'],
  ['DejaVu Sans Mono', 'monospace'],
  ['Ubuntu Mono', 'monospace'],
  ['Liberation Mono', 'monospace'],
  ['Noto Sans Mono', 'monospace'],
  ['Georgia', 'serif'],
  ['Cambria', 'serif'],
  ['Constantia', 'serif'],
  ['Palatino Linotype', 'serif'],
  ['Book Antiqua', 'serif'],
  ['Charter', 'serif'],
  ['Iowan Old Style', 'serif'],
  ['Literata', 'serif'],
  ['Merriweather', 'serif'],
  ['Times New Roman', 'serif'],
  ['Noto Serif', 'serif'],
  ['DejaVu Serif', 'serif'],
  ['Segoe UI', 'sans-serif'],
  ['Inter', 'sans-serif'],
  ['Calibri', 'sans-serif'],
  ['Helvetica Neue', 'sans-serif'],
  ['Arial', 'sans-serif'],
  ['Verdana', 'sans-serif'],
  ['Noto Sans', 'sans-serif'],
  ['Ubuntu', 'sans-serif'],
];

/**
 * A font is installed when text drawn with it differs in width from the
 * fallbacks. Two fallbacks, since the generic monospace may itself be the
 * font being tested (Consolas on Windows).
 */
function isInstalled(context: CanvasRenderingContext2D, name: string): boolean {
  const sample = 'mmmmmmmmmmlli10WQ@#';
  return ['monospace', 'serif'].some((fallback) => {
    context.font = `72px ${fallback}`;
    const base = context.measureText(sample).width;
    context.font = `72px "${name}", ${fallback}`;
    return context.measureText(sample).width !== base;
  });
}

let cache: { name: string; css: string }[] | null = null;

/** Installed fonts of the list, as a name and a CSS font-family value. */
export function installedFonts(): { name: string; css: string }[] {
  if (cache) return cache;
  const context = document.createElement('canvas').getContext('2d');
  if (!context) return [];
  cache = CANDIDATES.filter(([name]) => isInstalled(context, name)).map(([name, generic]) => ({
    name,
    css: `'${name}', ${generic}`,
  }));
  return cache;
}

/** First family of a CSS font list, without quotes: "'Cascadia Code', Consolas" gives "Cascadia Code". */
export function firstFamily(css: string): string {
  return (css.split(',')[0] ?? '').trim().replace(/^['"]|['"]$/g, '');
}
