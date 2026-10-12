use std::{
    fs::{self, File, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
};

#[tauri::command]
fn read_binary(path: String) -> Result<Vec<u8>, String> {
    let path = PathBuf::from(path);
    if path.extension().and_then(|value| value.to_str()).map(|value| value.eq_ignore_ascii_case("pdf")) != Some(true)
        && !matches!(path.extension().and_then(|value| value.to_str()).map(str::to_ascii_lowercase).as_deref(), Some("png" | "jpg" | "jpeg"))
    {
        return Err("Only PDF, PNG, and JPEG files may be opened".into());
    }
    fs::read(path).map_err(|error| format!("Unable to read file: {error}"))
}

#[tauri::command]
fn write_pdf_safe(path: String, data: Vec<u8>, allow_overwrite: bool) -> Result<(), String> {
    let destination = PathBuf::from(&path);
    if destination.extension().and_then(|value| value.to_str()).map(|value| value.eq_ignore_ascii_case("pdf")) != Some(true) {
        return Err("The destination must use the .pdf extension".into());
    }
    if destination.exists() && !allow_overwrite {
        return Err("The destination exists and overwrite was not confirmed".into());
    }
    let parent = destination.parent().ok_or("Invalid destination path")?;
    let mut temp = tempfile::Builder::new()
        .prefix(".openpdf-")
        .suffix(".tmp")
        .tempfile_in(parent)
        .map_err(|error| format!("Unable to create a safe temporary file: {error}"))?;
    temp.write_all(&data).map_err(|error| format!("Unable to write PDF: {error}"))?;
    temp.as_file_mut().sync_all().map_err(|error| format!("Unable to flush PDF: {error}"))?;

    let (_, temp_path) = temp.keep().map_err(|error| format!("Unable to preserve temporary file: {error}"))?;
    if destination.exists() {
        atomic_replace(&temp_path, &destination)?;
    } else {
        fs::rename(&temp_path, &destination).map_err(|error| format!("Unable to finish saving: {error}"))?;
    }
    if let Ok(directory) = File::open(parent) { let _ = directory.sync_all(); }
    Ok(())
}

#[cfg(unix)]
fn atomic_replace(source: &Path, destination: &Path) -> Result<(), String> {
    fs::rename(source, destination).map_err(|error| format!("Unable to replace destination: {error}"))
}

#[cfg(windows)]
fn atomic_replace(source: &Path, destination: &Path) -> Result<(), String> {
    let backup = destination.with_extension("pdf.openpdf-backup");
    fs::rename(destination, &backup).map_err(|error| format!("Unable to prepare destination: {error}"))?;
    match fs::rename(source, destination) {
        Ok(()) => { let _ = fs::remove_file(backup); Ok(()) }
        Err(error) => { let _ = fs::rename(backup, destination); Err(format!("Unable to replace destination: {error}")) }
    }
}

#[tauri::command]
fn path_exists(path: String) -> bool {
    OpenOptions::new().read(true).open(path).is_ok()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![read_binary, write_pdf_safe, path_exists])
        .run(tauri::generate_context!())
        .expect("error while running OpenPDF");
}
