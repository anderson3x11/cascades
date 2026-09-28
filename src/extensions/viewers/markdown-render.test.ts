import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown-render';

describe('renderMarkdown', () => {
  it('marks each block with its source line', () => {
    const html = renderMarkdown('# Titre\n\nUn paragraphe.\n\n- a\n- b\n');
    expect(html).toContain('<h1 data-line="1">Titre</h1>');
    expect(html).toContain('<p data-line="3">Un paragraphe.</p>');
    expect(html).toContain('<ul data-line="5">');
  });

  it('renders tables, task lists and footnotes', () => {
    const html = renderMarkdown(
      '| Jeu | Note |\n| --- | --- |\n| Elden Ring | 18 |\n\n- [x] fini\n- [ ] à faire\n\nTexte[^1]\n\n[^1]: Une note.\n',
    );
    expect(html).toContain('<table data-line="1">');
    expect(html).toContain('<td>Elden Ring</td>');
    expect(html).toMatch(
      /<input class="task-list-item-checkbox" checked="" disabled="" type="checkbox"/,
    );
    expect(html).toContain('class="footnote-ref"');
    expect(html).toContain('Une note.');
  });

  it('keeps fenced code with its language class', () => {
    const html = renderMarkdown('```js\nconst a = 1;\n```\n');
    expect(html).toContain(
      '<pre><code data-line="1" class="language-js">const a = 1;\n</code></pre>',
    );
  });
});
