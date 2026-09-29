import { describe, expect, it } from 'vitest';
import { parseManifest } from './plugins';

const manifest = (fields: Record<string, unknown>) =>
  JSON.stringify({ id: 'word-count', name: 'Word count', version: '1.0.0', ...fields });

describe('parseManifest', () => {
  it('reads a manifest, with defaults', () => {
    expect(parseManifest(manifest({ author: 'Ana' }))).toEqual({
      id: 'word-count',
      name: 'Word count',
      version: '1.0.0',
      author: 'Ana',
      description: undefined,
      permissions: [],
      main: 'main.js',
    });
    expect(parseManifest(manifest({ permissions: ['files'], main: 'index.js' }))).toMatchObject({
      permissions: ['files'],
      main: 'index.js',
    });
  });

  it('explains what is wrong', () => {
    expect(() => parseManifest('{')).toThrow(/invalid JSON/);
    expect(() => parseManifest('[]')).toThrow(/object/);
    expect(() => parseManifest(manifest({ id: 'Word Count' }))).toThrow(/lower case/);
    expect(() => parseManifest(manifest({ name: '' }))).toThrow(/name/);
    expect(() => parseManifest(manifest({ permissions: ['network'] }))).toThrow(/permissions/);
    expect(() => parseManifest(manifest({ main: '../evil.js' }))).toThrow(/main/);
  });
});
