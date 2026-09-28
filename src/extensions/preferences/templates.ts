export const SETTINGS_TEMPLATE = `// Réglages personnels : ils remplacent les valeurs par défaut.
// Écris-les entre les accolades { }, séparés par des virgules.
// Tape " pour voir la liste des réglages ; survole un réglage pour sa description.
// Les lignes qui commencent par // sont des commentaires, sans effet.
{
  // "editor.fontSize": 16,
  // Un bloc "[langage]" ne vaut que pour les fichiers de ce langage :
  // "[markdown]": { "editor.wordWrap": true },
}
`;

export const KEYBINDINGS_TEMPLATE = `// Raccourcis personnels : ils s'ajoutent à ceux par défaut, ou les remplacent.
// Écris-les entre les crochets [ ], un par ligne, séparés par des virgules.
// Après "command": , tape " pour voir la liste des commandes.
// Les lignes qui commencent par // sont des commentaires, sans effet.
[
  // { "key": "Ctrl+Shift+N", "command": "file.new" },
  // Un "-" devant la commande retire un raccourci par défaut :
  // { "key": "Ctrl+D", "command": "-editor.addNextOccurrence" },
]
`;

/** Content that holds nothing yet: the file can get its template. */
export const isEmpty = (text: string | null) =>
  text === null || /^\s*(\{\s*\}|\[\s*\])?\s*$/.test(text);
