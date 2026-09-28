import { describe, expect, it } from 'vitest';
import { decide } from './decide';

describe('decide', () => {
  it('reloads a clean tab changed elsewhere', () => {
    expect(decide('new', 'old', 'old')).toBe('reload');
  });

  it('asks when the tab has unsaved changes', () => {
    expect(decide('theirs', 'mine', 'old')).toBe('ask');
  });

  it('ignores our own save and unchanged content', () => {
    expect(decide('same', 'same', 'same')).toBe('none');
    expect(decide('old', 'mine', 'old')).toBe('none');
  });

  it('marks saved when the disk caught up with the editor', () => {
    expect(decide('mine', 'mine', 'old')).toBe('markSaved');
  });

  it('reports a removed file', () => {
    expect(decide(null, 'x', 'x')).toBe('removed');
  });
});
