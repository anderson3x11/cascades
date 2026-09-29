//! Search and replace in the files of the open folders.
//!
//! Matching is done line by line, on the decoded text (any encoding), so a
//! match never spans lines. Positions sent to the frontend count UTF-16 code
//! units, like JavaScript strings.

use crate::fs;
use regex::{Regex, RegexBuilder};
use serde::{Deserialize, Serialize};
use std::path::Path;

/// Files bigger than this are not searched (logs, dumps).
const MAX_FILE_SIZE: u64 = 20 * 1024 * 1024;
/// Characters of context shown before and after a match.
const BEFORE: usize = 40;
const AFTER: usize = 120;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchOptions {
    pub case_sensitive: bool,
    pub whole_word: bool,
    pub regex: bool,
}

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LineMatch {
    /// 1-based line number.
    pub line: usize,
    /// Position and length in the line, in UTF-16 code units.
    pub column: usize,
    pub length: usize,
    /// Text around the match, cut on long lines.
    pub before: String,
    pub matched: String,
    pub after: String,
    /// What the match becomes, when a replacement is given.
    pub replacement: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct FileMatches {
    pub path: String,
    pub matches: Vec<LineMatch>,
}

/// The regex for a query; `whole_word` and escaping apply to plain text too.
pub fn build(query: &str, options: &SearchOptions) -> Result<Regex, String> {
    let pattern = if options.regex {
        query.to_owned()
    } else {
        regex::escape(query)
    };
    let pattern = if options.whole_word {
        format!(r"\b(?:{pattern})\b")
    } else {
        pattern
    };
    RegexBuilder::new(&pattern)
        .case_insensitive(!options.case_sensitive)
        .build()
        .map_err(|e| match e {
            regex::Error::Syntax(message) => format!("invalid expression: {message}"),
            other => other.to_string(),
        })
}

fn utf16_len(text: &str) -> usize {
    text.encode_utf16().count()
}

/// The last `count` characters of `text`, with "…" when cut.
fn tail(text: &str, count: usize) -> String {
    let chars: Vec<char> = text.chars().collect();
    if chars.len() <= count {
        return text.trim_start().to_owned();
    }
    let kept: String = chars[chars.len() - count..].iter().collect();
    format!("…{kept}")
}

fn head(text: &str, count: usize) -> String {
    let mut chars = text.chars();
    let kept: String = chars.by_ref().take(count).collect();
    if chars.next().is_some() {
        format!("{kept}…")
    } else {
        kept
    }
}

/// The matches of `re` in `text`, line by line.
pub fn find(
    text: &str,
    re: &Regex,
    replacement: Option<&str>,
    options: &SearchOptions,
) -> Vec<LineMatch> {
    let mut out = Vec::new();
    for (index, line) in text.split('\n').enumerate() {
        for caps in re.captures_iter(line) {
            let whole = caps.get(0).expect("group 0 always matches");
            if whole.is_empty() {
                continue;
            }
            let replacement = replacement.map(|r| {
                if options.regex {
                    let mut out = String::new();
                    caps.expand(r, &mut out);
                    out
                } else {
                    r.to_owned()
                }
            });
            out.push(LineMatch {
                line: index + 1,
                column: utf16_len(&line[..whole.start()]),
                length: utf16_len(whole.as_str()),
                before: tail(&line[..whole.start()], BEFORE),
                matched: whole.as_str().to_owned(),
                after: head(&line[whole.end()..], AFTER),
                replacement,
            });
        }
    }
    out
}

/// Decoded text of a file worth searching: not too big, not binary.
pub fn read(path: &Path) -> Option<fs::Decoded> {
    let size = std::fs::metadata(path).ok()?.len();
    if size > MAX_FILE_SIZE {
        return None;
    }
    let decoded = fs::decode(&std::fs::read(path).ok()?);
    (!decoded.binary).then_some(decoded)
}

/// Replaces every match line by line (so exactly what the search showed).
/// Returns the new text and the number of replacements.
pub fn replace(
    text: &str,
    re: &Regex,
    replacement: &str,
    options: &SearchOptions,
) -> (String, usize) {
    let mut count = 0;
    let lines: Vec<String> = text
        .split('\n')
        .map(|line| {
            let matches = re.find_iter(line).filter(|m| !m.is_empty()).count();
            if matches == 0 {
                return line.to_owned();
            }
            count += matches;
            let replaced = if options.regex {
                re.replace_all(line, replacement)
            } else {
                re.replace_all(line, regex::NoExpand(replacement))
            };
            replaced.into_owned()
        })
        .collect();
    (lines.join("\n"), count)
}

/// Replaces in a file on disk, keeping its encoding, BOM and line endings.
pub fn replace_in_file(
    path: &Path,
    re: &Regex,
    replacement: &str,
    options: &SearchOptions,
) -> Result<usize, String> {
    let decoded = read(path).ok_or("unreadable file, binary or too big")?;
    let (text, count) = replace(&decoded.text, re, replacement, options);
    if count > 0 {
        let bytes = fs::encode(&text, &decoded.info)?;
        std::fs::write(path, bytes).map_err(|e| e.to_string())?;
    }
    Ok(count)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn options(case_sensitive: bool, whole_word: bool, regex: bool) -> SearchOptions {
        SearchOptions {
            case_sensitive,
            whole_word,
            regex,
        }
    }

    #[test]
    fn finds_plain_text_case_and_words() {
        let text = "Notes du jour\nnotes, NOTES\ncarnotes";
        let plain = options(false, false, false);
        let re = build("notes", &plain).unwrap();
        let found: Vec<(usize, usize)> = find(text, &re, None, &plain)
            .iter()
            .map(|m| (m.line, m.column))
            .collect();
        assert_eq!(found, vec![(1, 0), (2, 0), (2, 7), (3, 3)]);

        let words = options(true, true, false);
        let re = build("notes", &words).unwrap();
        assert_eq!(find(text, &re, None, &words).len(), 1);

        // Special characters are plain text unless regex is on.
        let re = build("a.b", &plain).unwrap();
        assert!(find("axb", &re, None, &plain).is_empty());
    }

    #[test]
    fn columns_count_utf16_and_context_is_cut() {
        let plain = options(false, false, false);
        let re = build("x", &plain).unwrap();
        let found = find("é😀x", &re, None, &plain);
        assert_eq!((found[0].column, found[0].length), (3, 1));

        let long = format!("{}x{}", "a".repeat(100), "b".repeat(200));
        let found = find(&long, &re, None, &plain);
        assert!(found[0].before.starts_with('…'));
        assert!(found[0].after.ends_with('…'));
    }

    #[test]
    fn previews_and_replaces_with_groups() {
        let regex = options(true, false, true);
        let re = build(r"(\w+)@(\w+)", &regex).unwrap();
        let found = find("moi@ici et toi@la", &re, Some("$2:$1"), &regex);
        assert_eq!(found[1].replacement.as_deref(), Some("la:toi"));
        let (text, count) = replace("moi@ici et toi@la\nrien", &re, "$2:$1", &regex);
        assert_eq!((text.as_str(), count), ("ici:moi et la:toi\nrien", 2));

        // Plain mode does not expand "$1".
        let plain = options(false, false, false);
        let re = build("prix", &plain).unwrap();
        assert_eq!(replace("prix", &re, "$1", &plain).0, "$1");
    }

    #[test]
    fn reports_invalid_expressions() {
        assert!(
            build("(", &options(false, false, true))
                .unwrap_err()
                .starts_with("invalid expression")
        );
    }
}
