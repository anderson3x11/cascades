//! Tauri commands exposed to the frontend (see src/platform/fs.ts).

use crate::config;
use crate::folder::{self, DirEntry, FileList};
use crate::fs::{self, Decoded, TextInfo};
use crate::search;
use crate::spell::{Misspelling, Speller};
use crate::watcher::FileWatcher;
use serde::Serialize;
use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use tauri::ipc::Channel;
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
pub fn watch_dir(watcher: State<'_, FileWatcher>, path: String) -> Result<(), String> {
    watcher.watch_dir(&path)
}

#[tauri::command]
pub fn unwatch_dir(watcher: State<'_, FileWatcher>, path: String) {
    watcher.unwatch_dir(&path);
}

#[tauri::command]
pub async fn list_dir(path: String) -> Result<Vec<DirEntry>, String> {
    folder::list_dir(Path::new(&path)).map_err(|e| format!("{path}: {e}"))
}

/// Runs on a worker thread: walking a big folder must not hold up other commands.
#[tauri::command]
pub async fn list_files(
    roots: Vec<String>,
    exclude: Vec<String>,
    limit: usize,
) -> Result<FileList, String> {
    tauri::async_runtime::spawn_blocking(move || folder::list_files(&roots, &exclude, limit))
        .await
        .map_err(|e| e.to_string())
}

/// The search in progress: starting another one or cancelling bumps it, and
/// the older search stops at its next file.
#[derive(Default)]
pub struct Searches(Arc<AtomicU64>);

#[derive(Serialize)]
pub struct SearchDone {
    /// Files sent to the channel, so that the page knows when it has them all.
    files: usize,
    /// The limit of matches was reached.
    truncated: bool,
    /// Another search replaced this one.
    cancelled: bool,
}

/// Searches the folders, sending each file with matches to `on_file`.
#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn search_files(
    on_file: Channel<search::FileMatches>,
    searches: State<'_, Searches>,
    id: u64,
    roots: Vec<String>,
    exclude: Vec<String>,
    query: String,
    options: search::SearchOptions,
    replacement: Option<String>,
    max_matches: usize,
) -> Result<SearchDone, String> {
    let re = search::build(&query, &options)?;
    let current = searches.0.clone();
    current.store(id, Ordering::SeqCst);
    tauri::async_runtime::spawn_blocking(move || {
        let mut total = 0;
        let mut files = 0;
        let mut cancelled = false;
        let complete = folder::walk_files(&roots, &exclude, |path| {
            if current.load(Ordering::SeqCst) != id {
                cancelled = true;
                return false;
            }
            let Some(decoded) = search::read(path) else {
                return true;
            };
            let matches = search::find(&decoded.text, &re, replacement.as_deref(), &options);
            if matches.is_empty() {
                return true;
            }
            total += matches.len();
            let file = search::FileMatches {
                path: path.to_string_lossy().into_owned(),
                matches,
            };
            if on_file.send(file).is_ok() {
                files += 1;
            }
            total < max_matches
        });
        SearchDone {
            files,
            truncated: !complete && !cancelled,
            cancelled,
        }
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn cancel_search(searches: State<'_, Searches>) {
    searches.0.fetch_add(1, Ordering::SeqCst);
}

#[derive(Serialize)]
pub struct Replaced {
    path: String,
    count: usize,
    error: Option<String>,
}

/// Replaces in each file, line by line as the search found the matches.
#[tauri::command]
pub async fn replace_in_files(
    paths: Vec<String>,
    query: String,
    options: search::SearchOptions,
    replacement: String,
) -> Result<Vec<Replaced>, String> {
    let re = search::build(&query, &options)?;
    tauri::async_runtime::spawn_blocking(move || {
        paths
            .into_iter()
            .map(|path| {
                match search::replace_in_file(Path::new(&path), &re, &replacement, &options) {
                    Ok(count) => Replaced {
                        path,
                        count,
                        error: None,
                    },
                    Err(error) => Replaced {
                        path,
                        count: 0,
                        error: Some(error),
                    },
                }
            })
            .collect()
    })
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn spell_check(
    speller: State<'_, Speller>,
    language: String,
    lines: Vec<String>,
) -> Result<Vec<Vec<Misspelling>>, String> {
    speller.check(language, lines)
}

#[tauri::command]
pub async fn spell_suggest(
    speller: State<'_, Speller>,
    language: String,
    word: String,
) -> Result<Vec<String>, String> {
    speller.suggest(language, word)
}

#[tauri::command]
pub async fn spell_add(
    speller: State<'_, Speller>,
    language: String,
    word: String,
) -> Result<(), String> {
    speller.add(language, word)
}

#[tauri::command]
pub async fn create_file(path: String) -> Result<(), String> {
    folder::create_file(Path::new(&path)).map_err(|e| format!("{path}: {e}"))
}

#[tauri::command]
pub async fn create_dir(path: String) -> Result<(), String> {
    folder::create_dir(Path::new(&path)).map_err(|e| format!("{path}: {e}"))
}

#[tauri::command]
pub async fn rename_path(from: String, to: String) -> Result<(), String> {
    folder::rename(Path::new(&from), Path::new(&to)).map_err(|e| format!("{to}: {e}"))
}

#[tauri::command]
pub async fn trash_path(path: String) -> Result<(), String> {
    folder::trash(Path::new(&path)).map_err(|e| format!("{path}: {e}"))
}

#[tauri::command]
pub async fn file_size(path: String) -> Result<u64, String> {
    std::fs::metadata(&path)
        .map(|m| m.len())
        .map_err(|e| format!("{path}: {e}"))
}

/// Raw bytes of a file, or of `length` bytes from `offset`. Sent as binary,
/// not as a JSON array.
#[tauri::command]
pub async fn read_binary(
    path: String,
    offset: Option<u64>,
    length: Option<u64>,
) -> Result<tauri::ipc::Response, String> {
    use std::io::{Read, Seek, SeekFrom};
    let error = |e: std::io::Error| format!("{path}: {e}");
    let mut file = std::fs::File::open(&path).map_err(error)?;
    if let Some(offset) = offset {
        file.seek(SeekFrom::Start(offset)).map_err(error)?;
    }
    let mut bytes = Vec::new();
    match length {
        Some(length) => file.take(length).read_to_end(&mut bytes),
        None => file.read_to_end(&mut bytes),
    }
    .map_err(error)?;
    Ok(tauri::ipc::Response::new(bytes))
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
