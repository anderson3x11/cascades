import MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';
import taskLists from 'markdown-it-task-lists';

/**
 * Markdown to HTML (not sanitized: the viewer runs DOMPurify on it). Every
 * block carries data-line="N", its first source line, for scroll sync.
 */
type Renderer = InstanceType<typeof MarkdownIt>;

function createRenderer(): Renderer {
  const md = new MarkdownIt({ html: true, linkify: true, typographer: false });
  md.use(footnote);
  md.use(taskLists, { enabled: false, label: true });
  md.core.ruler.push('source_lines', (state) => {
    for (const token of state.tokens) {
      if (token.map && token.block && token.nesting >= 0) {
        token.attrSet('data-line', String(token.map[0] + 1));
      }
    }
  });
  return md;
}

let renderer: Renderer | null = null;

export function renderMarkdown(text: string): string {
  renderer ??= createRenderer();
  return renderer.render(text);
}
