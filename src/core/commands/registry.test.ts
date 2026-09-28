import { describe, expect, it } from 'vitest';
import { CommandRegistry } from './registry';

describe('CommandRegistry', () => {
  it('registers, executes and lists commands', async () => {
    const reg = new CommandRegistry();
    reg.register('math.add', (a, b) => (a as number) + (b as number), { title: 'Add' });
    expect(await reg.execute('math.add', 1, 2)).toBe(3);
    expect(reg.list()).toEqual([{ id: 'math.add', title: 'Add' }]);
  });

  it('rejects duplicates and unknown ids', async () => {
    const reg = new CommandRegistry();
    reg.register('a', () => 0);
    expect(() => reg.register('a', () => 1)).toThrow();
    await expect(reg.execute('b')).rejects.toThrow('Unknown command');
  });

  it('unregisters on dispose', () => {
    const reg = new CommandRegistry();
    reg.register('a', () => 0).dispose();
    expect(reg.has('a')).toBe(false);
  });
});
