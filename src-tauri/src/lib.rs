use std::{
    fs::{self, File, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
};

fn has_supported_read_extension(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|value| value.to_str())
            .map(str::to_ascii_lowercase)
            .as_deref(),
        Some("pdf" | "png" | "jpg" | "jpeg")
    )
}

#[tauri::command]
fn read_binary(path: String) -> Result<Vec<u8>, String> {
    let path = PathBuf::from(path);
    if !has_supported_read_extension(&path) {
        return Err("Only PDF, PNG, and JPEG files may be opened".into());
    }
    fs::read(path).map_err(|error| format!("Unable to read file: {error}"))
}

#[tauri::command]
fn write_pdf_safe(path: String, data: Vec<u8>, allow_overwrite: bool) -> Result<(), String> {
    let destination = PathBuf::from(&path);
    write_pdf_safe_path(&destination, &data, allow_overwrite)
}

fn write_pdf_safe_path(
    destination: &Path,
    data: &[u8],
    allow_overwrite: bool,
) -> Result<(), String> {
    if destination
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.eq_ignore_ascii_case("pdf"))
        != Some(true)
    {
        return Err("The destination must use the .pdf extension".into());
    }
    if destination.exists() && !allow_overwrite {
        return Err("The destination exists and overwrite was not confirmed".into());
    }
    let parent = destination
        .parent()
        .filter(|path| !path.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."));
    let mut temp = tempfile::Builder::new()
        .prefix(".openpdf-")
        .suffix(".tmp")
        .tempfile_in(parent)
        .map_err(|error| format!("Unable to create a safe temporary file: {error}"))?;
    temp.write_all(data)
        .map_err(|error| format!("Unable to write PDF: {error}"))?;
    temp.as_file_mut()
        .sync_all()
        .map_err(|error| format!("Unable to flush PDF: {error}"))?;

    let (_, temp_path) = temp
        .keep()
        .map_err(|error| format!("Unable to preserve temporary file: {error}"))?;
    let result = if destination.exists() {
        #[cfg(unix)]
        if let Ok(metadata) = fs::metadata(destination) {
            fs::set_permissions(&temp_path, metadata.permissions())
                .map_err(|error| format!("Unable to preserve file permissions: {error}"))?;
        }
        atomic_replace(&temp_path, destination)
    } else {
        fs::rename(&temp_path, destination)
            .map_err(|error| format!("Unable to finish saving: {error}"))
    };
    if let Err(error) = result {
        let _ = fs::remove_file(&temp_path);
        return Err(error);
    }
    if let Ok(directory) = File::open(parent) {
        let _ = directory.sync_all();
    }
    Ok(())
}

#[cfg(unix)]
fn atomic_replace(source: &Path, destination: &Path) -> Result<(), String> {
    fs::rename(source, destination)
        .map_err(|error| format!("Unable to replace destination: {error}"))
}

#[cfg(windows)]
fn atomic_replace(source: &Path, destination: &Path) -> Result<(), String> {
    use std::{os::windows::ffi::OsStrExt, ptr};

    #[link(name = "Kernel32")]
    extern "system" {
        fn ReplaceFileW(
            replaced_file_name: *const u16,
            replacement_file_name: *const u16,
            backup_file_name: *const u16,
            replace_flags: u32,
            exclude: *const core::ffi::c_void,
            reserved: *const core::ffi::c_void,
        ) -> i32;
    }

    let destination_wide: Vec<u16> = destination
        .as_os_str()
        .encode_wide()
        .chain(Some(0))
        .collect();
    let source_wide: Vec<u16> = source.as_os_str().encode_wide().chain(Some(0)).collect();
    // REPLACEFILE_WRITE_THROUGH asks Windows to flush the replacement before returning.
    let replaced = unsafe {
        ReplaceFileW(
            destination_wide.as_ptr(),
            source_wide.as_ptr(),
            ptr::null(),
            0x0000_0001,
            ptr::null(),
            ptr::null(),
        )
    };
    if replaced == 0 {
        Err(format!(
            "Unable to replace destination: {}",
            std::io::Error::last_os_error()
        ))
    } else {
        Ok(())
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
        .invoke_handler(tauri::generate_handler![
            read_binary,
            write_pdf_safe,
            path_exists
        ])
        .run(tauri::generate_context!())
        .expect("error while running OpenPDF");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_extensions_without_case_or_separator_assumptions() {
        assert!(has_supported_read_extension(Path::new(
            "C:\\Documents\\SAMPLE.PDF"
        )));
        assert!(has_supported_read_extension(Path::new("/tmp/photo.JpEg")));
        assert!(!has_supported_read_extension(Path::new(
            "/tmp/document.txt"
        )));
    }

    #[test]
    fn writes_replaces_and_reopens_a_pdf() {
        let directory = tempfile::tempdir().expect("temporary directory");
        let destination = directory.path().join("Edited.PDF");

        write_pdf_safe_path(&destination, b"%PDF-1.4\nfirst", false).expect("initial save");
        assert_eq!(
            fs::read(&destination).expect("reopen initial file"),
            b"%PDF-1.4\nfirst"
        );
        assert!(write_pdf_safe_path(&destination, b"replacement", false).is_err());

        write_pdf_safe_path(&destination, b"%PDF-1.4\nsecond", true).expect("atomic replacement");
        assert_eq!(
            fs::read(&destination).expect("reopen replacement"),
            b"%PDF-1.4\nsecond"
        );
        assert_eq!(
            fs::read_dir(directory.path())
                .expect("read directory")
                .count(),
            1,
            "temporary save files must not be left behind",
        );
    }

    #[test]
    fn refuses_non_pdf_destinations() {
        let directory = tempfile::tempdir().expect("temporary directory");
        let destination = directory.path().join("output.txt");
        assert!(write_pdf_safe_path(&destination, b"not a pdf", false).is_err());
        assert!(!destination.exists());
    }
}
