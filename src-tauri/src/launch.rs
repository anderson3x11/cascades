//! Files given to the app from outside: on the command line ("Open with",
//! double-click), from a second launch while Cascades runs, or by the macOS
//! Finder. Until the interface asks for them, they wait here; after that, they
//! go to it as an "open-files" event.

use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

/// Some(paths) until the interface has taken them, then None.
pub struct Pending(Mutex<Option<Vec<String>>>);

impl Default for Pending {
    fn default() -> Self {
        Self(Mutex::new(Some(Vec::new())))
    }
}

/// The existing files among command line arguments, relative ones taken from `cwd`.
pub fn files_from_args(args: &[String], cwd: &Path) -> Vec<String> {
    args.iter()
        .filter(|arg| !arg.starts_with('-'))
        .map(|arg| {
            let path = PathBuf::from(arg);
            if path.is_absolute() {
                path
            } else {
                cwd.join(path)
            }
        })
        .filter(|path| path.is_file())
        .map(|path| path.to_string_lossy().into_owned())
        .collect()
}

/// Hands files to the interface, or keeps them until it is ready.
pub fn open(app: &AppHandle, paths: Vec<String>) {
    if paths.is_empty() {
        return;
    }
    let state = app.state::<Pending>();
    let mut pending = state.0.lock().unwrap_or_else(|e| e.into_inner());
    match pending.as_mut() {
        Some(waiting) => waiting.extend(paths),
        None => {
            drop(pending);
            let _ = app.emit("open-files", paths);
        }
    }
}

/// Brings the window to the front, for a second launch.
pub fn focus(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// The files given before the interface was ready. Later ones come as events.
#[tauri::command]
pub fn take_pending_files(pending: State<'_, Pending>) -> Vec<String> {
    pending
        .0
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .take()
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_existing_files_and_resolves_relative_ones() {
        let dir = std::env::temp_dir().join(format!("cascades-launch-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("a.txt"), "a").unwrap();
        let args = [
            "a.txt".to_string(),
            "--flag".to_string(),
            "missing.txt".to_string(),
            dir.to_string_lossy().into_owned(),
        ];
        assert_eq!(
            files_from_args(&args, &dir),
            [dir.join("a.txt").to_string_lossy().into_owned()]
        );
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
