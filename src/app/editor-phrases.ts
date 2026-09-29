/**
 * French for the words CodeMirror shows itself: the search panel, "go to
 * line", folding, the lint panel. Keys are CodeMirror's English phrases.
 */
export const FRENCH_PHRASES: Record<string, string> = {
  // Search panel
  Find: 'Rechercher',
  Replace: 'Remplacer',
  next: 'suivant',
  previous: 'précédent',
  all: 'tout',
  'match case': 'respecter la casse',
  'by word': 'mot entier',
  regexp: 'expression régulière',
  replace: 'remplacer',
  'replace all': 'tout remplacer',
  close: 'fermer',
  'current match': 'occurrence actuelle',
  'replaced $ matches': '$ occurrences remplacées',
  'replaced match on line $': 'occurrence remplacée ligne $',
  'on line': 'ligne',
  // Go to line
  'Go to line': 'Aller à la ligne',
  go: 'OK',
  // Folding
  'Folded lines': 'Lignes repliées',
  'Unfolded lines': 'Lignes dépliées',
  to: 'à',
  'folded code': 'texte replié',
  unfold: 'déplier',
  'Fold line': 'Replier la ligne',
  'Unfold line': 'Déplier la ligne',
  // Other
  'Control character': 'Caractère de contrôle',
  'Selection deleted': 'Sélection supprimée',
  Diagnostics: 'Problèmes',
  'No diagnostics': 'Aucun problème',
  Completions: 'Suggestions',
};
