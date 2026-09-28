//! Folder operations for the explorer: listing, creating, renaming, and
//! sending to the recycle bin.

use serde::Serialize;
use std::fs::{self, OpenOptions};
use std::io;
use std::path::Path;

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    pub name: String,
    pub is_dir: bool,
}

/// Entries of a folder, unsorted. A link to a folder counts as a folder.
pub fn list_dir(path: &Path) -> io::Result<Vec<DirEntry>> {
    let mut entries = Vec::new();
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let is_dir = fs::metadata(entry.path())
            .map(|m| m.is_dir())
            .unwrap_or(false);
        entries.push(DirEntry {
            name: entry.file_name().to_string_lossy().into_owned(),
            is_dir,
        });
    }
    Ok(entries)
}

/// Creates an empty file; fails if something already has that name.
pub fn create_file(path: &Path) -> io::Result<()> {
    OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map(|_| ())
}

pub fn create_dir(path: &Path) -> io::Result<()> {
    fs::create_dir(path)
}

/// Renames a file or folder without replacing anything already there.
pub fn rename(from: &Path, to: &Path) -> io::Result<()> {
    // A change of case only ("notes" to "Notes") is the same entry on Windows.
    let same = from.to_string_lossy().to_lowercase() == to.to_string_lossy().to_lowercase();
    if to.exists() && !same {
        return Err(io::Error::new(
            io::ErrorKind::AlreadyExists,
            "un fichier ou dossier porte déjà ce nom",
        ));
    }
    fs::rename(from, to)
}

#[derive(Debug, Serialize)]
pub struct FileList {
    pub files: Vec<String>,
    /// The limit was reached: some files are missing.
    pub truncated: bool,
}

/// Whether a name matches a pattern where `*` stands for any text, ignoring case.
fn matches(name: &str, pattern: &str) -> bool {
    let name = name.to_lowercase();
    let pattern = pattern.to_lowercase();
    let mut parts = pattern.split('*');
    let first = parts.next().unwrap_or_default();
    let Some(mut rest) = name.strip_prefix(first) else {
        return false;
    };
    let parts: Vec<&str> = parts.collect();
    for (i, part) in parts.iter().enumerate() {
        if i == parts.len() - 1 {
            return rest.ends_with(part);
        }
        match rest.find(part) {
            Some(at) => rest = &rest[at + part.len()..],
            None => return false,
        }
    }
    rest.is_empty()
}

/// Every file under the folders, at most `limit`, skipping what .gitignore
/// files ignore and the names matching `exclude` (see the explorer.exclude setting).
pub fn list_files(roots: &[String], exclude: &[String], limit: usize) -> FileList {
    let mut files = Vec::new();
    for root in roots {
        let patterns = exclude.to_vec();
        let walker = ignore::WalkBuilder::new(root)
            .hidden(false)
            .require_git(false)
            .filter_entry(move |entry| {
                let name = entry.file_name().to_string_lossy();
                !patterns.iter().any(|p| matches(&name, p))
            })
            .build();
        for entry in walker.flatten() {
            if !entry.file_type().is_some_and(|t| t.is_file()) {
                continue;
            }
            if files.len() == limit {
                return FileList {
                    files,
                    truncated: true,
                };
            }
            files.push(entry.path().to_string_lossy().into_owned());
        }
    }
    FileList {
        files,
        truncated: false,
    }
}

/// Sends a file or folder to the recycle bin.
pub fn trash(path: &Path) -> Result<(), String> {
    trash::delete(path).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    /// A fresh empty folder in the system temp folder.
    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("cascades-test-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn names_match_simple_patterns() {
        assert!(matches("node_modules", "node_modules"));
        assert!(matches("Debug.LOG", "*.log"));
        assert!(matches("notes-2025.txt", "notes*.txt"));
        assert!(!matches("notes.txt", "*.log"));
        assert!(!matches("my.git", ".git"));
    }

    #[test]
    fn lists_files_with_gitignore_and_exclusions() {
        let dir = temp_dir("list");
        fs::write(
            dir.join(".gitignore"),
            "*.tmp
",
        )
        .unwrap();
        fs::create_dir_all(dir.join("notes")).unwrap();
        fs::create_dir_all(dir.join("node_modules/lib")).unwrap();
        fs::write(dir.join("notes/a.txt"), "").unwrap();
        fs::write(dir.join("b.tmp"), "").unwrap();
        fs::write(dir.join("node_modules/lib/c.js"), "").unwrap();

        let roots = [dir.to_string_lossy().into_owned()];
        let list = list_files(&roots, &["node_modules".into()], 100);
        let mut names: Vec<String> = list
            .files
            .iter()
            .map(|f| {
                Path::new(f)
                    .file_name()
                    .unwrap()
                    .to_string_lossy()
                    .into_owned()
            })
            .collect();
        names.sort();
        assert_eq!(names, vec![".gitignore", "a.txt"]);
        assert!(!list.truncated);
        assert!(list_files(&roots, &[], 1).truncated);
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn creates_lists_and_renames() {
        let dir = temp_dir("folder");
        create_file(&dir.join("notes.txt")).unwrap();
        create_dir(&dir.join("archives")).unwrap();
        assert!(create_file(&dir.join("notes.txt")).is_err());

        let mut entries = list_dir(&dir).unwrap();
        entries.sort_by(|a, b| a.name.cmp(&b.name));
        assert_eq!(
            entries,
            vec![
                DirEntry {
                    name: "archives".into(),
                    is_dir: true
                },
                DirEntry {
                    name: "notes.txt".into(),
                    is_dir: false
                },
            ]
        );

        // Renaming onto an existing name is refused, a change of case is not.
        assert!(rename(&dir.join("notes.txt"), &dir.join("archives")).is_err());
        rename(&dir.join("notes.txt"), &dir.join("Notes.txt")).unwrap();
        assert!(
            list_dir(&dir)
                .unwrap()
                .iter()
                .any(|e| e.name == "Notes.txt")
        );
        fs::remove_dir_all(&dir).unwrap();
    }
}
