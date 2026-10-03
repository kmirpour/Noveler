use serde::Serialize;
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

#[derive(Serialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
}

/// Extensions the editor may read or write as UTF-8 text.
const TEXT_EXTENSIONS: &[&str] = &["md", "markdown", "txt"];
/// Extensions that may be written as raw bytes (exports).
const BINARY_EXTENSIONS: &[&str] = &["docx"];

/// Minimum time between two backups of the same file. Autosave fires every few
/// seconds, so without this the rolling window would only cover the last minute.
const BACKUP_INTERVAL: Duration = Duration::from_secs(10 * 60);
/// Number of backups kept per file.
const MAX_BACKUPS: usize = 20;

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    let path = PathBuf::from(path);
    ensure_extension(&path, TEXT_EXTENSIONS)?;
    fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {e}"))
}

/// Saves a text document. The previous version is backed up (rate-limited) to
/// `<dir>/.noveler/backups/<file name>/`, and the write is atomic so a crash can
/// never leave a half-written chapter behind.
#[tauri::command]
pub fn write_file(path: String, content: String) -> Result<(), String> {
    let path = PathBuf::from(path);
    ensure_extension(&path, TEXT_EXTENSIONS)?;
    ensure_absolute(&path)?;

    if let Err(e) = backup_existing(&path, SystemTime::now()) {
        // A failed backup must never prevent the user from saving.
        eprintln!("[noveler] backup failed for {}: {e}", path.display());
    }
    atomic_write(&path, content.as_bytes())
}

/// Writes binary export data (e.g. a .docx) byte-for-byte.
#[tauri::command]
pub fn write_binary_file(path: String, bytes: Vec<u8>) -> Result<(), String> {
    let path = PathBuf::from(path);
    ensure_extension(&path, BINARY_EXTENSIONS)?;
    ensure_absolute(&path)?;
    atomic_write(&path, &bytes)
}

#[tauri::command]
pub fn read_dir(path: String) -> Result<Vec<FileEntry>, String> {
    let mut entries = Vec::new();
    let read = fs::read_dir(&path).map_err(|e| format!("Failed to read directory: {e}"))?;

    for entry in read.flatten() {
        let file_type = match entry.file_type() {
            Ok(ft) => ft,
            Err(_) => continue,
        };
        let file_name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files/directories (starting with dot), incl. `.noveler/`
        if file_name.starts_with('.') {
            continue;
        }

        let is_dir = file_type.is_dir();
        let full_path = entry.path().to_string_lossy().to_string();

        if is_dir || has_extension(&entry.path(), TEXT_EXTENSIONS) {
            entries.push(FileEntry {
                name: file_name,
                path: full_path,
                is_dir,
            });
        }
    }

    entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(entries)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn has_extension(path: &Path, allowed: &[&str]) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| allowed.iter().any(|a| a.eq_ignore_ascii_case(e)))
        .unwrap_or(false)
}

fn ensure_extension(path: &Path, allowed: &[&str]) -> Result<(), String> {
    if has_extension(path, allowed) {
        Ok(())
    } else {
        Err(format!(
            "Unsupported file type for '{}'. Allowed: {}",
            path.display(),
            allowed.join(", ")
        ))
    }
}

/// Relative paths would resolve against the process working directory, which
/// is never what the user meant (this previously happened after drag-and-drop).
fn ensure_absolute(path: &Path) -> Result<(), String> {
    if path.is_absolute() {
        Ok(())
    } else {
        Err(format!(
            "Refusing to write to relative path '{}'. Use Save As to choose a location.",
            path.display()
        ))
    }
}

/// Write to a temp file in the same directory, flush to disk, then rename over
/// the target. `fs::rename` replaces the destination atomically on Windows
/// (MoveFileExW + MOVEFILE_REPLACE_EXISTING) and on POSIX.
fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = path
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .ok_or_else(|| format!("'{}' has no parent directory", path.display()))?;
    fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {e}"))?;

    let file_name = path
        .file_name()
        .ok_or_else(|| format!("'{}' has no file name", path.display()))?
        .to_string_lossy();
    let tmp_path = parent.join(format!(".{file_name}.noveler-tmp"));

    let write_tmp = || -> std::io::Result<()> {
        let mut f = File::create(&tmp_path)?;
        f.write_all(bytes)?;
        f.sync_all()
    };

    if let Err(e) = write_tmp() {
        let _ = fs::remove_file(&tmp_path);
        return Err(format!("Failed to write file: {e}"));
    }
    if let Err(e) = fs::rename(&tmp_path, path) {
        let _ = fs::remove_file(&tmp_path);
        return Err(format!("Failed to replace file: {e}"));
    }
    Ok(())
}

fn backup_dir_for(path: &Path) -> Option<PathBuf> {
    let parent = path.parent()?;
    let name = path.file_name()?;
    Some(parent.join(".noveler").join("backups").join(name))
}

/// Copies the current on-disk version of `path` into its backup folder, unless
/// the newest backup is younger than [`BACKUP_INTERVAL`]. Keeps [`MAX_BACKUPS`].
fn backup_existing(path: &Path, now: SystemTime) -> Result<(), String> {
    if !path.is_file() {
        return Ok(());
    }
    let dir = backup_dir_for(path).ok_or("Cannot determine backup directory")?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let now_secs = now
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs();

    // Backup names start with a sortable UTC stamp: YYYY-MM-DD_HHMMSS_<name>
    let mut backups: Vec<(u64, PathBuf)> = fs::read_dir(&dir)
        .map_err(|e| e.to_string())?
        .flatten()
        .filter_map(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            parse_stamp(&name).map(|secs| (secs, e.path()))
        })
        .collect();
    backups.sort_by_key(|(secs, _)| *secs);

    if let Some((newest, _)) = backups.last() {
        if now_secs.saturating_sub(*newest) < BACKUP_INTERVAL.as_secs() {
            return Ok(());
        }
    }

    let file_name = path.file_name().unwrap().to_string_lossy();
    let dest = dir.join(format!("{}_{file_name}", format_stamp(now_secs)));
    fs::copy(path, &dest).map_err(|e| e.to_string())?;
    backups.push((now_secs, dest));

    while backups.len() > MAX_BACKUPS {
        let (_, oldest) = backups.remove(0);
        let _ = fs::remove_file(oldest);
    }
    Ok(())
}

/// Formats unix seconds as `YYYY-MM-DD_HHMMSS` (UTC).
fn format_stamp(secs: u64) -> String {
    let days = (secs / 86_400) as i64;
    let rem = secs % 86_400;
    let (y, m, d) = civil_from_days(days);
    format!(
        "{y:04}-{m:02}-{d:02}_{:02}{:02}{:02}",
        rem / 3600,
        (rem % 3600) / 60,
        rem % 60
    )
}

/// Parses the leading `YYYY-MM-DD_HHMMSS` stamp of a backup file name.
fn parse_stamp(name: &str) -> Option<u64> {
    let s = name.get(0..17)?;
    let b = s.as_bytes();
    if b[4] != b'-' || b[7] != b'-' || b[10] != b'_' {
        return None;
    }
    let num = |r: std::ops::Range<usize>| s.get(r)?.parse::<u64>().ok();
    let (y, mo, d) = (num(0..4)?, num(5..7)?, num(8..10)?);
    let (h, mi, se) = (num(11..13)?, num(13..15)?, num(15..17)?);
    let days = days_from_civil(y as i64, mo as u32, d as u32);
    if days < 0 {
        return None;
    }
    Some(days as u64 * 86_400 + h * 3600 + mi * 60 + se)
}

// Howard Hinnant's civil-date algorithms (public domain).
fn days_from_civil(y: i64, m: u32, d: u32) -> i64 {
    let y = if m <= 2 { y - 1 } else { y };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = y - era * 400;
    let mp = (m as i64 + 9) % 12;
    let doy = (153 * mp + 2) / 5 + d as i64 - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    (if m <= 2 { y + 1 } else { y }, m, d)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("noveler-test-{name}-{nanos}"));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn stamp_round_trips() {
        for secs in [0u64, 951_782_400, 1_790_000_000, 4_102_444_799] {
            let s = format_stamp(secs);
            assert_eq!(parse_stamp(&format!("{s}_chapter.md")), Some(secs), "{s}");
        }
        assert_eq!(format_stamp(0), "1970-01-01_000000");
        assert_eq!(parse_stamp("not-a-backup.md"), None);
    }

    #[test]
    fn extension_checks() {
        assert!(has_extension(Path::new("a/B.MD"), TEXT_EXTENSIONS));
        assert!(!has_extension(Path::new("a/b.exe"), TEXT_EXTENSIONS));
        assert!(!has_extension(Path::new("a/noext"), TEXT_EXTENSIONS));
        assert!(read_file("C:/Windows/win.ini".into()).is_err());
    }

    #[test]
    fn rejects_relative_paths() {
        let err = write_file("chapter.md".into(), "x".into()).unwrap_err();
        assert!(err.contains("relative"));
    }

    #[test]
    fn atomic_write_replaces_content_and_leaves_no_temp() {
        let dir = temp_dir("atomic");
        let file = dir.join("ch1.md");
        atomic_write(&file, b"first").unwrap();
        atomic_write(&file, b"second").unwrap();
        assert_eq!(fs::read_to_string(&file).unwrap(), "second");
        let leftovers: Vec<_> = fs::read_dir(&dir)
            .unwrap()
            .flatten()
            .filter(|e| e.file_name().to_string_lossy().contains("noveler-tmp"))
            .collect();
        assert!(leftovers.is_empty());
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn binary_write_is_byte_exact() {
        let dir = temp_dir("binary");
        let file = dir.join("out.docx");
        let bytes: Vec<u8> = (0..=255).collect();
        write_binary_file(file.to_string_lossy().into(), bytes.clone()).unwrap();
        assert_eq!(fs::read(&file).unwrap(), bytes);
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn backups_are_rate_limited_and_pruned() {
        let dir = temp_dir("backup");
        let file = dir.join("ch1.md");
        fs::write(&file, "v1").unwrap();
        let backups = backup_dir_for(&file).unwrap();
        let count = || fs::read_dir(&backups).unwrap().count();

        let t0 = UNIX_EPOCH + Duration::from_secs(1_790_000_000);
        backup_existing(&file, t0).unwrap();
        assert_eq!(count(), 1);

        // Within the interval: no new backup.
        backup_existing(&file, t0 + Duration::from_secs(60)).unwrap();
        assert_eq!(count(), 1);

        // Many intervals later: capped at MAX_BACKUPS.
        for i in 1..=(MAX_BACKUPS as u64 + 5) {
            backup_existing(&file, t0 + BACKUP_INTERVAL * (i as u32)).unwrap();
        }
        assert_eq!(count(), MAX_BACKUPS);
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn no_backup_for_new_file() {
        let dir = temp_dir("newfile");
        let file = dir.join("new.md");
        backup_existing(&file, SystemTime::now()).unwrap();
        assert!(!backup_dir_for(&file).unwrap().exists());
        fs::remove_dir_all(dir).unwrap();
    }
}
