import type { PreviewMode, TabInfo, ViewerFactory, ViewerSpec } from '../api';
import { toDisposable, type Disposable } from '../core/disposable';

function extensionOf(path: string | null): string | null {
  const name = path?.split(/[\\/]/).pop() ?? '';
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : null;
}

/** Registered viewers, their loaded factories, and the preview mode of each tab. */
export class ViewerService {
  private viewers: ViewerSpec[] = [];
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- a load cache, never displayed
  private factories = new Map<string, Promise<ViewerFactory>>();
  /** Preview mode by tab id; absent means off. */
  modes = $state<Record<string, PreviewMode>>({});
  /** Share of the width given to the editor when the preview is beside it. */
  split = $state(0.5);
  /** Bumped when viewers change, so the UI re-evaluates which one applies. */
  version = $state(0);

  register(viewer: ViewerSpec): Disposable {
    this.viewers.push(viewer);
    this.version++;
    return toDisposable(() => {
      this.viewers = this.viewers.filter((v) => v !== viewer);
      this.factories.delete(viewer.id);
      this.version++;
    });
  }

  get(id: string): ViewerSpec | undefined {
    return this.viewers.find((v) => v.id === id);
  }

  /** Last registered wins, so plugins can override the built-in viewers. */
  previewFor(tab: TabInfo): ViewerSpec | null {
    const ext = extensionOf(tab.path);
    const candidates = this.viewers.filter((v) => v.kind === 'preview');
    for (let i = candidates.length - 1; i >= 0; i--) {
      const v = candidates[i] as ViewerSpec;
      if ((ext && v.extensions.includes(ext)) || v.languages?.includes(tab.language)) return v;
    }
    return null;
  }

  replaceFor(path: string): ViewerSpec | null {
    const ext = extensionOf(path);
    if (!ext) return null;
    const candidates = this.viewers.filter(
      (v) => v.kind === 'replace' && v.extensions.includes(ext),
    );
    return candidates[candidates.length - 1] ?? null;
  }

  /** Last registered wins, like replaceFor. */
  binaryViewer(): ViewerSpec | null {
    return this.viewers.filter((v) => v.kind === 'replace' && v.binary).at(-1) ?? null;
  }

  /** Loads a viewer once; later calls share the same promise. */
  load(spec: ViewerSpec): Promise<ViewerFactory> {
    let factory = this.factories.get(spec.id);
    if (!factory) {
      factory = spec.load();
      this.factories.set(spec.id, factory);
      // A failed load can be retried later.
      factory.catch(() => this.factories.delete(spec.id));
    }
    return factory;
  }

  previewMode(tabId: string): PreviewMode {
    return this.modes[tabId] ?? 'off';
  }

  setPreviewMode(tabId: string, mode: PreviewMode): void {
    if (mode === 'off') {
      this.modes = Object.fromEntries(Object.entries(this.modes).filter(([id]) => id !== tabId));
    } else {
      this.modes = { ...this.modes, [tabId]: mode };
    }
  }
}
