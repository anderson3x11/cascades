import { toDisposable, type Disposable } from '../disposable';

export type Listener<T> = (event: T) => void;

export class Emitter<T> {
  private listeners = new Set<Listener<T>>();

  on(listener: Listener<T>): Disposable {
    this.listeners.add(listener);
    return toDisposable(() => this.listeners.delete(listener));
  }

  fire(event: T): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch (err) {
        console.error('[cascades] event listener failed', err);
      }
    }
  }
}

/** Named, typed events. The event map is extended by the app (see api/events). */
export class EventBus<M extends object> {
  private emitters = new Map<keyof M, Emitter<unknown>>();

  on<K extends keyof M>(name: K, listener: Listener<M[K]>): Disposable {
    return this.emitter(name).on(listener as Listener<unknown>);
  }

  emit<K extends keyof M>(name: K, payload: M[K]): void {
    this.emitters.get(name)?.fire(payload);
  }

  private emitter(name: keyof M): Emitter<unknown> {
    let emitter = this.emitters.get(name);
    if (!emitter) {
      emitter = new Emitter<unknown>();
      this.emitters.set(name, emitter);
    }
    return emitter;
  }
}
