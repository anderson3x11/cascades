import type { LayoutPart } from '../api';

/** Which parts of the window are shown, and zen mode. The UI reads this. */
export class LayoutModel {
  tabs = $state(true);
  /** Tabs in a row at the top, or in a column on the left that can fold to icons. */
  tabsPosition = $state<'top' | 'left'>('top');
  tabsCollapsed = $state(false);
  statusBar = $state(true);
  zen = $state(false);

  /** A part is shown when it is enabled and zen mode is off. */
  shows(part: LayoutPart): boolean {
    return this[part] && !this.zen;
  }
}
