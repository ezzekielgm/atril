// Atril para el ordenador (Windows y Mac). La app es la misma de la web (carpeta dist/, dentro del
// programa); aquí solo está lo que necesita el sistema: abrir los Word con «Abrir con» o arrastrándolos,
// leerlos y guardarlos en su sitio, las ventanas de Abrir y Guardar como, abrir enlaces fuera y el
// portapapeles. La página habla con esto con las órdenes de abajo (src/escritorio.js).

// Sin ventana negra de consola en Windows
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use base64::Engine;
use std::path::Path;
use std::sync::Mutex;
use std::time::UNIX_EPOCH;
use tauri::{Emitter, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

/// Words que esperan a que la página los recoja (los del arranque, «Abrir con» y arrastrados).
#[derive(Default)]
struct Pendientes(Mutex<Vec<String>>);

/// Se queda solo con los .docx y .txt que existen.
fn solo_words<I: IntoIterator<Item = String>>(rutas: I) -> Vec<String> {
    rutas
        .into_iter()
        .filter(|r| {
            let l = r.to_lowercase();
            (l.ends_with(".docx") || l.ends_with(".txt")) && Path::new(r).is_file()
        })
        .collect()
}

/// Apunta los Word para abrir y avisa a la página (si aún está cargando, los recogerá al empezar).
fn entregar(app: &tauri::AppHandle, rutas: Vec<String>) {
    if rutas.is_empty() {
        return;
    }
    if let Ok(mut p) = app.state::<Pendientes>().0.lock() {
        p.extend(rutas);
    }
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
    let _ = app.emit("abrir-archivos", ());
}

fn decodificar(datos: &str) -> Result<Vec<u8>, String> {
    base64::engine::general_purpose::STANDARD
        .decode(datos)
        .map_err(|e| format!("datos no válidos: {e}"))
}

#[tauri::command]
fn archivos_pendientes(estado: tauri::State<'_, Pendientes>) -> Vec<String> {
    estado.0.lock().map(|mut p| std::mem::take(&mut *p)).unwrap_or_default()
}

#[tauri::command]
fn leer_archivo(ruta: String) -> Result<tauri::ipc::Response, String> {
    std::fs::read(&ruta)
        .map(tauri::ipc::Response::new)
        .map_err(|e| e.to_string())
}

/// Escribe encima del archivo: primero en un temporal de la misma carpeta y luego lo cambia por el
/// original, para que un corte a medias no deje el Word roto. Falla si Word lo tiene abierto.
#[tauri::command]
fn guardar_archivo(ruta: String, datos: String) -> Result<(), String> {
    let bytes = decodificar(&datos)?;
    let tmp = format!("{ruta}.atril-tmp");
    std::fs::write(&tmp, &bytes).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, &ruta).map_err(|e| {
        let _ = std::fs::remove_file(&tmp);
        e.to_string()
    })
}

/// Cuándo se cambió por última vez (milisegundos), o nada si el archivo ya no está.
#[tauri::command]
fn fecha_archivo(ruta: String) -> Option<f64> {
    let m = std::fs::metadata(&ruta).ok()?.modified().ok()?;
    Some(m.duration_since(UNIX_EPOCH).ok()?.as_millis() as f64)
}

/// Ventana «Abrir» para elegir uno o varios Word.
#[tauri::command]
async fn elegir_words(app: tauri::AppHandle) -> Vec<String> {
    app.dialog()
        .file()
        .set_title("Abrir un Word en Atril")
        .add_filter("Word o texto", &["docx", "txt"])
        .blocking_pick_files()
        .unwrap_or_default()
        .into_iter()
        .filter_map(|f| f.into_path().ok())
        .map(|p| p.to_string_lossy().into_owned())
        .collect()
}

/// Ventana «Guardar como». Devuelve dónde se guardó, o nada si se cancela.
#[tauri::command]
async fn guardar_como(app: tauri::AppHandle, nombre: String, datos: String) -> Result<Option<String>, String> {
    let bytes = decodificar(&datos)?;
    let ext = Path::new(&nombre)
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    let tipo = match ext.as_str() {
        "docx" => "Documento de Word",
        "pdf" => "PDF",
        "json" => "Copia de seguridad de Atril",
        "txt" => "Texto",
        _ => "Archivo",
    };
    let mut dialogo = app.dialog().file().set_title("Guardar").set_file_name(&nombre);
    if !ext.is_empty() {
        dialogo = dialogo.add_filter(tipo, &[ext.as_str()]);
    }
    let Some(elegido) = dialogo.blocking_save_file() else {
        return Ok(None);
    };
    let ruta = elegido.into_path().map_err(|e| e.to_string())?;
    std::fs::write(&ruta, bytes).map_err(|e| e.to_string())?;
    Ok(Some(ruta.to_string_lossy().into_owned()))
}

/// Abre fuera de Atril: jw.org en el navegador o JW Library si está instalada.
#[tauri::command]
fn abrir_enlace(app: tauri::AppHandle, url: String) -> Result<(), String> {
    let permitido = ["https://", "jwlibrary:", "mailto:"].iter().any(|p| url.starts_with(p));
    if !permitido {
        return Err("enlace no permitido".into());
    }
    app.opener().open_url(url, None::<&str>).map_err(|e| e.to_string())
}

#[tauri::command]
fn mostrar_en_carpeta(app: tauri::AppHandle, ruta: String) -> Result<(), String> {
    app.opener().reveal_item_in_dir(ruta).map_err(|e| e.to_string())
}

#[tauri::command]
fn leer_portapapeles(app: tauri::AppHandle) -> String {
    app.clipboard().read_text().unwrap_or_default()
}

#[tauri::command]
fn poner_titulo(window: tauri::WebviewWindow, titulo: String) {
    let _ = window.set_title(&titulo);
}

#[tauri::command]
fn version_app(app: tauri::AppHandle) -> String {
    app.package_info().version.to_string()
}

fn main() {
    let app = tauri::Builder::default()
        // Si Atril ya está abierto, el Word que se abre con «Abrir con» va a esa misma ventana
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            entregar(app, solo_words(args));
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(Pendientes::default())
        .setup(|app| {
            // Windows: el Word del doble clic o de «Abrir con» llega como argumento
            let rutas = solo_words(std::env::args().skip(1));
            if let Ok(mut p) = app.state::<Pendientes>().0.lock() {
                p.extend(rutas);
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            // Words arrastrados a la ventana
            if let tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, .. }) = event {
                let rutas = solo_words(paths.iter().map(|p| p.to_string_lossy().into_owned()));
                entregar(window.app_handle(), rutas);
            }
        })
        .invoke_handler(tauri::generate_handler![
            archivos_pendientes,
            leer_archivo,
            guardar_archivo,
            fecha_archivo,
            elegir_words,
            guardar_como,
            abrir_enlace,
            mostrar_en_carpeta,
            leer_portapapeles,
            poner_titulo,
            version_app
        ])
        .build(tauri::generate_context!())
        .expect("no se pudo arrancar Atril");

    app.run(|_app, _event| {
        // Mac: el Word del doble clic o de «Abrir con» llega como un evento
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Opened { urls } = _event {
            let rutas = solo_words(
                urls.into_iter()
                    .filter_map(|u| u.to_file_path().ok())
                    .map(|p| p.to_string_lossy().into_owned()),
            );
            entregar(_app, rutas);
        }
    });
}
