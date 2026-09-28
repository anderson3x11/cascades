import { autocompletion, type CompletionContext } from '@codemirror/autocomplete';
import { linter } from '@codemirror/lint';
import type { Extension } from '@codemirror/state';
import { hoverTooltip } from '@codemirror/view';
import type { ExtensionContext } from '../../api';
import { explain, suggest, type ConfigFileName, type ConfigKnowledge } from './assist';

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Completion, underlined mistakes and hover help for a config file tab. */
export function configFileAssist(ctx: ExtensionContext, file: ConfigFileName): Extension {
  const knowledge = (): ConfigKnowledge => ({
    settings: ctx.settings.schemas(),
    commands: ctx.commands.list().filter((c) => !c.hidden),
  });

  return [
    autocompletion({
      override: [
        (context: CompletionContext) => {
          const result = suggest(file, context.state.doc.toString(), context.pos, knowledge());
          // Open by itself only once something is typed; Ctrl+Space opens it anywhere.
          if (!result || (!context.explicit && result.from === context.pos)) return null;
          return { ...result, validFor: /^"?-?[\w.[\]-]*"?$/ };
        },
      ],
    }),
    linter(
      (view) =>
        ctx.configFiles.check(file, view.state.doc.toString()).map((problem) => ({
          ...problem,
          message: capitalize(problem.message),
        })),
      { delay: 300 },
    ),
    hoverTooltip((view, pos) => {
      const help = explain(file, view.state.doc.toString(), pos, knowledge());
      if (!help) return null;
      return {
        pos: help.from,
        end: help.to,
        create: () => {
          const dom = document.createElement('div');
          dom.textContent = help.text;
          return { dom };
        },
      };
    }),
  ];
}
