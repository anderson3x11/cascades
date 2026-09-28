import { DisposableStore } from '../disposable';

export interface ExtensionModule<C> {
  /** Unique id, e.g. "cascades.tabs" or "user.init". */
  id: string;
  activate(ctx: C): void | Promise<void>;
  deactivate?(): void;
}

interface Active<C> {
  module: ExtensionModule<C>;
  subscriptions: DisposableStore;
}

/**
 * Activates extensions with a context built for each one. Everything an
 * extension registers through its context is tied to its subscriptions, so
 * deactivating it removes every command, binding, setting and listener it added.
 */
export class ExtensionHost<C> {
  private active = new Map<string, Active<C>>();

  constructor(private createContext: (id: string, subscriptions: DisposableStore) => C) {}

  async activate(module: ExtensionModule<C>): Promise<void> {
    if (this.active.has(module.id)) {
      throw new Error(`Extension already active: ${module.id}`);
    }
    const subscriptions = new DisposableStore();
    const record = { module, subscriptions };
    this.active.set(module.id, record);
    try {
      await module.activate(this.createContext(module.id, subscriptions));
    } catch (err) {
      this.active.delete(module.id);
      subscriptions.dispose();
      throw new Error(`Failed to activate extension ${module.id}`, { cause: err });
    }
  }

  deactivate(id: string): void {
    const record = this.active.get(id);
    if (!record) return;
    this.active.delete(id);
    try {
      record.module.deactivate?.();
    } finally {
      record.subscriptions.dispose();
    }
  }

  isActive(id: string): boolean {
    return this.active.has(id);
  }

  activeIds(): string[] {
    return [...this.active.keys()];
  }

  deactivateAll(): void {
    for (const id of [...this.active.keys()].reverse()) this.deactivate(id);
  }
}
