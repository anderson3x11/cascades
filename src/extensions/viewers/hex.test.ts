import { describe, expect, it } from 'vitest';
import { formatRow } from './hex';

describe('formatRow', () => {
  it('shows the offset, the bytes in two groups and the printable characters', () => {
    const bytes = Uint8Array.from('Bonjour\u0000ÿcascades!', (c) => c.charCodeAt(0));
    expect(formatRow(0x20, bytes.subarray(0, 16))).toEqual([
      '00000020',
      '42 6F 6E 6A 6F 75 72 00  FF 63 61 73 63 61 64 65',
      'Bonjour··cascade',
    ]);
  });

  it('pads the last, shorter row', () => {
    const [, cells, text] = formatRow(0, Uint8Array.from([0x41, 0x42]));
    expect(cells.startsWith('41 42    ')).toBe(true);
    expect(cells.length).toBe(48);
    expect(text).toBe('AB');
  });
});
