mod commands;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![
      commands::read_file,
      commands::write_file,
      commands::write_binary_file,
      commands::read_dir,
      commands::read_dir_tree,
      commands::create_file,
      commands::create_dir,
      commands::rename_path,
      commands::delete_file
    ])
    .setup(|app| {
      if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
