import type { QuickPickItem, QuickPickOptions } from '../api';

interface Session {
  items: QuickPickItem<unknown>[];
  options: QuickPickOptions<unknown>;
  resolve: (value: unknown) => void;
}

/** The one quick pick shown at a time. Opening another cancels the current one. */
export class QuickPickModel {
  // Raw: the items (thousands of files) need no deep reactivity, the session is replaced.
  session = $state.raw<Session | null>(null);

  show<T>(items: QuickPickItem<T>[], options: QuickPickOptions<T> = {}): Promise<T | undefined> {
    this.close(undefined);
    return new Promise<T | undefined>((resolve) => {
      const session: Session = {
        items: items as QuickPickItem<unknown>[],
        options: options as QuickPickOptions<unknown>,
        resolve: resolve as (value: unknown) => void,
      };
      this.session = session;
      void options.more?.then((more) => {
        // Only if this list is still the one shown.
        if (this.session?.resolve === session.resolve) {
          this.session = {
            ...session,
            items: [...session.items, ...more] as QuickPickItem<unknown>[],
          };
        }
      });
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
