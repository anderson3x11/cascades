import { describe, expect, it } from 'vitest';
import { explain, suggest, type ConfigFileName, type ConfigKnowledge } from './assist';

const KNOWLEDGE: ConfigKnowledge = {
  settings: [
    { key: 'editor.tabSize', type: 'number', default: 4, description: 'Largeur d’une tabulation' },
    { key: 'editor.wordWrap', type: 'boolean', default: false },
    { key: 'workbench.theme', type: 'string', default: 'auto', enum: ['auto', 'nord'] },
  ],
  commands: [
    { id: 'file.new', title: 'Nouveau fichier', category: 'Fichier' },
    { id: 'file.save' },
  ],
};

/** Suggestions where "|" stands in the text. */
function at(file: ConfigFileName, marked: string) {
  const pos = marked.indexOf('|');
  const text = marked.replace('|', '');
  const result = suggest(file, text, pos, KNOWLEDGE);
  return result && { typed: text.slice(result.from, result.to), options: result.options };
}

describe('suggest in settings.json', () => {
  it('offers setting names with their default value', () => {
    const result = at('settings.json', '{\n  "edi|\n}');
    expect(result?.typed).toBe('"edi');
    expect(result?.options[0]).toMatchObject({
      label: '"editor.tabSize"',
      apply: '"editor.tabSize": 4',
      info: 'Largeur d’une tabulation\nDefault: 4',
    });
  });

  it('leaves out a brace right after an unclosed name', () => {
    expect(at('settings.json', '{\n"edi|}')?.typed).toBe('"edi');
  });

  it('only renames when a value already follows', () => {
    const result = at('settings.json', '{ "editor.tab|Size": 2 }');
    expect(result?.typed).toBe('"editor.tabSize"');
    expect(result?.options[0]?.apply).toBe('"editor.tabSize"');
  });

  it('offers setting names inside a language block', () => {
    expect(at('settings.json', '{ "[markdown]": { "|" } }')?.options).toHaveLength(3);
  });

  it('offers the possible values', () => {
    expect(at('settings.json', '{ "workbench.theme": "|" }')?.options.map((o) => o.apply)).toEqual([
      '"auto"',
      '"nord"',
    ]);
    expect(at('settings.json', '{ "editor.wordWrap": t| }')?.options.map((o) => o.apply)).toEqual([
      'true',
      'false',
    ]);
    expect(at('settings.json', '{ "editor.tabSize": | }')).toBeNull();
  });
});

describe('suggest in keybindings.json', () => {
  it('offers commands, and removals once "-" is typed', () => {
    const result = at('keybindings.json', '[{ "key": "Ctrl+N", "command": "fi|" }]');
    expect(result?.options.map((o) => [o.apply, o.detail])).toEqual([
      ['"file.new"', 'Nouveau fichier'],
      ['"file.save"', undefined],
    ]);
    expect(at('keybindings.json', '[{ "command": "-|" }]')?.options[0]?.apply).toBe('"-file.new"');
  });

  it('offers the properties of a shortcut', () => {
    const result = at('keybindings.json', '[{ "key": "Ctrl+N", | }]');
    expect(result?.options.map((o) => o.apply)).toEqual([
      '"key": ',
      '"command": ',
      '"when": ',
      '"args": ',
    ]);
  });
});

describe('explain', () => {
  it('describes a setting and a command', () => {
    const settings = '{ "editor.tabSize": 2 }';
    expect(explain('settings.json', settings, 5, KNOWLEDGE)?.text).toBe(
      'editor.tabSize\nLargeur d’une tabulation\nDefault: 4',
    );
    expect(explain('settings.json', settings, 20, KNOWLEDGE)).toBeNull();

    const keybindings = '[{ "key": "Ctrl+N", "command": "-file.new" }]';
    expect(explain('keybindings.json', keybindings, 34, KNOWLEDGE)?.text).toBe(
      'Fichier : Nouveau fichier',
    );
  });
});
