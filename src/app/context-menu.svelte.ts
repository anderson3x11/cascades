import type { ContextMenuItem, ContextMenuOptions } from '../api';

/** The right-click menu shown, at most one. */
export class ContextMenuModel {
  current = $state<{
    x: number;
    y: number;
    items: ContextMenuItem[];
    options: ContextMenuOptions;
  } | null>(null);

  show(
    position: { x: number; y: number },
    items: ContextMenuItem[],
    options: ContextMenuOptions = {},
  ): void {
    this.close();
    this.current = { ...position, items, options };
  }

  /** `chosen` is false when the menu is dismissed (Escape, click outside). */
  close(chosen = false): void {
    const closing = this.current;
    this.current = null;
    if (closing && !chosen) closing.options.onCancel?.();
  }
}
