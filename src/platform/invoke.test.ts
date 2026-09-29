import { afterEach, describe, expect, it } from 'vitest';
import { addTranslations, setLanguage } from '../core/i18n/i18n';
import { translateBackendMessage } from './invoke';

describe('translateBackendMessage', () => {
  afterEach(() => setLanguage('en'));

  it('translates a known message and keeps the path before it', () => {
    const d = addTranslations('fr', {
      'unknown encoding: {encoding}': 'encodage inconnu : {encoding}',
    });
    setLanguage('fr');
    expect(translateBackendMessage('C:/a.txt: unknown encoding: koi9')).toBe(
      'C:/a.txt: encodage inconnu : koi9',
    );
    d.dispose();
  });

  it('leaves other messages as they are', () => {
    setLanguage('fr');
    expect(translateBackendMessage('Accès refusé. (os error 5)')).toBe(
      'Accès refusé. (os error 5)',
    );
  });
});
