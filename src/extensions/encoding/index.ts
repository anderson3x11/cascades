import { defineExtension, t, type LineEnding, type TabInfo } from '../../api';

interface EncodingChoice {
  label: string;
  encoding: string;
  bom: boolean;
}

/** The usual encodings; the names are those encoding_rs knows. */
const encodings = (): EncodingChoice[] => [
  { label: 'UTF-8', encoding: 'utf-8', bom: false },
  { label: t('UTF-8 with BOM'), encoding: 'utf-8', bom: true },
  { label: 'UTF-16 LE', encoding: 'utf-16le', bom: true },
  { label: 'UTF-16 BE', encoding: 'utf-16be', bom: true },
  { label: t('Western European (Windows-1252, "Latin-1")'), encoding: 'windows-1252', bom: false },
  { label: t('Western European (ISO-8859-15)'), encoding: 'iso-8859-15', bom: false },
  { label: t('Central European (Windows-1250)'), encoding: 'windows-1250', bom: false },
  { label: t('Cyrillic (Windows-1251)'), encoding: 'windows-1251', bom: false },
  { label: t('Greek (Windows-1253)'), encoding: 'windows-1253', bom: false },
  { label: t('Turkish (Windows-1254)'), encoding: 'windows-1254', bom: false },
  { label: t('Japanese (Shift_JIS)'), encoding: 'shift_jis', bom: false },
  { label: t('Simplified Chinese (GBK)'), encoding: 'gbk', bom: false },
  { label: t('Korean (EUC-KR)'), encoding: 'euc-kr', bom: false },
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

    const pickEncoding = (tab: TabInfo, placeholder: string) => {
      const list = encodings();
      return ctx.quickPick.show(
        list.map((choice) => ({
          label: choice.label,
          description:
            choice.encoding === tab.encoding && choice.bom === tab.bom ? t('current') : '',
          value: choice,
        })),
        {
          placeholder,
          activeValue: list.find((c) => c.encoding === tab.encoding && c.bom === tab.bom),
        },
      );
    };

    /** Saves right away a file with no other change, so that the new format is on disk. */
    const saveIfClean = async (tab: TabInfo) => {
      if (tab.path && !tab.dirty) await ctx.commands.execute('file.save', tab.id);
    };

    ctx.commands.register(
      'file.reopenWithEncoding',
      async () => {
        const tab = current();
        if (!tab?.path || tab.viewer) return;
        const choice = await pickEncoding(tab, t('Reopen with the encoding…'));
        if (!choice) return;
        if (tab.dirty) {
          const answer = await ctx.dialogs.choose(
            t('The unsaved changes of this file will be lost. Reopen anyway?'),
            { buttons: [t('Reopen'), t('Cancel')] },
          );
          if (answer !== t('Reopen')) return;
        }
        const file = await ctx.fs.readTextFile(tab.path, choice.encoding);
        ctx.workspace.update(tab.id, {
          encoding: file.encoding,
          bom: file.bom,
          lineEnding: file.lineEnding,
        });
        ctx.workspace.reload(tab.id, file.text);
      },
      { title: t('Reopen with another encoding…'), category: t('File') },
    );

    ctx.commands.register(
      'file.saveWithEncoding',
      async () => {
        const tab = current();
        if (!tab || tab.viewer) return;
        const choice = await pickEncoding(tab, t('Save with the encoding…'));
        if (!choice) return;
        ctx.workspace.update(tab.id, { encoding: choice.encoding, bom: choice.bom });
        await saveIfClean(tab);
      },
      { title: t('Save with another encoding…'), category: t('File') },
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
                    label: t('Reopen with another encoding…'),
                    description: t('the file was read wrong'),
                    value: 'file.reopenWithEncoding',
                  },
                ]
              : []),
            {
              label: t('Save with another encoding…'),
              description: t('convert the file'),
              value: 'file.saveWithEncoding',
            },
          ],
          {
            placeholder: tab.bom
              ? t('Current encoding: {encoding} with BOM', { encoding: tab.encoding.toUpperCase() })
              : t('Current encoding: {encoding}', { encoding: tab.encoding.toUpperCase() }),
          },
        );
        if (action) await ctx.commands.execute(action);
      },
      { title: t('Change the encoding…'), category: t('File') },
    );

    ctx.commands.register(
      'file.changeLineEnding',
      async () => {
        const tab = current();
        if (!tab || tab.viewer) return;
        const choice = await ctx.quickPick.show(
          LINE_ENDINGS.map((l) => ({ label: l.label, description: l.description, value: l.value })),
          { placeholder: t('Line endings'), activeValue: tab.lineEnding },
        );
        if (!choice || choice === tab.lineEnding) return;
        ctx.workspace.update(tab.id, { lineEnding: choice });
        await saveIfClean(tab);
      },
      { title: t('Change the line endings…'), category: t('File') },
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
