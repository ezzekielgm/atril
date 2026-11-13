// «Seguir mi voz» al ensayar (prototipo; solo en la versión de pruebas). A petición de Ezequiel: que al mirar
// el texto encuentre enseguida por dónde va. Escucha con el micrófono, reconoce en el propio iPad (Vosk, modelo
// pequeño en español, sin internet: la voz no sale del aparato), casa lo oído con el texto (seguir-voz.js),
// resalta la frase y la palabra por la que va y mueve el texto con suavidad para tenerla a la vista.
// El reconocedor (≈ 6 MB) y el modelo (≈ 34 MB) se descargan una vez y se guardan en la caché «atril-voz».
import { normalizar, crearSeguidor } from "./seguir-voz.js";

const MOTOR = "voz/vosk.js";
const MODELO = "voz/vosk-model-small-es-0.3.tar.gz";
const CACHE = "atril-voz";
export const TAMANO_MB = 40;

export async function descargada() {
  try {
    const c = await caches.open(CACHE);
    return !!((await c.match(MOTOR)) && (await c.match(MODELO)));
  } catch { return false; }
}
export async function borrarDescarga() {
  try { await caches.delete(CACHE); } catch {}
}

/** Descarga (o saca de la caché) un archivo, avisando del progreso con (bytes, total). */
async function bajar(url, avance, senal) {
  const c = await caches.open(CACHE);
  const guardado = await c.match(url);
  if (guardado) return guardado.blob();
  const res = await fetch(url, { cache: "no-store", signal: senal });
  if (!res.ok) throw new Error(res.status === 404 ? "no-disponible" : "HTTP " + res.status);
  const total = Number(res.headers.get("content-length")) || 0;
  const trozos = [];
  let n = 0;
  if (res.body && res.body.getReader) {
    const lector = res.body.getReader();
    for (;;) {
      const { done, value } = await lector.read();
      if (done) break;
      trozos.push(value);
      n += value.length;
      avance(n, total);
    }
  } else {
    trozos.push(new Uint8Array(await res.arrayBuffer()));
  }
  const blob = new Blob(trozos, { type: res.headers.get("content-type") || "application/octet-stream" });
  await c.put(url, new Response(blob, { headers: { "Content-Type": blob.type, "Content-Length": String(blob.size) } }));
  return blob;
}

/** Descarga el reconocedor y el modelo (lo que falte). `avance(texto, fraccion)`. */
export async function descargar(avance, senal) {
  let hechoMotor = 0;
  const totalAprox = TAMANO_MB * 1024 * 1024;
  await bajar(MOTOR, (n) => { hechoMotor = n; avance(n, totalAprox); }, senal);
  await bajar(MODELO, (n, t) => avance(hechoMotor + n, t ? hechoMotor + t : totalAprox), senal);
}

let Vosk = null, modelo = null;
async function cargarMotor() {
  if (Vosk) return Vosk;
  if (!window.Vosk) {
    const blob = await bajar(MOTOR, () => {});
    const url = URL.createObjectURL(new Blob([blob], { type: "text/javascript" }));
    await new Promise((ok, mal) => {
      const s = document.createElement("script");
      s.src = url;
      s.onload = ok;
      s.onerror = () => mal(new Error("No se pudo cargar el reconocedor"));
      document.head.append(s);
    });
  }
  Vosk = window.Vosk;
  return Vosk;
}
async function cargarModelo() {
  if (modelo) return modelo;
  await cargarMotor();
  const blob = await bajar(MODELO, () => {});
  modelo = await Vosk.createModel(URL.createObjectURL(blob));
  return modelo;
}

/* ---------- Las palabras del texto, con su sitio en la página ---------- */
const BLOQUE = "p, li, h1, h2, h3, h4, blockquote, td, th";
const SALTAR = ".h-min, .pausa, figure"; // decoraciones del lector y dibujos: no se leen
const PALABRA = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;

function indexar(raiz) {
  const palabras = [], sitios = [], frases = [];
  let frase = 0, bloqueAnterior = null;
  const tw = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement && n.parentElement.closest(SALTAR) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const bloque = n.parentElement.closest(BLOQUE);
    if (bloque !== bloqueAnterior) { if (palabras.length) frase++; bloqueAnterior = bloque; }
    const t = n.nodeValue;
    let ultimoFin = 0;
    for (const m of t.matchAll(PALABRA)) {
      if (/[.!?¿¡:;]/.test(t.slice(ultimoFin, m.index)) && palabras.length && frases[frases.length - 1] === frase) frase++;
      const p = normalizar(m[0]);
      if (!p) continue;
      palabras.push(p);
      sitios.push([n, m.index, m.index + m[0].length]);
      frases.push(frase);
      ultimoFin = m.index + m[0].length;
    }
    if (/[.!?:;]\s*$/.test(t.slice(ultimoFin))) frase++;
  }
  return { palabras, sitios, frases };
}

function rango(sitio, hasta = sitio) {
  const r = document.createRange();
  r.setStart(sitio[0], sitio[1]);
  r.setEnd(hasta[0], hasta[2]);
  return r;
}

/* ---------- Seguir ---------- */
export const seguirVoz = {
  activo: false,
  pos: -1,
  estado: "",

  /**
   * Empieza a escuchar. `scrollEl` y `contentEl` son los del lector; `alCambiar(estado)` para pintar el aviso.
   * Lanza si no hay micrófono o el reconocedor no carga.
   */
  async empezar({ scrollEl, contentEl, alCambiar = () => {} }) {
    if (this.activo) return;
    this.scrollEl = scrollEl; this.contentEl = contentEl; this.alCambiar = alCambiar;
    this.activo = true;
    this.avisar("Preparando la voz…");
    try {
      const m = await cargarModelo();
      if (!this.activo) return;
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
      if (!this.activo) { this.cerrarAudio(); return; }
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      if (this.ctx.state === "suspended") await this.ctx.resume().catch(() => {});
      this.rec = new m.KaldiRecognizer(this.ctx.sampleRate);
      this.rec.on("partialresult", (msg) => this.oir(msg.result.partial, false));
      this.rec.on("result", (msg) => this.oir(msg.result.text, true));
      this.fuente = this.ctx.createMediaStreamSource(this.stream);
      this.nodo = this.ctx.createScriptProcessor(4096, 1, 1);
      this.nodo.onaudioprocess = (e) => { if (this.activo && this.rec) { try { this.rec.acceptWaveform(e.inputBuffer); } catch {} } };
      this.fuente.connect(this.nodo);
      this.nodo.connect(this.ctx.destination);
      this.reindexar({ desdeLoVisible: true });
      this.ultimaVez = Date.now();
      this.avisar("Te escucho. Empieza a leer.");
      this.vigia = setInterval(() => {
        if (this.activo && Date.now() - this.ultimaVez > 12000) this.avisar("No te oigo. ¿Estás leyendo? Toca la palabra por la que vas.");
      }, 3000);
    } catch (e) {
      this.parar();
      throw e;
    }
  },

  parar() {
    this.activo = false;
    clearInterval(this.vigia);
    try { if (this.rec) this.rec.remove(); } catch {}
    this.rec = null;
    this.cerrarAudio();
    this.limpiar();
    this.avisar("");
  },

  cerrarAudio() {
    try { if (this.nodo) { this.nodo.onaudioprocess = null; this.nodo.disconnect(); } } catch {}
    try { if (this.fuente) this.fuente.disconnect(); } catch {}
    try { if (this.stream) this.stream.getTracks().forEach((t) => t.stop()); } catch {}
    try { if (this.ctx) this.ctx.close(); } catch {}
    this.nodo = this.fuente = this.stream = this.ctx = null;
  },

  avisar(t) { this.estado = t; this.alCambiar(t); },

  /** Vuelve a leer el texto de la página (al empezar o si se ha repintado). */
  reindexar({ desdeLoVisible = false } = {}) {
    if (!this.contentEl) return;
    const anterior = this.idx && this.pos >= 0 ? this.idx.sitios[this.pos] : null;
    this.idx = indexar(this.contentEl);
    let desde = -1;
    if (desdeLoVisible) desde = this.primeraVisible() - 1;
    else if (anterior) desde = Math.max(-1, this.idx.sitios.findIndex((s) => s[0] === anterior[0] && s[1] === anterior[1]));
    this.seguidor = crearSeguidor(this.idx.palabras, { desde });
    this.pos = desde;
    if (desde >= 0) this.pintar({ mover: false });
  },

  /** La primera palabra que se ve por debajo del borde de arriba del texto. */
  primeraVisible() {
    const top = this.scrollEl.getBoundingClientRect().top + 8;
    const s = this.idx.sitios;
    let lo = 0, hi = s.length - 1, r = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const rect = rango(s[mid]).getBoundingClientRect();
      if (rect.top >= top) { r = mid; hi = mid - 1; } else lo = mid + 1;
    }
    return r;
  },

  oir(texto, final) {
    if (!this.activo || !this.seguidor || !texto) return;
    this.ultimaVez = Date.now();
    const p = this.seguidor.oir(texto, { final });
    if (p != null) {
      this.pos = p;
      if (this.estado !== "Te sigo") this.avisar("Te sigo");
      this.pintar();
    }
  },

  /** Toca una palabra para decir «voy por aquí» (si se ha perdido). */
  tocar(e) {
    if (!this.activo || !this.idx) return false;
    let nodo = null, off = 0;
    if (document.caretRangeFromPoint) {
      const r = document.caretRangeFromPoint(e.clientX, e.clientY);
      if (r) { nodo = r.startContainer; off = r.startOffset; }
    } else if (document.caretPositionFromPoint) {
      const r = document.caretPositionFromPoint(e.clientX, e.clientY);
      if (r) { nodo = r.offsetNode; off = r.offset; }
    }
    if (!nodo) return false;
    const s = this.idx.sitios;
    let k = s.findIndex((x) => x[0] === nodo && off >= x[1] && off <= x[2]);
    if (k < 0) k = s.findIndex((x) => x[0] === nodo && x[1] >= off);
    if (k < 0) return false;
    this.seguidor.pos = k;
    this.pos = k;
    this.ultimaVez = Date.now();
    this.avisar("Te sigo desde aquí");
    this.pintar({ mover: false });
    return true;
  },

  pintar({ mover = true } = {}) {
    if (!this.idx || this.pos < 0 || this.pos >= this.idx.sitios.length) return;
    const { sitios, frases } = this.idx;
    const f = frases[this.pos];
    let a = this.pos, b = this.pos;
    while (a > 0 && frases[a - 1] === f) a--;
    while (b < sitios.length - 1 && frases[b + 1] === f) b++;
    const rPal = rango(sitios[this.pos]);
    try {
      if (window.CSS && CSS.highlights && window.Highlight) {
        CSS.highlights.set("voz-frase", new Highlight(rango(sitios[a], sitios[b])));
        CSS.highlights.set("voz-palabra", new Highlight(rPal));
      } else {
        this.limpiarBloque();
        const bl = sitios[this.pos][0].parentElement.closest(BLOQUE);
        if (bl) { bl.classList.add("voz-bloque"); this.bloque = bl; }
      }
    } catch {}
    if (!mover) return;
    // Que la palabra quede entre el 15 % y el 55 % de la altura; si no, se lleva al 33 %
    const sc = this.scrollEl.getBoundingClientRect();
    const r = rPal.getBoundingClientRect();
    const y = (r.top - sc.top) / sc.height;
    if (y < 0.15 || y > 0.55) this.scrollEl.scrollBy({ top: r.top - sc.top - sc.height * 0.33, behavior: "smooth" });
  },

  limpiarBloque() { if (this.bloque) { this.bloque.classList.remove("voz-bloque"); this.bloque = null; } },
  limpiar() {
    try { if (window.CSS && CSS.highlights) { CSS.highlights.delete("voz-frase"); CSS.highlights.delete("voz-palabra"); } } catch {}
    this.limpiarBloque();
  },
};
