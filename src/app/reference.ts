import type { CommandRegistry } from '../core/commands/registry';
import { formatKeySequence, parseKeySequence } from '../core/keybindings/keys';
import type { KeybindingRegistry } from '../core/keybindings/registry';
import type { SettingsRegistry } from '../core/settings/registry';

/** Commands and settings as the interface shows them, for the documentation. */
export interface Reference {
  commands: { id: string; title: string; category: string; keys: string[] }[];
  settings: {
    key: string;
    type: string;
    default: unknown;
    description: string;
    values?: readonly unknown[];
  }[];
}

/**
 * Everything a user can run or set, in the current language and with the
 * shortcuts of the current system ("Leader S" keeps the word Leader).
 */
export function buildReference(
  commands: CommandRegistry,
  keybindings: KeybindingRegistry,
  settings: SettingsRegistry,
): Reference {
  return {
    commands: commands
      .list()
      .filter((c) => c.title && !c.hidden)
      .map((c) => ({
        id: c.id,
        title: c.title ?? c.id,
        category: c.category ?? '',
        keys: [
          ...new Set(
            keybindings
              .forCommand(c.id)
              .reverse()
              .map((b) => formatKeySequence(parseKeySequence(b.key))),
          ),
        ],
      }))
      .sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title)),
    settings: settings
      .allSchemas()
      .map(([key, schema]) => ({
        key,
        type: schema.type,
        default: schema.default,
        description: schema.description ?? '',
        ...(schema.enum ? { values: schema.enum } : {}),
      }))
      .sort((a, b) => a.key.localeCompare(b.key)),
  };
}
