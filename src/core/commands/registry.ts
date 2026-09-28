import { toDisposable, type Disposable } from '../disposable';

export type CommandHandler = (...args: unknown[]) => unknown;

export interface CommandMeta {
  /** Human readable name shown in the palette. */
  title?: string;
  category?: string;
}

export interface CommandInfo extends CommandMeta {
  id: string;
}

export class CommandRegistry {
  private commands = new Map<string, { handler: CommandHandler; meta: CommandMeta }>();

  register(id: string, handler: CommandHandler, meta: CommandMeta = {}): Disposable {
    if (this.commands.has(id)) {
      throw new Error(`Command already registered: ${id}`);
    }
    const entry = { handler, meta };
    this.commands.set(id, entry);
    return toDisposable(() => {
      if (this.commands.get(id) === entry) this.commands.delete(id);
    });
  }

  has(id: string): boolean {
    return this.commands.has(id);
  }

  async execute(id: string, ...args: unknown[]): Promise<unknown> {
    const entry = this.commands.get(id);
    if (!entry) {
      throw new Error(`Unknown command: ${id}`);
    }
    return await entry.handler(...args);
  }

  list(): CommandInfo[] {
    return [...this.commands].map(([id, { meta }]) => ({ id, ...meta }));
  }
}
