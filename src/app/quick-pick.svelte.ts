import type { QuickPickItem, QuickPickOptions } from '../api';

interface Session {
  items: QuickPickItem<unknown>[];
  options: QuickPickOptions<unknown>;
  resolve: (value: unknown) => void;
}

/** The one quick pick shown at a time. Opening another cancels the current one. */
export class QuickPickModel {
  session = $state<Session | null>(null);

  show<T>(items: QuickPickItem<T>[], options: QuickPickOptions<T> = {}): Promise<T | undefined> {
    this.close(undefined);
    return new Promise<T | undefined>((resolve) => {
      this.session = {
        items: items as QuickPickItem<unknown>[],
        options: options as QuickPickOptions<unknown>,
        resolve: resolve as (value: unknown) => void,
      };
    });
  }

  /** Closes with a value, or undefined to cancel. */
  close(value: unknown): void {
    const session = this.session;
    if (!session) return;
    this.session = null;
    session.resolve(value);
  }
}
