import { RangeSet, RangeSetBuilder, Text } from '@codemirror/state';
import { EditorView, gutter, GutterMarker, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import {
  defineExtension,
  t,
  type Disposable,
  type ExtensionContext,
  type TabInfo,
} from '../../api';
import { changedLines, type ChangeKind } from './changes';

/** Waits for a pause in typing before comparing with the saved text. */
const DELAY_MS = 300;

class ChangeMarker extends GutterMarker {
  override elementClass: string;
  constructor(readonly kind: ChangeKind) {
    super();
    this.elementClass = `cm-change-${kind}`;
  }
  override eq(other: GutterMarker) {
    return other instanceof ChangeMarker && other.kind === this.kind;
  }
}
const MARKERS: Record<ChangeKind, ChangeMarker> = {
  added: new ChangeMarker('added'),
  modified: new ChangeMarker('modified'),
  deleted: new ChangeMarker('deleted'),
};

/** Lines changed since the last save, as marks in the margin (like Notepad++). */
function changeMarkers(ctx: ExtensionContext, tab: TabInfo) {
  const plugin = ViewPlugin.fromClass(
    class {
      markers: RangeSet<ChangeMarker> = RangeSet.empty;
      private timer: ReturnType<typeof setTimeout> | undefined;
      private listeners: Disposable[];

      constructor(private view: EditorView) {
        this.compute();
        // Saving or reloading changes what the text is compared with.
        const again = (changed: TabInfo) => {
          if (changed.documentId === tab.documentId) this.schedule(0);
        };
        this.listeners = [
          ctx.events.on('workspace.didSave', again),
          ctx.events.on('workspace.didChangeTab', again),
        ];
      }

      update(update: ViewUpdate) {
        if (update.docChanged) {
          // Keep the marks in place while typing, until the next comparison.
          this.markers = this.markers.map(update.changes);
          this.schedule(DELAY_MS);
        }
      }

      destroy() {
        clearTimeout(this.timer);
        for (const listener of this.listeners) listener.dispose();
      }

      private schedule(delay: number) {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => {
          this.compute();
          // Redraw the gutter: an empty transaction is enough.
          this.view.dispatch({});
        }, delay);
      }

      private compute() {
        let saved: string;
        try {
          saved = ctx.workspace.savedText(tab.id);
        } catch {
          return; // The tab is closing.
        }
        const doc = this.view.state.doc;
        const lines = changedLines(Text.of(saved.split('\n')), doc);
        const builder = new RangeSetBuilder<ChangeMarker>();
        for (const n of [...lines.keys()].sort((a, b) => a - b)) {
          const from = doc.line(n).from;
          builder.add(from, from, MARKERS[lines.get(n) as ChangeKind]);
        }
        this.markers = builder.finish();
      }
    },
  );
  return [
    plugin,
    gutter({
      class: 'cm-change-gutter',
      markers: (view) => view.plugin(plugin)?.markers ?? RangeSet.empty,
    }),
    EditorView.baseTheme({
      '.cm-change-gutter': { width: '3px', marginRight: '2px' },
      '.cm-change-gutter .cm-change-added': { background: 'var(--change-added)' },
      '.cm-change-gutter .cm-change-modified': { background: 'var(--change-modified)' },
      // Lines removed here: a small triangle at the top of the line.
      '.cm-change-gutter .cm-change-deleted': {
        background:
          'linear-gradient(135deg, var(--change-deleted) 0 45%, transparent 45%) no-repeat 0 0 / 6px 6px',
        overflow: 'visible',
      },
    }),
  ];
}

export default defineExtension({
  id: 'cascades.change-markers',
  activate(ctx) {
    ctx.settings.register('changeMarkers', {
      enabled: {
        type: 'boolean',
        default: true,
        description: t(
          'Mark the lines changed since the last save in the margin: green added, orange changed, red deleted.',
        ),
      },
    });
    const handle = ctx.editor.addExtension((tab) =>
      ctx.settings.get<boolean>('changeMarkers.enabled', tab.language) && !tab.viewer && !tab.large
        ? changeMarkers(ctx, tab)
        : [],
    );
    ctx.settings.onDidChange(({ keys }) => {
      if (keys.includes('changeMarkers.enabled')) handle.refresh();
    });
  },
});
