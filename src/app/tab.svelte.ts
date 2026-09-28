import type { EditorState, StateEffect, Text } from '@codemirror/state';
import type { LineEnding, TabInfo } from '../api';

function basename(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

export class Tab implements TabInfo {
  readonly id: string;
  path = $state<string | null>(null);
  encoding = $state('utf-8');
  bom = $state(false);
  lineEnding = $state<LineEnding>('lf');
  language = $state('plaintext');
  dirty = $state(false);

  /** Editor state while the tab is not shown. The active tab's state lives in the view. */
  state: EditorState;
  /** Document as last saved, to compute `dirty`. */
  savedDoc: Text;
  scroll: StateEffect<unknown> | null = null;

  private readonly untitledName: string;

  constructor(id: string, state: EditorState, untitledName: string) {
    this.id = id;
    this.state = state;
    this.savedDoc = state.doc;
    this.untitledName = untitledName;
  }

  get title(): string {
    return this.path ? basename(this.path) : this.untitledName;
  }
}
