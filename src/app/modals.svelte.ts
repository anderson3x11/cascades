import type { ModalSpec } from '../api';
import { toDisposable, type Disposable } from '../core/disposable';

/** The modal window shown over the app, at most one at a time. */
export class ModalModel {
  current = $state<ModalSpec | null>(null);

  show(modal: ModalSpec): Disposable {
    this.current = modal;
    return toDisposable(() => {
      if (this.current === modal) this.current = null;
    });
  }

  close(): void {
    this.current = null;
  }
}
