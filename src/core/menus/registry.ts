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

/** Name and icon of a group of items, shown as a sub-menu that unfolds. */
export interface MenuGroupSpec {
  /** The `group` key of its items ("2_save"). */
  id: string;
  title: string;
  /** The "d" of an SVG path on a 24×24 grid, 2 px stroke (Lucide icons fit). */
  icon?: string;
}

/** The items of one group, in order, with its name when it has one. */
export interface MenuSection {
  group: string;
  spec: MenuGroupSpec | undefined;
  items: MenuItemSpec[];
}

interface ItemRecord {
  menuId: string;
  item: MenuItemSpec;
  seq: number;
}

export class MenuRegistry {
  private menus: MenuSpec[] = [];
  private items: ItemRecord[] = [];
  private groups: { menuId: string; spec: MenuGroupSpec }[] = [];
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

  /** Names a group of a menu; it may be registered before the menu or its items. */
  registerGroup(menuId: string, spec: MenuGroupSpec): Disposable {
    const record = { menuId, spec };
    this.groups.push(record);
    this.onDidChange.fire();
    return toDisposable(() => {
      this.groups = this.groups.filter((g) => g !== record);
      this.onDidChange.fire();
    });
  }

  /** Registered menus in menu bar order. */
  bar(): MenuSpec[] {
    return [...this.menus].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  /** Items of a menu by group, groups sorted by key and items by order. */
  sections(menuId: string): MenuSection[] {
    const sorted = this.items
      .filter((r) => r.menuId === menuId)
      .sort(
        (a, b) =>
          (a.item.group ?? '').localeCompare(b.item.group ?? '') ||
          (a.item.order ?? 0) - (b.item.order ?? 0) ||
          a.seq - b.seq,
      );
    const sections: MenuSection[] = [];
    for (const { item } of sorted) {
      const group = item.group ?? '';
      let section = sections.at(-1);
      if (section?.group !== group) {
        const spec = this.groups.find((g) => g.menuId === menuId && g.spec.id === group)?.spec;
        section = { group, spec, items: [] };
        sections.push(section);
      }
      section.items.push(item);
    }
    return sections;
  }
}
