// Writing time: counts the minutes spent typing, shown in the status bar.
// A pause of more than a minute is not counted.

const PAUSE_MS = 60_000;

export default {
  activate(ctx) {
    const { t } = ctx.i18n;
    ctx.i18n.addTranslations('fr', {
      '{minutes} min of writing': '{minutes} min d’écriture',
      'Time spent typing since Cascades started': 'Temps passé à écrire depuis le lancement',
      'Reset the writing time': 'Remettre à zéro le temps d’écriture',
    });

    let total = 0;
    let last = 0;

    const item = ctx.statusBar.addItem({ id: 'writing-time', alignment: 'right', priority: 50 });
    item.tooltip = t('Time spent typing since Cascades started');
    const show = () => {
      item.text = t('{minutes} min of writing', { minutes: Math.floor(total / 60_000) });
    };
    show();

    ctx.events.on('editor.didUpdate', ({ docChanged }) => {
      if (!docChanged) return;
      const now = Date.now();
      if (last && now - last < PAUSE_MS) total += now - last;
      last = now;
      show();
    });

    ctx.commands.register(
      'writingTime.reset',
      () => {
        total = 0;
        last = 0;
        show();
      },
      { title: t('Reset the writing time'), category: t('Plugins') },
    );
  },
};
