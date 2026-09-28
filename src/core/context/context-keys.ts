import { Emitter } from '../events/emitter';
import type { ContextValue } from './when';

/** Global state flags that `when` clauses are evaluated against (focus, mode, open panels...). */
export class ContextKeys {
  private values = new Map<string, ContextValue>();
  readonly onDidChange = new Emitter<string>();

  get = (key: string): ContextValue => this.values.get(key);

  set(key: string, value: ContextValue): void {
    if (this.values.get(key) === value) return;
    if (value === undefined) {
      this.values.delete(key);
    } else {
      this.values.set(key, value);
    }
    this.onDidChange.fire(key);
  }
}
