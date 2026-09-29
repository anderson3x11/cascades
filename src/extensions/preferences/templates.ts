import { t } from '../../api';

export const settingsTemplate =
  () => `// ${t('Personal settings: they replace the default values.')}
// ${t('Write them between the braces { }, separated by commas.')}
// ${t('Type " to see the list of settings; hover a setting for its description.')}
// ${t('Lines that start with // are comments, with no effect.')}
{
  // "editor.fontSize": 16,
  // ${t('A "[language]" block only applies to the files of that language:')}
  // "[markdown]": { "editor.wordWrap": true },
}
`;

export const keybindingsTemplate =
  () => `// ${t('Personal shortcuts: they add to the default ones, or replace them.')}
// ${t('Write them between the brackets [ ], one per line, separated by commas.')}
// ${t('After "command": , type " to see the list of commands.')}
// ${t('Lines that start with // are comments, with no effect.')}
[
  // { "key": "Ctrl+Shift+N", "command": "file.new" },
  // ${t('A "-" before the command removes a default shortcut:')}
  // { "key": "Ctrl+D", "command": "-editor.addNextOccurrence" },
]
`;

/** Content that holds nothing yet: the file can get its template. */
export const isEmpty = (text: string | null) =>
  text === null || /^\s*(\{\s*\}|\[\s*\])?\s*$/.test(text);
