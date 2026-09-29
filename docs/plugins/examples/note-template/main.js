// Note templates: a command (Leader N) that inserts a note chosen in a list.
// Indented lines become cascades.

export default function (ctx) {
  const { t } = ctx.i18n;
  ctx.i18n.addTranslations('fr', {
    'Insert a note template…': 'Insérer un modèle de note…',
    'Choose a template': 'Choisir un modèle',
    Day: 'Journée',
    Meeting: 'Réunion',
    Idea: 'Idée',
    'To do': 'À faire',
    Notes: 'Notes',
    'Who is there': 'Présents',
    Decisions: 'Décisions',
    'Next steps': 'Suite',
    'Why it matters': 'Pourquoi c’est important',
    'First step': 'Premier pas',
  });

  const today = () => new Date().toLocaleDateString(ctx.i18n.language());
  const templates = () => [
    {
      label: t('Day'),
      text: `${today()}\n\t${t('To do')}\n\t\t- [ ] \n\t${t('Notes')}\n\t\t`,
    },
    {
      label: t('Meeting'),
      text: `${t('Meeting')} ${today()}\n\t${t('Who is there')}\n\t\t\n\t${t('Decisions')}\n\t\t\n\t${t('Next steps')}\n\t\t- [ ] `,
    },
    {
      label: t('Idea'),
      text: `${t('Idea')}\n\t${t('Why it matters')}\n\t\t\n\t${t('First step')}\n\t\t`,
    },
  ];

  ctx.commands.register(
    'noteTemplate.insert',
    async () => {
      const view = ctx.editor.view();
      if (!view) return;
      const text = await ctx.quickPick.show(
        templates().map(({ label, text }) => ({ label, value: text })),
        { placeholder: t('Choose a template') },
      );
      if (text === undefined) return;
      const { from, to } = view.state.selection.main;
      view.dispatch({
        changes: { from, to, insert: text },
        selection: { anchor: from + text.length },
        scrollIntoView: true,
      });
      view.focus();
    },
    { title: t('Insert a note template…'), category: t('Plugins') },
  );
  ctx.keybindings.register({
    key: 'Leader N',
    command: 'noteTemplate.insert',
    when: 'editorFocus',
  });
}
