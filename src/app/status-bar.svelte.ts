import type { StatusItem, StatusItemOptions, StatusMenu } from '../api';
import { Emitter } from '../core/events/emitter';

export class StatusBarItem implements StatusItem {
  readonly id: string;
  readonly alignment: 'left' | 'center' | 'right';
  readonly priority: number;
  readonly command: string | undefined;
  readonly menu: (() => StatusMenu) | undefined;
  readonly icon: string | undefined;
  readonly label: string;
  text = $state('');
  tooltip = $state('');
  visible = $state(true);

  constructor(
    options: StatusItemOptions,
    private readonly remove: (item: StatusBarItem) => void,
  ) {
    this.id = options.id;
    this.alignment = options.alignment;
    this.priority = options.priority ?? 0;
    this.command = options.command;
    this.menu = options.menu;
    this.icon = options.icon;
    this.label = options.label ?? options.id;
  }

  dispose(): void {
    this.remove(this);
  }
}

export class StatusBarModel {
  items = $state<StatusBarItem[]>([]);
  /** An item with a menu was clicked: its menu shows in the side panel. */
  readonly onDidRequestMenu = new Emitter<string>();

  addItem(options: StatusItemOptions): StatusBarItem {
    const item = new StatusBarItem(options, (i) => {
      this.items = this.items.filter((x) => x !== i);
    });
    this.items = [...this.items, item].sort((a, b) => b.priority - a.priority);
    return item;
  }
}
