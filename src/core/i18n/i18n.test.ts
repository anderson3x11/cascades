import { afterEach, describe, expect, it } from 'vitest';
import { addTranslations, pickLanguage, setLanguage, t } from './i18n';

describe('t', () => {
  afterEach(() => setLanguage('en'));

  it('returns the English text when there is no translation', () => {
    setLanguage('fr');
    expect(t('Nothing here')).toBe('Nothing here');
  });

  it('translates into the current language', () => {
    const d = addTranslations('fr', { 'Save as…': 'Enregistrer sous…' });
    expect(t('Save as…')).toBe('Save as…');
    setLanguage('fr');
    expect(t('Save as…')).toBe('Enregistrer sous…');
    d.dispose();
    expect(t('Save as…')).toBe('Save as…');
  });

  it('fills placeholders after translating', () => {
    const d = addTranslations('fr', { '{count} files': '{count} fichiers' });
    setLanguage('fr');
    expect(t('{count} files', { count: 3 })).toBe('3 fichiers');
    expect(t('{missing} stays', {})).toBe('{missing} stays');
    d.dispose();
  });

  it('lets a later catalog override an earlier one', () => {
    const a = addTranslations('fr', { Open: 'Ouvrir' });
    const b = addTranslations('fr', { Open: 'Ouvrir…' });
    setLanguage('fr');
    expect(t('Open')).toBe('Ouvrir…');
    b.dispose();
    expect(t('Open')).toBe('Ouvrir');
    a.dispose();
  });
});

describe('pickLanguage', () => {
  it('uses the setting when it names a known language', () => {
    expect(pickLanguage('fr', ['en-US'])).toBe('fr');
  });

  it('follows the system with auto', () => {
    expect(pickLanguage('auto', ['fr-FR', 'en-US'])).toBe('fr');
    expect(pickLanguage('auto', ['de-DE', 'fr-CA'])).toBe('fr');
    expect(pickLanguage(undefined, ['de-DE'])).toBe('en');
  });
});
