mod commands;
mod config;
mod cursor;
mod fs;
mod watcher;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::read_text_file,
            commands::write_text_file,
            commands::config_dir,
            commands::read_config_file,
            commands::write_config_file,
            commands::cursor_unhide,
            commands::cursor_restore,
            commands::watch_file,
            commands::unwatch_file,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            app.manage(watcher::FileWatcher::new(app.handle().clone())?);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
