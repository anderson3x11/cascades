mod commands;
mod config;
mod cursor;
mod folder;
mod fs;
mod launch;
#[cfg(target_os = "macos")]
mod menu;
mod search;
mod spell;
mod watcher;

use std::path::Path;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // First, so that a second launch hands its files over before anything starts.
    let builder =
        tauri::Builder::default().plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            let files = launch::files_from_args(args.get(1..).unwrap_or(&[]), Path::new(&cwd));
            launch::open(app, files);
            launch::focus(app);
        }));
    #[cfg(target_os = "macos")]
    let builder = builder.menu(menu::mac_menu);
    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            commands::read_text_file,
            commands::read_binary,
            commands::file_size,
            commands::write_text_file,
            commands::config_dir,
            commands::read_config_file,
            commands::write_config_file,
            commands::list_config_folder,
            commands::list_config_subfolders,
            commands::open_config_folder,
            commands::cursor_unhide,
            commands::cursor_restore,
            commands::allow_asset_dir,
            commands::watch_file,
            commands::unwatch_file,
            commands::watch_dir,
            commands::unwatch_dir,
            commands::list_dir,
            commands::list_files,
            commands::spell_check,
            commands::spell_suggest,
            commands::spell_add,
            commands::spell_languages,
            commands::search_files,
            commands::cancel_search,
            commands::replace_in_files,
            commands::create_file,
            commands::create_dir,
            commands::rename_path,
            commands::trash_path,
            launch::take_pending_files,
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
            app.manage(spell::Speller::default());
            app.manage(launch::Pending::default());
            let args: Vec<String> = std::env::args().skip(1).collect();
            let cwd = std::env::current_dir().unwrap_or_default();
            launch::open(app.handle(), launch::files_from_args(&args, &cwd));
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, _event| {
            // Files opened from the Finder, including the one that started the app.
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = _event {
                let files = urls
                    .into_iter()
                    .filter_map(|url| url.to_file_path().ok())
                    .map(|path| path.to_string_lossy().into_owned())
                    .collect();
                launch::open(_app, files);
            }
        });
}
