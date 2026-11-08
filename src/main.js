// Atril — lector y editor de discursos y notas (PWA)
// Código sin frameworks. Los datos se guardan en IndexedDB, en el propio dispositivo.

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

function hasBackground(node) {
  const bg = node.style && (node.style.backgroundColor || node.style.background);
  return bg && !/transparent|rgba\(0,\s*0,\s*0,\s*0\)|^initial|^inherit/.test(bg);
}

function cleanNode(node) {
  for (const child of [...node.childNodes]) {
    if (child.nodeType === Node.COMMENT_NODE) { child.remove(); continue; }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    let tag = child.tagName.toUpperCase();
    if (DROP.has(tag)) { child.remove(); continue; }

    // Resaltado aplicado como estilo sobre otra etiqueta (p. ej. <b style="background-color:…">)
    if (tag !== "SPAN" && tag !== "FONT" && tag !== "MARK" && !BLOCKS.has(tag) && hasBackground(child)) {
      const m = document.createElement("mark");
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
      const wrap = (t) => { const w = document.createElement(t); w.append(out); out = w; };
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
    for (const a of [...child.attributes]) if (!keep.includes(a.name.toLowerCase())) child.removeAttribute(a.name);
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
  // Quita <mark> vacíos o anidados
  out.querySelectorAll("mark mark").forEach((m) => m.replaceWith(...m.childNodes));
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
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains("docs")) d.createObjectStore("docs", { keyPath: "id" });
      if (!d.objectStoreNames.contains("notes")) d.createObjectStore("notes", { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
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
const DEFAULTS = { fontSize: 26, theme: "claro", font: "serif", lineHeight: 1.6, wakeLock: true, tab: "docs" };
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
async function exportWord(kind, item) {
  const close = busy("Preparando el Word…");
  try {
    const { buildDocx } = await import("./docx-export.js");
    let html = item.html || "<p></p>";
    if (kind === "notes" && item.title) {
      const firstLine = htmlToText(html).split("\n")[0].trim();
      if (firstLine !== item.title.trim()) html = `<h1>${escapeHtml(item.title)}</h1>` + html;
    }
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
   Copia de seguridad
   ============================================================ */
async function exportBackup() {
  const data = { app: "atril", format: 1, exported: new Date().toISOString(), docs: await store.all("docs"), notes: await store.all("notes") };
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const file = new File([JSON.stringify(data)], `atril-copia-${stamp}.json`, { type: "application/json" });
  offerFile(file, { title: "Copia de seguridad lista" });
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
      const clean = {
        id: it.id, title: String(it.title || "Sin título").slice(0, 300), html: sanitize(String(it.html || "")),
        created: Number(it.created) || Date.now(), updated: Number(it.updated) || Date.now(), source: it.source ? String(it.source) : undefined,
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

async function newItem(kind) {
  const now = Date.now();
  const item = { id: uid(), title: "", html: "<p><br></p>", created: now, updated: now };
  await store.put(kind, item);
  go(`#/editar/${kind}/${item.id}`);
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
      el("button", { class: "btn", html: icon("plus") + "<span>Nuevo discurso</span>", onclick: () => newItem("docs") })
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
        el("span", { class: "card-meta", text: `${fmtDate(it.updated || it.created)} · ${words.toLocaleString("es-ES")} palabras` }),
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
  openSheet([
    el("h2", { text: "Ajustes" }),
    el("label", { class: "switch-row" }, el("span", { text: "Mantener la pantalla encendida al leer" }), wake),
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
  ]);
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
  running: false, startedAt: 0, elapsed: 0, int: 0,
  ms() { return this.elapsed + (this.running ? Date.now() - this.startedAt : 0); },
  toggle() {
    if (this.running) { this.elapsed += Date.now() - this.startedAt; this.running = false; clearInterval(this.int); }
    else { this.startedAt = Date.now(); this.running = true; this.int = setInterval(() => this.paint(), 500); }
    this.paint();
  },
  reset() { this.running = false; this.elapsed = 0; clearInterval(this.int); this.paint(); },
  paint() {
    const s = Math.floor(this.ms() / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    $("#timer-text").textContent = (h ? h + ":" + String(m).padStart(2, "0") : String(m).padStart(2, "0")) + ":" + String(sec).padStart(2, "0");
    $("#timer").classList.toggle("running", this.running);
    $("#timer-reset").hidden = this.running || this.elapsed === 0;
  },
};

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
    el("h2", { text: "Texto" }),
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
    el("div", { class: "actions" }, el("button", { class: "action plain", text: "Cerrar", onclick: () => closeSheet() })),
  ], { onClose: () => { aaSheetOpen = false; } });
}

const reader = {
  kind: null, id: null, item: null,
  scrollEl: $("#reader-scroll"), contentEl: $("#reader-content"),
  posKey() { return `atril.pos.${this.kind}.${this.id}`; },

  async open(kind, id, stale = () => false) {
    const item = await store.get(kind, id);
    if (stale()) return;
    if (!item) { toast("Ese documento ya no existe."); throw new Error("no existe"); }
    this.kind = kind; this.id = id; this.item = item;
    const title = item.title || htmlToText(item.html).split("\n")[0].slice(0, 60) || "Sin título";
    $("#reader-title").textContent = title;
    document.title = title + " · Atril";
    this.contentEl.innerHTML = item.html || "";
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
    this.savePos();
  },

  savePos() {
    if (!this.id) return;
    const r = this.scrollEl.scrollHeight ? this.scrollEl.scrollTop / this.scrollEl.scrollHeight : 0;
    lsSet(this.posKey(), String(Math.round(r * 10000) / 10000));
  },

  paintProgress() {
    const el2 = this.scrollEl;
    const max = el2.scrollHeight - el2.clientHeight;
    $("#progress-bar").style.width = (max > 0 ? (el2.scrollTop / max) * 100 : 0) + "%";
  },

  init() {
    attachPinch(this.scrollEl, this.contentEl);
    const saveLater = debounce(() => this.savePos(), 400);
    this.scrollEl.addEventListener("scroll", () => { this.paintProgress(); saveLater(); }, { passive: true });
    // Un toque sobre el texto oculta o muestra la barra (modo atril)
    this.contentEl.addEventListener("click", (e) => {
      if (e.target.closest("a")) return;
      if (window.getSelection && String(window.getSelection()).length) return;
      views.reader.classList.toggle("immersive");
    });
    $("#reader-back").addEventListener("click", () => go("#/"));
    $("#reader-edit").addEventListener("click", () => go(`#/editar/${this.kind}/${this.id}`));
    $("#reader-aa").addEventListener("click", openAaSheet);
    $("#timer-toggle").addEventListener("click", () => timer.toggle());
    $("#timer-reset").addEventListener("click", () => timer.reset());
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
      case "highlight": this.toggleHighlight(); break;
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

  toggleHighlight() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const m = this.selectionMark();
    if (m) { m.replaceWith(...m.childNodes); return; }
    if (sel.isCollapsed) { toast("Selecciona primero el texto que quieres resaltar."); return; }
    // hiliteColor funciona en Safari y Chrome; al guardar se convierte en <mark>
    document.execCommand("styleWithCSS", false, true);
    document.execCommand("hiliteColor", false, "#fff176");
    document.execCommand("styleWithCSS", false, false);
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
window.__atril = { sanitize, htmlToText, textToHtml, store, settings: () => settings, setFontSize, importFiles, exportWord };
