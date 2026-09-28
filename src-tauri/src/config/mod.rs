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

#[cfg(test)]
mod tests {
    use super::*;

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
