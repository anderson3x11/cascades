//! Location of the user configuration (settings.json, init.js, later themes
//! and plugins). Portable mode: when a file named `portable` sits next to the
//! executable, the configuration lives in a `config` folder beside it.

use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

pub fn config_dir(app: &AppHandle) -> Result<PathBuf, String> {
    if let Some(dir) = portable_dir() {
        return Ok(dir);
    }
    app.path().app_config_dir().map_err(|e| e.to_string())
}

fn portable_dir() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let exe_dir = exe.parent()?;
    exe_dir
        .join("portable")
        .is_file()
        .then(|| exe_dir.join("config"))
}

fn valid_segment(segment: &str) -> bool {
    !segment.is_empty() && !segment.contains(['/', '\\', ':']) && segment != "." && segment != ".."
}

/// A file of the config folder: "settings.json" or one level down, "themes/nord.json".
/// Nothing outside the config folder can be named.
pub fn config_file(dir: &Path, name: &str) -> Result<PathBuf, String> {
    let segments: Vec<&str> = name.split('/').collect();
    if segments.len() > 2 || !segments.iter().all(|s| valid_segment(s)) {
        return Err(format!("Invalid config file name: {name}"));
    }
    Ok(segments
        .iter()
        .fold(dir.to_path_buf(), |path, s| path.join(s)))
}

/// Names of the files in a subfolder of the config folder ("themes"), sorted.
/// An absent folder is empty.
pub fn list_folder(dir: &Path, folder: &str) -> Result<Vec<String>, String> {
    if !valid_segment(folder) {
        return Err(format!("Invalid config folder name: {folder}"));
    }
    let entries = match std::fs::read_dir(dir.join(folder)) {
        Ok(entries) => entries,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => return Err(e.to_string()),
    };
    let mut names: Vec<String> = entries
        .filter_map(Result::ok)
        .filter(|e| e.file_type().is_ok_and(|t| t.is_file()))
        .filter_map(|e| e.file_name().into_string().ok())
        .collect();
    names.sort();
    Ok(names)
}

/// Writes through a temporary file then renames it, so a crash never leaves a
/// half-written file. Creates the parent folder if needed.
pub fn write_atomic(path: &Path, content: &[u8]) -> std::io::Result<()> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir)?;
    }
    let tmp = path.with_extension("tmp");
    std::fs::write(&tmp, content)?;
    std::fs::rename(&tmp, path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn write_atomic_creates_and_replaces() {
        let dir = std::env::temp_dir().join(format!("cascades-test-{}", std::process::id()));
        let path = dir.join("nested").join("session.json");
        write_atomic(&path, b"one").unwrap();
        write_atomic(&path, b"two").unwrap();
        assert_eq!(std::fs::read(&path).unwrap(), b"two");
        assert!(!path.with_extension("tmp").exists());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn accepts_plain_names() {
        let dir = Path::new("cfg");
        assert_eq!(
            config_file(dir, "settings.json").unwrap(),
            dir.join("settings.json")
        );
    }

    #[test]
    fn accepts_one_subfolder() {
        let dir = Path::new("cfg");
        assert_eq!(
            config_file(dir, "themes/nord.json").unwrap(),
            dir.join("themes").join("nord.json")
        );
    }

    #[test]
    fn rejects_paths() {
        let dir = Path::new("cfg");
        for name in [
            "",
            "..",
            "../secret",
            "a/../b",
            "a/b/c",
            "a\\b",
            "C:x",
            "/abs",
            "themes/",
        ] {
            assert!(config_file(dir, name).is_err(), "{name} should be rejected");
        }
    }

    #[test]
    fn lists_folder_files() {
        let dir = std::env::temp_dir().join(format!("cascades-list-{}", std::process::id()));
        assert_eq!(list_folder(&dir, "themes").unwrap(), Vec::<String>::new());
        write_atomic(&dir.join("themes").join("b.json"), b"{}").unwrap();
        write_atomic(&dir.join("themes").join("a.json"), b"{}").unwrap();
        std::fs::create_dir_all(dir.join("themes").join("sub")).unwrap();
        assert_eq!(list_folder(&dir, "themes").unwrap(), ["a.json", "b.json"]);
        assert!(list_folder(&dir, "..").is_err());
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
