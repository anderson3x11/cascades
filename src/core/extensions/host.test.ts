import { describe, expect, it, vi } from 'vitest';
import { CommandRegistry } from '../commands/registry';
import type { DisposableStore } from '../disposable';
import { ExtensionHost } from './host';

interface Ctx {
  registerCommand(id: string, fn: () => unknown): void;
}

function setup() {
  const commands = new CommandRegistry();
  const host = new ExtensionHost<Ctx>((_id, subs: DisposableStore) => ({
    registerCommand: (id, fn) => subs.add(commands.register(id, fn)),
  }));
  return { commands, host };
}

describe('ExtensionHost', () => {
  it('activates an extension with its context', async () => {
    const { commands, host } = setup();
    await host.activate({
      id: 'test',
      activate: (ctx) => ctx.registerCommand('test.hello', () => 'hi'),
    });
    expect(host.isActive('test')).toBe(true);
    expect(await commands.execute('test.hello')).toBe('hi');
  });

  it('removes everything an extension registered on deactivate', async () => {
    const { commands, host } = setup();
    const deactivate = vi.fn();
    await host.activate({
      id: 'test',
      activate: (ctx) => ctx.registerCommand('test.hello', () => 'hi'),
      deactivate,
    });
    host.deactivate('test');
    expect(deactivate).toHaveBeenCalledOnce();
    expect(commands.has('test.hello')).toBe(false);
    expect(host.isActive('test')).toBe(false);
  });

  it('rolls back a failed activation', async () => {
    const { commands, host } = setup();
    await expect(
      host.activate({
        id: 'broken',
        activate: (ctx) => {
          ctx.registerCommand('broken.cmd', () => 0);
          throw new Error('boom');
        },
      }),
    ).rejects.toThrow('broken');
    expect(commands.has('broken.cmd')).toBe(false);
    expect(host.isActive('broken')).toBe(false);
  });

  it('refuses to activate the same id twice', async () => {
    const { host } = setup();
    await host.activate({ id: 'a', activate: () => {} });
    await expect(host.activate({ id: 'a', activate: () => {} })).rejects.toThrow();
  });
});
