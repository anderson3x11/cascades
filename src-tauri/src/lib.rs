mod commands;
mod config;
mod cursor;
mod folder;
mod fs;
mod search;
mod watcher;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::read_text_file,
            commands::read_binary,
            commands::write_text_file,
            commands::config_dir,
            commands::read_config_file,
            commands::write_config_file,
            commands::list_config_folder,
            commands::cursor_unhide,
            commands::cursor_restore,
            commands::allow_asset_dir,
            commands::watch_file,
            commands::unwatch_file,
            commands::watch_dir,
            commands::unwatch_dir,
            commands::list_dir,
            commands::list_files,
            commands::search_files,
            commands::cancel_search,
            commands::replace_in_files,
            commands::create_file,
            commands::create_dir,
            commands::rename_path,
            commands::trash_path,
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
            app.manage(commands::Searches::default());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
