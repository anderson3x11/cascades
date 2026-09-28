import { describe, expect, it } from 'vitest';
import { parseSession } from './session';

describe('parseSession', () => {
  it('reads a valid session', () => {
    const session = parseSession(
      JSON.stringify({
        version: 1,
        active: 1,
        tabs: [
          { path: 'C:/notes.txt', selection: { anchor: 3, head: 5 }, scrollTop: 120 },
          {
            path: null,
            content: 'brouillon',
            lineEnding: 'crlf',
            selection: { anchor: 0, head: 0 },
          },
        ],
      }),
    );
    expect(session).toEqual({
      version: 1,
      active: 1,
      tabs: [
        { path: 'C:/notes.txt', selection: { anchor: 3, head: 5 }, scrollTop: 120 },
        {
          path: null,
          content: 'brouillon',
          lineEnding: 'crlf',
          selection: { anchor: 0, head: 0 },
          scrollTop: 0,
        },
      ],
    });
  });

  it('drops invalid tabs and fixes the active index', () => {
    const session = parseSession(
      JSON.stringify({
        version: 1,
        active: 5,
        tabs: [{ path: null }, { path: 42 }, 'x', { path: 'C:/a.txt', selection: 'bad' }],
      }),
    );
    expect(session?.tabs).toEqual([
      { path: 'C:/a.txt', selection: { anchor: 0, head: 0 }, scrollTop: 0 },
    ]);
    expect(session?.active).toBe(0);
  });

  it('rejects unusable files', () => {
    expect(parseSession('not json')).toBeNull();
    expect(parseSession('{"version": 2, "tabs": []}')).toBeNull();
    expect(parseSession('[]')).toBeNull();
  });
});
