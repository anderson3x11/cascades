import { Channel, isTauri } from '@tauri-apps/api/core';
import { invoke } from './invoke';
import { fakeFs } from './fake-fs';
import { t } from '../core/i18n/i18n';

export interface SearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
}

export interface LineMatch {
  /** 1-based. */
  line: number;
  /** Position and length in the line, in UTF-16 code units (JavaScript string indices). */
  column: number;
  length: number;
  /** Text around the match, cut on long lines. */
  before: string;
  matched: string;
  after: string;
  /** What the match becomes, when a replacement is given. */
  replacement: string | null;
}

export interface FileMatches {
  path: string;
  matches: LineMatch[];
}

export interface SearchRequest {
  roots: string[];
  exclude: string[];
  query: string;
  options: SearchOptions;
  /** To preview each replacement. */
  replacement?: string | null;
  /** The search stops past this many matches. */
  maxMatches: number;
}

export interface SearchRun {
  /** Resolves when the search is over. Rejects on an invalid expression. */
  done: Promise<{ truncated: boolean; cancelled: boolean }>;
  cancel(): void;
}

let nextId = 1;

/** Searches the files of the folders; `onFile` gets each file with matches as it is found. */
export function searchFiles(
  request: SearchRequest,
  onFile: (file: FileMatches) => void,
): SearchRun {
  if (!isTauri()) return fakeSearch(request, onFile);
  const id = nextId++;
  let received = 0;
  let expected: number | null = null;
  let allReceived: () => void = () => {};
  const channel = new Channel<FileMatches>();
  channel.onmessage = (file) => {
    received++;
    onFile(file);
    if (received === expected) allReceived();
  };
  const done = (async () => {
    const result = await invoke<{ files: number; truncated: boolean; cancelled: boolean }>(
      'search_files',
      { onFile: channel, id, ...request, replacement: request.replacement ?? null },
    );
    // The last files may still be on their way.
    if (received < result.files) {
      expected = result.files;
      await new Promise<void>((resolve) => (allReceived = resolve));
    }
    return { truncated: result.truncated, cancelled: result.cancelled };
  })();
  return { done, cancel: () => void invoke('cancel_search') };
}

export interface Replaced {
  path: string;
  count: number;
  error: string | null;
}

/** Replaces the matches in each file, keeping its encoding and line endings. */
export async function replaceInFiles(
  paths: string[],
  query: string,
  options: SearchOptions,
  replacement: string,
): Promise<Replaced[]> {
  if (!isTauri()) return fakeReplace(paths, query, options, replacement);
  return await invoke<Replaced[]>('replace_in_files', { paths, query, options, replacement });
}

// In the browser (dev server, e2e tests): the same over the in-memory disk,
// with JavaScript regular expressions.

function regexOf(query: string, options: SearchOptions): RegExp {
  let source = options.regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (options.wholeWord) source = `\\b(?:${source})\\b`;
  try {
    return new RegExp(source, options.caseSensitive ? 'gu' : 'giu');
  } catch (err) {
    throw new Error(
      t('invalid expression: {problem}', {
        problem: err instanceof Error ? err.message : String(err),
      }),
      {
        cause: err,
      },
    );
  }
}

function fakeSearch(request: SearchRequest, onFile: (file: FileMatches) => void): SearchRun {
  const done = (async () => {
    const re = regexOf(request.query, request.options);
    let total = 0;
    for (const path of fakeFs.listFiles(request.roots, request.exclude, Infinity).files) {
      const matches: LineMatch[] = [];
      fakeFs
        .read(path)
        .split('\n')
        .forEach((line, index) => {
          for (const m of line.matchAll(re)) {
            if (m[0] === '') continue;
            const column = m.index;
            matches.push({
              line: index + 1,
              column,
              length: m[0].length,
              before: line.slice(0, column).trimStart(),
              matched: m[0],
              after: line.slice(column + m[0].length),
              replacement:
                request.replacement == null
                  ? null
                  : request.options.regex
                    ? m[0].replace(
                        new RegExp(re.source, re.flags.replace('g', '')),
                        request.replacement,
                      )
                    : request.replacement,
            });
          }
        });
      if (matches.length === 0) continue;
      onFile({ path, matches });
      total += matches.length;
      if (total >= request.maxMatches) return { truncated: true, cancelled: false };
    }
    return { truncated: false, cancelled: false };
  })();
  return { done, cancel: () => {} };
}

function fakeReplace(
  paths: string[],
  query: string,
  options: SearchOptions,
  replacement: string,
): Replaced[] {
  const re = regexOf(query, options);
  return paths.map((path) => {
    let count = 0;
    const text = fakeFs
      .read(path)
      .split('\n')
      .map((line) =>
        line.replace(re, (...args: unknown[]) => {
          count++;
          const matched = args[0] as string;
          return options.regex
            ? matched.replace(new RegExp(re.source, re.flags.replace('g', '')), replacement)
            : replacement;
        }),
      )
      .join('\n');
    fakeFs.write(path, text);
    return { path, count, error: null };
  });
}
