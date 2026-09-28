import { toDisposable, type Disposable } from '../disposable';
import { Emitter } from '../events/emitter';

export interface MenuSpec {
  id: string;
  title: string;
  /** Position in the menu bar, lower first. */
  order?: number;
}

export interface MenuItemSpec {
  command: string;
  /** Defaults to the command title. */
  title?: string;
  /** Items are grouped by this key (sorted as strings, e.g. "1_new"), with separators between groups. */
  group?: string;
  /** Position inside the group, lower first. */
  order?: number;
}

export type MenuEntry = { kind: 'item'; item: MenuItemSpec } | { kind: 'separator' };

interface ItemRecord {
  menuId: string;
  item: MenuItemSpec;
  seq: number;
}

export class MenuRegistry {
  private menus: MenuSpec[] = [];
  private items: ItemRecord[] = [];
  private seq = 0;
  readonly onDidChange = new Emitter<void>();

  registerMenu(spec: MenuSpec): Disposable {
    if (this.menus.some((m) => m.id === spec.id)) {
      throw new Error(`Menu already registered: ${spec.id}`);
    }
    this.menus.push(spec);
    this.onDidChange.fire();
    return toDisposable(() => {
      this.menus = this.menus.filter((m) => m !== spec);
      this.onDidChange.fire();
    });
  }

  /** Items may be added before their menu is registered. */
  registerItem(menuId: string, item: MenuItemSpec): Disposable {
    const record = { menuId, item, seq: this.seq++ };
    this.items.push(record);
    this.onDidChange.fire();
    return toDisposable(() => {
      this.items = this.items.filter((r) => r !== record);
      this.onDidChange.fire();
    });
  }

  /** Registered menus in menu bar order. */
  bar(): MenuSpec[] {
    return [...this.menus].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  /** Items of a menu, sorted, with separators between groups. */
  entries(menuId: string): MenuEntry[] {
    const sorted = this.items
      .filter((r) => r.menuId === menuId)
      .sort(
        (a, b) =>
          (a.item.group ?? '').localeCompare(b.item.group ?? '') ||
          (a.item.order ?? 0) - (b.item.order ?? 0) ||
          a.seq - b.seq,
      );
    const entries: MenuEntry[] = [];
    let group: string | undefined;
    for (const [i, record] of sorted.entries()) {
      const g = record.item.group ?? '';
      if (i > 0 && g !== group) entries.push({ kind: 'separator' });
      group = g;
      entries.push({ kind: 'item', item: record.item });
    }
    return entries;
  }
}
