import { describe, expect, it } from 'vitest';
import { languageId, languageNameFromContent, resolveLanguage } from './languages';

describe('languages', () => {
  it('reads the language from the first lines', () => {
    expect(languageNameFromContent('#!/usr/bin/env python3\nprint(1)')).toBe('Python');
    expect(languageNameFromContent('#!/bin/bash\necho')).toBe('Shell');
    expect(languageNameFromContent('#!/usr/bin/env node')).toBe('JavaScript');
    expect(languageNameFromContent('<?xml version="1.0"?><a/>')).toBe('XML');
    expect(languageNameFromContent('\n<!DOCTYPE html>\n<html>')).toBe('HTML');
    expect(languageNameFromContent('Elden Ring\n\tCombat')).toBeNull();
  });

  it('prefers the choice, then the file name, then the content', () => {
    const id = (path: string | null, text: string, chosen: string | null) =>
      languageId(resolveLanguage(path, text, chosen));
    expect(id('C:/a/deploy', '#!/bin/bash', null)).toBe('shell');
    expect(id('C:/a/notes.md', '#!/bin/bash', null)).toBe('markdown');
    expect(id('C:/a/notes.md', '', 'Python')).toBe('python');
    expect(id('C:/a/script.py', '', 'plaintext')).toBe('plaintext');
    expect(id(null, 'du texte', null)).toBe('plaintext');
  });
});
