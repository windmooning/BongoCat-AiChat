use tauri::{
    AppHandle, Manager, PhysicalPosition, Runtime, WebviewWindow, async_runtime::spawn,
    command,
};

pub static MAIN_WINDOW_LABEL: &str = "main";
pub static PREFERENCE_WINDOW_LABEL: &str = "preference";
pub static CHAT_WINDOW_LABEL: &str = "chat";

const CHAT_GAP: i32 = 12;

#[cfg(target_os = "macos")]
mod macos;

#[cfg(target_os = "windows")]
mod windows;

#[cfg(target_os = "linux")]
mod linux;

#[cfg(target_os = "macos")]
pub use macos::*;

#[cfg(target_os = "windows")]
pub use windows::*;

#[cfg(target_os = "linux")]
pub use linux::*;

pub fn show_main_window(app_handle: &AppHandle) {
    show_window_by_label(app_handle, MAIN_WINDOW_LABEL);
}

pub fn show_preference_window(app_handle: &AppHandle) {
    show_window_by_label(app_handle, PREFERENCE_WINDOW_LABEL);
}

fn get_chat_windows<R: Runtime>(
    app_handle: &AppHandle<R>,
) -> Option<(WebviewWindow<R>, WebviewWindow<R>)> {
    let main_window = app_handle.get_webview_window(MAIN_WINDOW_LABEL)?;
    let chat_window = app_handle.get_webview_window(CHAT_WINDOW_LABEL)?;

    Some((main_window, chat_window))
}

fn get_chat_position<R: Runtime>(
    main_window: &WebviewWindow<R>,
    chat_window: &WebviewWindow<R>,
) -> PhysicalPosition<i32> {
    let main_position = main_window.outer_position().unwrap_or_default();
    let main_size = main_window.outer_size().unwrap_or_default();
    let chat_size = chat_window.outer_size().unwrap_or_default();

    let scale_factor = main_window.scale_factor().unwrap_or(1.0);
    let gap = (f64::from(CHAT_GAP) * scale_factor) as i32;

    let mut x = main_position.x - chat_size.width as i32 - gap;
    let mut y = main_position.y;

    if let Some(monitor) = main_window.current_monitor().ok().flatten() {
        let monitor_position = monitor.position();
        let monitor_size = monitor.size();

        if x < monitor_position.x {
            x = main_position.x + main_size.width as i32 + gap;
        }

        let min_x = monitor_position.x;
        let max_x = min_x + (monitor_size.width as i32 - chat_size.width as i32).max(0);

        x = x.clamp(min_x, max_x);

        let min_y = monitor_position.y;
        let max_y = min_y + (monitor_size.height as i32 - chat_size.height as i32).max(0);

        y = y.clamp(min_y, max_y);
    }

    PhysicalPosition::new(x, y)
}

fn show_chat_window<R: Runtime>(app_handle: &AppHandle<R>, follow_cat: bool) -> Option<()> {
    let (main_window, chat_window) = get_chat_windows(app_handle)?;

    let _ = chat_window.set_always_on_top(true);

    if follow_cat {
        let position = get_chat_position(&main_window, &chat_window);

        let _ = chat_window.set_position(position);
    }

    let _ = chat_window.show();
    let _ = chat_window.set_focus();

    Some(())
}

#[command]
pub async fn show_chat_window_command<R: Runtime>(
    app_handle: AppHandle<R>,
    follow_cat: bool,
) -> Result<(), String> {
    show_chat_window(&app_handle, follow_cat)
        .ok_or_else(|| "Chat window is not available".to_string())
}

#[command]
pub async fn hide_chat_window<R: Runtime>(app_handle: AppHandle<R>) -> Result<(), String> {
    let chat_window = app_handle
        .get_webview_window(CHAT_WINDOW_LABEL)
        .ok_or_else(|| "Chat window is not available".to_string())?;

    let _ = chat_window.hide();

    Ok(())
}

#[command]
pub async fn toggle_chat_window<R: Runtime>(
    app_handle: AppHandle<R>,
    follow_cat: bool,
) -> Result<bool, String> {
    let chat_window = app_handle
        .get_webview_window(CHAT_WINDOW_LABEL)
        .ok_or_else(|| "Chat window is not available".to_string())?;

    if chat_window.is_visible().unwrap_or(false) {
        let _ = chat_window.hide();

        Ok(false)
    } else {
        show_chat_window(&app_handle, follow_cat)
            .ok_or_else(|| "Chat window is not available".to_string())?;

        Ok(true)
    }
}

#[command]
pub async fn reposition_chat_window<R: Runtime>(app_handle: AppHandle<R>) -> Result<(), String> {
    let (main_window, chat_window) = get_chat_windows(&app_handle)
        .ok_or_else(|| "Chat window is not available".to_string())?;

    if !chat_window.is_visible().unwrap_or(false) {
        return Ok(());
    }

    let _ = chat_window.set_position(get_chat_position(&main_window, &chat_window));

    Ok(())
}

fn show_window_by_label(app_handle: &AppHandle, label: &str) {
    let Some(window) = app_handle.get_webview_window(label) else {
        return;
    };

    let app_handle = app_handle.clone();

    spawn(async move {
        show_window(app_handle, window).await;
    });
}
