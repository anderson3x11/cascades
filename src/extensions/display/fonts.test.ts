import { describe, expect, it } from 'vitest';
import { firstFamily } from './fonts';

describe('firstFamily', () => {
  it('takes the first family without its quotes', () => {
    expect(firstFamily("'Cascadia Code', Consolas, monospace")).toBe('Cascadia Code');
    expect(firstFamily('"iA Writer Mono S", monospace')).toBe('iA Writer Mono S');
    expect(firstFamily('Georgia')).toBe('Georgia');
  });
});
