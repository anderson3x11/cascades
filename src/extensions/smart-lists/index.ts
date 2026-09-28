import { EditorState, Prec, type Extension, type TransactionSpec } from '@codemirror/state';
import { keymap, type EditorView, type KeyBinding } from '@codemirror/view';
import { defineExtension } from '../../api';
import { continueList, indentList, renumberChanges, toggleTask } from './list';

const run =
  (command: (state: EditorState) => TransactionSpec | null) =>
  (view: EditorView): boolean => {
    const spec = command(view.state);
    if (!spec) return false;
    view.dispatch(spec);
    return true;
  };

/** Renumbers ordered lists around every user edit, in the same transaction (one undo step). */
const renumberOnEdit = EditorState.transactionFilter.of((tr) => {
  if (
    !tr.docChanged ||
    !(tr.isUserEvent('input') || tr.isUserEvent('delete') || tr.isUserEvent('move'))
  ) {
    return tr;
  }
  let from = Infinity;
  let to = 0;
  tr.changes.iterChangedRanges((_fromA, _toA, fromB, toB) => {
    from = Math.min(from, tr.newDoc.lineAt(fromB).number);
    to = Math.max(to, tr.newDoc.lineAt(toB).number);
  });
  const changes = renumberChanges(tr.state, from, to);
  return changes.length > 0 ? [tr, { changes, sequential: true }] : tr;
});

export default defineExtension({
  id: 'cascades.smart-lists',
  activate(ctx) {
    ctx.settings.register('smartLists', {
      languages: {
        type: 'array',
        default: ['plaintext', 'markdown'],
        description: 'Langages où les listes intelligentes sont actives.',
      },
      continue: {
        type: 'boolean',
        default: true,
        description: 'Entrée continue la liste, ou en sort sur une puce vide.',
      },
      tabIndents: {
        type: 'boolean',
        default: true,
        description: 'Tab et Shift+Tab changent le niveau d’une ligne de liste.',
      },
      renumber: {
        type: 'boolean',
        default: true,
        description: 'Renuméroter les listes numérotées après chaque modification.',
      },
    });

    const handle = ctx.editor.addExtension((tab) => {
      const get = <T>(key: string) => ctx.settings.get<T>(`smartLists.${key}`, tab.language);
      if (!get<string[]>('languages').includes(tab.language)) return [];
      const keys: KeyBinding[] = [];
      if (get<boolean>('continue')) keys.push({ key: 'Enter', run: run(continueList) });
      if (get<boolean>('tabIndents')) {
        keys.push({
          key: 'Tab',
          run: run((s) => indentList(s, 1)),
          shift: run((s) => indentList(s, -1)),
        });
      }
      const extensions: Extension[] = [Prec.highest(keymap.of(keys))];
      if (get<boolean>('renumber')) extensions.push(renumberOnEdit);
      return extensions;
    });

    ctx.settings.onDidChange(({ keys }) => {
      if (keys.some((k) => k.startsWith('smartLists.'))) handle.refresh();
    });

    ctx.commands.register(
      'editor.toggleTask',
      () => {
        const view = ctx.editor.view();
        return view ? run(toggleTask)(view) : false;
      },
      { title: 'Cocher / décocher la tâche', category: 'Éditeur' },
    );
    ctx.menus.registerItem('edit', { command: 'editor.toggleTask', group: '3_lines', order: 20 });
  },
});
