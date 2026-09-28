import type { PanelSpec } from '../api';
import { toDisposable, type Disposable } from '../core/disposable';

/** Side panels, and the one shown (at most one at a time). */
export class PanelModel {
  specs = $state<PanelSpec[]>([]);
  visible = $state<string | null>(null);

  register(panel: PanelSpec): Disposable {
    this.specs = [...this.specs, panel];
    return toDisposable(() => {
      this.specs = this.specs.filter((p) => p !== panel);
      if (this.visible === panel.id) this.visible = null;
    });
  }

  current(): PanelSpec | null {
    return this.specs.find((p) => p.id === this.visible) ?? null;
  }

  show(id: string): void {
    if (this.specs.some((p) => p.id === id)) this.visible = id;
  }

  hide(id: string): void {
    if (this.visible === id) this.visible = null;
  }

  toggle(id: string): void {
    if (this.visible === id) this.hide(id);
    else this.show(id);
  }
}
