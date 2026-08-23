use tauri::{
    Runtime, generate_handler,
    plugin::{Builder, TauriPlugin},
};

mod commands;

pub use commands::*;

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("custom-window")
        .invoke_handler(generate_handler![
            commands::show_window,
            commands::hide_window,
            commands::show_chat_window_command,
            commands::hide_chat_window,
            commands::toggle_chat_window,
            commands::reposition_chat_window,
            commands::set_always_on_top,
            commands::set_taskbar_visibility,
        ])
        .build()
}
