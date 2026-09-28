import { describe, expect, it } from 'vitest';
import { sections, type Setting } from './sections';

const SETTINGS: Setting[] = [
  { key: 'workbench.theme', type: 'string', default: 'auto', description: 'Thème de couleurs.' },
  { key: 'editor.tabSize', type: 'number', default: 4, description: 'Largeur d’une tabulation.' },
  { key: 'myPlugin.on', type: 'boolean', default: true },
  { key: 'editor.fontSize', type: 'number', default: 14, description: 'Taille de police.' },
];

describe('sections', () => {
  it('groups by namespace, built-in sections first', () => {
    expect(sections(SETTINGS, '').map((s) => [s.title, s.settings.map((x) => x.key)])).toEqual([
      ['Éditeur', ['editor.tabSize', 'editor.fontSize']],
      ['Interface', ['workbench.theme']],
      ['myPlugin', ['myPlugin.on']],
    ]);
  });

  it('searches keys and descriptions, ignoring accents and case', () => {
    expect(sections(SETTINGS, 'THEME').flatMap((s) => s.settings.map((x) => x.key))).toEqual([
      'workbench.theme',
    ]);
    expect(sections(SETTINGS, 'police editor').flatMap((s) => s.settings)).toHaveLength(1);
  });
});
