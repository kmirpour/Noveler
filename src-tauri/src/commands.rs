use std::fs;
use std::path::Path;
use serde::Serialize;

#[derive(Serialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
}

#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        if !parent.as_os_str().is_empty() {
            let _ = fs::create_dir_all(parent);
        }
    }
    fs::write(&path, content).map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
pub fn read_dir(path: String) -> Result<Vec<FileEntry>, String> {
    let mut entries = Vec::new();
    let read = fs::read_dir(&path).map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in read.flatten() {
        let file_type = match entry.file_type() {
            Ok(ft) => ft,
            Err(_) => continue,
        };
        let file_name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files/directories (starting with dot)
        if file_name.starts_with('.') {
            continue;
        }

        let is_dir = file_type.is_dir();
        let full_path = entry.path().to_string_lossy().to_string();

        if is_dir {
            entries.push(FileEntry {
                name: file_name,
                path: full_path,
                is_dir: true,
            });
        } else {
            let lower = file_name.to_lowercase();
            if lower.ends_with(".md") || lower.ends_with(".markdown") || lower.ends_with(".txt") {
                entries.push(FileEntry {
                    name: file_name,
                    path: full_path,
                    is_dir: false,
                });
            }
        }
    }

    entries.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(entries)
}
