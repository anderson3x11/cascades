//! The macOS menu bar. The app draws its own menus in the window, so the
//! native one only holds what macOS expects: the app menu (hide, quit), the
//! clipboard (which the webview needs for Cmd+C and Cmd+V) and the window menu.
//! It has no "Close Window": Cmd+W closes a tab, as the app's shortcut says.

use tauri::menu::{Menu, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Runtime};

pub fn mac_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let app_menu = Submenu::with_items(
        app,
        "Cascades",
        true,
        &[
            &PredefinedMenuItem::about(app, None, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::hide(app, None)?,
            &PredefinedMenuItem::hide_others(app, None)?,
            &PredefinedMenuItem::show_all(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::quit(app, None)?,
        ],
    )?;
    let edit = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::cut(app, None)?,
            &PredefinedMenuItem::copy(app, None)?,
            &PredefinedMenuItem::paste(app, None)?,
            &PredefinedMenuItem::select_all(app, None)?,
        ],
    )?;
    let window = Submenu::with_items(
        app,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(app, None)?,
            &PredefinedMenuItem::fullscreen(app, None)?,
        ],
    )?;
    Menu::with_items(app, &[&app_menu, &edit, &window])
}
