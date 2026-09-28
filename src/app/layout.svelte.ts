import type { LayoutPart } from '../api';

/** Which parts of the window are shown, and zen mode. The UI reads this. */
export class LayoutModel {
  menuBar = $state(true);
  tabs = $state(true);
  statusBar = $state(true);
  zen = $state(false);

  /** A part is shown when it is enabled and zen mode is off. */
  shows(part: LayoutPart): boolean {
    return this[part] && !this.zen;
  }
}
