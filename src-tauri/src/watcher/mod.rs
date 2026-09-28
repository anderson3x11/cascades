//! Watches open files for changes made by other programs. Watches the parent
//! folders rather than the files, so saves that replace the file (write to a
//! temporary file then rename) are seen too. Emits `file-changed` with the
//! path as the frontend registered it; the frontend decides what changed by
//! reading the file.

use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

pub const EVENT: &str = "file-changed";

#[derive(Clone, Serialize)]
pub struct FileChanged {
    pub path: String,
}

/// Watched files by normalized path: (path as registered, reference count).
type Files = Arc<Mutex<HashMap<String, (String, usize)>>>;

pub struct FileWatcher {
    files: Files,
    dirs: Mutex<HashMap<PathBuf, usize>>,
    watcher: Mutex<RecommendedWatcher>,
}

/// Comparison key for a path: Windows paths are case-insensitive and accept both separators.
fn key(path: &Path) -> String {
    let text = path.to_string_lossy();
    if cfg!(windows) {
        text.replace('/', "\\").to_lowercase()
    } else {
        text.into_owned()
    }
}

impl FileWatcher {
    pub fn new(app: AppHandle) -> notify::Result<Self> {
        let files: Files = Arc::default();
        let seen = files.clone();
        let watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
            let Ok(event) = res else { return };
            if !matches!(
                event.kind,
                EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_)
            ) {
                return;
            }
            let files = seen.lock().unwrap();
            for path in &event.paths {
                if let Some((original, _)) = files.get(&key(path)) {
                    let _ = app.emit(
                        EVENT,
                        FileChanged {
                            path: original.clone(),
                        },
                    );
                }
            }
        })?;
        Ok(Self {
            files,
            dirs: Mutex::default(),
            watcher: Mutex::new(watcher),
        })
    }

    pub fn watch(&self, path: &str) -> Result<(), String> {
        let file = Path::new(path);
        let dir = file
            .parent()
            .ok_or("File has no parent folder")?
            .to_path_buf();
        {
            let mut files = self.files.lock().unwrap();
            let entry = files.entry(key(file)).or_insert((path.to_owned(), 0));
            entry.1 += 1;
            if entry.1 > 1 {
                return Ok(());
            }
        }
        // The files lock is released before touching the watcher, whose
        // callback takes that lock.
        let mut dirs = self.dirs.lock().unwrap();
        let count = dirs.entry(dir.clone()).or_insert(0);
        *count += 1;
        if *count == 1 {
            let result = self
                .watcher
                .lock()
                .unwrap()
                .watch(&dir, RecursiveMode::NonRecursive);
            if let Err(e) = result {
                dirs.remove(&dir);
                self.files.lock().unwrap().remove(&key(file));
                return Err(e.to_string());
            }
        }
        Ok(())
    }

    pub fn unwatch(&self, path: &str) {
        let file = Path::new(path);
        {
            let mut files = self.files.lock().unwrap();
            let Some(entry) = files.get_mut(&key(file)) else {
                return;
            };
            entry.1 -= 1;
            if entry.1 > 0 {
                return;
            }
            files.remove(&key(file));
        }
        let Some(dir) = file.parent() else { return };
        let mut dirs = self.dirs.lock().unwrap();
        if let Some(count) = dirs.get_mut(dir) {
            *count -= 1;
            if *count == 0 {
                dirs.remove(dir);
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
}
