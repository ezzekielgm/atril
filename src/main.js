// Atril — lector y editor de discursos y notas (PWA)
// Código sin frameworks. Los datos se guardan en IndexedDB, en el propio dispositivo.

import { enlazarCitas } from "./biblia.js";
import { crearPlan, tiempoPrevisto, palabraActual, mmss, contarPalabras, minutosEstimados, minutosDeTitulo, tituloSinMinutos, PALABRAS_POR_MINUTO } from "./tiempo.js";
import { COLORES, claseValida, claseDeFondo, colorDeMark } from "./colores.js";
import { crearPlantilla, repartirMinutos } from "./plantilla.js";
import { dividirEnTarjetas, nivelDeCorte, partesDelDiscurso, parteDeBloque } from "./tarjetas.js";
import { marcarCoincidencias, limpiarCoincidencias } from "./buscar.js";
import { puedeGrabar, crearGrabadora, extensionDe } from "./grabadora.js";

/* ============================================================
   Utilidades
   ============================================================ */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

function debounce(fn, ms) {
  let t;
  const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  d.flush = (...a) => { clearTimeout(t); return fn(...a); };
  d.cancel = () => clearTimeout(t);
  return d;
}

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function fmtDate(ts) {
  const d = new Date(ts), now = new Date();
  const hm = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86400000);
  if (diff === 0) return `Hoy, ${hm}`;
  if (diff === 1) return `Ayer, ${hm}`;
  const y = d.getFullYear() === now.getFullYear() ? "" : ` ${d.getFullYear()}`;
  return `${d.getDate()} ${MESES[d.getMonth()]}${y}`;
}

/** Texto plano a partir del HTML, con saltos de línea entre bloques. */
function htmlToText(html) {
  const div = document.createElement("div");
  div.innerHTML = html;
  div.querySelectorAll("br").forEach((b) => b.replaceWith("\n"));
  div.querySelectorAll("li").forEach((li) => {
    const ol = li.parentElement && li.parentElement.tagName === "OL";
    const n = ol ? [...li.parentElement.children].indexOf(li) + 1 + ". " : "• ";
    li.prepend(n);
  });
  div.querySelectorAll("p,h1,h2,h3,h4,li,blockquote,tr,div,table,ul,ol").forEach((b) => b.append("\n"));
  div.querySelectorAll("td,th").forEach((c) => c.append("\t"));
  return div.textContent.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function textToHtml(text) {
  const parts = String(text).replace(/\r\n?/g, "\n").split(/\n{2,}/);
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("") || "<p><br></p>";
}

function wordCount(html) {
  const t = htmlToText(html);
  return t ? t.split(/\s+/).filter(Boolean).length : 0;
}

function safeFileName(name) {
  return (name || "Documento").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 120) || "Documento";
}

/* ============================================================
   Iconos (trazos de 24x24)
   ============================================================ */
const P = {
  back: '<path d="M15 18l-6-6 6-6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.6-4.6"/>',
  share: '<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2"/><path d="M9 2h6"/>',
  reset: '<path d="M1 4v6h6"/><path d="M3.5 15a9 9 0 1 0 2.1-9.4L1 10"/>',
  aa: '<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  more: '<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>',
  redo: '<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 15-6.7L21 13"/>',
  marker: '<path d="M9 11l-6 6v3h9l3-3"/><path d="M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01" stroke-width="3"/>',
  olist: '<path d="M10 6h11M10 12h11M10 18h11"/><path d="M4 6h1v4M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>',
  clear: '<path d="M4 7V4h16v3"/><path d="M5 20h6"/><path d="M13 4L8 20"/><path d="M15 15l5 5M20 15l-5 5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  open: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6M9 15l3-3 3 3"/>',
  word: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13l1.5 5 2.5-4 2.5 4 1.5-5"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>',
  note: '<path d="M15 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9z"/><path d="M15 3v6h6"/><path d="M7 13h10M7 17h6"/>',
  move: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
  outline: '<path d="M4 6h16"/><path d="M9 12h11"/><path d="M9 18h11"/><path d="M4 12h.01M4 18h.01" stroke-width="3"/>',
  close: '<path d="M18 6L6 18M6 6l12 12"/>',
  up: '<path d="M18 15l-6-6-6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  prev: '<path d="M15 18l-6-6 6-6"/>',
  next: '<path d="M9 18l6-6-6-6"/>',
  play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>',
  pause: '<rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/>',
  cards: '<rect x="3" y="7" width="14" height="14" rx="2"/><path d="M7 3h12a2 2 0 0 1 2 2v12"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><path d="M12 17v4M8 21h8"/>',
  pdf: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 18v-5h1.6a1.5 1.5 0 0 1 0 3H8"/><path d="M13.5 13v5h1a2.5 2.5 0 0 0 0-5z"/>',
  bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  scroll: '<path d="M12 3v13"/><path d="M7 11l5 5 5-5"/><path d="M5 21h14"/>',
  template: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
};
const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ""}</svg>`;
function paintIcons(root = document) {
  $$("[data-icon]", root).forEach((n) => { if (!n.querySelector("svg")) n.insertAdjacentHTML("afterbegin", icon(n.dataset.icon)); });
}

/* ============================================================
   Limpieza de HTML (lista blanca)
   ============================================================ */
const ALLOWED = {
  P: [], H1: [], H2: [], H3: [], H4: [], STRONG: [], B: [], EM: [], I: [], U: [], S: [], STRIKE: [], DEL: [], MARK: [],
  BR: [], UL: [], OL: [], LI: [], TABLE: [], THEAD: [], TBODY: [], TR: [], TD: ["colspan", "rowspan"], TH: ["colspan", "rowspan"],
  BLOCKQUOTE: [], IMG: ["src", "alt"], A: ["href"], SUB: [], SUP: [],
};
const DROP = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "NOSCRIPT", "TEMPLATE", "SVG", "MATH", "LINK", "META", "TITLE", "HEAD", "FORM", "INPUT", "BUTTON", "SELECT", "TEXTAREA", "VIDEO", "AUDIO", "CANVAS"]);
const BLOCKS = new Set(["P", "H1", "H2", "H3", "H4", "UL", "OL", "LI", "TABLE", "BLOCKQUOTE", "DIV", "TR", "TD", "TH", "THEAD", "TBODY"]);

function fondoDe(node) {
  return (node.style && (node.style.backgroundColor || node.style.background)) || "";
}
function hasBackground(node) {
  const bg = fondoDe(node);
  return bg && !/transparent|rgba\(0,\s*0,\s*0,\s*0\)|^initial|^inherit|^unset|^none/.test(bg);
}
/** <mark> del color que corresponde al fondo de un nodo. */
function markDe(node) {
  const m = document.createElement("mark");
  const c = claseDeFondo(fondoDe(node));
  if (c) m.className = c;
  return m;
}

function cleanNode(node) {
  for (const child of [...node.childNodes]) {
    if (child.nodeType === Node.COMMENT_NODE) { child.remove(); continue; }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    let tag = child.tagName.toUpperCase();
    if (DROP.has(tag)) { child.remove(); continue; }

    // Resaltado aplicado como estilo sobre otra etiqueta (p. ej. <b style="background-color:…">)
    if (tag !== "SPAN" && tag !== "FONT" && tag !== "MARK" && !BLOCKS.has(tag) && hasBackground(child)) {
      const m = markDe(child);
      while (child.firstChild) m.append(child.firstChild);
      child.append(m);
    }
    // Etiquetas equivalentes con un solo nombre
    if (tag === "B" || tag === "I") {
      const n = document.createElement(tag === "B" ? "strong" : "em");
      while (child.firstChild) n.append(child.firstChild);
      child.replaceWith(n);
      cleanNode(n);
      continue;
    }

    // Spans con fondo (resaltado del editor) -> <mark>; negrita/cursiva por estilo -> etiquetas
    if (tag === "SPAN" || tag === "FONT") {
      const st = child.style || {};
      const fw = st.fontWeight;
      const inner = document.createDocumentFragment();
      while (child.firstChild) inner.append(child.firstChild);
      let out = inner;
      const wrap = (t) => { const w = t === "mark" ? markDe(child) : document.createElement(t); w.append(out); out = w; };
      if (fw === "bold" || Number(fw) >= 600) wrap("strong");
      if (st.fontStyle === "italic") wrap("em");
      if ((st.textDecoration || st.textDecorationLine || "").includes("underline")) wrap("u");
      if (hasBackground(child)) wrap("mark");
      const frag = document.createDocumentFragment();
      frag.append(out);
      const holder = document.createElement("div");
      holder.append(frag);
      cleanNode(holder);
      child.replaceWith(...holder.childNodes);
      continue;
    }

    // DIV sin bloques dentro -> párrafo; con bloques -> se desenvuelve
    if (tag === "DIV") {
      const hasBlock = [...child.children].some((c) => BLOCKS.has(c.tagName.toUpperCase()));
      if (hasBlock) {
        cleanNode(child);
        child.replaceWith(...child.childNodes);
        continue;
      }
      const p = document.createElement("p");
      while (child.firstChild) p.append(child.firstChild);
      child.replaceWith(p);
      if (!p.textContent.trim() && !p.querySelector("img,br")) p.innerHTML = "<br>";
      cleanNode(p);
      continue;
    }
    if (tag === "STRIKE" || tag === "DEL") {
      const s = document.createElement("s");
      while (child.firstChild) s.append(child.firstChild);
      child.replaceWith(s);
      cleanNode(s);
      continue;
    }

    if (!ALLOWED[tag]) {
      cleanNode(child);
      child.replaceWith(...child.childNodes);
      continue;
    }

    // Atributos
    const keep = ALLOWED[tag];
    const color = tag === "MARK" ? claseValida(child.getAttribute("class")) || (hasBackground(child) ? claseDeFondo(fondoDe(child)) : "") : "";
    for (const a of [...child.attributes]) if (!keep.includes(a.name.toLowerCase())) child.removeAttribute(a.name);
    if (color) child.className = color;
    if (tag === "IMG") {
      const src = child.getAttribute("src") || "";
      if (!/^data:image\/(png|jpe?g|gif|webp|bmp);base64,/i.test(src)) { child.remove(); continue; }
    }
    if (tag === "A") {
      const href = child.getAttribute("href") || "";
      if (!/^(https?:|mailto:)/i.test(href)) child.removeAttribute("href");
      else { child.setAttribute("target", "_blank"); child.setAttribute("rel", "noopener"); }
    }
    cleanNode(child);
  }
}

/** Un <mark> dentro de otro: se parte el de fuera para que cada trozo tenga un solo color. */
function partirMarks(root) {
  let inner;
  while ((inner = root.querySelector("mark mark"))) {
    const outer = inner.parentElement.closest("mark");
    if (claseValida(inner.getAttribute("class")) === claseValida(outer.getAttribute("class"))) { inner.replaceWith(...inner.childNodes); continue; }
    const antes = document.createRange();
    antes.setStart(outer, 0); antes.setEndBefore(inner);
    const fa = antes.extractContents();
    const despues = document.createRange();
    despues.setStartAfter(inner); despues.setEnd(outer, outer.childNodes.length);
    const fd = despues.extractContents();
    const copia = (frag) => { if (!frag.textContent) return null; const m = outer.cloneNode(false); m.append(frag); return m; };
    const a = copia(fa), d = copia(fd);
    outer.replaceWith(...[a, ...outer.childNodes, d].filter(Boolean));
  }
}

function sanitize(html) {
  const doc = new DOMParser().parseFromString(`<!DOCTYPE html><body>${html || ""}</body>`, "text/html");
  const body = doc.body;
  cleanNode(body);
  // Texto suelto en la raíz -> dentro de párrafos
  const out = document.createElement("div");
  let para = null;
  for (const n of [...body.childNodes]) {
    const isBlock = n.nodeType === 1 && BLOCKS.has(n.tagName.toUpperCase());
    if (isBlock) { para = null; out.append(n); continue; }
    if (n.nodeType === 3 && !n.textContent.trim() && !para) continue;
    if (!para) { para = document.createElement("p"); out.append(para); }
    para.append(n);
  }
  // Resaltados dentro de otros: el de dentro manda en su trozo
  partirMarks(out);
  out.querySelectorAll("mark,strong,em,u,s,b,i").forEach((m) => { if (!m.textContent && !m.querySelector("img")) m.remove(); });
  const res = out.innerHTML.trim();
  return res || "<p><br></p>";
}

/* ============================================================
   Almacenamiento (IndexedDB)
   ============================================================ */
const DB_NAME = "atril";
let dbPromise;
function openDb() {
  return (dbPromise ||= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains("docs")) d.createObjectStore("docs", { keyPath: "id" });
      if (!d.objectStoreNames.contains("notes")) d.createObjectStore("notes", { keyPath: "id" });
      if (!d.objectStoreNames.contains("grabaciones")) d.createObjectStore("grabaciones", { keyPath: "id" });
    };
    req.onsuccess = () => {
      const d = req.result;
      d.onversionchange = () => { d.close(); dbPromise = null; };
      resolve(d);
    };
    req.onblocked = () => toast("Cierra las otras ventanas de Atril para terminar de actualizar.");
    req.onerror = () => reject(req.error);
  }));
}
async function tx(storeName, mode, fn) {
  const d = await openDb();
  return new Promise((resolve, reject) => {
    const t = d.transaction(storeName, mode);
    let result;
    const r = fn(t.objectStore(storeName));
    if (r) r.onsuccess = () => { result = r.result; };
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}
const store = {
  all: (s) => tx(s, "readonly", (o) => o.getAll()),
  get: (s, id) => tx(s, "readonly", (o) => o.get(id)),
  put: (s, obj) => tx(s, "readwrite", (o) => o.put(obj)),
  del: (s, id) => tx(s, "readwrite", (o) => o.delete(id)),
};

/* ============================================================
   Ajustes
   ============================================================ */
const DEFAULTS = {
  fontSize: 26, theme: "claro", font: "serif", lineHeight: 1.6, wakeLock: true, tab: "docs", refLinks: "app",
  grabar: false, tpWpm: 130, pdfSize: 16, pdfMarks: true, markColor: "amarillo",
};
const FS_MIN = 14, FS_MAX = 80;
let settings = { ...DEFAULTS };
try { settings = { ...DEFAULTS, ...JSON.parse(localStorage.getItem("atril.settings") || "{}") }; } catch {}
function saveSettings() { try { localStorage.setItem("atril.settings", JSON.stringify(settings)); } catch {} }
function lsGet(k, def = null) { try { const v = localStorage.getItem(k); return v == null ? def : v; } catch { return def; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch {} }

const THEME_COLORS = { claro: "#ffffff", sepia: "#f5edda", oscuro: "#121212" };
function applySettings() {
  const root = document.documentElement;
  root.dataset.theme = settings.theme;
  root.dataset.font = settings.font;
  root.style.setProperty("--fs", settings.fontSize + "px");
  root.style.setProperty("--lh", String(settings.lineHeight));
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_COLORS[settings.theme] || "#ffffff");
}

/* ============================================================
   Avisos, hojas y diálogos
   ============================================================ */
let toastTimer;
function toast(msg, { action, onAction, ms = 3200 } = {}) {
  const t = $("#toast");
  t.replaceChildren(el("span", { text: msg }));
  if (action) t.append(el("button", { text: action, onclick: () => { t.hidden = true; onAction && onAction(); } }));
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

let sheetClose = null;
function openSheet(content, { onClose, dismissable = true } = {}) {
  closeSheet();
  const overlay = $("#overlay");
  const sheet = el("div", { class: "sheet", role: "dialog", "aria-modal": "true" });
  sheet.append(...[].concat(content));
  overlay.replaceChildren(sheet);
  overlay.hidden = false;
  const close = () => {
    overlay.hidden = true;
    overlay.replaceChildren();
    overlay.onclick = null;
    sheetClose = null;
    onClose && onClose();
  };
  overlay.onclick = (e) => { if (e.target === overlay && dismissable) close(); };
  sheetClose = close;
  return { sheet, close };
}
function closeSheet() { if (sheetClose) sheetClose(); }

/** Menú de acciones. actions: [{label, icon, danger, run}] */
function actionSheet(title, actions) {
  const { close } = openSheet([
    title ? el("h2", { text: title }) : null,
    el("div", { class: "actions" },
      actions.map((a) => {
        const b = el("button", { class: "action" + (a.danger ? " danger" : ""), html: (a.icon ? icon(a.icon) : "") + `<span>${escapeHtml(a.label)}</span>` });
        b.addEventListener("click", () => { close(); a.run(); });
        return b;
      }),
      el("button", { class: "action plain", text: "Cancelar", onclick: () => close() })
    ),
  ].filter(Boolean));
}

function confirmDialog({ title, message, ok = "Aceptar", cancel = "Cancelar", danger = false }) {
  return new Promise((resolve) => {
    let answered = false;
    const { close } = openSheet([
      el("h2", { text: title }),
      message ? el("p", { text: message }) : null,
      el("div", { class: "actions" },
        el("button", { class: "action " + (danger ? "danger" : "primary"), text: ok, onclick: () => { answered = true; close(); resolve(true); } }),
        el("button", { class: "action plain", text: cancel, onclick: () => close() })
      ),
    ].filter(Boolean), { onClose: () => { if (!answered) resolve(false); } });
  });
}

function promptDialog({ title, value = "", ok = "Guardar", placeholder = "" }) {
  return new Promise((resolve) => {
    let answered = false;
    const input = el("input", { type: "text", value, placeholder, autocomplete: "off" });
    const submit = () => { answered = true; close(); resolve(input.value.trim()); };
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") submit(); });
    const { close } = openSheet([
      el("h2", { text: title }),
      input,
      el("div", { class: "actions" },
        el("button", { class: "action primary", text: ok, onclick: submit }),
        el("button", { class: "action plain", text: "Cancelar", onclick: () => close() })
      ),
    ], { onClose: () => { if (!answered) resolve(null); } });
    setTimeout(() => { input.focus(); input.select(); }, 60);
  });
}

function busy(message) {
  const { close } = openSheet([el("div", { class: "spinner" }), el("p", { text: message, style: "text-align:center" })], { dismissable: false });
  return close;
}

/** Ofrece un archivo ya generado. El toque en el botón lanza "Compartir" (Guardar en Archivos, correo, etc.). */
function offerFile(file, { title } = {}) {
  const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
  const { close } = openSheet([
    el("h2", { text: title || "Archivo listo" }),
    el("p", { text: file.name }),
    el("div", { class: "actions" },
      el("button", {
        class: "action primary",
        html: icon(canShare ? "share" : "download") + `<span>${canShare ? "Guardar en Archivos o compartir" : "Descargar"}</span>`,
        onclick: async () => {
          if (canShare) {
            try { await navigator.share({ files: [file], title: file.name }); close(); }
            catch (e) { if (e && e.name !== "AbortError") { downloadFile(file); close(); } }
          } else { downloadFile(file); close(); }
        },
      }),
      el("button", { class: "action plain", text: "Cerrar", onclick: () => close() })
    ),
    canShare ? el("p", { class: "small-print", text: "En el menú, elige «Guardar en Archivos» para guardarlo en el iPad o en iCloud." }) : null,
  ].filter(Boolean));
}
function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const a = el("a", { href: url, download: file.name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast("Texto copiado. Ya puedes pegarlo donde quieras.");
  } catch {
    // Alternativa para navegadores sin permiso de portapapeles
    const ta = el("textarea", { style: "position:fixed;top:-1000px;opacity:0" });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch {}
    ta.remove();
    toast(ok ? "Texto copiado." : "No se pudo copiar. Usa «Compartir».");
  }
}

async function shareText(title, text) {
  if (navigator.share) {
    try { await navigator.share({ title, text }); return; }
    catch (e) { if (e && e.name === "AbortError") return; }
  }
  copyText(text);
}

/* ============================================================
   Importar documentos
   ============================================================ */
let mammothPromise;
function loadMammoth() {
  if (window.mammoth) return Promise.resolve(window.mammoth);
  return (mammothPromise ||= new Promise((resolve, reject) => {
    const s = el("script", { src: "vendor/mammoth.browser.min.js" });
    s.onload = () => resolve(window.mammoth);
    s.onerror = () => { mammothPromise = null; reject(new Error("No se pudo cargar el lector de Word")); };
    document.head.append(s);
  }));
}

const STYLE_MAP = [
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Subtitle'] => h2:fresh",
  "p[style-name='Título'] => h1:fresh",
  "p[style-name='Subtítulo'] => h2:fresh",
  "p[style-name='Quote'] => blockquote:fresh",
  "p[style-name='Intense Quote'] => blockquote:fresh",
  "u => u",
  "strike => s",
  // Resaltados de Word por colores (los demás, amarillo)
  "highlight[color='green'] => mark.c-verde",
  "highlight[color='darkGreen'] => mark.c-verde",
  "highlight[color='cyan'] => mark.c-azul",
  "highlight[color='blue'] => mark.c-azul",
  "highlight[color='darkCyan'] => mark.c-azul",
  "highlight[color='darkBlue'] => mark.c-azul",
  "highlight[color='magenta'] => mark.c-rosa",
  "highlight[color='red'] => mark.c-rosa",
  "highlight[color='darkMagenta'] => mark.c-rosa",
  "highlight[color='darkRed'] => mark.c-rosa",
  "highlight => mark",
];

async function docxToHtml(file) {
  const mammoth = await loadMammoth();
  const arrayBuffer = await file.arrayBuffer();
  const res = await mammoth.convertToHtml({ arrayBuffer }, { styleMap: STYLE_MAP });
  return sanitize(res.value);
}

async function importFiles(files) {
  const list = [...files];
  if (!list.length) return;
  const done = [];
  const close = busy(list.length > 1 ? `Abriendo ${list.length} documentos…` : "Abriendo el documento…");
  try {
    for (const f of list) {
      const name = f.name || "Documento";
      const lower = name.toLowerCase();
      let html;
      try {
        if (lower.endsWith(".docx")) html = await docxToHtml(f);
        else if (lower.endsWith(".txt") || f.type === "text/plain") html = textToHtml(await f.text());
        else if (lower.endsWith(".doc")) { toast("Los .doc antiguos no se pueden abrir. Ábrelo en Pages y expórtalo como Word (.docx)."); continue; }
        else { toast(`«${name}» no es un Word (.docx) ni un texto (.txt).`); continue; }
      } catch (e) {
        console.error(e);
        toast(`No se pudo abrir «${name}». ¿Está dañado o protegido con contraseña?`, { ms: 5000 });
        continue;
      }
      const now = Date.now();
      const doc = { id: uid(), title: name.replace(/\.(docx|txt)$/i, "").replace(/[_]+/g, " ").trim(), html, created: now, updated: now, source: name };
      await store.put("docs", doc);
      done.push(doc);
    }
  } finally {
    close();
  }
  if (done.length === 1) go(`#/leer/docs/${done[0].id}`);
  else if (done.length > 1) { toast(`${done.length} documentos añadidos.`); renderHome(); }
}

/* ============================================================
   Exportar a Word
   ============================================================ */
/** HTML con el título delante si el texto no empieza ya por él. */
function htmlConTitulo(item) {
  const html = item.html || "<p></p>";
  if (!item.title) return html;
  const firstLine = htmlToText(html).split("\n")[0].trim();
  return firstLine === item.title.trim() ? html : `<h1>${escapeHtml(item.title)}</h1>` + html;
}

async function exportWord(kind, item) {
  const close = busy("Preparando el Word…");
  try {
    const { buildDocx } = await import("./docx-export.js");
    const html = kind === "notes" ? htmlConTitulo(item) : item.html || "<p></p>";
    const blob = await buildDocx(item.title || "Documento", html);
    close();
    const file = new File([blob], safeFileName(item.title) + ".docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    offerFile(file, { title: "Word listo" });
  } catch (e) {
    console.error(e);
    close();
    toast("No se pudo crear el Word. Inténtalo de nuevo.");
  }
}

/* ============================================================
   Guardar como PDF (para imprimir o mandar)
   ============================================================ */
function exportPdf(kind, item) {
  const chips = (opts, key) => el("div", { class: "chips" }, opts.map(([val, label]) => {
    const b = el("button", { class: "chip", "aria-pressed": String(settings[key] === val), text: label });
    b.addEventListener("click", () => {
      settings[key] = val; saveSettings();
      $$(".chip", b.parentElement).forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
    });
    return b;
  }));
  const marcas = el("input", { type: "checkbox", role: "switch" });
  marcas.checked = settings.pdfMarks !== false;
  marcas.addEventListener("change", () => { settings.pdfMarks = marcas.checked; saveSettings(); });
  openSheet([
    el("h2", { text: "Guardar como PDF" }),
    el("p", { text: "Para imprimirlo o mandarlo. Se crea en el propio iPad." }),
    el("div", { class: "group" }, el("span", { class: "label", text: "Tamaño de letra" }),
      chips([[12, "Normal"], [16, "Grande"], [20, "Muy grande"]], "pdfSize")),
    el("label", { class: "switch-row" }, el("span", { text: "Incluir los resaltados de colores" }), marcas),
    el("div", { class: "actions" },
      el("button", { class: "action primary", html: icon("pdf") + "<span>Crear el PDF</span>", onclick: () => crearPdf(kind, item) }),
      el("button", { class: "action plain", text: "Cancelar", onclick: () => closeSheet() })
    ),
  ]);
}

async function crearPdf(kind, item) {
  const close = busy("Preparando el PDF…");
  try {
    const { buildPdf } = await import("./pdf-export.js");
    const blob = await buildPdf({
      title: item.title || "Documento", html: htmlConTitulo(item),
      size: Number(settings.pdfSize) || 12, family: settings.font, highlights: settings.pdfMarks !== false,
    });
    close();
    offerFile(new File([blob], safeFileName(item.title) + ".pdf", { type: "application/pdf" }), { title: "PDF listo" });
  } catch (e) {
    console.error(e);
    close();
    toast("No se pudo crear el PDF. Inténtalo de nuevo.");
  }
}

/* ============================================================
   Copia de seguridad
   ============================================================ */
async function exportBackup() {
  const data = { app: "atril", format: 1, exported: new Date().toISOString(), docs: await store.all("docs"), notes: await store.all("notes") };
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const file = new File([JSON.stringify(data)], `atril-copia-${stamp}.json`, { type: "application/json" });
  offerFile(file, { title: "Copia de seguridad lista" });
}

/** Ensayos de una copia de seguridad (las grabaciones no van en la copia). */
function limpiarEnsayos(lista) {
  if (!Array.isArray(lista)) return undefined;
  const num = (x) => (Number.isFinite(Number(x)) && Number(x) >= 0 ? Math.round(Number(x)) : null);
  const res = lista.slice(0, 30).filter((e) => e && num(e.seg) != null).map((e) => ({
    id: String(e.id || uid()).slice(0, 40), fecha: num(e.fecha) || Date.now(), seg: num(e.seg), objetivoSeg: num(e.objetivoSeg),
    partes: (Array.isArray(e.partes) ? e.partes : []).slice(0, 60).map((p) => ({ t: String((p && p.t) || "").slice(0, 200), s: num(p && p.s) || 0, o: num(p && p.o) })),
    audio: false,
  }));
  return res.length ? res : undefined;
}

async function importBackup(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch { toast("Ese archivo no es una copia de Atril."); return; }
  if (!data || data.app !== "atril") { toast("Ese archivo no es una copia de Atril."); return; }
  let nDocs = 0, nNotes = 0;
  for (const [kind, items] of [["docs", data.docs], ["notes", data.notes]]) {
    for (const it of Array.isArray(items) ? items : []) {
      if (!it || typeof it.id !== "string") continue;
      const existing = await store.get(kind, it.id);
      if (existing && existing.updated >= (it.updated || 0)) continue;
      const target = Number(it.target);
      const clean = {
        id: it.id, title: String(it.title || "Sin título").slice(0, 300), html: sanitize(String(it.html || "")),
        created: Number(it.created) || Date.now(), updated: Number(it.updated) || Date.now(), source: it.source ? String(it.source) : undefined,
        target: target > 0 && target <= 240 ? target : undefined,
        ensayos: limpiarEnsayos(it.ensayos),
      };
      await store.put(kind, clean);
      kind === "docs" ? nDocs++ : nNotes++;
    }
  }
  toast(`Restaurados: ${nDocs} discursos y ${nNotes} notas.`);
  renderHome();
}

/* ============================================================
   Navegación
   ============================================================ */
const views = { home: $("#view-home"), reader: $("#view-reader"), editor: $("#view-editor") };
let currentView = null;

function showView(name) {
  for (const [k, v] of Object.entries(views)) v.hidden = k !== name;
  currentView = name;
}

function go(hash, { replace = false } = {}) {
  if (location.hash === hash) { route(); return; }
  if (replace) { history.replaceState(null, "", hash); route(); }
  else location.hash = hash;
}

let routeSeq = 0;
async function route() {
  // Si llega otra navegación mientras esta espera, gana siempre la última
  const seq = ++routeSeq;
  const stale = () => seq !== routeSeq;
  if (currentView === "editor") await editor.flush();
  if (stale()) return;
  if (currentView === "reader") reader.leave();
  const parts = (location.hash || "#/").replace(/^#\/?/, "").split("/");
  const [view, kind, id] = parts;
  try {
    if (view === "leer" && (kind === "docs" || kind === "notes") && id) return await reader.open(kind, id, stale);
    if (view === "editar" && (kind === "docs" || kind === "notes") && id) return await editor.open(kind, id, stale);
  } catch (e) {
    console.error(e);
  }
  if (stale()) return;
  if (location.hash && location.hash !== "#/") history.replaceState(null, "", "#/");
  renderHome();
}

/* ============================================================
   Inicio
   ============================================================ */
const home = {
  query: "",
};

function itemActions(kind, item) {
  const common = [
    { label: "Guardar como Word", icon: "word", run: () => exportWord(kind, item) },
    { label: "Copiar el texto", icon: "copy", run: () => copyText(htmlToText(item.html)) },
    { label: "Compartir el texto", icon: "share", run: () => shareText(item.title, htmlToText(item.html)) },
    { label: "Renombrar", icon: "edit", run: () => renameItem(kind, item) },
  ];
  const move = kind === "notes"
    ? { label: "Pasar a Discursos", icon: "move", run: () => moveItem("notes", "docs", item) }
    : { label: "Pasar a Notas", icon: "move", run: () => moveItem("docs", "notes", item) };
  const del = { label: "Eliminar", icon: "trash", danger: true, run: () => deleteItem(kind, item) };
  common.splice(1, 0, { label: "Guardar como PDF", icon: "pdf", run: () => exportPdf(kind, item) });
  if (kind === "docs") {
    return [
      { label: "Leer", icon: "book", run: () => go(`#/leer/docs/${item.id}`) },
      { label: "Editar", icon: "edit", run: () => go(`#/editar/docs/${item.id}`) },
      ...common, move, del,
    ];
  }
  return [
    { label: "Editar", icon: "edit", run: () => go(`#/editar/notes/${item.id}`) },
    { label: "Leer en grande", icon: "book", run: () => go(`#/leer/notes/${item.id}`) },
    ...common, move, del,
  ];
}

async function renameItem(kind, item) {
  const name = await promptDialog({ title: "Renombrar", value: item.title });
  if (!name) return;
  item.title = name;
  item.updated = Date.now();
  await store.put(kind, item);
  renderHome();
}

async function moveItem(from, to, item) {
  await store.put(to, { ...item, updated: Date.now() });
  await store.del(from, item.id);
  toast(to === "docs" ? "Movido a Discursos." : "Movido a Notas.");
  renderHome();
}

async function deleteItem(kind, item) {
  const ok = await confirmDialog({
    title: `¿Eliminar «${item.title}»?`,
    message: kind === "docs" ? "Se borra de Atril. El Word original que tengas en Archivos no se toca." : "La nota se borrará de este dispositivo.",
    ok: "Eliminar", danger: true,
  });
  if (!ok) return;
  await store.del(kind, item.id);
  lsSet(`atril.pos.${kind}.${item.id}`, "");
  toast("Eliminado.", {
    action: "Deshacer",
    onAction: async () => { await store.put(kind, item); renderHome(); },
    ms: 6000,
  });
  renderHome();
}

async function newItem(kind, extra = {}) {
  const now = Date.now();
  const item = { id: uid(), title: "", html: "<p><br></p>", created: now, updated: now, ...extra };
  await store.put(kind, item);
  go(`#/editar/${kind}/${item.id}`);
}

function nuevoDiscurso() {
  actionSheet("Nuevo discurso", [
    { label: "Con plantilla: introducción, puntos y conclusión", icon: "template", run: plantillaDialog },
    { label: "En blanco", icon: "note", run: () => newItem("docs") },
  ]);
}

/** Plantilla: título, duración y número de puntos; reparte los minutos entre las partes. */
function plantillaDialog() {
  let minutos = 10, puntos = 3;
  const titulo = el("input", { type: "text", placeholder: "Título del discurso", autocomplete: "off" });
  const dur = el("input", { type: "number", inputmode: "numeric", min: 3, max: 120, step: 1, class: "num-input", value: minutos, "aria-label": "Minutos" });
  const reparto = el("p", { class: "small-print reparto" });
  const pintar = () => {
    const r = repartirMinutos(minutos, puntos);
    reparto.textContent = `Introducción ${r.intro} min · ${r.puntos.map((m, i) => `Punto ${i + 1}: ${m} min`).join(" · ")} · Conclusión ${r.conclusion} min`;
  };
  const fijar = (n) => { minutos = clamp(Math.round(Number(n) || 10), 3, 120); dur.value = minutos; pintar(); };
  dur.addEventListener("change", () => fijar(dur.value));
  dur.addEventListener("input", () => { const n = Number(dur.value); if (n >= 3 && n <= 120) { minutos = Math.round(n); pintar(); } });
  const crear = async () => {
    fijar(dur.value);
    const t = titulo.value.trim();
    const { html, reparto: r } = crearPlantilla({ titulo: t, minutos, puntos });
    closeSheet();
    await newItem("docs", { title: t, html, target: r.total });
  };
  titulo.addEventListener("keydown", (e) => { if (e.key === "Enter") dur.focus(); });
  openSheet([
    el("h2", { text: "Discurso con plantilla" }),
    titulo,
    el("div", { class: "group" }, el("span", { class: "label", text: "Duración" }),
      el("div", { class: "size-row" },
        el("button", { class: "chip", text: "−", "aria-label": "Un minuto menos", onclick: () => fijar(minutos - 1) }),
        dur, el("span", { class: "unit", text: "min" }),
        el("button", { class: "chip", text: "+", "aria-label": "Un minuto más", onclick: () => fijar(minutos + 1) }))),
    el("div", { class: "group" }, el("span", { class: "label", text: "Puntos principales" }),
      el("div", { class: "chips" }, [2, 3, 4, 5].map((n) => {
        const b = el("button", { class: "chip", "aria-pressed": String(n === puntos), text: String(n) });
        b.addEventListener("click", () => { puntos = n; $$(".chip", b.parentElement).forEach((c) => c.setAttribute("aria-pressed", String(c === b))); pintar(); });
        return b;
      }))),
    reparto,
    el("p", { class: "small-print", text: "Cada parte lleva sus minutos en el título, así el cronómetro te dirá si vas adelantado o retrasado." }),
    el("div", { class: "actions" },
      el("button", { class: "action primary", text: "Crear", onclick: crear }),
      el("button", { class: "action plain", text: "Cancelar", onclick: () => closeSheet() })),
  ]);
  pintar();
  setTimeout(() => titulo.focus(), 60);
}

async function renderHome() {
  showView("home");
  document.title = "Atril";
  const tab = settings.tab === "notes" ? "notes" : "docs";
  $$(".segmented button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));

  const actions = $("#home-actions");
  actions.replaceChildren();
  if (tab === "docs") {
    actions.append(
      el("button", { class: "btn primary", html: icon("open") + "<span>Abrir Word</span>", onclick: () => $("#file-input").click() }),
      el("button", { class: "btn", html: icon("plus") + "<span>Nuevo discurso</span>", onclick: nuevoDiscurso })
    );
  } else {
    actions.append(el("button", { class: "btn primary", html: icon("plus") + "<span>Nueva nota</span>", onclick: () => newItem("notes") }));
  }

  let items = [];
  try { items = await store.all(tab); } catch (e) { console.error(e); toast("No se pudo leer el almacenamiento del dispositivo."); }
  items.sort((a, b) => (b.updated || 0) - (a.updated || 0));
  const q = home.query.trim().toLowerCase();
  const textCache = new Map();
  const textOf = (it) => { if (!textCache.has(it.id)) textCache.set(it.id, htmlToText(it.html || "")); return textCache.get(it.id); };
  if (q) items = items.filter((it) => (it.title || "").toLowerCase().includes(q) || textOf(it).toLowerCase().includes(q));

  const list = $("#list");
  list.replaceChildren(
    ...items.map((it) => {
      const text = textOf(it);
      const title = it.title || text.split("\n")[0].slice(0, 60) || "Sin título";
      const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
      const main = el("button", { class: "card-main", onclick: () => go(tab === "docs" ? `#/leer/docs/${it.id}` : `#/editar/notes/${it.id}`) },
        el("span", { class: "card-title", text: title }),
        el("span", { class: "card-meta", text: `${fmtDate(it.updated || it.created)} · ${words.toLocaleString("es-ES")} palabras${words ? ` · ≈ ${minutosEstimados(words)} min` : ""}${it.target ? ` · objetivo ${it.target} min` : ""}` }),
        el("span", { class: "card-snippet", text: text.replace(/\s+/g, " ").slice(title === text.split("\n")[0] ? title.length : 0, 220).trim() })
      );
      const more = el("button", { class: "card-more", "aria-label": "Opciones", html: icon("more"), onclick: () => actionSheet(title, itemActions(tab, it)) });
      return el("li", { class: "card" }, main, more);
    })
  );

  const empty = $("#empty");
  if (items.length) empty.hidden = true;
  else {
    empty.hidden = false;
    if (q) empty.replaceChildren(el("h2", { text: "Sin resultados" }), el("p", { text: `Nada coincide con «${home.query}».` }));
    else if (tab === "docs") empty.replaceChildren(
      el("h2", { text: "Aún no hay discursos" }),
      el("p", { text: "Toca «Abrir Word» para traer un .docx desde Archivos, iCloud o el correo. Luego podrás leerlo con letra grande y retocarlo." })
    );
    else empty.replaceChildren(
      el("h2", { text: "Aún no hay notas" }),
      el("p", { text: "Toca «Nueva nota» para empezar. Desde el menú ⋯ de cada nota puedes copiar el texto, compartirlo o guardarlo como Word." })
    );
  }

  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  $("#install-hint").hidden = standalone || lsGet("atril.hideInstall") === "1";
}

function openSettings() {
  const wake = el("input", { type: "checkbox", role: "switch" });
  wake.checked = !!settings.wakeLock;
  wake.addEventListener("change", () => { settings.wakeLock = wake.checked; saveSettings(); });
  const grabar = el("input", { type: "checkbox", role: "switch" });
  grabar.checked = !!settings.grabar;
  grabar.addEventListener("change", () => { settings.grabar = grabar.checked; saveSettings(); });
  openSheet([
    el("h2", { text: "Ajustes" }),
    el("label", { class: "switch-row" }, el("span", { text: "Mantener la pantalla encendida al leer" }), wake),
    puedeGrabar() ? el("label", { class: "switch-row" }, el("span", { text: "Grabar audio al ensayar con el cronómetro" }), grabar) : null,
    el("div", { class: "group" },
      el("span", { class: "label", text: "Citas bíblicas" }),
      el("p", { class: "small-print", text: "Al leer, las citas como «Sal 37:4» se pueden tocar para abrir el versículo." }),
      el("div", { class: "chips" }, [["app", "Abrir en JW Library"], ["web", "Abrir en jw.org"], ["off", "Sin enlaces"]].map(([val, label]) => {
        const b = el("button", { class: "chip", "aria-pressed": String(settings.refLinks === val), text: label });
        b.addEventListener("click", () => {
          settings.refLinks = val; saveSettings();
          $$(".chip", b.parentElement).forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
        });
        return b;
      }))
    ),
    el("div", { class: "group" },
      el("span", { class: "label", text: "Copia de seguridad" }),
      el("p", { class: "small-print", text: "Tus discursos y notas se guardan solo en este dispositivo. Haz una copia de vez en cuando y guárdala en Archivos o iCloud." }),
      el("div", { class: "actions" },
        el("button", { class: "action", html: icon("download") + "<span>Hacer copia de seguridad</span>", onclick: () => { closeSheet(); exportBackup(); } }),
        el("button", { class: "action", html: icon("upload") + "<span>Restaurar una copia</span>", onclick: () => { closeSheet(); $("#backup-input").click(); } })
      )
    ),
    el("p", { class: "small-print", text: `Atril · versión ${APP_VERSION}` }),
    el("div", { class: "actions" }, el("button", { class: "action plain", text: "Cerrar", onclick: () => closeSheet() })),
  ].filter(Boolean));
}

/* ============================================================
   Zoom con dos dedos (cambia el tamaño de la letra, no la página)
   ============================================================ */
function showZoomToast(size) {
  const t = $("#zoom-toast");
  t.textContent = `${size}`;
  t.hidden = false;
  clearTimeout(showZoomToast.t);
  showZoomToast.t = setTimeout(() => { t.hidden = true; }, 700);
}

function captureAnchor(scrollEl, contentEl) {
  const rect = scrollEl.getBoundingClientRect();
  const y = rect.top + Math.min(rect.height * 0.35, 260);
  const x = rect.left + rect.width / 2;
  let node = document.elementFromPoint(x, y);
  while (node && node.parentElement && node.parentElement !== contentEl) node = node.parentElement;
  if (node && node.parentElement === contentEl) {
    const r = node.getBoundingClientRect();
    return { node, y, frac: r.height ? (y - r.top) / r.height : 0 };
  }
  return { ratio: scrollEl.scrollHeight ? scrollEl.scrollTop / scrollEl.scrollHeight : 0 };
}
function restoreAnchor(scrollEl, a) {
  if (!a) return;
  if (a.node && a.node.isConnected) {
    const r = a.node.getBoundingClientRect();
    scrollEl.scrollTop += r.top + a.frac * r.height - a.y;
  } else if (a.ratio != null) {
    scrollEl.scrollTop = a.ratio * scrollEl.scrollHeight;
  }
}

function setFontSize(size, { scrollEl, contentEl, anchor } = {}) {
  const s = clamp(Math.round(size), FS_MIN, FS_MAX);
  if (s === settings.fontSize) return s;
  const a = anchor || (scrollEl && contentEl ? captureAnchor(scrollEl, contentEl) : null);
  settings.fontSize = s;
  document.documentElement.style.setProperty("--fs", s + "px");
  if (scrollEl) restoreAnchor(scrollEl, a);
  showZoomToast(s);
  return s;
}

function attachPinch(scrollEl, contentEl) {
  let base = null, anchor = null, pending = null, raf = 0;
  const begin = () => { base = settings.fontSize; anchor = captureAnchor(scrollEl, contentEl); };
  const apply = () => {
    raf = 0;
    if (base == null || pending == null) return;
    setFontSize(base * pending, { scrollEl, contentEl, anchor });
  };
  const change = (scale) => { pending = scale; if (!raf) raf = requestAnimationFrame(apply); };
  const end = () => { if (base != null) { base = null; pending = null; saveSettings(); syncAaSheet(); } };

  if ("ongesturestart" in window) {
    // Safari (iPad / iPhone): eventos de gesto nativos
    scrollEl.addEventListener("gesturestart", (e) => { e.preventDefault(); begin(); });
    scrollEl.addEventListener("gesturechange", (e) => { e.preventDefault(); change(e.scale); });
    scrollEl.addEventListener("gestureend", (e) => { e.preventDefault(); end(); });
  } else {
    // Resto de navegadores: dos dedos con eventos táctiles
    let d0 = 0;
    const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    scrollEl.addEventListener("touchstart", (e) => { if (e.touches.length === 2) { d0 = dist(e.touches); begin(); } }, { passive: true });
    scrollEl.addEventListener("touchmove", (e) => {
      if (e.touches.length === 2 && d0) { e.preventDefault(); change(dist(e.touches) / d0); }
    }, { passive: false });
    scrollEl.addEventListener("touchend", (e) => { if (d0 && e.touches.length < 2) { d0 = 0; end(); } });
    scrollEl.addEventListener("touchcancel", () => { d0 = 0; end(); });
  }
  // Ctrl + rueda / pellizco en trackpad (ordenador)
  scrollEl.addEventListener("wheel", (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    setFontSize(settings.fontSize * Math.exp(-e.deltaY / 200), { scrollEl, contentEl });
    clearTimeout(attachPinch.wt);
    attachPinch.wt = setTimeout(() => { saveSettings(); syncAaSheet(); }, 300);
  }, { passive: false });
}

/* ============================================================
   Pantalla siempre encendida
   ============================================================ */
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && settings.wakeLock && "wakeLock" in navigator && !wakeLock && document.visibilityState === "visible") {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => { wakeLock = null; });
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch { wakeLock = null; }
}

/* ============================================================
   Cronómetro
   ============================================================ */
const timer = {
  running: false, startedAt: 0, elapsed: 0, int: 0, docKey: "",
  ms() { return this.elapsed + (this.running ? Date.now() - this.startedAt : 0); },
  toggle() {
    if (this.running) {
      this.elapsed += Date.now() - this.startedAt;
      this.running = false;
      clearInterval(this.int);
      ensayo.pausa();
    } else {
      const desdeCero = this.elapsed === 0;
      this.startedAt = Date.now();
      this.running = true;
      this.int = setInterval(() => this.paint(), 500);
      if (desdeCero) { this.docKey = reader.kind + "/" + reader.id; ensayo.empezar(); }
      else ensayo.seguir();
    }
    this.paint();
  },
  /** A cero. Si el ensayo ha durado al menos 30 s, se guarda en el historial. */
  reset({ otroDoc = false } = {}) {
    const ms = this.ms();
    this.running = false;
    this.elapsed = 0;
    clearInterval(this.int);
    ensayo.terminar(ms, { otroDoc });
    this.paint();
  },
  paint() {
    ensayo.tic();
    const s = Math.floor(this.ms() / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const txt = (h ? h + ":" + String(m).padStart(2, "0") : String(m).padStart(2, "0")) + ":" + String(sec).padStart(2, "0");
    $("#timer-text").textContent = txt;
    $("#cards-timer-text").textContent = txt;
    const rec = ensayo.grabando();
    for (const n of [$("#timer"), $("#cards-timer")]) { n.classList.toggle("running", this.running); n.classList.toggle("rec", rec); }
    $("#timer-reset").hidden = this.running || this.elapsed === 0;
    if (currentView === "reader") reader.paintPace();
  },
};

/* ============================================================
   Ensayos: tiempo total y por parte, con grabación opcional
   ============================================================ */
const MIN_ENSAYO = 30;       // segundos mínimos para guardar un ensayo
const MAX_ENSAYOS = 30;      // por discurso
const MAX_GRABACIONES = 5;   // por discurso

const ensayo = {
  activo: false, kind: null, id: null, titulo: "", partes: [], ms: [], parte: 0, ultimo: 0, objetivoSeg: null,
  grab: null, grabListo: false, grabInicio: 0, marcas: [],

  grabando() { return !!(this.grab && this.grabListo && this.grab.activa); },

  empezar() {
    if (!reader.item) { this.activo = false; return; }
    this.activo = true;
    this.kind = reader.kind; this.id = reader.id;
    this.titulo = reader.item.title || "Sin título";
    this.partes = reader.partesEnsayo();
    this.ms = this.partes.map(() => 0);
    this.objetivoSeg = reader.plan ? Math.round(reader.plan.objetivoSeg) : null;
    this.parte = reader.parteActual() ?? 0;
    this.ultimo = Date.now();
    this.marcas = [];
    if (settings.grabar && puedeGrabar()) this.empezarGrabacion();
  },

  async empezarGrabacion() {
    const g = crearGrabadora();
    this.grab = g; this.grabListo = false;
    try {
      await g.empezar();
      if (this.grab !== g) { g.cancelar(); return; } // el ensayo terminó mientras se pedía el micrófono
      this.grabListo = true;
      this.grabInicio = timer.ms();
      if (!timer.running) g.pausar();
      this.marca(true);
      timer.paint();
    } catch (e) {
      console.warn(e);
      if (this.grab === g) this.grab = null;
      toast("No se pudo usar el micrófono. El ensayo sigue, pero sin grabar audio.", { ms: 5000 });
    }
  },

  /** Apunta en la grabación dónde empieza cada parte (para saltar a ella al escuchar). */
  marca(forzar = false) {
    if (!this.grabando()) return;
    const s = Math.max(0, (timer.ms() - this.grabInicio) / 1000);
    const ult = this.marcas[this.marcas.length - 1];
    if (forzar || !ult || ult.i !== this.parte) this.marcas.push({ i: this.parte, s: Math.round(s * 10) / 10 });
  },

  /** Suma el tiempo transcurrido a la parte que se está leyendo. */
  tic() {
    if (!this.activo) return;
    const now = Date.now();
    if (timer.running) {
      const k = currentView === "reader" && reader.id === this.id ? reader.parteActual() : null;
      if (k != null && k !== this.parte) { this.parte = k; this.marca(); }
      this.ms[this.parte] += now - this.ultimo;
    }
    this.ultimo = now;
  },

  pausa() { this.tic(); if (this.grab) this.grab.pausar(); },
  seguir() {
    if (!this.activo) { this.empezar(); return; }
    this.ultimo = Date.now();
    if (this.grab) this.grab.seguir();
  },

  async terminar(ms, { otroDoc = false } = {}) {
    if (!this.activo) return null;
    this.tic();
    this.activo = false;
    const g = this.grab;
    this.grab = null; this.grabListo = false;
    const seg = Math.round(ms / 1000);
    if (seg < MIN_ENSAYO) { if (g) g.cancelar(); return null; }
    const kind = this.kind, id = this.id;
    const registro = {
      id: uid(), fecha: Date.now(), seg, objetivoSeg: this.objetivoSeg,
      partes: this.partes.map((p, k) => ({ t: p.titulo, s: Math.round(this.ms[k] / 1000), o: p.objetivoSeg })),
      audio: false,
    };
    try {
      const blob = g ? await g.terminar() : null;
      if (blob && blob.size) {
        await store.put("grabaciones", {
          id: registro.id, kind, docId: id, fecha: registro.fecha, mime: blob.type, blob,
          marcas: this.marcas, partes: registro.partes.map((p) => p.t),
        });
        registro.audio = true;
      }
      const item = await store.get(kind, id);
      if (!item) return null;
      const todos = [registro, ...(item.ensayos || [])];
      item.ensayos = todos.slice(0, MAX_ENSAYOS);
      // Solo se guardan las últimas grabaciones (el audio ocupa mucho)
      let n = 0;
      for (const e of item.ensayos) if (e.audio && ++n > MAX_GRABACIONES) { e.audio = false; await store.del("grabaciones", e.id); }
      for (const e of todos.slice(MAX_ENSAYOS)) if (e.audio) await store.del("grabaciones", e.id);
      await store.put(kind, item);
      if (reader.id === id && reader.kind === kind && reader.item) reader.item.ensayos = item.ensayos;
    } catch (e) {
      console.error(e);
      toast("No se pudo guardar el ensayo.");
      return null;
    }
    const dif = registro.objetivoSeg ? seg - registro.objetivoSeg : null;
    const extra = dif == null ? "" : Math.abs(dif) < 15 ? " (en tiempo)" : dif > 0 ? ` (+${mmss(dif)})` : ` (−${mmss(-dif)})`;
    if (otroDoc) toast(`Ensayo de «${this.titulo}» guardado: ${mmss(seg)}${extra}.`, { ms: 5000 });
    else toast(`Ensayo guardado: ${mmss(seg)}${extra}`, { action: "Ver", onAction: () => reader.openEnsayos(), ms: 6000 });
    return registro;
  },
};

async function borrarEnsayo(kind, id, eid) {
  const item = await store.get(kind, id);
  if (!item) return;
  const e = (item.ensayos || []).find((x) => x.id === eid);
  item.ensayos = (item.ensayos || []).filter((x) => x.id !== eid);
  if (!item.ensayos.length) delete item.ensayos;
  if (e && e.audio) await store.del("grabaciones", eid);
  await store.put(kind, item);
  if (reader.id === id && reader.item) reader.item.ensayos = item.ensayos;
}

/** Borra grabaciones que ya no pertenecen a ningún ensayo (p. ej. de discursos eliminados). */
async function limpiarGrabaciones() {
  try {
    const todas = await store.all("grabaciones");
    for (const g of todas) {
      const item = await store.get(g.kind === "notes" ? "notes" : "docs", g.docId);
      const sigue = item && (item.ensayos || []).some((e) => e.id === g.id && e.audio);
      if (!sigue) await store.del("grabaciones", g.id);
    }
  } catch (e) { console.warn(e); }
}

/* ============================================================
   Lector
   ============================================================ */
let aaSheetOpen = false;
function syncAaSheet() {
  if (!aaSheetOpen) return;
  const r = $("#aa-range");
  if (r) r.value = settings.fontSize;
  const v = $("#aa-value");
  if (v) v.textContent = settings.fontSize;
}

function openAaSheet() {
  const scrollEl = currentView === "editor" ? $("#editor-scroll") : $("#reader-scroll");
  const contentEl = currentView === "editor" ? $("#editor") : $("#reader-content");
  const range = el("input", { type: "range", id: "aa-range", min: FS_MIN, max: FS_MAX, step: 1, value: settings.fontSize, "aria-label": "Tamaño de letra" });
  range.addEventListener("input", () => { setFontSize(Number(range.value), { scrollEl, contentEl }); $("#aa-value").textContent = settings.fontSize; });
  range.addEventListener("change", saveSettings);
  const step = (d) => { setFontSize(settings.fontSize + d, { scrollEl, contentEl }); saveSettings(); syncAaSheet(); };
  const chipGroup = (opts, key, cls = "") =>
    el("div", { class: "chips" }, opts.map(([val, label]) => {
      const b = el("button", { class: `chip ${cls ? cls + val : ""}`, "aria-pressed": String(settings[key] === val), text: label });
      b.addEventListener("click", () => {
        settings[key] = val;
        saveSettings();
        const a = captureAnchor(scrollEl, contentEl);
        applySettings();
        restoreAnchor(scrollEl, a);
        $$(".chip", b.parentElement).forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
      });
      return b;
    }));
  aaSheetOpen = true;
  openSheet([
    el("h2", { text: currentView === "reader" ? "Texto y tiempo" : "Texto" }),
    el("div", { class: "group" },
      el("span", { class: "label", html: `Tamaño · <span id="aa-value">${settings.fontSize}</span>` }),
      el("div", { class: "size-row" },
        el("button", { class: "chip", text: "A", style: "font-size:15px", "aria-label": "Más pequeña", onclick: () => step(-2) }),
        range,
        el("button", { class: "chip", text: "A", style: "font-size:24px", "aria-label": "Más grande", onclick: () => step(2) })
      ),
      el("p", { class: "small-print", text: "También puedes separar dos dedos sobre el texto para agrandarlo y pellizcar para achicarlo." })
    ),
    el("div", { class: "group" }, el("span", { class: "label", text: "Tema" }),
      chipGroup([["claro", "Claro"], ["sepia", "Sepia"], ["oscuro", "Oscuro"]], "theme", "t-")),
    el("div", { class: "group" }, el("span", { class: "label", text: "Letra" }),
      chipGroup([["serif", "Clásica"], ["sans", "Moderna"]], "font")),
    el("div", { class: "group" }, el("span", { class: "label", text: "Interlineado" }),
      chipGroup([[1.35, "Junto"], [1.6, "Normal"], [1.9, "Amplio"]], "lineHeight")),
    currentView === "reader" ? reader.timeGroup() : null,
    el("div", { class: "actions" }, el("button", { class: "action plain", text: "Cerrar", onclick: () => closeSheet() })),
  ].filter(Boolean), { onClose: () => { aaSheetOpen = false; } });
}

const reader = {
  kind: null, id: null, item: null, plan: null, mode: "texto", lastPace: null, aqui: null, filtro: "todo", savedScroll: null,
  scrollEl: $("#reader-scroll"), contentEl: $("#reader-content"), outlineEl: $("#reader-outline"),
  posKey() { return `atril.pos.${this.kind}.${this.id}`; },
  aquiKey() { return `atril.aqui.${this.kind}.${this.id}`; },

  async open(kind, id, stale = () => false) {
    const item = await store.get(kind, id);
    if (stale()) return;
    if (!item) { toast("Ese documento ya no existe."); throw new Error("no existe"); }
    // El cronómetro era de otro discurso: se guarda ese ensayo y se empieza de cero
    if ((timer.running || timer.elapsed) && timer.docKey !== kind + "/" + id) timer.reset({ otroDoc: true });
    this.kind = kind; this.id = id; this.item = item; this.filtro = "todo"; this.savedScroll = null;
    const title = item.title || htmlToText(item.html).split("\n")[0].slice(0, 60) || "Sin título";
    $("#reader-title").textContent = title;
    document.title = title + " · Atril";
    this.contentEl.innerHTML = item.html || "";
    enlazarCitas(this.contentEl, settings.refLinks);
    this.cargarAqui();
    this.setMode("texto", { keepScroll: true });
    this.buildPlan();
    views.reader.classList.remove("immersive");
    showView("reader");
    timer.paint();
    // Recupera la posición de lectura
    const ratio = parseFloat(lsGet(this.posKey(), "0")) || 0;
    requestAnimationFrame(() => { this.scrollEl.scrollTop = ratio * this.scrollEl.scrollHeight; this.paintProgress(); });
    keepAwake(true);
  },

  leave() {
    keepAwake(false);
    buscador.cerrar();
    prompter.cerrar();
    if (tarjetas.activo) tarjetas.cerrar();
    if (this.mode === "texto") this.savePos();
    else if (this.savedScroll != null && this.scrollEl.scrollHeight) lsSet(this.posKey(), String(this.savedScroll / this.scrollEl.scrollHeight));
    views.reader.classList.remove("immersive");
    $("#float-timer").hidden = true;
  },

  savePos() {
    if (!this.id || this.mode !== "texto") return;
    const r = this.scrollEl.scrollHeight ? this.scrollEl.scrollTop / this.scrollEl.scrollHeight : 0;
    lsSet(this.posKey(), String(Math.round(r * 10000) / 10000));
  },

  buildPlan() {
    this.plan = crearPlan([...this.contentEl.children], Number(this.item && this.item.target) || 0);
    this.paintPace();
  },

  /** Partes del discurso para los ensayos (según los minutos de los títulos o los títulos). */
  partesEnsayo() {
    const bloques = [...this.contentEl.children].map((b) => ({ tag: b.tagName, texto: b.textContent || "" }));
    return partesDelDiscurso(bloques, this.plan, tituloSinMinutos);
  },

  /** Bloque que se está leyendo (el que cruza la línea a un tercio de la pantalla) o null. */
  bloqueActual() {
    if (tarjetas.activo) { const t = tarjetas.lista[tarjetas.i]; return t ? t.inicio : null; }
    if (this.mode !== "texto") return null;
    const r = this.scrollEl.getBoundingClientRect();
    const y = r.top + r.height * 0.33;
    const hijos = this.contentEl.children;
    let elegido = 0;
    for (let i = 0; i < hijos.length; i++) {
      if (hijos[i].getBoundingClientRect().top <= y) elegido = i; else break;
    }
    return elegido;
  },

  parteActual() {
    const b = this.bloqueActual();
    return b == null ? null : parteDeBloque(ensayo.partes, b);
  },

  /** Palabra por la que se va (para el ritmo) o null si no se puede saber. */
  palabraLeida() {
    const plan = this.plan;
    if (!plan) return null;
    if (tarjetas.activo) {
      const t = tarjetas.lista[tarjetas.i];
      if (!t) return null;
      const st = $("#cards-stage");
      const max = st.scrollHeight - st.clientHeight;
      const frac = max > 20 ? st.scrollTop / max : 0.5;
      return (plan.inicioBloque[t.inicio] || 0) + t.palabras * frac;
    }
    if (this.mode !== "texto") return null;
    return palabraActual(plan, this.scrollEl, this.contentEl);
  },

  /** Ritmo: colores del cronómetro y «adelantado / retrasado» (barra, tarjetas y cronómetro flotante). */
  paintPace() {
    const seg = timer.ms() / 1000;
    const started = timer.running || timer.elapsed > 0;
    const plan = this.plan;
    let estado = "", largo = "", corto = "", aviso = "";
    if (plan && started) {
      const objetivo = plan.objetivoSeg;
      const resta = objetivo - seg;
      if (resta <= 0) { aviso = "over"; estado = "over"; largo = `Te pasas ${mmss(-resta)}`; corto = `+${mmss(-resta)}`; }
      else {
        if (resta <= Math.max(60, objetivo * 0.1)) aviso = "warn";
        const w = this.palabraLeida();
        if (w != null) this.lastPace = tiempoPrevisto(plan, w) - seg;
        const d = this.lastPace == null ? 0 : this.lastPace;
        if (Math.abs(d) < 20) { estado = "ok"; largo = "En tiempo"; corto = "✓"; }
        else if (d > 0) { estado = "ahead"; largo = `Adelantado ${mmss(d)}`; corto = `−${mmss(d)}`; }
        else { estado = "behind"; largo = `Retrasado ${mmss(-d)}`; corto = `+${mmss(-d)}`; }
      }
    }
    for (const n of [$("#timer"), $("#cards-timer")]) { n.classList.remove("warn", "over"); if (aviso) n.classList.add(aviso); }
    const html = estado ? `<span class="long">${escapeHtml(largo)}</span><span class="short">${escapeHtml(corto)}</span>` : "";
    for (const chip of [$("#pace"), $("#cards-pace")]) { chip.hidden = !estado; chip.className = "pace " + estado; chip.innerHTML = html; }
    $("#timer-toggle").title = plan ? `Objetivo ${mmss(plan.objetivoSeg)}` : "Cronómetro";
    // Cronómetro flotante en modo atril
    const flot = $("#float-timer");
    const showFloat = views.reader.classList.contains("immersive") && started && !tarjetas.activo;
    flot.hidden = !showFloat;
    if (showFloat) {
      flot.className = "float-timer" + (aviso ? " " + aviso : "") + (timer.running ? "" : " paused") + (ensayo.grabando() ? " rec" : "");
      flot.innerHTML = `<span>${mmss(seg)}</span>${estado ? `<span class="fp ${estado}">${escapeHtml(corto)}</span>` : ""}`;
    }
  },

  /** Bloque de «Duración del discurso» del panel Texto y tiempo. */
  timeGroup() {
    const palabras = contarPalabras(this.contentEl.textContent || "");
    const est = minutosEstimados(palabras);
    const partes = this.plan && this.plan.porPartes ? this.plan.secciones : [];
    const valor = el("input", { type: "number", inputmode: "numeric", min: 0, max: 240, step: 1, class: "num-input", "aria-label": "Minutos de objetivo", value: Number(this.item.target) || "", placeholder: "—" });
    const guardar = debounce(async () => {
      try {
        // Se relee para no pisar los ensayos guardados mientras tanto
        const fresco = await store.get(this.kind, this.id);
        const it = { ...(fresco || this.item), target: this.item.target };
        if (!it.target) delete it.target;
        await store.put(this.kind, it);
      } catch (e) { console.error(e); }
    }, 500);
    const fijar = (n) => {
      n = Math.max(0, Math.min(240, Math.round(Number(n) || 0)));
      this.item.target = n || undefined;
      valor.value = n || "";
      guardar();
      this.buildPlan();
      timer.paint();
    };
    valor.addEventListener("input", () => fijar(valor.value));
    return el("div", { class: "group" },
      el("span", { class: "label", text: "Duración del discurso" }),
      el("div", { class: "size-row" },
        el("button", { class: "chip", text: "−", "aria-label": "Un minuto menos", onclick: () => fijar((Number(valor.value) || est) - 1) }),
        valor,
        el("span", { class: "unit", text: "min" }),
        el("button", { class: "chip", text: "+", "aria-label": "Un minuto más", onclick: () => fijar((Number(valor.value) || est) + 1) }),
        el("button", { class: "chip", text: "Quitar", onclick: () => fijar(0) })
      ),
      el("p", { class: "small-print", text: `Lectura estimada: ≈ ${est} min (${palabras.toLocaleString("es-ES")} palabras a ${PALABRAS_POR_MINUTO} por minuto).` }),
      partes.length
        ? el("p", { class: "small-print", text: `Hay ${partes.length} partes con minutos en el título (suman ${mmss(this.plan.sumaPartesSeg)}). El ritmo se calcula por partes.` })
        : el("p", { class: "small-print", text: "Con el cronómetro en marcha verás si vas adelantado o retrasado. Truco: si pones «(5 min)» al final de un título, se calcula por partes." })
    );
  },

  setMode(mode, { keepScroll = false } = {}) {
    this.mode = mode;
    const esquema = mode === "esquema";
    if (esquema) this.renderOutline();
    this.outlineEl.hidden = !esquema;
    this.contentEl.hidden = esquema;
    const b = $("#reader-outline-btn");
    b.classList.toggle("active", esquema);
    b.setAttribute("aria-pressed", String(esquema));
    if (esquema) this.scrollEl.scrollTop = 0;
    else if (!keepScroll && this.savedScroll != null) this.scrollEl.scrollTop = this.savedScroll;
    this.paintProgress();
  },

  toggleOutline() {
    if (this.mode === "texto") { buscador.cerrar(); prompter.cerrar(); this.savedScroll = this.scrollEl.scrollTop; this.setMode("esquema"); }
    else this.setMode("texto");
  },

  /** Esquema: títulos y frases resaltadas (con filtro por color). Tocar un punto lleva a su sitio en el texto. */
  renderOutline() {
    const out = this.outlineEl;
    out.replaceChildren();
    const bloques = [...this.contentEl.children];
    const items = [];
    const colores = new Set();
    bloques.forEach((b, i) => {
      if (i === this.aqui) items.push({ tipo: "aqui", i });
      const tag = b.tagName;
      if (/^H[1-4]$/.test(tag)) { items.push({ tipo: "h", i, b }); return; }
      b.querySelectorAll("mark").forEach((m) => { const c = colorDeMark(m); colores.add(c); items.push({ tipo: "m", i, m, c }); });
    });
    // Filtro: todo, solo títulos o un color
    if (colores.size) {
      if (this.filtro !== "todo" && this.filtro !== "titulos" && !colores.has(this.filtro)) this.filtro = "todo";
      const opciones = [["todo", "Todo"], ["titulos", "Títulos"], ...COLORES.filter((c) => colores.has(c.id)).map((c) => [c.id, c.nombre])];
      const fila = el("div", { class: "o-filtro", role: "toolbar", "aria-label": "Filtrar el esquema" },
        opciones.map(([val, label]) => el("button", {
          class: "chip" + (COLORES.some((c) => c.id === val) ? ` sw-${val}` : ""), "data-filtro": val,
          "aria-pressed": String(this.filtro === val), text: label,
        })));
      out.append(fila);
    } else this.filtro = "todo";
    let n = 0;
    for (const it of items) {
      if (it.tipo === "aqui") {
        out.append(el("button", { class: "o-item o-aqui", "data-i": it.i, html: icon("bookmark") + "<span>Voy por aquí</span>" }));
        continue;
      }
      if (it.tipo === "h") {
        const min = minutosDeTitulo(it.b.textContent);
        const h = el("button", { class: `o-item o-h o-${it.b.tagName.toLowerCase()}`, "data-i": it.i });
        h.textContent = min ? tituloSinMinutos(it.b.textContent) : it.b.textContent.trim();
        if (min) h.append(el("span", { class: "o-min", text: `${String(min).replace(".", ",")} min` }));
        out.append(h); n++;
        continue;
      }
      if (this.filtro === "titulos" || (this.filtro !== "todo" && this.filtro !== it.c)) continue;
      const item = el("div", { class: `o-item o-m o-${it.c}`, "data-i": it.i, role: "button", tabindex: "0" });
      item.innerHTML = it.m.innerHTML;
      out.append(item); n++;
    }
    if (!n) {
      out.append(el("div", { class: "o-empty" },
        el("h2", { text: "El esquema está vacío" }),
        el("p", { text: "Aquí salen los títulos y las frases resaltadas. En el editor, usa «Título» o «Subtítulo» para las partes y el marcador para las ideas clave." })
      ));
    }
  },

  goToBlock(i, { flash = true } = {}) {
    this.setMode("texto", { keepScroll: true });
    const b = this.contentEl.children[i];
    if (!b) return;
    const top = b.getBoundingClientRect().top - this.scrollEl.getBoundingClientRect().top;
    this.scrollEl.scrollTop += top - Math.min(80, this.scrollEl.clientHeight * 0.15);
    if (flash) { b.classList.remove("flash"); void b.offsetWidth; b.classList.add("flash"); }
    this.paintProgress();
  },

  paintProgress() {
    const el2 = this.scrollEl;
    const max = el2.scrollHeight - el2.clientHeight;
    $("#progress-bar").style.width = (max > 0 ? (el2.scrollTop / max) * 100 : 0) + "%";
  },

  /* ---- Marcador «voy por aquí» (doble toque en un párrafo) ---- */
  cargarAqui() {
    this.aqui = null;
    let dato = null;
    try { dato = JSON.parse(lsGet(this.aquiKey(), "null")); } catch {}
    if (!dato || typeof dato.i !== "number") return;
    const hijos = this.contentEl.children;
    const empieza = (k) => hijos[k] && hijos[k].textContent.trim().startsWith(dato.t || "");
    let i = dato.i;
    // Si el texto se ha editado y el párrafo se ha movido, se busca por su principio
    if (!empieza(i)) i = [...hijos].findIndex((h, k) => empieza(k));
    if (i >= 0 && hijos[i]) { this.aqui = i; hijos[i].classList.add("aqui"); }
  },

  toggleAqui(target) {
    let b = target;
    while (b && b.parentElement !== this.contentEl) b = b.parentElement;
    if (!b) return;
    const i = [...this.contentEl.children].indexOf(b);
    $$(".aqui", this.contentEl).forEach((x) => x.classList.remove("aqui"));
    if (this.aqui === i) {
      this.aqui = null;
      lsSet(this.aquiKey(), "");
      toast("Marca quitada.");
    } else {
      this.aqui = i;
      b.classList.add("aqui");
      lsSet(this.aquiKey(), JSON.stringify({ i, t: b.textContent.trim().slice(0, 40) }));
      toast("Marcado: voy por aquí. Toca dos veces otra vez para quitarlo.");
    }
  },

  irAqui() { if (this.aqui != null) this.goToBlock(this.aqui); },

  /* ---- Menú ⋯ ---- */
  openMenu() {
    const n = (this.item.ensayos || []).length;
    const acciones = [
      { label: "Buscar en el texto", icon: "search", run: () => buscador.abrir() },
      { label: "Tarjetas: una parte por pantalla", icon: "cards", run: () => tarjetas.abrir() },
      { label: "Desplazamiento automático", icon: "scroll", run: () => prompter.abrir() },
      { label: n ? `Ensayos (${n})` : "Ensayos", icon: "history", run: () => this.openEnsayos() },
    ];
    if (this.aqui != null) acciones.push({ label: "Ir a «voy por aquí»", icon: "bookmark", run: () => this.irAqui() });
    acciones.push(
      { label: "Guardar como Word", icon: "word", run: () => exportWord(this.kind, this.item) },
      { label: "Guardar como PDF", icon: "pdf", run: () => exportPdf(this.kind, this.item) },
    );
    actionSheet(null, acciones);
  },

  /* ---- Ensayos ---- */
  async openEnsayos() {
    if (!this.id) return;
    const kind = this.kind, id = this.id;
    const item = (await store.get(kind, id)) || this.item;
    const lista = item.ensayos || [];
    const objetivo = Number(item.target) ? item.target * 60 : this.plan ? Math.round(this.plan.objetivoSeg) : null;
    const contenido = [el("h2", { text: lista.length ? `Ensayos · ${lista.length}` : "Ensayos" })];
    if (puedeGrabar()) {
      const sw = el("input", { type: "checkbox", role: "switch", id: "grabar-switch" });
      sw.checked = !!settings.grabar;
      sw.addEventListener("change", () => { settings.grabar = sw.checked; saveSettings(); });
      contenido.push(
        el("label", { class: "switch-row" }, el("span", { class: "with-icon", html: icon("mic") + "<span>Grabar audio al ensayar</span>" }), sw),
        el("p", { class: "small-print", text: `Graba mientras corre el cronómetro. Se guardan las ${MAX_GRABACIONES} últimas grabaciones de cada discurso, solo en este dispositivo.` })
      );
    }
    if (!lista.length) {
      contenido.push(el("p", { text: "Aún no hay ensayos. Pon en marcha el cronómetro y lee el discurso. Al ponerlo a cero (↺) se guarda el ensayo con el tiempo de cada parte." }));
    } else {
      const media = Math.round(lista.reduce((a, e) => a + e.seg, 0) / lista.length);
      contenido.push(el("p", { class: "ens-resumen", text: [`Último ${mmss(lista[0].seg)}`, `media ${mmss(media)}`, objetivo ? `objetivo ${mmss(objetivo)}` : ""].filter(Boolean).join(" · ") }));
      // Barras de los últimos ensayos, del más antiguo al más reciente
      const ult = lista.slice(0, 12).reverse();
      const tope = Math.max(...ult.map((e) => e.seg), objetivo || 0) * 1.08;
      const barras = el("div", { class: "ens-barras", role: "img", "aria-label": "Duración de los últimos ensayos" });
      ult.forEach((e) => {
        const o = e.objetivoSeg || objetivo;
        const cls = o && e.seg > o + 15 ? " over" : "";
        barras.append(el("span", { class: "ens-barra" + cls, style: `height:${Math.max(6, Math.round((e.seg / tope) * 100))}%`, title: mmss(e.seg) }));
      });
      if (objetivo) barras.append(el("i", { class: "ens-objetivo", style: `bottom:${Math.round((objetivo / tope) * 100)}%` }));
      contenido.push(barras);
      contenido.push(el("div", { class: "ens-lista" }, lista.map((e) => this.filaEnsayo(e, item))));
    }
    contenido.push(el("div", { class: "actions" }, el("button", { class: "action plain", text: "Cerrar", onclick: () => closeSheet() })));
    openSheet(contenido);
  },

  filaEnsayo(e, item) {
    const dif = e.objetivoSeg ? e.seg - e.objetivoSeg : null;
    const tono = (d) => (d == null ? "" : d > 15 ? "over" : d < -15 ? "ahead" : "ok");
    const difTxt = dif == null ? "" : Math.abs(dif) < 15 ? "en tiempo" : dif > 0 ? `+${mmss(dif)}` : `−${mmss(-dif)}`;
    const det = el("div", { class: "ens-detalle", hidden: true });
    const cab = el("button", { class: "ens-fila", "aria-expanded": "false" },
      el("span", { class: "ens-fecha", text: fmtDate(e.fecha) }),
      e.audio ? el("span", { class: "ens-mic", html: icon("mic"), title: "Con grabación" }) : null,
      el("span", { class: "ens-total", text: mmss(e.seg) }),
      difTxt ? el("span", { class: "ens-dif " + tono(dif), text: difTxt }) : null);
    cab.addEventListener("click", () => { det.hidden = !det.hidden; cab.setAttribute("aria-expanded", String(!det.hidden)); });
    for (const p of e.partes || []) {
      det.append(el("div", { class: "ens-parte" },
        el("span", { class: "ens-pt", text: p.t || "Parte" }),
        el("span", { class: "ens-ps " + tono(p.o ? p.s - p.o : null), text: mmss(p.s) + (p.o ? ` de ${mmss(p.o)}` : "") })));
    }
    const acciones = el("div", { class: "ens-acciones" });
    if (e.audio) acciones.append(el("button", { class: "chip", html: icon("play") + "<span>Escuchar</span>", onclick: () => this.abrirGrabacion(e, item) }));
    const borrar = el("button", { class: "chip danger", text: "Borrar" });
    let armado = false;
    borrar.addEventListener("click", async () => {
      if (!armado) {
        armado = true; borrar.textContent = "¿Seguro? Toca otra vez";
        setTimeout(() => { armado = false; borrar.textContent = "Borrar"; }, 3000);
        return;
      }
      await borrarEnsayo(this.kind, this.id, e.id);
      this.openEnsayos();
    });
    acciones.append(borrar);
    det.append(acciones);
    return el("div", { class: "ens-item" }, cab, det);
  },

  async abrirGrabacion(e, item) {
    const g = await store.get("grabaciones", e.id);
    if (!g || !g.blob) { toast("Esa grabación ya no está en el dispositivo."); return; }
    const url = URL.createObjectURL(g.blob);
    const audio = el("audio", { controls: true, src: url, preload: "metadata", class: "ens-audio" });
    const vistas = new Set();
    const marcas = (g.marcas || []).filter((m) => (vistas.has(m.i) ? false : vistas.add(m.i))).sort((a, b) => a.s - b.s);
    const fecha = new Date(g.fecha);
    const nombre = `Ensayo ${safeFileName(item.title || "discurso")} ${fecha.getDate()}-${fecha.getMonth() + 1}-${fecha.getFullYear()}.${extensionDe(g.mime || g.blob.type)}`;
    openSheet([
      el("h2", { text: `Ensayo · ${fmtDate(g.fecha)} · ${mmss(e.seg)}` }),
      audio,
      marcas.length > 1 ? el("div", { class: "group" }, el("span", { class: "label", text: "Ir a" }),
        el("div", { class: "chips" }, marcas.map((m) => el("button", {
          class: "chip", text: `${(g.partes && g.partes[m.i]) || "Parte " + (m.i + 1)} · ${mmss(m.s)}`,
          onclick: () => { audio.currentTime = m.s; audio.play().catch(() => {}); },
        })))) : null,
      el("div", { class: "actions" },
        el("button", { class: "action", html: icon("share") + "<span>Guardar el audio</span>", onclick: () => offerFile(new File([g.blob], nombre, { type: g.mime || g.blob.type }), { title: "Audio listo" }) }),
        el("button", { class: "action plain", text: "Volver a los ensayos", onclick: () => this.openEnsayos() })),
    ].filter(Boolean), { onClose: () => { audio.pause(); setTimeout(() => URL.revokeObjectURL(url), 1000); } });
  },

  init() {
    attachPinch(this.scrollEl, this.contentEl);
    const saveLater = debounce(() => this.savePos(), 400);
    let paceRaf = 0;
    this.scrollEl.addEventListener("scroll", () => {
      this.paintProgress();
      if (this.mode === "texto") saveLater();
      if (!paceRaf && (timer.running || timer.elapsed)) paceRaf = requestAnimationFrame(() => { paceRaf = 0; this.paintPace(); });
    }, { passive: true });
    // Un toque sobre el texto oculta o muestra la barra (modo atril); dos toques marcan «voy por aquí»
    let ultimoToque = { t: 0, x: 0, y: 0 }, esperaToque = 0;
    this.contentEl.addEventListener("click", (e) => {
      if (e.target.closest("a")) return;
      if (prompter.activo) { prompter.alternar(); return; }
      const now = Date.now();
      if (now - ultimoToque.t < 300 && Math.hypot(e.clientX - ultimoToque.x, e.clientY - ultimoToque.y) < 40) {
        clearTimeout(esperaToque);
        ultimoToque.t = 0;
        try { window.getSelection().removeAllRanges(); } catch {} // el doble toque no debe seleccionar una palabra
        this.toggleAqui(e.target);
        return;
      }
      if (window.getSelection && String(window.getSelection()).length) return;
      ultimoToque = { t: now, x: e.clientX, y: e.clientY };
      clearTimeout(esperaToque);
      esperaToque = setTimeout(() => {
        ultimoToque.t = 0;
        views.reader.classList.toggle("immersive");
        this.paintPace();
      }, 300);
    });
    this.outlineEl.addEventListener("click", (e) => {
      if (e.target.closest("a")) return;
      const f = e.target.closest("[data-filtro]");
      if (f) { this.filtro = f.dataset.filtro; this.renderOutline(); return; }
      const it = e.target.closest(".o-item");
      if (it) this.goToBlock(Number(it.dataset.i));
    });
    $("#reader-outline-btn").addEventListener("click", () => this.toggleOutline());
    $("#reader-more").addEventListener("click", () => this.openMenu());
    $("#float-timer").addEventListener("click", () => timer.toggle());
    $("#reader-back").addEventListener("click", () => go("#/"));
    $("#reader-edit").addEventListener("click", () => go(`#/editar/${this.kind}/${this.id}`));
    $("#reader-aa").addEventListener("click", openAaSheet);
    $("#timer-toggle").addEventListener("click", () => timer.toggle());
    $("#timer-reset").addEventListener("click", () => timer.reset());

    // Teclado, mando o pedal de pasar páginas
    document.addEventListener("keydown", (e) => {
      if (currentView !== "reader" || !$("#overlay").hidden) return;
      if (e.target.closest && e.target.closest("input, textarea, [contenteditable]")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      const adelante = k === "ArrowRight" || k === "PageDown" || (k === " " && !e.shiftKey);
      const atras = k === "ArrowLeft" || k === "PageUp" || (k === " " && e.shiftKey);
      if (k === " " && e.target.closest && e.target.closest("button")) return;
      if (tarjetas.activo) {
        if (adelante || k === "ArrowDown") { e.preventDefault(); tarjetas.ir(1); }
        else if (atras || k === "ArrowUp") { e.preventDefault(); tarjetas.ir(-1); }
        else if (k === "Escape") tarjetas.cerrar();
        return;
      }
      if (k === "Escape") { if (buscador.abierto) buscador.cerrar(); else if (prompter.activo) prompter.cerrar(); return; }
      if (this.mode === "texto" && (adelante || atras)) {
        e.preventDefault();
        this.scrollEl.scrollBy({ top: (adelante ? 1 : -1) * this.scrollEl.clientHeight * 0.85, behavior: "smooth" });
      }
    });
  },
};

/* ============================================================
   Buscar en el texto
   ============================================================ */
const buscador = {
  abierto: false, hits: [], i: -1,
  abrir() {
    prompter.cerrar();
    if (tarjetas.activo) tarjetas.cerrar();
    if (reader.mode !== "texto") reader.setMode("texto");
    views.reader.classList.remove("immersive");
    $("#findbar").hidden = false;
    this.abierto = true;
    const inp = $("#find-input");
    inp.focus();
    inp.select();
    if (inp.value.trim()) this.buscar();
    reader.paintPace();
  },
  cerrar() {
    if (!this.abierto) return;
    this.abierto = false;
    this.limpiar();
    $("#findbar").hidden = true;
    $("#find-input").blur();
    $("#find-count").textContent = "";
  },
  limpiar() { limpiarCoincidencias(reader.contentEl); this.hits = []; this.i = -1; },
  buscar() {
    this.limpiar();
    const q = $("#find-input").value;
    this.hits = marcarCoincidencias(reader.contentEl, q);
    if (!this.hits.length) { $("#find-count").textContent = q.trim().length >= 2 ? "Sin resultados" : ""; return; }
    // La primera coincidencia a partir de lo que se está leyendo
    const top = reader.scrollEl.getBoundingClientRect().top;
    const k = this.hits.findIndex((h) => h[0].getBoundingClientRect().top >= top + 10);
    this.ir(k < 0 ? 0 : k);
  },
  ir(k) {
    const n = this.hits.length;
    if (!n) return;
    k = ((k % n) + n) % n;
    if (this.hits[this.i]) this.hits[this.i].forEach((s) => s.classList.remove("cur"));
    this.i = k;
    this.hits[k].forEach((s) => s.classList.add("cur"));
    const sr = reader.scrollEl.getBoundingClientRect();
    const r = this.hits[k][0].getBoundingClientRect();
    reader.scrollEl.scrollTop += r.top - sr.top - sr.height * 0.35;
    $("#find-count").textContent = `${k + 1} de ${n}`;
  },
  init() {
    const inp = $("#find-input");
    const later = debounce(() => this.buscar(), 220);
    inp.addEventListener("input", later);
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); later.cancel(); if (!this.hits.length) this.buscar(); else this.ir(this.i + (e.shiftKey ? -1 : 1)); }
      else if (e.key === "Escape") this.cerrar();
    });
    $("#find-next").addEventListener("click", () => { if (!this.hits.length) this.buscar(); else this.ir(this.i + 1); });
    $("#find-prev").addEventListener("click", () => this.ir(this.i - 1));
    $("#find-close").addEventListener("click", () => this.cerrar());
  },
};

/* ============================================================
   Tarjetas: una parte del discurso por pantalla
   ============================================================ */
const tarjetas = {
  activo: false, lista: [], i: 0, corte: 0,
  abrir(desdeBloque) {
    buscador.cerrar();
    prompter.cerrar();
    if (reader.mode !== "texto") reader.setMode("texto");
    const bloques = [...reader.contentEl.children].map((b) => ({ tag: b.tagName, palabras: contarPalabras(b.textContent || "") }));
    this.lista = dividirEnTarjetas(bloques);
    this.corte = nivelDeCorte(bloques);
    if (!this.lista.length) { toast("No hay texto que mostrar."); return; }
    const b = desdeBloque ?? reader.bloqueActual() ?? 0;
    this.i = Math.max(0, this.lista.findIndex((t) => b >= t.inicio && b < t.fin));
    this.activo = true;
    $("#cards").hidden = false;
    this.pintar(0);
    timer.paint();
  },
  cerrar() {
    if (!this.activo) return;
    ensayo.tic();
    this.activo = false;
    $("#cards").hidden = true;
    const t = this.lista[this.i];
    if (t) reader.goToBlock(t.inicio, { flash: false });
    timer.paint();
  },
  pintar(dir) {
    const t = this.lista[this.i];
    const hijos = reader.contentEl.children;
    const body = $("#card-body");
    const copias = [];
    for (let k = t.inicio; k < t.fin; k++) copias.push(hijos[k].cloneNode(true));
    body.replaceChildren(...copias);
    // Título de la parte (no el del discurso, si la primera tarjeta lleva los dos)
    const titulo = copias.find((c) => c.tagName === "H" + this.corte) || copias.find((c) => /^H[1-4]$/.test(c.tagName));
    $("#cards-title").textContent = titulo ? tituloSinMinutos(titulo.textContent) : `Parte ${this.i + 1}`;
    $("#cards-count").textContent = `${this.i + 1} / ${this.lista.length}`;
    $("#cards-prev").disabled = this.i === 0;
    $("#cards-next").disabled = this.i === this.lista.length - 1;
    $("#cards-stage").scrollTop = 0;
    body.classList.remove("in-next", "in-prev");
    if (dir) { void body.offsetWidth; body.classList.add(dir > 0 ? "in-next" : "in-prev"); }
    reader.paintPace();
  },
  ir(d) {
    const n = this.i + d;
    if (n < 0 || n >= this.lista.length) {
      const body = $("#card-body");
      body.classList.remove("tope"); void body.offsetWidth; body.classList.add("tope");
      return;
    }
    ensayo.tic(); // el tiempo hasta aquí cuenta para la tarjeta anterior
    this.i = n;
    this.pintar(d);
    ensayo.tic();
  },
  init() {
    const stage = $("#cards-stage");
    attachPinch(stage, $("#card-body"));
    let p0 = null, varios = false;
    stage.addEventListener("pointerdown", (e) => {
      if (p0) { varios = true; return; }
      p0 = { x: e.clientX, y: e.clientY, t: Date.now(), id: e.pointerId };
      varios = false;
    });
    stage.addEventListener("pointerup", (e) => {
      if (!p0 || e.pointerId !== p0.id) return;
      const dx = e.clientX - p0.x, dy = e.clientY - p0.y, dt = Date.now() - p0.t;
      const fueronVarios = varios;
      p0 = null;
      if (fueronVarios) return;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4 && dt < 900) { this.ir(dx < 0 ? 1 : -1); return; }
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12 && dt < 500 && !e.target.closest("a")) {
        const r = stage.getBoundingClientRect();
        const fx = (e.clientX - r.left) / r.width;
        if (fx > 0.65) this.ir(1);
        else if (fx < 0.35) this.ir(-1);
      }
    });
    stage.addEventListener("pointercancel", () => { p0 = null; });
    stage.addEventListener("scroll", () => { if (timer.running || timer.elapsed) reader.paintPace(); }, { passive: true });
    $("#cards-prev").addEventListener("click", () => this.ir(-1));
    $("#cards-next").addEventListener("click", () => this.ir(1));
    $("#cards-close").addEventListener("click", () => this.cerrar());
    $("#cards-timer-toggle").addEventListener("click", () => timer.toggle());
  },
};

/* ============================================================
   Desplazamiento automático (teleprompter)
   ============================================================ */
const prompter = {
  activo: false, pausado: false, wpm: 130, pos: 0, raf: 0, ultimo: 0, pxPorPalabra: 1, medido: 0, tocando: false, soltar: 0,
  abrir() {
    buscador.cerrar();
    if (tarjetas.activo) tarjetas.cerrar();
    if (reader.mode !== "texto") reader.setMode("texto");
    const palabras = contarPalabras(reader.contentEl.textContent || "");
    if (!palabras) { toast("No hay texto que desplazar."); return; }
    const objetivo = Number(reader.item && reader.item.target) || 0;
    this.wpm = clamp(Math.round(objetivo ? palabras / objetivo : Number(settings.tpWpm) || 130), 40, 300);
    this.activo = true;
    this.pausado = false;
    views.reader.classList.add("immersive", "tp-on");
    $("#tp-bar").hidden = false;
    $("#tp-guide").hidden = false;
    this.medir();
    this.pos = reader.scrollEl.scrollTop;
    this.ultimo = performance.now();
    this.pintar();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame((t) => this.paso(t));
    reader.paintPace();
  },
  cerrar() {
    if (!this.activo) return;
    this.activo = false;
    cancelAnimationFrame(this.raf);
    views.reader.classList.remove("tp-on", "immersive");
    $("#tp-bar").hidden = true;
    $("#tp-guide").hidden = true;
    reader.savePos();
    reader.paintPace();
  },
  medir() {
    const c = reader.contentEl, cs = getComputedStyle(c);
    const alto = c.offsetHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    this.pxPorPalabra = Math.max(0.1, alto / Math.max(1, contarPalabras(c.textContent || "")));
    this.medido = performance.now();
  },
  paso(t) {
    if (!this.activo) return;
    const dt = Math.min(100, t - this.ultimo) / 1000;
    this.ultimo = t;
    const sc = reader.scrollEl;
    if (!this.pausado && !this.tocando) {
      if (t - this.medido > 1000) this.medir();
      if (Math.abs(sc.scrollTop - this.pos) > 3) this.pos = sc.scrollTop; // lo ha movido el usuario o el zoom
      this.pos += (this.pxPorPalabra * this.wpm / 60) * dt;
      sc.scrollTop = this.pos;
      if (sc.scrollTop >= sc.scrollHeight - sc.clientHeight - 1) { this.pausado = true; this.pintar(); toast("Has llegado al final."); }
    }
    this.raf = requestAnimationFrame((x) => this.paso(x));
  },
  alternar() {
    this.pausado = !this.pausado;
    this.pos = reader.scrollEl.scrollTop;
    this.pintar();
  },
  velocidad(d) {
    this.wpm = clamp(this.wpm + d, 40, 300);
    settings.tpWpm = this.wpm;
    saveSettings();
    this.pintar();
  },
  pintar() {
    const play = $("#tp-play");
    play.innerHTML = icon(this.pausado ? "play" : "pause");
    play.setAttribute("aria-label", this.pausado ? "Seguir" : "Pausa");
    $("#tp-speed").textContent = `${this.wpm} pal/min`;
    $("#tp-bar").classList.toggle("paused", this.pausado);
  },
  init() {
    const sc = reader.scrollEl;
    sc.addEventListener("touchstart", () => { if (this.activo) { this.tocando = true; clearTimeout(this.soltar); } }, { passive: true });
    const fin = () => {
      if (!this.activo) return;
      clearTimeout(this.soltar);
      this.soltar = setTimeout(() => { this.tocando = false; this.pos = sc.scrollTop; this.ultimo = performance.now(); }, 700);
    };
    sc.addEventListener("touchend", fin, { passive: true });
    sc.addEventListener("touchcancel", fin, { passive: true });
    $("#tp-play").addEventListener("click", () => this.alternar());
    $("#tp-slower").addEventListener("click", () => this.velocidad(-10));
    $("#tp-faster").addEventListener("click", () => this.velocidad(10));
    $("#tp-close").addEventListener("click", () => this.cerrar());
  },
};

/* ============================================================
   Editor
   ============================================================ */
const editor = {
  kind: null, id: null, item: null, dirty: false, saving: null,
  area: $("#editor"), titleInput: $("#editor-title"), scrollEl: $("#editor-scroll"),

  async open(kind, id, stale = () => false) {
    const item = await store.get(kind, id);
    if (stale()) return;
    if (!item) { toast("Ese documento ya no existe."); throw new Error("no existe"); }
    this.kind = kind; this.id = id; this.item = item; this.dirty = false;
    this.titleInput.value = item.title || "";
    this.titleInput.placeholder = kind === "notes" ? "Título de la nota" : "Título del discurso";
    this.area.innerHTML = item.html && item.html !== "<p><br></p>" ? item.html : "<p><br></p>";
    $("#save-state").textContent = "";
    document.title = (item.title || "Editar") + " · Atril";
    this.togglePalette(false);
    showView("editor");
    this.scrollEl.scrollTop = 0;
    this.paintToolbar();
    // Documento nuevo: el cursor empieza en el título
    if (!item.title && (!item.html || item.html === "<p><br></p>")) this.titleInput.focus();
  },

  markDirty() {
    this.dirty = true;
    $("#save-state").textContent = "";
    this.saveLater();
  },

  async save() {
    if (!this.dirty || !this.item) return;
    this.dirty = false;
    const html = sanitize(this.area.innerHTML);
    let title = this.titleInput.value.trim();
    if (!title) title = htmlToText(html).split("\n")[0].trim().slice(0, 60);
    const item = { ...this.item, html, title: title || (this.kind === "notes" ? "Nota sin título" : "Sin título"), updated: Date.now() };
    this.item = item;
    const p = store.put(this.kind, item).then(
      () => { $("#save-state").textContent = "Guardado"; },
      (e) => { console.error(e); this.dirty = true; $("#save-state").textContent = "Sin guardar"; toast("No se pudo guardar. Revisa el espacio del dispositivo."); }
    );
    this.saving = p;
    await p;
  },

  async flush() {
    this.saveLater.cancel();
    if (this.saving) await this.saving;
    await this.save();
  },

  exec(cmd) {
    this.area.focus();
    const d = document;
    switch (cmd) {
      case "undo": d.execCommand("undo"); break;
      case "redo": d.execCommand("redo"); break;
      case "bold": d.execCommand("bold"); break;
      case "italic": d.execCommand("italic"); break;
      case "underline": d.execCommand("underline"); break;
      case "highlight": this.togglePalette(); return;
      case "h1": d.execCommand("formatBlock", false, "<h1>"); break;
      case "h2": d.execCommand("formatBlock", false, "<h2>"); break;
      case "p": d.execCommand("formatBlock", false, "<p>"); break;
      case "ul": d.execCommand("insertUnorderedList"); break;
      case "ol": d.execCommand("insertOrderedList"); break;
      case "clear":
        d.execCommand("removeFormat");
        this.unwrapMarksInSelection();
        d.execCommand("formatBlock", false, "<p>");
        break;
    }
    this.markDirty();
    this.paintToolbar();
  },

  selectionMark() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    let n = sel.anchorNode;
    if (n && n.nodeType === 3) n = n.parentElement;
    const m = n && n.closest ? n.closest("mark") : null;
    if (m) return m;
    // ¿Es un span con fondo (resaltado recién aplicado)?
    let s = n;
    while (s && s !== this.area) { if (s.nodeType === 1 && s.tagName === "SPAN" && hasBackground(s)) return s; s = s.parentElement; }
    return null;
  },

  unwrapMarksInSelection() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    $$("mark", this.area).forEach((m) => { if (range.intersectsNode(m)) m.replaceWith(...m.childNodes); });
  },

  /** Paleta del resaltador (debajo de la barra). */
  togglePalette(force) {
    const p = $("#palette");
    const show = force ?? p.hidden;
    p.hidden = !show;
    $('#toolbar button[data-cmd="highlight"]').setAttribute("aria-expanded", String(show));
    if (show) this.paintPalette();
  },

  colorActual() {
    const m = this.selectionMark();
    if (!m) return null;
    return m.tagName === "MARK" ? colorDeMark(m) : (claseDeFondo(fondoDe(m)).slice(2) || "amarillo");
  },

  paintPalette() {
    const actual = this.colorActual();
    $$("#palette [data-color]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.color === actual)));
  },

  quitarResaltado(m) {
    if (m.tagName === "MARK") { m.replaceWith(...m.childNodes); return; }
    m.style.backgroundColor = "";
    if (!m.getAttribute("style")) m.replaceWith(...m.childNodes);
  },

  aplicarColor(id) {
    this.area.focus();
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const m = this.selectionMark();
    const dentro = m && (sel.isCollapsed || m.contains(range.commonAncestorContainer));
    if (id === "quitar") {
      if (dentro) this.quitarResaltado(m);
      else {
        $$("mark, span", this.area).forEach((n) => {
          if (range.intersectsNode(n) && (n.tagName === "MARK" || hasBackground(n))) this.quitarResaltado(n);
        });
      }
    } else {
      const c = COLORES.find((x) => x.id === id);
      if (!c) return;
      if (dentro) {
        // Cambia el color del resaltado en el que está el cursor
        if (m.tagName === "MARK") { if (c.clase) m.className = c.clase; else m.removeAttribute("class"); }
        else m.style.backgroundColor = c.hex;
      } else if (sel.isCollapsed) {
        toast("Selecciona primero el texto que quieres resaltar.");
        return;
      } else {
        // hiliteColor funciona en Safari y Chrome; al guardar se convierte en <mark> del color que toca
        document.execCommand("styleWithCSS", false, true);
        document.execCommand("hiliteColor", false, c.hex);
        document.execCommand("styleWithCSS", false, false);
      }
      settings.markColor = id;
      saveSettings();
    }
    this.markDirty();
    this.paintToolbar();
  },

  paintToolbar() {
    const state = (c) => { try { return document.queryCommandState(c); } catch { return false; } };
    let block = "";
    try { block = String(document.queryCommandValue("formatBlock") || "").toLowerCase(); } catch {}
    const map = {
      bold: state("bold"), italic: state("italic"), underline: state("underline"),
      ul: state("insertUnorderedList"), ol: state("insertOrderedList"),
      h1: block === "h1", h2: block === "h2", highlight: !!this.selectionMark(),
    };
    $$("#toolbar button[data-cmd]").forEach((b) => b.classList.toggle("active", !!map[b.dataset.cmd]));
    if (!$("#palette").hidden) this.paintPalette();
  },

  init() {
    this.saveLater = debounce(() => this.save(), 700);
    attachPinch(this.scrollEl, this.area);
    this.area.addEventListener("input", () => this.markDirty());
    this.titleInput.addEventListener("input", () => this.markDirty());
    this.titleInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); this.area.focus(); } });
    this.area.addEventListener("paste", (e) => {
      // Pega como texto limpio (evita estilos raros de webs o del correo)
      const text = e.clipboardData && e.clipboardData.getData("text/plain");
      if (text == null) return;
      e.preventDefault();
      document.execCommand("insertText", false, text);
    });
    document.addEventListener("selectionchange", () => { if (currentView === "editor") this.paintToolbar(); });
    // Mantener la selección al tocar la barra de herramientas
    $$("#toolbar button").forEach((b) => {
      b.tabIndex = -1;
      b.addEventListener("pointerdown", (e) => e.preventDefault());
      b.addEventListener("mousedown", (e) => e.preventDefault());
      b.addEventListener("click", () => this.exec(b.dataset.cmd));
    });
    $$("#palette button").forEach((b) => {
      b.tabIndex = -1;
      b.addEventListener("pointerdown", (e) => e.preventDefault());
      b.addEventListener("mousedown", (e) => e.preventDefault());
      b.addEventListener("click", () => { if (b.dataset.color === "cerrar") this.togglePalette(false); else this.aplicarColor(b.dataset.color); });
    });
    $("#editor-back").addEventListener("click", async () => {
      await this.flush();
      go(this.kind === "docs" ? `#/leer/docs/${this.id}` : "#/", { replace: true });
    });
    $("#editor-read").addEventListener("click", async () => { await this.flush(); go(`#/leer/${this.kind}/${this.id}`); });
    $("#editor-more").addEventListener("click", async () => {
      await this.flush();
      const item = this.item;
      actionSheet(item.title, [
        { label: "Guardar como Word", icon: "word", run: () => exportWord(this.kind, item) },
        { label: "Guardar como PDF", icon: "pdf", run: () => exportPdf(this.kind, item) },
        { label: "Copiar el texto", icon: "copy", run: () => copyText(htmlToText(item.html)) },
        { label: "Compartir el texto", icon: "share", run: () => shareText(item.title, htmlToText(item.html)) },
        { label: "Tamaño de letra y tema", icon: "aa", run: () => openAaSheet() },
        { label: "Eliminar", icon: "trash", danger: true, run: async () => { await deleteItem(this.kind, item); } },
      ]);
    });
  },
};

/* ============================================================
   Arranque
   ============================================================ */
const APP_VERSION = "__APP_VERSION__";

function init() {
  applySettings();
  paintIcons();
  // Evita el zoom de página de Safari en toda la app (el zoom de letra lo gestionamos nosotros)
  document.addEventListener("gesturestart", (e) => e.preventDefault());
  document.addEventListener("dblclick", (e) => { if (!e.target.closest(".editor, input")) e.preventDefault(); }, { passive: false });

  $$(".segmented button").forEach((b) => b.addEventListener("click", () => { settings.tab = b.dataset.tab; saveSettings(); renderHome(); }));
  $("#search").addEventListener("input", debounce((e) => { home.query = e.target.value; renderHome(); }, 150));
  $("#btn-settings").addEventListener("click", openSettings);
  $("#hide-install-hint").addEventListener("click", () => { lsSet("atril.hideInstall", "1"); $("#install-hint").hidden = true; });
  $("#file-input").addEventListener("change", (e) => { const f = e.target.files; importFiles(f).finally(() => { e.target.value = ""; }); });
  $("#backup-input").addEventListener("change", (e) => { const f = e.target.files && e.target.files[0]; if (f) importBackup(f).finally(() => { e.target.value = ""; }); });

  reader.init();
  buscador.init();
  tarjetas.init();
  prompter.init();
  editor.init();

  window.addEventListener("hashchange", route);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && currentView === "reader") keepAwake(true);
    if (document.visibilityState === "hidden") { if (currentView === "editor") editor.flush(); if (currentView === "reader") reader.savePos(); }
  });
  window.addEventListener("pagehide", () => { if (currentView === "editor") editor.flush(); });

  // Con el teclado en pantalla, la app ocupa solo la parte visible (evita saltos en iPad/iPhone)
  if (window.visualViewport) {
    const fit = () => {
      document.documentElement.style.setProperty("--vvh", window.visualViewport.height + "px");
      if (window.scrollY) window.scrollTo(0, 0);
    };
    window.visualViewport.addEventListener("resize", fit);
    fit();
  }

  // Pide al navegador que no borre los datos
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  // Limpieza de grabaciones sueltas, cuando la app ya está tranquila
  setTimeout(limpiarGrabaciones, 8000);

  route();
  registerSW();
}

function registerSW() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  // La primera vez que el service worker toma el control no hay nada que actualizar
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register("sw.js").catch((e) => console.warn("SW", e));
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController) { hadController = true; return; }
    toast("Hay una versión nueva de Atril.", { action: "Actualizar", onAction: async () => { if (currentView === "editor") await editor.flush(); location.reload(); }, ms: 10000 });
  });
}

init();

// Exportado para las pruebas automáticas
window.__atril = {
  sanitize, htmlToText, textToHtml, store, settings: () => settings, setFontSize, importFiles, exportWord, crearPdf,
  timer, reader, editor, ensayo, buscador, tarjetas, prompter, crearPlantilla,
};
