//! Tauri commands exposed to the frontend (see src/platform/fs.ts).

use crate::config;
use crate::fs::{self, Decoded, TextInfo};
use crate::watcher::FileWatcher;
use tauri::{AppHandle, Manager, State};

/// Lets the page load files of one folder through the asset protocol (images
/// of an open Markdown file, an open image). Nothing is reachable before that.
#[tauri::command]
pub fn allow_asset_dir(app: AppHandle, dir: String) -> Result<(), String> {
    app.asset_protocol_scope()
        .allow_directory(&dir, false)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn watch_file(watcher: State<'_, FileWatcher>, path: String) -> Result<(), String> {
    watcher.watch(&path)
}

#[tauri::command]
pub fn unwatch_file(watcher: State<'_, FileWatcher>, path: String) {
    watcher.unwatch(&path);
}

#[tauri::command]
pub async fn read_text_file(path: String) -> Result<Decoded, String> {
    let bytes = std::fs::read(&path).map_err(|e| format!("{path}: {e}"))?;
    Ok(fs::decode(&bytes))
}

#[tauri::command]
pub async fn write_text_file(path: String, text: String, info: TextInfo) -> Result<(), String> {
    let bytes = fs::encode(&text, &info)?;
    std::fs::write(&path, bytes).map_err(|e| format!("{path}: {e}"))
}

#[tauri::command]
pub async fn config_dir(app: AppHandle) -> Result<String, String> {
    Ok(config::config_dir(&app)?.to_string_lossy().into_owned())
}

// Not async: synchronous commands run on the main thread, where dialogs are shown.
#[tauri::command]
pub fn cursor_unhide() -> u32 {
    crate::cursor::unhide()
}

#[tauri::command]
pub fn cursor_restore(raised: u32) {
    crate::cursor::restore(raised);
}

/// Returns None when the file does not exist.
#[tauri::command]
pub async fn read_config_file(app: AppHandle, name: String) -> Result<Option<String>, String> {
    let path = config::config_file(&config::config_dir(&app)?, &name)?;
    match std::fs::read_to_string(&path) {
        Ok(text) => Ok(Some(text)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("{}: {e}", path.display())),
    }
}

#[tauri::command]
pub async fn list_config_folder(app: AppHandle, folder: String) -> Result<Vec<String>, String> {
    config::list_folder(&config::config_dir(&app)?, &folder)
}

#[tauri::command]
pub async fn write_config_file(
    app: AppHandle,
    name: String,
    content: String,
) -> Result<(), String> {
    let path = config::config_file(&config::config_dir(&app)?, &name)?;
    config::write_atomic(&path, content.as_bytes()).map_err(|e| format!("{}: {e}", path.display()))
}
