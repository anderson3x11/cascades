import { describe, expect, it } from 'vitest';
import type { ContextValue } from '../context/when';
import { KeybindingRegistry } from './registry';

const none = (): ContextValue => undefined;

describe('KeybindingRegistry', () => {
  it('matches a single chord', () => {
    const reg = new KeybindingRegistry();
    reg.register({ key: 'Ctrl+S', command: 'file.save' });
    const res = reg.resolve('ctrl+s', none);
    expect(res.kind === 'match' && res.binding.command).toBe('file.save');
  });

  it('resolves multi-chord sequences', () => {
    const reg = new KeybindingRegistry();
    reg.register({ key: 'Ctrl+K Z', command: 'view.zen' });
    expect(reg.resolve('ctrl+k', none).kind).toBe('pending');
    const res = reg.resolve('z', none);
    expect(res.kind === 'match' && res.binding.command).toBe('view.zen');
    expect(reg.pendingChords).toEqual([]);
  });

  it('resets after a wrong chord in a sequence', () => {
    const reg = new KeybindingRegistry();
    reg.register({ key: 'Ctrl+K Z', command: 'view.zen' });
    reg.resolve('ctrl+k', none);
    expect(reg.resolve('x', none).kind).toBe('none');
    expect(reg.pendingChords).toEqual([]);
  });

  it('lets the last registered binding win', () => {
    const reg = new KeybindingRegistry();
    reg.register({ key: 'Ctrl+D', command: 'default.cmd' });
    reg.register({ key: 'Ctrl+D', command: 'user.cmd' });
    const res = reg.resolve('ctrl+d', none);
    expect(res.kind === 'match' && res.binding.command).toBe('user.cmd');
  });

  it('filters by when clause', () => {
    const reg = new KeybindingRegistry();
    reg.register({ key: 'Escape', command: 'preview.close', when: 'previewOpen' });
    expect(reg.resolve('escape', none).kind).toBe('none');
    const res = reg.resolve('escape', (k) => k === 'previewOpen');
    expect(res.kind).toBe('match');
  });

  it('supports modes through context keys', () => {
    const reg = new KeybindingRegistry();
    reg.register({ key: 'X', command: 'vim.delete', when: "vim.mode == 'normal'" });
    const insert = (k: string) => (k === 'vim.mode' ? 'insert' : undefined);
    const normal = (k: string) => (k === 'vim.mode' ? 'normal' : undefined);
    expect(reg.resolve('x', insert).kind).toBe('none');
    expect(reg.resolve('x', normal).kind).toBe('match');
  });

  it('removes a binding on dispose', () => {
    const reg = new KeybindingRegistry();
    const d = reg.register({ key: 'Ctrl+S', command: 'file.save' });
    d.dispose();
    expect(reg.resolve('ctrl+s', none).kind).toBe('none');
  });

  it('resolves "Leader" to the configured chord', () => {
    const reg = new KeybindingRegistry();
    reg.register({ key: 'Leader Z', command: 'view.toggleZen' });
    expect(reg.resolve('ctrl+space', none).kind).toBe('pending');
    const res = reg.resolve('z', none);
    expect(res.kind === 'match' && res.binding.chords).toEqual(['ctrl+space', 'z']);

    reg.setLeader('Alt+Space');
    expect(reg.resolve('ctrl+space', none).kind).toBe('none');
    expect(reg.resolve('alt+space', none).kind).toBe('pending');
    expect(reg.forCommand('view.toggleZen')[0]?.chords).toEqual(['alt+space', 'z']);
  });

  it('lists the keys that can follow a pending sequence', () => {
    const reg = new KeybindingRegistry();
    reg.register({ key: 'Leader Z', command: 'view.toggleZen' });
    reg.register({ key: 'Leader T', command: 'view.selectTheme' });
    reg.register({ key: 'Leader G S', command: 'git.status' });
    reg.register({ key: 'Leader X', command: 'hidden', when: 'never' });
    reg.register({ key: 'Ctrl+S', command: 'file.save' });
    reg.resolve('ctrl+space', none);
    expect(reg.continuations(none)).toEqual([
      { chord: 'g', command: 'git.status', prefix: true },
      { chord: 't', command: 'view.selectTheme', prefix: false },
      { chord: 'z', command: 'view.toggleZen', prefix: false },
    ]);
  });

  it('lists bindings for a command, most recent first', () => {
    const reg = new KeybindingRegistry();
    reg.register({ key: 'Ctrl+S', command: 'file.save' });
    reg.register({ key: 'Ctrl+K S', command: 'file.save' });
    expect(reg.forCommand('file.save').map((b) => b.chords)).toEqual([['ctrl+k', 's'], ['ctrl+s']]);
  });
});
