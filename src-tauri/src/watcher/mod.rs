//! Watches files and folders for changes made by other programs.
//!
//! Files: the parent folders are watched rather than the files, so saves that
//! replace the file (write to a temporary file then rename) are seen too.
//! Emits `file-changed` with the path as the frontend registered it; the
//! frontend decides what changed by reading the file.
//!
//! Folders: emits `dir-changed` when an entry of the folder is created,
//! removed or renamed (the explorer then lists the folder again).

use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

pub const EVENT: &str = "file-changed";
pub const DIR_EVENT: &str = "dir-changed";

#[derive(Clone, Serialize)]
pub struct FileChanged {
    pub path: String,
}

/// Registered paths by normalized key: (path as registered, reference count).
type Registry = Arc<Mutex<HashMap<String, (String, usize)>>>;

pub struct FileWatcher {
    files: Registry,
    folders: Registry,
    /// Folders watched by notify, with the number of users (files and folders).
    watched: Mutex<HashMap<PathBuf, usize>>,
    watcher: Mutex<RecommendedWatcher>,
}

/// Comparison key for a path: Windows paths are case-insensitive and accept both separators.
fn key(path: &Path) -> String {
    let text = path.to_string_lossy();
    if cfg!(windows) {
        text.replace('/', "\\")
            .trim_end_matches('\\')
            .to_lowercase()
    } else {
        text.trim_end_matches('/').to_owned()
    }
}

/// Adds one reference; true for the first one.
fn add(registry: &Registry, path: &Path, original: &str) -> bool {
    let mut map = registry.lock().unwrap();
    let entry = map.entry(key(path)).or_insert((original.to_owned(), 0));
    entry.1 += 1;
    entry.1 == 1
}

/// Removes one reference; true when it was the last one.
fn remove(registry: &Registry, path: &Path) -> bool {
    let mut map = registry.lock().unwrap();
    let Some(entry) = map.get_mut(&key(path)) else {
        return false;
    };
    entry.1 -= 1;
    if entry.1 > 0 {
        return false;
    }
    map.remove(&key(path));
    true
}

impl FileWatcher {
    pub fn new(app: AppHandle) -> notify::Result<Self> {
        let files: Registry = Arc::default();
        let folders: Registry = Arc::default();
        let (seen_files, seen_folders) = (files.clone(), folders.clone());
        let watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
            let Ok(event) = res else { return };
            let is_change = matches!(
                event.kind,
                EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_)
            );
            if !is_change {
                return;
            }
            // Content changes do not change a folder listing.
            let is_listing_change = !matches!(
                event.kind,
                EventKind::Modify(notify::event::ModifyKind::Data(_))
            );
            for path in &event.paths {
                if let Some((original, _)) = seen_files.lock().unwrap().get(&key(path)) {
                    let _ = app.emit(
                        EVENT,
                        FileChanged {
                            path: original.clone(),
                        },
                    );
                }
                if !is_listing_change {
                    continue;
                }
                let Some(parent) = path.parent() else {
                    continue;
                };
                if let Some((original, _)) = seen_folders.lock().unwrap().get(&key(parent)) {
                    let _ = app.emit(
                        DIR_EVENT,
                        FileChanged {
                            path: original.clone(),
                        },
                    );
                }
            }
        })?;
        Ok(Self {
            files,
            folders,
            watched: Mutex::default(),
            watcher: Mutex::new(watcher),
        })
    }

    pub fn watch(&self, path: &str) -> Result<(), String> {
        let file = Path::new(path);
        let dir = file.parent().ok_or("File has no parent folder")?;
        if !add(&self.files, file, path) {
            return Ok(());
        }
        self.watch_folder(dir).inspect_err(|_| {
            remove(&self.files, file);
        })
    }

    pub fn unwatch(&self, path: &str) {
        let file = Path::new(path);
        if remove(&self.files, file)
            && let Some(dir) = file.parent()
        {
            self.unwatch_folder(dir);
        }
    }

    /// Watches the entries of a folder (not its subfolders).
    pub fn watch_dir(&self, path: &str) -> Result<(), String> {
        let dir = Path::new(path);
        if !add(&self.folders, dir, path) {
            return Ok(());
        }
        self.watch_folder(dir).inspect_err(|_| {
            remove(&self.folders, dir);
        })
    }

    pub fn unwatch_dir(&self, path: &str) {
        let dir = Path::new(path);
        if remove(&self.folders, dir) {
            self.unwatch_folder(dir);
        }
    }

    // The registry locks are released before touching the watcher, whose
    // callback takes them.
    fn watch_folder(&self, dir: &Path) -> Result<(), String> {
        let mut watched = self.watched.lock().unwrap();
        let count = watched.entry(dir.to_path_buf()).or_insert(0);
        *count += 1;
        if *count == 1 {
            let result = self
                .watcher
                .lock()
                .unwrap()
                .watch(dir, RecursiveMode::NonRecursive);
            if let Err(e) = result {
                watched.remove(dir);
                return Err(e.to_string());
            }
        }
        Ok(())
    }

    fn unwatch_folder(&self, dir: &Path) {
        let mut watched = self.watched.lock().unwrap();
        if let Some(count) = watched.get_mut(dir) {
            *count -= 1;
            if *count == 0 {
                watched.remove(dir);
                let _ = self.watcher.lock().unwrap().unwatch(dir);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keys_ignore_case_and_separators_on_windows() {
        let a = key(Path::new("C:/Users/Me/Notes.txt"));
        let b = key(Path::new("c:\\users\\me\\notes.txt"));
        if cfg!(windows) {
            assert_eq!(a, b);
        } else {
            assert_ne!(a, b);
        }
    }

    #[test]
    fn keys_ignore_a_trailing_separator() {
        assert_eq!(key(Path::new("C:/notes/")), key(Path::new("C:/notes")));
    }
}
