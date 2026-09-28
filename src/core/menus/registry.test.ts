import { describe, expect, it, vi } from 'vitest';
import { MenuRegistry, type MenuEntry } from './registry';

const labels = (entries: MenuEntry[]) =>
  entries.map((e) => (e.kind === 'separator' ? '---' : e.item.command));

describe('MenuRegistry', () => {
  it('orders menus in the bar', () => {
    const reg = new MenuRegistry();
    reg.registerMenu({ id: 'edit', title: 'Édition', order: 20 });
    reg.registerMenu({ id: 'file', title: 'Fichier', order: 10 });
    expect(reg.bar().map((m) => m.id)).toEqual(['file', 'edit']);
  });

  it('sorts items by group then order, with separators between groups', () => {
    const reg = new MenuRegistry();
    reg.registerItem('file', { command: 'file.save', group: '2_save', order: 1 });
    reg.registerItem('file', { command: 'file.open', group: '1_new', order: 2 });
    reg.registerItem('file', { command: 'file.new', group: '1_new', order: 1 });
    reg.registerItem('file', { command: 'tabs.close', group: '3_close' });
    expect(labels(reg.entries('file'))).toEqual([
      'file.new',
      'file.open',
      '---',
      'file.save',
      '---',
      'tabs.close',
    ]);
  });

  it('keeps registration order for equal positions', () => {
    const reg = new MenuRegistry();
    reg.registerItem('m', { command: 'a' });
    reg.registerItem('m', { command: 'b' });
    expect(labels(reg.entries('m'))).toEqual(['a', 'b']);
  });

  it('removes menus and items on dispose and notifies', () => {
    const reg = new MenuRegistry();
    const listener = vi.fn();
    reg.onDidChange.on(listener);
    const menu = reg.registerMenu({ id: 'file', title: 'Fichier' });
    const item = reg.registerItem('file', { command: 'file.new' });
    item.dispose();
    menu.dispose();
    expect(reg.bar()).toEqual([]);
    expect(reg.entries('file')).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(4);
  });

  it('refuses duplicate menu ids', () => {
    const reg = new MenuRegistry();
    reg.registerMenu({ id: 'file', title: 'Fichier' });
    expect(() => reg.registerMenu({ id: 'file', title: 'Autre' })).toThrow();
  });
});
