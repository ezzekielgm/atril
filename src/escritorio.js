// Atril para el ordenador (Windows y Mac): la misma app dentro de una ventana propia hecha con Tauri
// (carpeta src-tauri/). Aquí está lo que solo existe ahí: abrir y guardar el Word del PC en su sitio,
// abrir los .docx con «Abrir con», arrastrarlos a la ventana, el portapapeles y las versiones nuevas.
// En el navegador y en el iPad `escritorio.activo` es false y no se usa nada de esto.

const T = typeof window !== "undefined" ? window.__TAURI_INTERNALS__ : undefined;
const invoke = (cmd, args) => T.invoke(cmd, args);

/** Blob -> base64 (para mandar el archivo a la parte nativa). */
async function aBase64(blob) {
  const b = new Uint8Array(await blob.arrayBuffer());
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
}

const TIPOS = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  pdf: "application/pdf",
  json: "application/json",
};
const nombreDe = (ruta) => String(ruta).split(/[\\/]/).pop();

/** «1.0.12» > «1.0.9» */
function esMasNueva(a, b) {
  const pa = String(a).split(".").map(Number), pb = String(b).split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x !== y) return x > y;
  }
  return false;
}

export const REPO = "ezzekielgm/atril";

export const escritorio = {
  activo: !!T,
  mac: typeof navigator !== "undefined" && /Mac/.test(navigator.platform || navigator.userAgent),

  /** Abre un enlace fuera de Atril: jw.org en el navegador, JW Library si está instalada. */
  abrirEnlace(url) { return invoke("abrir_enlace", { url }).catch((e) => console.warn("Enlace", e)); },
  leerPortapapeles() { return invoke("leer_portapapeles"); },
  ponerTitulo(titulo) { return invoke("poner_titulo", { titulo }).catch(() => {}); },
  version() { return invoke("version_app"); },
  /** Cuándo se cambió por última vez el archivo (ms) o null si ya no está. */
  fechaArchivo(ruta) { return invoke("fecha_archivo", { ruta }); },
  mostrarEnCarpeta(ruta) { return invoke("mostrar_en_carpeta", { ruta }).catch((e) => console.warn(e)); },

  /** Ventana para elegir Words del ordenador. Devuelve los File (con .rutaPC) o []. */
  async elegirWords() {
    const rutas = await invoke("elegir_words");
    return this.leerVarios(rutas);
  },
  /** Un archivo del ordenador como File, con su ruta en .rutaPC (para guardarlo luego en el mismo sitio). */
  async leer(ruta) {
    const datos = await invoke("leer_archivo", { ruta });
    const nombre = nombreDe(ruta);
    const ext = (nombre.split(".").pop() || "").toLowerCase();
    const f = new File([datos], nombre, { type: TIPOS[ext] || "" });
    f.rutaPC = ruta;
    return f;
  },
  async leerVarios(rutas) {
    const res = [];
    for (const r of rutas || []) {
      try { res.push(await this.leer(r)); } catch (e) { console.warn("No se pudo leer", r, e); }
    }
    return res;
  },
  /** Escribe el archivo encima del que hay en esa ruta (falla si Word lo tiene abierto). */
  async guardar(ruta, blob) { await invoke("guardar_archivo", { ruta, datos: await aBase64(blob) }); },
  /** Ventana «Guardar como». Devuelve la ruta elegida o null si se cancela. */
  async guardarComo(nombre, blob) { return invoke("guardar_como", { nombre, datos: await aBase64(blob) }); },

  /**
   * Words que hay que abrir: los del doble clic o «Abrir con» al arrancar, los que se abren con Atril
   * ya en marcha y los que se arrastran a la ventana. cb(files) cada vez.
   */
  alAbrirArchivos(cb) {
    const recoger = async () => {
      try {
        const rutas = await invoke("archivos_pendientes");
        if (rutas && rutas.length) cb(await this.leerVarios(rutas));
      } catch (e) { console.warn(e); }
    };
    const ev = window.__TAURI__ && window.__TAURI__.event;
    if (ev) ev.listen("abrir-archivos", recoger);
    window.addEventListener("focus", recoger);
    recoger();
  },

  /** El título de la ventana sigue al de la página («Mi discurso · Atril»). */
  seguirTitulo() {
    const t = document.querySelector("title");
    if (!t) return;
    const poner = () => this.ponerTitulo(document.title || "Atril");
    new MutationObserver(poner).observe(t, { childList: true, characterData: true, subtree: true });
    poner();
  },

  /** ¿Hay una versión nueva para el ordenador? {version, url} o null. Mira las publicaciones de GitHub. */
  async versionNueva() {
    const actual = await this.version();
    // En las publicaciones también están las del reloj: solo cuentan las «escritorio-v…»
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=30`, { headers: { Accept: "application/vnd.github+json" }, cache: "no-store" });
    if (!r.ok) throw new Error("GitHub " + r.status);
    const j = (await r.json()).find((x) => /^escritorio-v\d/.test(x.tag_name || "") && !x.draft && !x.prerelease) || {};
    const v = String(j.tag_name || "").replace(/^escritorio-v/, "");
    return v && esMasNueva(v, actual) ? { version: v, url: j.html_url || `https://github.com/${REPO}/releases/latest`, actual } : null;
  },
};

export { esMasNueva };
