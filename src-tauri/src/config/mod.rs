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

/// Only plain file names are accepted, so nothing outside the config folder can be read.
pub fn config_file(dir: &Path, name: &str) -> Result<PathBuf, String> {
    let valid = !name.is_empty() && !name.contains(['/', '\\', ':']) && name != "." && name != "..";
    if !valid {
        return Err(format!("Invalid config file name: {name}"));
    }
    Ok(dir.join(name))
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
    fn rejects_paths() {
        let dir = Path::new("cfg");
        for name in ["", "..", "../secret", "a/b", "a\\b", "C:x"] {
            assert!(config_file(dir, name).is_err(), "{name} should be rejected");
        }
    }
}
