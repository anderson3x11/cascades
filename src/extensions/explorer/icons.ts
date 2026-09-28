/** Small file-type icons for the explorer: SVG path data on a 16×16 grid, drawn as strokes. */

export type IconKind =
  'folder' | 'folderOpen' | 'text' | 'markdown' | 'code' | 'data' | 'image' | 'pdf' | 'file';

const PAGE =
  'M4 1.5h5l3.5 3.5v9a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5V2a.5.5 0 0 1 .5-.5ZM9 1.5V5h3.5';

export const ICON_PATHS: Record<IconKind, string> = {
  folder: 'M1.5 4a1 1 0 0 1 1-1h3.5l1.5 1.5h6a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V4Z',
  folderOpen: 'M1.5 12V4a1 1 0 0 1 1-1h3.5l1.5 1.5h5a1 1 0 0 1 1 1V7M1.5 12l2-5h11l-2 5h-11Z',
  text: `${PAGE}M5.5 8h5M5.5 10h5M5.5 12h3`,
  markdown: `${PAGE}M5 12.5v-4l1.5 1.5 1.5-1.5v4M10.5 8.5v4M9.3 11.3l1.2 1.2 1.2-1.2`,
  code: `${PAGE}M6.5 8.5 5 10l1.5 1.5M9.5 8.5 11 10l-1.5 1.5`,
  data: `${PAGE}M7 8.5c-.8 0-1 .4-1 1s.1 1-.8 1c.9 0 .8.4.8 1s.2 1 1 1M9 8.5c.8 0 1 .4 1 1s-.1 1 .8 1c-.9 0-.8.4-.8 1s-.2 1-1 1`,
  image: 'M2.5 3.5h11v9h-11ZM2.5 11l3-3 2.5 2.5 2-2 3.5 3.5M11 6a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z',
  pdf: `${PAGE}M5.5 9h5v3.5h-5Z`,
  file: PAGE,
};

const EXTENSIONS: Record<string, IconKind> = {};
const add = (kind: IconKind, list: string) => {
  for (const ext of list.split(' ')) EXTENSIONS[ext] = kind;
};
add('text', 'txt text log');
add('markdown', 'md markdown mdx');
add(
  'code',
  'js mjs cjs jsx ts tsx py rs go java c h cpp hpp cs php rb sh bash ps1 bat cmd lua kt swift css scss less html htm xml vue svelte sql',
);
add('data', 'json jsonc yaml yml toml ini cfg conf csv tsv env');
add('image', 'png jpg jpeg gif webp svg bmp ico avif');
add('pdf', 'pdf');

export function iconFor(name: string, isDir: boolean, expanded: boolean): IconKind {
  if (isDir) return expanded ? 'folderOpen' : 'folder';
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return 'text';
  return EXTENSIONS[name.slice(dot + 1).toLowerCase()] ?? 'file';
}
