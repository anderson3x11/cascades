import { describe, expect, it, vi } from 'vitest';
import { MenuRegistry, type MenuSection } from './registry';

const labels = (sections: MenuSection[]) => sections.map((s) => s.items.map((i) => i.command));

describe('MenuRegistry', () => {
  it('orders menus in the bar', () => {
    const reg = new MenuRegistry();
    reg.registerMenu({ id: 'edit', title: 'Édition', order: 20 });
    reg.registerMenu({ id: 'file', title: 'Fichier', order: 10 });
    expect(reg.bar().map((m) => m.id)).toEqual(['file', 'edit']);
  });

  it('sorts items by group then order, one section per group', () => {
    const reg = new MenuRegistry();
    reg.registerItem('file', { command: 'file.save', group: '2_save', order: 1 });
    reg.registerItem('file', { command: 'file.open', group: '1_new', order: 2 });
    reg.registerItem('file', { command: 'file.new', group: '1_new', order: 1 });
    reg.registerItem('file', { command: 'tabs.close', group: '3_close' });
    expect(labels(reg.sections('file'))).toEqual([
      ['file.new', 'file.open'],
      ['file.save'],
      ['tabs.close'],
    ]);
  });

  it('keeps registration order for equal positions', () => {
    const reg = new MenuRegistry();
    reg.registerItem('m', { command: 'a' });
    reg.registerItem('m', { command: 'b' });
    expect(labels(reg.sections('m'))).toEqual([['a', 'b']]);
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
    expect(reg.sections('file')).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(4);
  });

  it('gives a group its name and icon, even when named before its items', () => {
    const reg = new MenuRegistry();
    reg.registerGroup('file', { id: '2_save', title: 'Enregistrer', icon: 'M0 0' });
    reg.registerItem('file', { command: 'file.new', group: '1_new' });
    reg.registerItem('file', { command: 'file.save', group: '2_save' });
    expect(reg.sections('file').map((s) => s.spec?.title)).toEqual([undefined, 'Enregistrer']);
  });

  it('refuses duplicate menu ids', () => {
    const reg = new MenuRegistry();
    reg.registerMenu({ id: 'file', title: 'Fichier' });
    expect(() => reg.registerMenu({ id: 'file', title: 'Autre' })).toThrow();
  });
});
