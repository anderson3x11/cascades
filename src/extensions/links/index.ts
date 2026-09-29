import { EditorSelection, StateEffect, StateField, type Extension } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  MatchDecorator,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view';
import { defineExtension, t, type ExtensionContext, type TabInfo } from '../../api';
import { isUrl, linkAt, markdownLink, resolve, type FoundLink } from './links';

/** The link to underline while Ctrl is held over it, or null. */
const setHovered = StateEffect.define<{ from: number; to: number } | null>();
const hoverMark = Decoration.mark({ class: 'cm-ctrl-link' });

const hovered = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setHovered)) {
        return effect.value
          ? Decoration.set(hoverMark.range(effect.value.from, effect.value.to))
          : Decoration.none;
      }
    }
    return tr.docChanged ? Decoration.none : value;
  },
  provide: (field) => EditorView.decorations.from(field),
});

/** The link at a point of the window, with its range in the document. */
function linkAtCoords(view: EditorView, x: number, y: number): FoundLink | null {
  const pos = view.posAtCoords({ x, y });
  if (pos === null) return null;
  const line = view.state.doc.lineAt(pos);
  const link = linkAt(line.text, pos - line.from);
  return link && { ...link, from: line.from + link.from, to: line.from + link.to };
}

/** Web addresses underlined in plain text files, where no grammar colors them. */
const urlDecorator = new MatchDecorator({
  regexp: /\b(?:https?:\/\/|www\.)[^\s<>"'`]+[^\s<>"'`.,;:!?)]/g,
  decoration: Decoration.mark({ class: 'cm-url' }),
});
const plainTextUrls = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = urlDecorator.createDeco(view);
    }
    update(update: ViewUpdate) {
      this.decorations = urlDecorator.updateDeco(update, this.decorations);
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

const theme = EditorView.baseTheme({
  '.cm-url': { textDecoration: 'underline', textDecorationColor: 'var(--ui-border)' },
  '.cm-ctrl-link, .cm-ctrl-link *': {
    color: 'var(--syn-link) !important',
    textDecoration: 'underline',
    cursor: 'pointer',
  },
});

function followLinks(ctx: ExtensionContext, tab: TabInfo): Extension {
  const open = async (link: FoundLink) => {
    const destination = resolve(link.target, tab.path);
    if (!destination) return;
    if (destination.kind === 'url') {
      await ctx.app.openExternal(destination.url);
      return;
    }
    try {
      await ctx.commands.execute('file.openPath', destination.path);
    } catch {
      ctx.banners.show({
        kind: 'warning',
        message: t('File not found: {path}', { path: destination.path }),
        actions: [{ label: t('OK'), run: () => {} }],
      });
    }
  };

  const hover = (view: EditorView, link: FoundLink | null) => {
    const current = view.state.field(hovered).iter();
    const same = link
      ? current.value && current.from === link.from && current.to === link.to
      : !current.value;
    if (!same) view.dispatch({ effects: setHovered.of(link && { from: link.from, to: link.to }) });
  };

  let last: { x: number; y: number } | null = null;
  return [
    hovered,
    EditorView.domEventHandlers({
      mousedown(event, view) {
        if (!(event.ctrlKey || event.metaKey) || event.button !== 0) return false;
        const link = linkAtCoords(view, event.clientX, event.clientY);
        if (!link) return false;
        // Ctrl+click on a link opens it instead of adding a cursor.
        event.preventDefault();
        void open(link);
        return true;
      },
      mousemove(event, view) {
        last = { x: event.clientX, y: event.clientY };
        hover(
          view,
          event.ctrlKey || event.metaKey ? linkAtCoords(view, event.clientX, event.clientY) : null,
        );
        return false;
      },
      mouseleave(_event, view) {
        last = null;
        hover(view, null);
        return false;
      },
      keydown(event, view) {
        if (event.key === 'Control' && last) hover(view, linkAtCoords(view, last.x, last.y));
        return false;
      },
      keyup(event, view) {
        if (event.key === 'Control') hover(view, null);
        return false;
      },
    }),
  ];
}

/** Pasting one web address over selected text makes a Markdown link of it. */
const pasteAsLink = EditorView.domEventHandlers({
  paste(event, view) {
    const text = event.clipboardData?.getData('text/plain').trim() ?? '';
    const ranges = view.state.selection.ranges;
    if (!isUrl(text) || ranges.some((r) => r.empty || view.state.doc.lineAt(r.from).to < r.to)) {
      return false;
    }
    event.preventDefault();
    view.dispatch(
      view.state.changeByRange((range) => {
        const insert = markdownLink(view.state.sliceDoc(range.from, range.to), text);
        return {
          changes: { from: range.from, to: range.to, insert },
          range: EditorSelection.cursor(range.from + insert.length),
        };
      }),
      { userEvent: 'input.paste' },
    );
    return true;
  },
});

export default defineExtension({
  id: 'cascades.links',
  activate(ctx) {
    ctx.settings.register('links', {
      ctrlClick: {
        type: 'boolean',
        default: true,
        description: t('Ctrl+click opens a link: a web address in the browser, a file in a tab.'),
      },
      pasteAsMarkdown: {
        type: 'boolean',
        default: true,
        description: t(
          'In Markdown, pasting a web address over selected text makes it a link [text](address).',
        ),
      },
    });

    const handle = ctx.editor.addExtension((tab) => {
      const get = (key: string) => ctx.settings.get<boolean>(`links.${key}`, tab.language);
      return [
        theme,
        tab.language === 'plaintext' ? plainTextUrls : [],
        get('ctrlClick') ? followLinks(ctx, tab) : [],
        get('pasteAsMarkdown') && tab.language === 'markdown' ? pasteAsLink : [],
      ];
    });
    ctx.settings.onDidChange(({ keys }) => {
      if (keys.some((k) => k.startsWith('links.'))) handle.refresh();
    });
  },
});
