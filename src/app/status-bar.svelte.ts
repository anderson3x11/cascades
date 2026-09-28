import type { StatusItem, StatusItemOptions } from '../api';

export class StatusBarItem implements StatusItem {
  readonly id: string;
  readonly alignment: 'left' | 'right';
  readonly priority: number;
  readonly command: string | undefined;
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
  }

  dispose(): void {
    this.remove(this);
  }
}

export class StatusBarModel {
  items = $state<StatusBarItem[]>([]);

  addItem(options: StatusItemOptions): StatusBarItem {
    const item = new StatusBarItem(options, (i) => {
      this.items = this.items.filter((x) => x !== i);
    });
    this.items = [...this.items, item].sort((a, b) => b.priority - a.priority);
    return item;
  }
}
