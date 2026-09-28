export interface Disposable {
  dispose(): void;
}

export function toDisposable(fn: () => void): Disposable {
  let disposed = false;
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      fn();
    },
  };
}

/** Collects disposables and disposes them in reverse order. */
export class DisposableStore implements Disposable {
  private items: Disposable[] = [];
  private disposed = false;

  add<T extends Disposable>(item: T): T {
    if (this.disposed) {
      item.dispose();
    } else {
      this.items.push(item);
    }
    return item;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const errors: unknown[] = [];
    for (const item of this.items.reverse()) {
      try {
        item.dispose();
      } catch (err) {
        errors.push(err);
      }
    }
    this.items = [];
    if (errors.length > 0) {
      throw new AggregateError(errors, 'Errors while disposing');
    }
  }
}
