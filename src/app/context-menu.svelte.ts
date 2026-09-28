import type { ContextMenuItem } from '../api';

/** The right-click menu shown, at most one. */
export class ContextMenuModel {
  current = $state<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);

  show(position: { x: number; y: number }, items: ContextMenuItem[]): void {
    this.current = { ...position, items };
  }

  close(): void {
    this.current = null;
  }
}
