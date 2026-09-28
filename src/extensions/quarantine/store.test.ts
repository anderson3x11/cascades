import { describe, expect, it } from 'vitest';
import { QuarantineStore } from './store';

describe('QuarantineStore', () => {
  it('keeps snippets per file, newest first', () => {
    const store = new QuarantineStore();
    store.add('a.txt', 'premier', 3);
    store.add('a.txt', 'second', 8);
    store.add('b.txt', 'ailleurs', 1);
    expect(store.list('a.txt').map((s) => s.text)).toEqual(['second', 'premier']);
    expect(store.list('b.txt').map((s) => s.text)).toEqual(['ailleurs']);
    expect(store.list('c.txt')).toEqual([]);
  });

  it('removes a snippet and can put it back at its place', () => {
    const store = new QuarantineStore();
    store.add('a.txt', 'un', 1);
    const two = store.add('a.txt', 'deux', 2);
    store.add('a.txt', 'trois', 3);
    const removed = store.remove('a.txt', two.id);
    expect(store.list('a.txt').map((s) => s.text)).toEqual(['trois', 'un']);
    if (!removed) throw new Error('not removed');
    store.restore('a.txt', removed.snippet, removed.index);
    expect(store.list('a.txt').map((s) => s.text)).toEqual(['trois', 'deux', 'un']);
    expect(store.remove('a.txt', 'unknown')).toBeNull();
  });

  it('moves snippets to a new key', () => {
    const store = new QuarantineStore();
    store.add('tab-1', 'brouillon', 1);
    store.add('notes.txt', 'déjà là', 1);
    store.rename('tab-1', 'notes.txt');
    expect(store.list('tab-1')).toEqual([]);
    expect(store.list('notes.txt').map((s) => s.text)).toEqual(['brouillon', 'déjà là']);
  });

  it('saves and loads, dropping unwanted keys and malformed entries', () => {
    const store = new QuarantineStore();
    store.add('C:/a.txt', 'garde', 1, 1000);
    store.add('tab-3', 'sans titre', 1, 1000);
    const data = store.toJSON((key) => !key.startsWith('tab-'));
    expect(Object.keys(data)).toEqual(['C:/a.txt']);

    const other = new QuarantineStore();
    other.load({ ...data, 'C:/b.txt': [{ id: 1 }, 'x'], 'C:/c.txt': 'pas une liste' });
    expect(other.list('C:/a.txt').map((s) => s.text)).toEqual(['garde']);
    expect(other.list('C:/b.txt')).toEqual([]);
  });
});
