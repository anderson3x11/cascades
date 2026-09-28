import type { SettingSchema } from '../../api';

/** Titles of the built-in setting namespaces, in display order. */
const SECTION_TITLES: Record<string, string> = {
  editor: 'Éditeur',
  cascades: 'Cascades',
  smartLists: 'Listes intelligentes',
  indentKeep: 'Indentation',
  autoPairs: 'Paires automatiques',
  links: 'Liens',
  insertDate: 'Date',
  markdownTables: 'Tableaux Markdown',
  files: 'Fichiers',
  session: 'Session',
  workbench: 'Interface',
  zen: 'Mode zen',
  preview: 'Aperçus',
  keyboard: 'Clavier',
};

export type Setting = SettingSchema & { key: string };

export interface Section {
  title: string;
  settings: Setting[];
}

/** Lower case without accents, for searching. */
export const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/**
 * Settings grouped by namespace ("editor.tabSize" goes in "Éditeur"), keeping
 * those whose key or description contains every word of `query`.
 */
export function sections(settings: Setting[], query: string): Section[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  const byNamespace = new Map<string, Setting[]>();
  for (const setting of settings) {
    const haystack = fold(`${setting.key} ${setting.description ?? ''}`);
    if (!words.every((word) => haystack.includes(word))) continue;
    const namespace = setting.key.slice(0, setting.key.indexOf('.'));
    byNamespace.set(namespace, [...(byNamespace.get(namespace) ?? []), setting]);
  }
  const known = Object.keys(SECTION_TITLES);
  const rank = (namespace: string) => {
    const index = known.indexOf(namespace);
    return index === -1 ? known.length : index;
  };
  return [...byNamespace]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([namespace, list]) => ({
      title: SECTION_TITLES[namespace] ?? namespace,
      settings: list,
    }));
}
