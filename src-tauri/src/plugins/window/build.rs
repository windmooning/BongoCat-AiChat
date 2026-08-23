const COMMANDS: &[&str] = &[
    "show_window",
    "hide_window",
    "show_chat_window_command",
    "hide_chat_window",
    "toggle_chat_window",
    "reposition_chat_window",
    "show_cat_bubble_window_command",
    "hide_cat_bubble_window",
    "set_always_on_top",
    "set_taskbar_visibility",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS).build();
}
