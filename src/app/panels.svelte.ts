import type { PanelSide, PanelSpec } from '../api';
import { toDisposable, type Disposable } from '../core/disposable';

const sideOf = (panel: PanelSpec): PanelSide => panel.side ?? 'right';

/** Side panels, and the one shown on each side (at most one per side). */
export class PanelModel {
  specs = $state<PanelSpec[]>([]);
  visible = $state<Record<PanelSide, string | null>>({ left: null, right: null });
  /** Last panel shown on each side, shown again when the side is toggled. */
  private last: Record<PanelSide, string | null> = { left: null, right: null };

  register(panel: PanelSpec): Disposable {
    this.specs = [...this.specs, panel];
    return toDisposable(() => {
      this.specs = this.specs.filter((p) => p !== panel);
      this.hide(panel.id);
    });
  }

  /** Panels of one side, in registration order. */
  of(side: PanelSide): PanelSpec[] {
    return this.specs.filter((p) => sideOf(p) === side);
  }

  current(side: PanelSide): PanelSpec | null {
    return this.specs.find((p) => p.id === this.visible[side]) ?? null;
  }

  isVisible(id: string): boolean {
    return this.visible.left === id || this.visible.right === id;
  }

  show(id: string): void {
    const panel = this.specs.find((p) => p.id === id);
    if (!panel) return;
    const side = sideOf(panel);
    this.visible[side] = id;
    this.last[side] = id;
  }

  hide(id: string): void {
    if (this.visible.left === id) this.visible.left = null;
    if (this.visible.right === id) this.visible.right = null;
  }

  toggle(id: string): void {
    if (this.isVisible(id)) this.hide(id);
    else this.show(id);
  }

  /** Hides the side, or shows its last panel again. */
  toggleSide(side: PanelSide): void {
    if (this.visible[side]) {
      this.visible[side] = null;
      return;
    }
    const last = this.of(side).find((p) => p.id === this.last[side]) ?? this.of(side)[0];
    if (last) this.show(last.id);
  }
}
