import { describe, expect, it } from 'vitest';
import { parseSession } from './session';

const tab = (path: string | null, extra: object = {}) => ({
  path,
  selection: { anchor: 0, head: 0 },
  scrollTop: 0,
  ...extra,
});

describe('parseSession', () => {
  it('reads groups, clones and orientation', () => {
    const session = parseSession(
      JSON.stringify({
        version: 2,
        activeGroup: 1,
        orientation: 'column',
        groups: [
          { active: 0, tabs: [tab('C:/notes.txt', { doc: 'd1' })] },
          {
            active: 1,
            tabs: [tab('C:/notes.txt', { doc: 'd1' }), tab(null, { content: 'brouillon' })],
          },
        ],
      }),
    );
    expect(session?.activeGroup).toBe(1);
    expect(session?.orientation).toBe('column');
    expect(session?.groups.map((g) => g.tabs.map((t) => t.doc ?? t.content))).toEqual([
      ['d1'],
      ['d1', 'brouillon'],
    ]);
  });

  it('reads the version 1 format as a single group', () => {
    const session = parseSession(
      JSON.stringify({
        version: 1,
        active: 1,
        tabs: [
          tab('C:/a.txt', { scrollTop: 120 }),
          tab(null, { content: 'x', lineEnding: 'crlf' }),
        ],
      }),
    );
    expect(session).toEqual({
      version: 2,
      activeGroup: 0,
      orientation: 'row',
      groups: [
        {
          active: 1,
          tabs: [
            tab('C:/a.txt', { scrollTop: 120 }),
            tab(null, { content: 'x', lineEnding: 'crlf' }),
          ],
        },
      ],
    });
  });

  it('drops invalid tabs and empty groups, and fixes indexes', () => {
    const session = parseSession(
      JSON.stringify({
        version: 2,
        activeGroup: 7,
        groups: [{ tabs: [{ path: null }, 'x'] }, { active: 9, tabs: [tab('C:/a.txt')] }],
      }),
    );
    expect(session?.groups).toEqual([{ active: 0, tabs: [tab('C:/a.txt')] }]);
    expect(session?.activeGroup).toBe(0);
  });

  it('rejects unusable files', () => {
    expect(parseSession('not json')).toBeNull();
    expect(parseSession('{"version": 3, "groups": []}')).toBeNull();
    expect(parseSession('[]')).toBeNull();
  });
});
