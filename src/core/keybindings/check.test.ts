import { describe, expect, it } from 'vitest';
import { checkKeybindings } from './check';

const COMMANDS = new Set(['file.new', 'file.save']);
const underlined = (text: string) =>
  checkKeybindings(text, (id) => COMMANDS.has(id)).map((p) => [
    text.slice(p.from, p.to),
    p.severity,
    p.message,
  ]);

describe('checkKeybindings', () => {
  it('accepts a correct file, removal rules included', () => {
    expect(
      underlined(`[
        // Mes raccourcis
        { "key": "Ctrl+Alt+N", "command": "file.new", "when": "editorFocus" },
        { "command": "-file.save" },
      ]`),
    ).toEqual([]);
  });

  it('underlines bad keys, conditions and commands', () => {
    expect(
      underlined(`[
        { "key": "Hyper+N", "command": "file.nouveau" },
        { "key": "Ctrl+N", "command": "file.new", "when": "a &&", "arg": 1 },
        { "command": "file.new" },
        "Ctrl+S"
      ]`),
    ).toEqual([
      ['"file.nouveau"', 'warning', 'commande inconnue : file.nouveau'],
      ['"Hyper+N"', 'error', 'modificateur inconnu « Hyper » dans « Hyper+N »'],
      ['"arg"', 'warning', 'propriété inconnue (key, command, when, args)'],
      ['"a &&"', 'error', 'condition invalide : « a && »'],
      ['{', 'error', '"key" manquant'],
      ['"Ctrl+S"', 'error', 'attendu : { "key": …, "command": … }'],
    ]);
  });

  it('wants a list', () => {
    expect(underlined('{}')).toEqual([['{}', 'error', 'le fichier doit contenir une liste [ … ]']]);
  });
});
