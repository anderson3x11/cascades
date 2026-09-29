import { describe, expect, it } from 'vitest';
import { languageChoices } from './languages';

describe('languageChoices', () => {
  it('makes one choice per language, named in French, without technical tags', () => {
    expect(
      languageChoices(['fr-015', 'fr-BE', 'fr-FR', 'zh-Latn-CN-x-ext', 'en-US', 'en-GB'], 'fr'),
    ).toEqual([
      { tag: 'en', label: 'Anglais' },
      { tag: 'fr', label: 'Français' },
    ]);
  });
});
