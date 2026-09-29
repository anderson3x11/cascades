import { defineExtension, type LineEnding, type TabInfo } from '../../api';

interface EncodingChoice {
  label: string;
  encoding: string;
  bom: boolean;
}

/** The usual encodings; the names are those encoding_rs knows. */
export const ENCODINGS: EncodingChoice[] = [
  { label: 'UTF-8', encoding: 'utf-8', bom: false },
  { label: 'UTF-8 avec BOM', encoding: 'utf-8', bom: true },
  { label: 'UTF-16 LE', encoding: 'utf-16le', bom: true },
  { label: 'UTF-16 BE', encoding: 'utf-16be', bom: true },
  { label: 'Europe occidentale (Windows-1252, « Latin-1 »)', encoding: 'windows-1252', bom: false },
  { label: 'Europe occidentale (ISO-8859-15)', encoding: 'iso-8859-15', bom: false },
  { label: 'Europe centrale (Windows-1250)', encoding: 'windows-1250', bom: false },
  { label: 'Cyrillique (Windows-1251)', encoding: 'windows-1251', bom: false },
  { label: 'Grec (Windows-1253)', encoding: 'windows-1253', bom: false },
  { label: 'Turc (Windows-1254)', encoding: 'windows-1254', bom: false },
  { label: 'Japonais (Shift_JIS)', encoding: 'shift_jis', bom: false },
  { label: 'Chinois simplifié (GBK)', encoding: 'gbk', bom: false },
  { label: 'Coréen (EUC-KR)', encoding: 'euc-kr', bom: false },
];

const LINE_ENDINGS: { label: string; description: string; value: LineEnding }[] = [
  { label: 'LF', description: 'Linux, macOS', value: 'lf' },
  { label: 'CRLF', description: 'Windows', value: 'crlf' },
];

/** Reopening with another encoding, saving with another encoding or line ending. */
export default defineExtension({
  id: 'cascades.encoding',
  activate(ctx) {
    const current = () => ctx.workspace.active();

    const pickEncoding = (tab: TabInfo, placeholder: string) =>
      ctx.quickPick.show(
        ENCODINGS.map((choice) => ({
          label: choice.label,
          description: choice.encoding === tab.encoding && choice.bom === tab.bom ? 'actuel' : '',
          value: choice,
        })),
        {
          placeholder,
          activeValue: ENCODINGS.find((c) => c.encoding === tab.encoding && c.bom === tab.bom),
        },
      );

    /** Saves right away a file with no other change, so that the new format is on disk. */
    const saveIfClean = async (tab: TabInfo) => {
      if (tab.path && !tab.dirty) await ctx.commands.execute('file.save', tab.id);
    };

    ctx.commands.register(
      'file.reopenWithEncoding',
      async () => {
        const tab = current();
        if (!tab?.path || tab.viewer) return;
        const choice = await pickEncoding(tab, 'Rouvrir avec l’encodage…');
        if (!choice) return;
        if (tab.dirty) {
          const answer = await ctx.dialogs.choose(
            'Les modifications non enregistrées de ce fichier seront perdues. Rouvrir quand même ?',
            { buttons: ['Rouvrir', 'Annuler'] },
          );
          if (answer !== 'Rouvrir') return;
        }
        const file = await ctx.fs.readTextFile(tab.path, choice.encoding);
        ctx.workspace.update(tab.id, {
          encoding: file.encoding,
          bom: file.bom,
          lineEnding: file.lineEnding,
        });
        ctx.workspace.reload(tab.id, file.text);
      },
      { title: 'Rouvrir avec un autre encodage…', category: 'Fichier' },
    );

    ctx.commands.register(
      'file.saveWithEncoding',
      async () => {
        const tab = current();
        if (!tab || tab.viewer) return;
        const choice = await pickEncoding(tab, 'Enregistrer avec l’encodage…');
        if (!choice) return;
        ctx.workspace.update(tab.id, { encoding: choice.encoding, bom: choice.bom });
        await saveIfClean(tab);
      },
      { title: 'Enregistrer avec un autre encodage…', category: 'Fichier' },
    );

    ctx.commands.register(
      'file.changeEncoding',
      async () => {
        const tab = current();
        if (!tab || tab.viewer) return;
        const action = await ctx.quickPick.show(
          [
            ...(tab.path
              ? [
                  {
                    label: 'Rouvrir avec un autre encodage…',
                    description: 'le fichier était mal lu',
                    value: 'file.reopenWithEncoding',
                  },
                ]
              : []),
            {
              label: 'Enregistrer avec un autre encodage…',
              description: 'convertir le fichier',
              value: 'file.saveWithEncoding',
            },
          ],
          {
            placeholder: `Encodage actuel : ${tab.encoding.toUpperCase()}${tab.bom ? ' avec BOM' : ''}`,
          },
        );
        if (action) await ctx.commands.execute(action);
      },
      { title: 'Changer l’encodage…', category: 'Fichier' },
    );

    ctx.commands.register(
      'file.changeLineEnding',
      async () => {
        const tab = current();
        if (!tab || tab.viewer) return;
        const choice = await ctx.quickPick.show(
          LINE_ENDINGS.map((l) => ({ label: l.label, description: l.description, value: l.value })),
          { placeholder: 'Fins de ligne', activeValue: tab.lineEnding },
        );
        if (!choice || choice === tab.lineEnding) return;
        ctx.workspace.update(tab.id, { lineEnding: choice });
        await saveIfClean(tab);
      },
      { title: 'Changer les fins de ligne…', category: 'Fichier' },
    );

    ctx.menus.registerItem('file', {
      command: 'file.reopenWithEncoding',
      group: '2_save',
      order: 3,
    });
    ctx.menus.registerItem('file', { command: 'file.saveWithEncoding', group: '2_save', order: 4 });
    ctx.menus.registerItem('file', { command: 'file.changeLineEnding', group: '2_save', order: 5 });
  },
});
