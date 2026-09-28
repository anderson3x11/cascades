import { toDisposable, type Disposable } from '../core/disposable';
import { Emitter } from '../core/events/emitter';
import type { Theme } from '../core/themes/theme';

/**
 * Registered themes, and the one applied to the page: the data-theme-type
 * attribute picks the base palette, the theme's colors are set as CSS
 * variables on top of it.
 */
export class ThemeService {
  private themes = new Map<string, Theme>();
  private applied: Theme | null = null;
  private appliedKeys: string[] = [];
  readonly onDidChange = new Emitter<void>();

  constructor(private readonly root: HTMLElement = document.documentElement) {}

  /** Registering an id again replaces the theme (and re-applies it if current). */
  register(theme: Theme): Disposable {
    this.themes.set(theme.id, theme);
    if (this.applied?.id === theme.id) this.apply(theme.id);
    this.onDidChange.fire();
    return toDisposable(() => {
      if (this.themes.get(theme.id) === theme) this.themes.delete(theme.id);
      this.onDidChange.fire();
    });
  }

  get(id: string): Theme | undefined {
    return this.themes.get(id);
  }

  list(): Theme[] {
    return [...this.themes.values()];
  }

  current(): Theme | null {
    return this.applied;
  }

  /** Returns false when the id is unknown (nothing changes then). */
  apply(id: string): boolean {
    const theme = this.themes.get(id);
    if (!theme) return false;
    for (const key of this.appliedKeys) this.root.style.removeProperty(`--${key}`);
    this.root.dataset.themeType = theme.type;
    for (const [key, value] of Object.entries(theme.colors)) {
      this.root.style.setProperty(`--${key}`, value);
    }
    this.appliedKeys = Object.keys(theme.colors);
    this.applied = theme;
    this.onDidChange.fire();
    return true;
  }
}
