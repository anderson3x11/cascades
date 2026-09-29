import type { EditorState, StateEffect, Text } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import type { LineEnding, TabInfo } from '../api';

function basename(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

/**
 * A document: the file side (path, encoding, saved state). Several tabs,
 * in different groups, can show the same document.
 */
export class Doc {
  readonly id: string;
  path = $state<string | null>(null);
  encoding = $state('utf-8');
  bom = $state(false);
  lineEnding = $state<LineEnding>('lf');
  language = $state('plaintext');
  /** Language chosen by hand ("Python", or "plaintext"), or null to detect it. */
  chosenLanguage: string | null = null;
  /** A big file, in light mode. */
  large = false;
  dirty = $state(false);
  /** Viewer shown instead of the editor (images), or null for a text document. */
  viewer = $state<string | null>(null);
  /** Text as last saved, to compute `dirty`. */
  savedDoc: Text;

  private readonly untitledName: string;

  constructor(id: string, savedDoc: Text, untitledName: string) {
    this.id = id;
    this.savedDoc = savedDoc;
    this.untitledName = untitledName;
  }

  get title(): string {
    return this.path ? basename(this.path) : this.untitledName;
  }
}

/** A tab: one view of a document in a group, with its own cursor, scroll and undo history. */
export class Tab implements TabInfo {
  readonly id: string;
  readonly doc: Doc;
  group: Group;
  /** Editor state while the tab is not shown. The shown tab's state lives in its group's view. */
  state: EditorState;
  scroll: StateEffect<unknown> | null = null;
  /** Document position at the top of the view when the tab was last shown. */
  topPos = 0;

  constructor(id: string, doc: Doc, group: Group, state: EditorState) {
    this.id = id;
    this.doc = doc;
    this.group = group;
    this.state = state;
  }

  get documentId(): string {
    return this.doc.id;
  }
  get groupId(): string {
    return this.group.id;
  }
  get path(): string | null {
    return this.doc.path;
  }
  get title(): string {
    return this.doc.title;
  }
  get encoding(): string {
    return this.doc.encoding;
  }
  get bom(): boolean {
    return this.doc.bom;
  }
  get lineEnding(): LineEnding {
    return this.doc.lineEnding;
  }
  get language(): string {
    return this.doc.language;
  }
  get dirty(): boolean {
    return this.doc.dirty;
  }
  get viewer(): string | null {
    return this.doc.viewer;
  }

  get large(): boolean {
    return this.doc.large;
  }
}

/** A group of tabs with its own editor view (one pane of a split). */
export class Group {
  readonly id: string;
  tabs = $state<Tab[]>([]);
  activeId = $state<string | null>(null);
  view: EditorView | null = null;

  constructor(id: string) {
    this.id = id;
  }

  activeTab(): Tab | null {
    return this.tabs.find((t) => t.id === this.activeId) ?? null;
  }
}
