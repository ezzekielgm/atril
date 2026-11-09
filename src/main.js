// Atril — lector y editor de discursos y notas (PWA)
// Código sin frameworks. Los datos se guardan en IndexedDB, en el propio dispositivo.

import { enlazarCitas } from "./biblia.js";
import { crearPlan, tiempoPrevisto, palabraActual, mmss, contarPalabras, minutosEstimados, minutosDeTitulo, tituloSinMinutos, ritmoDeEnsayos, analizarEnsayos, PALABRAS_POR_MINUTO } from "./tiempo.js";
import { limpiarDibujo, figuraDibujo, svgDibujo } from "./dibujo-svg.js";
import { COLORES, LETRAS, claseValida, claseDeFondo, colorDeMark, claseLetraValida, claseDeLetra, rgbDe } from "./colores.js";
import { crearPlantilla, repartirMinutos } from "./plantilla.js";
import { dividirEnTarjetas, nivelDeCorte, partesDelDiscurso, parteDeBloque, estimarPartes } from "./tarjetas.js";
import { marcarCoincidencias, limpiarCoincidencias, plegarTexto, rangosCoincidencias } from "./buscar.js";
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
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 15l2.5 2.5L16 13"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  doc: '<path d="M6 1.5h8.5l5.5 5.5v14a1.5 1.5 0 0 1-1.5 1.5h-12.5a1.5 1.5 0 0 1-1.5-1.5v-18a1.5 1.5 0 0 1 1.5-1.5z" fill="currentColor" stroke="none"/><path d="M14.5 1.5v5.5h5.5" stroke="#fff" stroke-opacity=".55" fill="none"/><path d="M8 12h8M8 15.5h8M8 19h5" stroke="#fff" stroke-width="1.6"/>',
  nota: '<rect x="3.5" y="2" width="17" height="20" rx="2" fill="currentColor" stroke="none"/><path d="M7.5 8h9M7.5 12h9M7.5 16h5" stroke="#fff" stroke-width="1.6"/>',
  replace: '<path d="M4 7h11l-3-3"/><path d="M20 17H9l3 3"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  pluma: '<path d="M4 20c4-1 6-3 8-6l5-8a2 2 0 0 0-3-2l-6 9c-2 3-3 5-4 7z"/><path d="M12.5 14.5l-3-2"/>',
  goma: '<path d="M7 20h11"/><path d="M5.5 15.5l9-9a2 2 0 0 1 3 0l2 2a2 2 0 0 1 0 3l-8 8H9z"/><path d="M10 11l5 5"/>',
  rotulador: '<path d="M9 15l-3 3v2h4l3-3"/><path d="M9 15l6-9 4 3-6 8z"/><path d="M3 21h8"/>',
  escudo: '<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6L12 3z"/><path d="M8.8 12.2l2.2 2.2 4.3-4.6"/>',
  chat: '<path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3 20.5l1.5-5.2A8.5 8.5 0 1 1 21 11.5z"/>',
  guia: '<circle cx="12" cy="12" r="9.5"/><path d="M9.3 9.2a2.8 2.8 0 0 1 5.4 1c0 1.9-2.7 2.6-2.7 4.2"/><path d="M12 17.6h.01" stroke-width="2.6"/>',
  pin: '<path d="M12 16v6"/><path d="M8.5 3h7l-1 6 3.5 3.5V16H6v-3.5L9.5 9z"/>',
  panel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/><path d="M5.5 8h1.5M5.5 11h1.5"/>',
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
const BLOCKS = new Set(["P", "H1", "H2", "H3", "H4", "UL", "OL", "LI", "TABLE", "BLOCKQUOTE", "DIV", "TR", "TD", "TH", "THEAD", "TBODY", "FIGURE"]);
const LETRA_EN = /^(P|H[1-4]|LI|TD|TH|STRONG|B|EM|I|U|S|STRIKE|DEL|MARK|SUB|SUP)$/; // etiquetas cuyo color de letra se conserva

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
    // Dibujo: se vuelve a hacer entero a partir de sus datos (del SVG que llega no se guarda nada)
    if (tag === "FIGURE") {
      const d = /\bdibujo\b/.test(child.getAttribute("class") || "") ? limpiarDibujo(child.getAttribute("data-dibujo")) : null;
      if (d && d.t.length) child.replaceWith(figuraDibujo(d)); else child.remove();
      continue;
    }

    // Color de letra aplicado como estilo sobre otra etiqueta (p. ej. <p style="color:red">, <b style="color:…">)
    if (tag !== "SPAN" && tag !== "FONT" && LETRA_EN.test(tag)) {
      const c = child.style && child.style.color;
      const cl = c ? claseDeLetra(c) || "t-auto" : "";
      if (cl) { const sp = document.createElement("span"); sp.className = cl; while (child.firstChild) sp.append(child.firstChild); child.append(sp); }
    }
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
      // Color de la letra: <span class="t-rojo"> ya limpio se queda tal cual
      const clase = child.getAttribute("class") || "";
      const fontColor = tag === "FONT" ? child.getAttribute("color") : "";
      const letra = st.color ? claseDeLetra(st.color) || "t-auto"
        : fontColor ? claseDeLetra(fontColor) || "t-auto"
        : claseLetraValida(clase) || (clase === "t-auto" ? "t-auto" : "");
      if (tag === "SPAN" && letra && child.attributes.length === 1 && clase === letra) { cleanNode(child); continue; }
      const fw = st.fontWeight;
      const inner = document.createDocumentFragment();
      while (child.firstChild) inner.append(child.firstChild);
      let out = inner;
      const wrap = (t) => {
        const w = t === "mark" ? markDe(child) : t === "letra" ? Object.assign(document.createElement("span"), { className: letra }) : document.createElement(t);
        w.append(out); out = w;
      };
      if (letra) wrap("letra");
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

/** El <span> de color de letra que envuelve a un nodo (sin salir de root) o null. */
function colorDeFuera(n, root) {
  for (let p = n.parentElement; p && p !== root; p = p.parentElement) if (p.tagName === "SPAN" && claseLetraValida(p.getAttribute("class"))) return p;
  return null;
}
/** Parte `fuera` en tres: lo de antes de `dentro`, el trozo que lo lleva (ya sin `fuera`) y lo de después. */
function partirAlrededor(fuera, dentro) {
  const antes = document.createRange();
  antes.setStart(fuera, 0); antes.setEndBefore(dentro);
  const fa = antes.extractContents();
  const despues = document.createRange();
  despues.setStartAfter(dentro); despues.setEnd(fuera, fuera.childNodes.length);
  const fd = despues.extractContents();
  const copia = (frag) => { if (!frag.textContent) return null; const m = fuera.cloneNode(false); m.append(frag); return m; };
  const a = copia(fa), d = copia(fd);
  fuera.replaceWith(...[a, ...fuera.childNodes, d].filter(Boolean));
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
  // «Automático» (color normal) dentro de un trozo de color: se parte el de fuera y se quita
  let auto;
  while ((auto = out.querySelector("span.t-auto"))) {
    let fuera;
    while ((fuera = colorDeFuera(auto, out))) partirAlrededor(fuera, auto);
    auto.replaceWith(...auto.childNodes);
  }
  out.querySelectorAll("mark,strong,em,u,s,b,i,span").forEach((m) => { if (!m.textContent && !m.querySelector("img")) m.remove(); });
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
    const req = indexedDB.open(DB_NAME, 3);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains("docs")) d.createObjectStore("docs", { keyPath: "id" });
      if (!d.objectStoreNames.contains("notes")) d.createObjectStore("notes", { keyPath: "id" });
      if (!d.objectStoreNames.contains("grabaciones")) d.createObjectStore("grabaciones", { keyPath: "id" });
      if (!d.objectStoreNames.contains("versiones")) d.createObjectStore("versiones", { keyPath: "id" });
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
/** Apunta cuándo cambió algo (para el aviso de copia de seguridad). */
const marcarCambio = (s) => { if (s === "docs" || s === "notes") lsSet("atril.cambio", String(Date.now())); };
const store = {
  all: (s) => tx(s, "readonly", (o) => o.getAll()),
  get: (s, id) => tx(s, "readonly", (o) => o.get(id)),
  put: (s, obj) => { marcarCambio(s); return tx(s, "readwrite", (o) => o.put(obj)); },
  del: (s, id) => { marcarCambio(s); return tx(s, "readwrite", (o) => o.delete(id)); },
};

/* ============================================================
   Ajustes
   ============================================================ */
const DEFAULTS = {
  fontSize: 26, theme: "claro", font: "sans", lineHeight: 1.6, wakeLock: true, tab: "docs", refLinks: "app",
  grabar: false, tpWpm: 130, pdfSize: 16, pdfMarks: true, markColor: "amarillo", ppm: PALABRAS_POR_MINUTO,
  panel: true, panelEditor: true, presToque: true, presComprobar: true, // panel lateral (lector / editor) y pasar página tocando al presentar
};
const FS_MIN = 14, FS_MAX = 80;
let settings = { ...DEFAULTS };
try { settings = { ...DEFAULTS, ...JSON.parse(localStorage.getItem("atril.settings") || "{}") }; } catch {}
// Diseño como Word: la letra pasa a ser la de Word una sola vez (luego se puede cambiar en «Letra»)
if (!settings.estiloWord) {
  settings.font = "sans";
  settings.estiloWord = 1;
  try { localStorage.setItem("atril.settings", JSON.stringify(settings)); } catch {}
}
/** Palabras por minuto al hablar (para las estimaciones). */
const ppm = () => clamp(Math.round(Number(settings.ppm) || PALABRAS_POR_MINUTO), 70, 220);
function saveSettings() { try { localStorage.setItem("atril.settings", JSON.stringify(settings)); } catch {} }
function lsGet(k, def = null) { try { const v = localStorage.getItem(k); return v == null ? def : v; } catch { return def; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch {} }

// Color de la barra del sistema: [papel, barra azul] de cada tema
const THEME_COLORS = { claro: ["#ffffff", "#185abd"], sepia: ["#f7efdd", "#6b4520"], oscuro: ["#1b1b1d", "#1f2a3d"] };
function pintarColorBarra() {
  const c = THEME_COLORS[settings.theme] || THEME_COLORS.claro;
  const meta = $('meta[name="theme-color"]');
  // Inicio: el azul del banner; editor: la barra azul; lector: el papel
  const color = currentView === "home" ? (settings.theme === "oscuro" ? "#081f47" : "#0c306d") : currentView === "reader" ? c[0] : c[1];
  if (meta) meta.setAttribute("content", color);
}
function applySettings() {
  const root = document.documentElement;
  root.dataset.theme = settings.theme;
  root.dataset.font = settings.font;
  root.style.setProperty("--fs", settings.fontSize + "px");
  root.style.setProperty("--lh", String(settings.lineHeight));
  pintarColorBarra();
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
/** Menú de acciones. Un elemento {grupo: "Nombre"} empieza un grupo con su título. */
function actionSheet(title, actions) {
  const bloques = [];
  let actual = null;
  for (const a of actions) {
    if (!a) continue;
    if (a.grupo) { actual = null; bloques.push(el("h3", { class: "menu-grupo", text: a.grupo })); continue; }
    if (!actual) { actual = el("div", { class: "actions menu" }); bloques.push(actual); }
    const b = el("button", { class: "action" + (a.danger ? " danger" : ""), html: (a.icon ? icon(a.icon) : "") + `<span>${escapeHtml(a.label)}</span>` });
    b.addEventListener("click", () => { close(); a.run(); });
    actual.append(b);
  }
  const { close } = openSheet([
    title ? el("h2", { text: title }) : null,
    ...bloques,
    el("div", { class: "actions" }, el("button", { class: "action plain", text: "Cancelar", onclick: () => close() })),
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
function offerFile(file, { title, onDone, nota, boton } = {}) {
  const hecho = () => { try { onDone && onDone(); } catch (e) { console.error(e); } };
  const canShare = !!(navigator.canShare && navigator.canShare({ files: [file] }));
  const { close } = openSheet([
    el("h2", { text: title || "Archivo listo" }),
    el("p", { text: file.name }),
    el("div", { class: "actions" },
      el("button", {
        class: "action primary",
        html: icon(canShare ? "share" : "download") + `<span>${canShare ? boton || "Guardar en Archivos o compartir" : "Descargar"}</span>`,
        onclick: async () => {
          if (canShare) {
            try { await navigator.share({ files: [file], title: file.name }); close(); hecho(); }
            catch (e) { if (e && e.name !== "AbortError") { downloadFile(file); close(); hecho(); } }
          } else { downloadFile(file); close(); hecho(); }
        },
      }),
      el("button", { class: "action plain", text: "Cerrar", onclick: () => close() })
    ),
    nota ? el("p", { class: "small-print nota-pc", text: nota })
      : canShare ? el("p", { class: "small-print", text: "En el menú, elige «Guardar en Archivos» para guardarlo en el iPad o en iCloud." }) : null,
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
   Compartir (WhatsApp u otra app), como texto o como archivo
   ============================================================ */
/** Rodea un trozo con las marcas de WhatsApp (*negrita*, _cursiva_, ~tachado~), con los espacios por fuera y línea a línea. */
function marcaWA(texto, m) {
  return texto.split("\n").map((linea) => {
    const r = /^(\s*)([\s\S]*?)(\s*)$/.exec(linea);
    if (!r[2]) return linea;
    if (r[2].startsWith(m) && r[2].endsWith(m) && r[2].length > 2) return linea; // ya lleva la marca
    return r[1] + m + r[2] + m + r[3];
  }).join("\n");
}

/** Texto para un mensaje: párrafos separados por una línea en blanco, listas con viñetas y,
    con `marcas`, el formato que entiende WhatsApp (*negrita*, _cursiva_, ~tachado~, títulos en negrita). */
function textoWA(html, { marcas = true } = {}) {
  const box = document.createElement("div");
  box.innerHTML = html;
  const MARCA = marcas ? { STRONG: "*", B: "*", EM: "_", I: "_", S: "~", DEL: "~", STRIKE: "~" } : {};
  const enLinea = (n) => {
    if (n.nodeType === 3) return n.nodeValue.replace(/\s+/g, " ");
    if (n.nodeType !== 1) return "";
    if (n.tagName === "BR") return "\n";
    if (n.tagName === "UL" || n.tagName === "OL") return ""; // las listas de dentro van aparte
    const t = [...n.childNodes].map(enLinea).join("");
    return MARCA[n.tagName] ? marcaWA(t, MARCA[n.tagName]) : t;
  };
  const limpio = (t) => t.replace(/ *\n */g, "\n").trim();
  const lista = (ul, nivel, out) => {
    let i = 0;
    for (const li of ul.children) {
      if (li.tagName !== "LI") continue;
      i++;
      const sangria = "   ".repeat(nivel);
      const t = limpio(enLinea(li));
      if (t) out.push(sangria + (ul.tagName === "OL" ? `${i}. ` : "• ") + t.replace(/\n/g, "\n" + sangria + "   "));
      for (const sub of li.children) if (sub.tagName === "UL" || sub.tagName === "OL") lista(sub, nivel + 1, out);
    }
  };
  const bloques = (nodos, out) => {
    for (const n of nodos) {
      if (n.nodeType === 3) { const t = n.nodeValue.trim(); if (t) out.push(t); continue; }
      if (n.nodeType !== 1) continue;
      const tag = n.tagName;
      if (/^H[1-4]$/.test(tag)) { const t = n.textContent.replace(/\s+/g, " ").trim(); if (t) out.push(marcas ? "*" + t + "*" : t); }
      else if (tag === "UL" || tag === "OL") { const l = []; lista(n, 0, l); if (l.length) out.push(l.join("\n")); }
      else if (tag === "BLOCKQUOTE") { const d = []; bloques(n.childNodes, d); if (d.length) out.push(d.join("\n\n").split("\n").map((x) => "> " + x).join("\n")); }
      else if (tag === "TABLE") {
        const filas = [...n.querySelectorAll("tr")].map((tr) => [...tr.children].map((c) => limpio(enLinea(c)).replace(/\n/g, " ")).filter(Boolean).join(" | ")).filter(Boolean);
        if (filas.length) out.push(filas.join("\n"));
      }
      else if (tag === "DIV") bloques(n.childNodes, out);
      else { const t = limpio(enLinea(n)); if (t) out.push(t); }
    }
  };
  const out = [];
  bloques(box.childNodes, out);
  return out.join("\n\n");
}

/** El texto que se manda: con formato de WhatsApp o plano. Las notas empiezan por su título; las pausas «‖» no se mandan. */
function textoParaCompartir(kind, item, { formato = true } = {}) {
  const box = document.createElement("div");
  box.innerHTML = item.html || "";
  box.querySelectorAll("figure").forEach((f) => f.replaceWith(Object.assign(document.createElement("p"), { textContent: "[Dibujo]" })));
  let t = textoWA(box.innerHTML, { marcas: formato });
  t = t.replace(/[ \t]*‖[ \t]*/g, " ").replace(/([^\s]) {2,}/g, "$1 ").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  const titulo = (item.title || "").trim();
  const sinMarcas = (x) => x.replace(/[*_~]/g, "").trim();
  if (kind === "notes" && titulo && sinMarcas(t.split("\n")[0] || "") !== sinMarcas(titulo)) t = (formato ? `*${titulo}*` : titulo) + (t ? "\n\n" + t : "");
  return t;
}

/** Abre WhatsApp con el texto escrito, para elegir el chat. Si no se abre (no está instalado), ofrece otra app. */
function enviarWhatsApp(titulo, texto) {
  const t = encodeURIComponent(texto);
  if (!(esIOS() || esAndroid())) { window.open("https://wa.me/?text=" + t, "_blank", "noopener"); return; }
  let salio = false;
  const vigila = () => { if (document.hidden) salio = true; };
  document.addEventListener("visibilitychange", vigila);
  window.addEventListener("pagehide", vigila);
  location.href = "whatsapp://send?text=" + t;
  setTimeout(() => {
    document.removeEventListener("visibilitychange", vigila);
    window.removeEventListener("pagehide", vigila);
    if (!salio && !document.hidden) toast("No se ha abierto WhatsApp. ¿Lo tienes instalado?", { action: "Otra app", onAction: () => shareText(titulo, texto), ms: 7000 });
  }, 2500);
}

/** Compartir: a WhatsApp, a otra app o copiado (como texto), o como Word o PDF (como archivo). */
function abrirCompartir(kind, item) {
  if (!item) return;
  if (!htmlToText(item.html || "").trim() && !/<figure/i.test(item.html || "")) { toast("Todavía no hay texto que compartir."); return; }
  const texto = () => textoParaCompartir(kind, item, { formato: settings.formatoWA !== false });
  const formato = el("input", { type: "checkbox", role: "switch", id: "compartir-formato" });
  formato.checked = settings.formatoWA !== false;
  formato.addEventListener("change", () => { settings.formatoWA = formato.checked; saveSettings(); });
  const op = (ic, titulo, sub, run, extra = "") => el("button", {
    class: "action co-op" + extra,
    html: icon(ic) + `<span class="co-t"><span class="co-n">${escapeHtml(titulo)}</span><small>${escapeHtml(sub)}</small></span>`,
    onclick: run,
  });
  const { close } = openSheet([
    el("h2", { text: "Compartir" }),
    el("p", { class: "co-titulo", text: item.title || "" }),
    el("h3", { class: "co-sec", text: "Como texto (para leerlo en el mensaje)" }),
    el("div", { class: "actions menu" },
      op("chat", "WhatsApp", "Se abre WhatsApp con el texto y eliges el chat", () => { const t = texto(); close(); enviarWhatsApp(item.title, t); }, " co-wa"),
      op("share", "Otra app", "Correo, Mensajes, Telegram, Notas, Claude…", () => { const t = texto(); close(); shareText(item.title, t); }, " co-otra"),
      op("copy", "Copiar el texto", "Y lo pegas donde quieras", () => { const t = texto(); close(); copyText(t); }, " co-copiar")),
    el("label", { class: "switch-row" }, el("span", { html: "Con negritas y cursivas de WhatsApp <small class=\"co-ej\">*así* y _así_</small>" }), formato),
    el("h3", { class: "co-sec", text: "Como archivo (igual que se ve aquí)" }),
    el("div", { class: "actions menu" },
      op("word", "Word", "Se abre en Word, Pages o Google Docs", () => { close(); exportWord(kind, item, { compartir: true }); }, " co-word"),
      op("pdf", "PDF", "Para leerlo o imprimirlo tal cual", () => { close(); exportPdf(kind, item); }, " co-pdf")),
    el("div", { class: "actions" }, el("button", { class: "action plain", text: "Cerrar", onclick: () => close() })),
  ]);
}

/* ============================================================
   Importar documentos
   ============================================================ */
/* ============================================================
   Versiones anteriores (como el historial de versiones de Word):
   copia al empezar a editar, al cambiar por un Word nuevo y al recuperar otra.
   Almacén `versiones`: {id, kind, docId, fecha, title, html, motivo}. Las 10 últimas de cada documento.
   ============================================================ */
const MAX_VERSIONES = 10;
async function versionesDe(kind, id) {
  const todas = await store.all("versiones").catch(() => []);
  return todas.filter((v) => v.kind === kind && v.docId === id).sort((a, b) => b.fecha - a.fecha);
}
async function guardarVersion(kind, item, motivo) {
  if (!item || !item.id || !item.html) return;
  try {
    const lista = await versionesDe(kind, item.id);
    if (lista[0] && lista[0].html === item.html && lista[0].title === item.title) return; // ya está guardada
    await tx("versiones", "readwrite", (o) => o.put({ id: uid(), kind, docId: item.id, fecha: Date.now(), title: item.title || "", html: item.html, motivo }));
    for (const v of lista.slice(MAX_VERSIONES - 1)) await tx("versiones", "readwrite", (o) => o.delete(v.id));
  } catch (e) { console.warn("No se pudo guardar la versión", e); }
}
/** Al arrancar: quita las versiones de documentos que ya no existen. */
async function limpiarVersiones() {
  try {
    const [v, docs, notes] = await Promise.all([store.all("versiones"), store.all("docs"), store.all("notes")]);
    const hay = new Set([...docs.map((d) => "docs/" + d.id), ...notes.map((d) => "notes/" + d.id)]);
    for (const x of v) if (!hay.has(x.kind + "/" + x.docId)) await tx("versiones", "readwrite", (o) => o.delete(x.id));
  } catch {}
}
/** Hoja con las versiones anteriores; `alRecuperar(item)` se llama con el documento ya cambiado. */
async function abrirVersiones(kind, id, { alRecuperar = () => {}, antes = async () => {} } = {}) {
  const lista = await versionesDe(kind, id);
  const recuperar = async (v) => {
    await antes();
    const actual = await store.get(kind, id);
    if (!actual) return;
    await guardarVersion(kind, actual, "Antes de recuperar otra versión");
    const nuevo = { ...actual, html: sanitize(v.html), title: v.title || actual.title, updated: Date.now() };
    await store.put(kind, nuevo);
    closeSheet();
    await alRecuperar(nuevo);
    toast(`Recuperada la versión de ${fmtDate(v.fecha).toLowerCase()}. La que tenías queda en «Versiones anteriores».`, { ms: 6000 });
  };
  const ver = (v) => openSheet([
    el("h2", { text: `${fmtDate(v.fecha)} · ${v.motivo || ""}` }),
    el("div", { class: "doc-content ver-previa", html: sanitize(v.html) }),
    el("div", { class: "actions" },
      el("button", { class: "action primary", text: "Recuperar esta versión", onclick: () => recuperar(v) }),
      el("button", { class: "action plain", text: "Volver", onclick: () => abrirVersiones(kind, id, { alRecuperar, antes }) })),
  ]);
  openSheet([
    el("h2", { text: "Versiones anteriores" }),
    el("p", { class: "small-print", text: `Atril guarda una copia al empezar a editar, al cambiarlo por un Word nuevo y al recuperar otra versión. Se quedan las ${MAX_VERSIONES} últimas, solo en este dispositivo.` }),
    lista.length
      ? el("div", { class: "versiones" }, lista.map((v) => {
          const n = contarPalabras(htmlToText(v.html));
          return el("div", { class: "version" },
            el("div", { class: "v-txt" },
              el("b", { text: fmtDate(v.fecha) }),
              el("span", { text: `${v.motivo || ""} · ${n.toLocaleString("es-ES")} palabras` })),
            el("button", { class: "chip", text: "Ver", onclick: () => ver(v) }),
            el("button", { class: "chip", text: "Recuperar", onclick: () => recuperar(v) }));
        }))
      : el("p", { text: "Aún no hay versiones anteriores. La primera se guarda en cuanto cambies algo en el editor." }),
    el("div", { class: "actions" }, el("button", { class: "action plain", text: "Cerrar", onclick: () => closeSheet() })),
  ]);
}

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
  let arrayBuffer = await file.arrayBuffer();
  // El color de la letra no lo lee mammoth: se marca antes y se recupera después
  let colores = null;
  try {
    colores = await import("./word-colores.js");
    arrayBuffer = await colores.marcarColores(arrayBuffer);
  } catch (e) { console.warn("Sin colores de letra:", e); colores = null; }
  const res = await mammoth.convertToHtml({ arrayBuffer }, { styleMap: STYLE_MAP });
  return sanitize(colores ? colores.ponerColores(res.value) : res.value);
}

async function importFiles(files) {
  const list = [...files];
  if (!list.length) return;
  const done = [];
  let close = busy(list.length > 1 ? `Abriendo ${list.length} documentos…` : "Abriendo el documento…");
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
      const title = name.replace(/\.(docx|txt)$/i, "").replace(/[_]+/g, " ").trim();
      // ¿Es una versión nueva de un discurso que ya está? (mismo nombre de archivo o mismo título)
      const previo = (await store.all("docs")).find((d) => d.source === name || plegarTexto(d.title) === plegarTexto(title));
      if (previo) {
        close();
        const sustituir = await confirmDialog({
          title: `Ya tienes «${previo.title || title}»`,
          message: (sinPasarAlPC(previo) ? `Ojo: lo cambiaste en el iPad (${fmtDate(previo.updated).toLowerCase()}) y esos cambios no están en este Word. Si lo sustituyes, quedarán en «Versiones anteriores». ` : "") +
            "¿Lo cambias por esta versión? Se conservan tus ensayos, la duración y dónde lo has dado.",
          ok: "Sustituir por esta versión", cancel: "Añadir como otro discurso",
        });
        close = busy("Abriendo el documento…");
        if (sustituir) {
          const fresco = (await store.get("docs", previo.id)) || previo;
          await guardarVersion("docs", fresco, "Antes de cambiarlo por el Word nuevo");
          await store.put("docs", { ...fresco, html, updated: now, source: name, alPC: now });
          done.push({ ...fresco, actualizado: true });
          continue;
        }
      }
      const doc = { id: uid(), title, html, created: now, updated: now, source: name, alPC: now };
      await store.put("docs", doc);
      done.push(doc);
    }
  } finally {
    close();
  }
  if (done.length === 1) {
    if (done[0].actualizado) toast(`«${done[0].title}» actualizado con la versión nueva.`);
    go(`#/leer/docs/${done[0].id}`);
  } else if (done.length > 1) { toast(`${done.length} documentos abiertos.`); renderHome(); }
}

/** Cómo llevar el Word del PC al iPad. */
function ayudaWord() {
  openSheet([
    el("h2", { text: "Pasar el Word del PC al iPad" }),
    el("p", { text: "Atril abre los .docx que tengas en el iPad. La forma más cómoda:" }),
    el("ol", { class: "lista-pasos" },
      el("li", { text: "En el PC, guarda el Word en OneDrive o en iCloud Drive. También puedes mandártelo por correo y, en el iPad, guardarlo en Archivos." }),
      el("li", { text: "En el iPad, toca «Abrir Word» y búscalo en Explorar → OneDrive o iCloud Drive." }),
      el("li", { text: "Si luego lo cambias en el PC, ábrelo otra vez: Atril te ofrecerá sustituir la versión anterior sin perder tus ensayos, la duración ni dónde lo has dado." })),
    el("p", { class: "small-print", text: "Para que OneDrive salga en Archivos, instala la app de OneDrive en el iPad e inicia sesión." }),
    el("div", { class: "actions" },
      el("button", { class: "action primary", html: icon("open") + "<span>Abrir Word</span>", onclick: () => { closeSheet(); $("#file-input").click(); } }),
      el("button", { class: "action plain", text: "Cerrar", onclick: () => closeSheet() })),
  ]);
}

/** Guía de Atril: qué hace cada función y dónde está (para quien la estrena). */
async function abrirGuia(seccion) {
  lsSet("atril.guiaVista", "1");
  const aviso = $("#guia-hint");
  if (aviso) aviso.hidden = true;
  try {
    const m = await import("./guia.js");
    m.abrirGuia({ seccion, icon, alProbar: crearEjemplo, android: esAndroid() });
  } catch (e) {
    console.error(e);
    toast("No se pudo abrir la guía. Inténtalo de nuevo.");
  }
}

/** Discurso de ejemplo para ver cómo funciona Atril (si ya existe, lo abre). */
async function crearEjemplo() {
  const ya = (await store.all("docs").catch(() => [])).find((d) => d.title === "Ejemplo: la paciencia");
  if (ya) { go(`#/leer/docs/${ya.id}`); return; }
  const now = Date.now();
  const html = `<h1>La paciencia</h1>
<h2>Introducción (1 min)</h2><p>¿Le ha tocado alguna vez esperar en una cola que no avanza? A todos nos cuesta esperar. Pero la Biblia dice en Gálatas 5:22 que la paciencia forma parte del fruto del espíritu.</p>
<h2>Por qué vale la pena (2 min)</h2><p><mark>La paciencia nos ayuda a mantener la calma</mark> cuando las cosas no salen como queremos. Santiago 5:7 pone el ejemplo del agricultor, que espera la cosecha sin desanimarse.</p><ul><li>Pausa aquí y mira al público.</li><li>Pregunta: ¿qué haríamos nosotros?</li></ul>
<h2>Cómo cultivarla (1 min)</h2><p>Pidamos ayuda en oración y pensemos en lo paciente que es Dios con nosotros (2 Pedro 3:9).</p>
<h2>Conclusión (1 min)</h2><p><mark class="c-verde">Quien espera con paciencia, gana.</mark> Esta semana, probemos a contar hasta diez antes de responder.</p>`;
  const item = { id: uid(), title: "Ejemplo: la paciencia", html: sanitize(html), created: now, updated: now, target: 5 };
  await store.put("docs", item);
  go(`#/leer/docs/${item.id}`);
  setTimeout(() => toast("Separa dos dedos para agrandar la letra. Toca «Presentar» para darlo con el cronómetro.", { ms: 7000 }), 500);
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

/** Para Word y PDF: cada dibujo pasa a ser una imagen PNG (los dos la entienden). */
async function htmlParaExportar(html) {
  if (!html.includes("dibujo")) return html;
  const box = document.createElement("div");
  box.innerHTML = html;
  for (const f of [...box.querySelectorAll("figure.dibujo")]) {
    const d = limpiarDibujo(f.getAttribute("data-dibujo"));
    if (!d) { f.remove(); continue; }
    try {
      const img = new Image();
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgDibujo(d, { colores: true }));
      await img.decode();
      const c = document.createElement("canvas");
      const escala = 1.6;
      c.width = Math.round(d.w * escala); c.height = Math.round(d.h * escala);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      const p = document.createElement("p");
      p.append(Object.assign(document.createElement("img"), { src: c.toDataURL("image/png"), alt: "Dibujo", width: 600, height: Math.round((600 * d.h) / d.w) }));
      f.replaceWith(p);
    } catch (e) { console.warn("Dibujo sin exportar", e); f.remove(); }
  }
  return box.innerHTML;
}

async function exportWord(kind, item, { compartir = false } = {}) {
  const close = busy("Preparando el Word…");
  try {
    const { buildDocx } = await import("./docx-export.js");
    const html = await htmlParaExportar(kind === "notes" ? htmlConTitulo(item) : item.html || "<p></p>");
    const blob = await buildDocx(item.title || "Documento", html);
    close();
    // Con el mismo nombre que el Word del PC, para poder sustituirlo
    const nombre = item.source && /\.docx$/i.test(item.source) ? item.source : safeFileName(item.title) + ".docx";
    const file = new File([blob], nombre, { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    offerFile(file, compartir ? {
      title: "Word listo para compartir",
      boton: "Compartir",
      nota: "En la lista, elige WhatsApp, Correo o la app que quieras.",
    } : {
      title: "Word listo",
      nota: item.source ? "Para que el del PC quede igual: Guardar en Archivos → la misma carpeta (OneDrive o iCloud) → «Reemplazar». Si lo tienes abierto en el PC, ciérralo antes." : "",
      onDone: () => marcarEnPC(kind, item.id),
    });
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
      title: item.title || "Documento", html: await htmlParaExportar(htmlConTitulo(item)),
      size: Number(settings.pdfSize) || 12, family: ["sans", "arial", "verdana"].includes(settings.font) ? "sans" : "serif", highlights: settings.pdfMarks !== false,
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
  if (!data.docs.length && !data.notes.length) { toast("No hay discursos ni notas que copiar."); return; }
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const file = new File([JSON.stringify(data)], `atril-copia-${stamp}.json`, { type: "application/json" });
  offerFile(file, {
    title: "Copia de seguridad lista",
    onDone: () => { lsSet("atril.copia", String(Date.now())); lsSet("atril.copiaLuego", ""); if (currentView === "home") pintarAvisoCopia(); },
  });
}

/** Registro de «dónde lo he dado» de una copia de seguridad. */
function limpiarDado(lista) {
  if (!Array.isArray(lista)) return undefined;
  const res = lista.slice(0, 300).filter((d) => d && /^\d{4}-\d{2}-\d{2}$/.test(String(d.fecha))).map((d) => ({
    id: String(d.id || uid()).slice(0, 40), fecha: String(d.fecha), lugar: String(d.lugar || "").slice(0, 120), notas: String(d.notas || "").slice(0, 500),
  }));
  return res.length ? ordenarDado(res) : undefined;
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
        dado: limpiarDado(it.dado),
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
  pintarColorBarra();
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
  if (currentView === "editor") {
    reemplazo.cerrar();
    await editor.flush();
    // Si se ha cambiado un discurso que vino del PC, se ofrece pasarlo al Word del PC
    const it = editor.item, k = editor.kind;
    if (editor.versionHecha && it && it.source && !(location.hash || "").startsWith(`#/editar/${k}/${it.id}`)) {
      editor.versionHecha = false;
      toast("Cambios guardados en el iPad. ¿Los pasas también al Word del PC?", {
        action: "Guardar Word", ms: 9000,
        onAction: async () => { const f = await store.get(k, it.id); if (f) exportWord(k, f); },
      });
    }
  }
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
    { label: "Compartir (WhatsApp, correo…)", icon: "share", run: () => abrirCompartir(kind, item) },
    { label: "Guardar como Word", icon: "word", run: () => exportWord(kind, item) },
    { label: "Guardar como PDF", icon: "pdf", run: () => exportPdf(kind, item) },
    { label: "Renombrar", icon: "edit", run: () => renameItem(kind, item) },
  ];
  const move = kind === "notes"
    ? { label: "Pasar a Discursos", icon: "move", run: () => moveItem("notes", "docs", item) }
    : { label: "Pasar a Notas", icon: "move", run: () => moveItem("docs", "notes", item) };
  const del = { label: "Eliminar", icon: "trash", danger: true, run: () => deleteItem(kind, item) };
  const fijar = { label: item.fijado ? "Quitar de arriba" : "Fijar arriba", icon: "pin", run: () => fijarItem(kind, item) };
  if (kind === "docs") {
    const n = (item.dado || []).length;
    return [
      { label: "Leer", icon: "book", run: () => go(`#/leer/docs/${item.id}`) },
      { label: "Presentar", icon: "play", run: () => presentarDesdeInicio(item.id) },
      { label: "Editar", icon: "edit", run: () => go(`#/editar/docs/${item.id}`) },
      fijar,
      { label: n ? `Dónde lo he dado (${n})` : "Apuntar que lo he dado", icon: "calendar", run: () => abrirDado("docs", item.id) },
      ...common, move, del,
    ];
  }
  return [
    { label: "Editar", icon: "edit", run: () => go(`#/editar/notes/${item.id}`) },
    { label: "Leer en grande", icon: "book", run: () => go(`#/leer/notes/${item.id}`) },
    fijar,
    ...common, move, del,
  ];
}

/**
 * Word del PC al día: `item.alPC` = cuándo el discurso quedó igual que el Word del PC (al abrirlo o al guardarlo
 * como Word). Si después se cambia en el iPad (`updated` posterior), está «sin pasar al PC».
 */
const sinPasarAlPC = (it) => !!(it && it.source && it.alPC && (it.updated || 0) > it.alPC);
async function marcarEnPC(kind, id) {
  const it = await store.get(kind, id);
  if (!it || !it.source) return;
  await store.put(kind, { ...it, alPC: Math.max(Date.now(), it.updated || 0) });
  if (currentView === "home") renderHome();
}

/** Fijar arriba (como «Anclar» en Word): sale el primero de la lista. */
async function fijarItem(kind, item) {
  const fresco = (await store.get(kind, item.id)) || item;
  if (fresco.fijado) delete fresco.fijado; else fresco.fijado = true;
  await store.put(kind, fresco);
  toast(fresco.fijado ? "Fijado arriba." : "Ya no está fijado.");
  renderHome();
}

/** Abre el discurso y entra directamente en Presentar, desde el principio. */
let presentarAlAbrir = null;
function presentarDesdeInicio(id) {
  presentarAlAbrir = "docs/" + id;
  go(`#/leer/docs/${id}`);
}

/** Lo leído de un documento (0–100) o null si no se ha abierto. */
function progresoDe(kind, id) {
  const v = lsGet(`atril.prog.${kind}.${id}`, "");
  return v === "" ? null : clamp(Number(v) || 0, 0, 100);
}

/** El último discurso abierto en el lector ({kind, id, t}) o null. */
function ultimoAbierto() {
  try { const u = JSON.parse(lsGet("atril.ultimo", "null")); return u && u.id ? u : null; } catch { return null; }
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
  lsSet(`atril.prog.${kind}.${item.id}`, "");
  toast("Eliminado.", {
    action: "Deshacer",
    onAction: async () => { await store.put(kind, item); renderHome(); },
    ms: 6000,
  });
  renderHome();
}

/** Nota a mano: se abre el lienzo y, al terminar, se guarda como nota. */
async function notaAMano() {
  try {
    const { abrirLienzo } = await import("./lienzo.js");
    abrirLienzo({
      confirmar: confirmDialog, icono: icon, titulo: "Nota a mano",
      alGuardar: async (d) => {
        const now = Date.now();
        const fecha = new Date(now).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
        const item = { id: uid(), title: `Nota a mano · ${fecha}`, html: sanitize(figuraDibujo(d).outerHTML + "<p><br></p>"), created: now, updated: now };
        await store.put("notes", item);
        go(`#/editar/notes/${item.id}`);
      },
    });
  } catch (e) { console.error(e); toast("No se pudo abrir el dibujo. Inténtalo de nuevo."); }
}
/** Nota dictada: nota nueva con el teclado abierto (para tocar su micrófono). */
let dictarAlAbrir = null;
async function notaDictada() {
  // En el iPad el teclado solo sale si algo coge el foco dentro del mismo toque
  const f = $("#foco-teclado");
  if (f) f.focus();
  const now = Date.now();
  const item = { id: uid(), title: "", html: "<p><br></p>", created: now, updated: now };
  await store.put("notes", item);
  dictarAlAbrir = "notes/" + item.id;
  go(`#/editar/notes/${item.id}`);
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

/** En los discursos, la primera línea del texto si dice algo distinto del título (p. ej. si el título es el nombre del archivo). */
function primeraLinea(title, text) {
  const l = (text.split("\n").find((x) => x.trim()) || "").trim();
  if (!l || plegarTexto(l) === plegarTexto(title)) return null;
  return el("span", { class: "card-snippet una", text: l.slice(0, 160) });
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
      el("button", { class: "btn", html: icon("plus") + "<span>Nuevo discurso</span>", onclick: nuevoDiscurso }),
      el("button", { class: "text-btn ayuda-word", text: "¿Cómo paso el Word del PC?", onclick: ayudaWord })
    );
  } else {
    actions.append(
      el("button", { class: "btn primary", html: icon("plus") + "<span>Nueva nota</span>", onclick: () => newItem("notes") }),
      el("button", { class: "btn", id: "nota-mano", html: icon("pluma") + "<span>Nota a mano</span>", onclick: notaAMano }),
      el("button", { class: "btn", id: "nota-dictar", html: icon("mic") + "<span>Dictar</span>", onclick: notaDictada }));
  }

  let items = [];
  try { items = await store.all(tab); } catch (e) { console.error(e); toast("No se pudo leer el almacenamiento del dispositivo."); }
  // «¿Cómo paso el Word del PC?» solo hasta que se abre el primer Word
  const ayudaPC = $(".ayuda-word", actions);
  if (ayudaPC) ayudaPC.hidden = items.some((i) => i.source);
  // Los fijados primero; después, lo último editado
  items.sort((a, b) => (b.fijado ? 1 : 0) - (a.fijado ? 1 : 0) || (b.updated || 0) - (a.updated || 0));
  const total = items.length;
  const q = plegarTexto(home.query);
  const textCache = new Map();
  const textOf = (it) => { if (!textCache.has(it.id)) textCache.set(it.id, htmlToText(it.html || "")); return textCache.get(it.id); };
  // Busca en el título, el texto y los lugares donde se ha dado («¿lo he dado ya aquí?»)
  if (q) items = items.filter((it) => plegarTexto(it.title).includes(q) || plegarTexto(textOf(it)).includes(q) ||
    (it.dado || []).some((d) => plegarTexto(`${d.lugar} ${d.notas}`).includes(q)));

  const list = $("#list");
  list.replaceChildren(
    ...items.map((it) => {
      const text = textOf(it);
      const title = it.title || text.split("\n")[0].slice(0, 60) || "Sin título";
      const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
      const esDoc = tab === "docs";
      const est = words ? minutosEstimados(words, ppm()) : 0;
      const editado = fmtDate(it.updated || it.created);
      // La duración, en grande: el objetivo si lo hay; si no, lo que se tarda en leer
      const dur = esDoc && (it.target || est)
        ? el("span", { class: "card-dur", title: it.target ? "Duración objetivo" : "Lectura estimada" },
            el("b", { text: String(it.target || est) }), el("small", { text: it.target ? "min" : "min aprox." }))
        : null;
      const prog = esDoc ? progresoDe("docs", it.id) : null;
      const main = el("button", { class: "card-main", onclick: () => go(esDoc ? `#/leer/docs/${it.id}` : `#/editar/notes/${it.id}`) },
        el("span", { class: "card-icon " + (esDoc ? "es-doc" : "es-nota"), html: icon(esDoc ? "doc" : "nota") }),
        el("span", { class: "card-title", text: title }),
        dur,
        resumenDado(it),
        el("span", { class: "card-meta" },
          it.fijado ? el("span", { class: "card-pin", html: icon("pin") + "<span>Fijado</span>" }) : null,
          sinPasarAlPC(it) ? el("span", { class: "card-sinpc", title: "Lo has cambiado en el iPad y el Word del PC aún no tiene esos cambios", text: "Cambiado en el iPad" }) : null,
          esDoc && it.target && est ? el("span", { text: `≈ ${est} min de lectura` }) : null,
          el("span", { text: `Editado ${editado.charAt(0).toLowerCase() + editado.slice(1)}` })),
        esDoc ? primeraLinea(title, text) : el("span", { class: "card-snippet", text: text.replace(/\s+/g, " ").slice(title === text.split("\n")[0] ? title.length : 0, 220).trim() })
      );
      const more = el("button", { class: "card-more", "aria-label": "Opciones", html: icon("more"), onclick: () => actionSheet(title, itemActions(tab, it)) });
      // Lo leído, como en la biblioteca de Kindle
      const barra = prog ? el("span", { class: "card-prog", title: `Leído el ${prog} %`, "aria-label": `Leído el ${prog} %` }, el("i", { style: `width:${prog}%` })) : null;
      return el("li", { class: "card" + (it.fijado ? " fijado" : "") + (barra ? " con-prog" : "") }, main, more, barra);
    })
  );

  // «Seguir donde lo dejaste»: el último discurso abierto, con un toque para seguir o presentar
  const seguir = $("#seguir");
  const u = tab === "docs" && !q && total >= 2 ? ultimoAbierto() : null;
  const ult = u && u.kind === "docs" ? items.find((x) => x.id === u.id) : null;
  seguir.hidden = !ult;
  if (ult) {
    const t = ult.title || textOf(ult).split("\n")[0].slice(0, 60) || "Sin título";
    const p = progresoDe("docs", ult.id) || 0;
    const abierto = fmtDate(u.t || Date.now());
    seguir.replaceChildren(
      el("div", { class: "seg-txt" },
        el("span", { class: "seg-label", text: "Seguir donde lo dejaste" }),
        el("span", { class: "seg-titulo", text: t }),
        el("span", { class: "seg-meta", text: [p ? `Leído el ${p} %` : "", `abierto ${abierto.charAt(0).toLowerCase() + abierto.slice(1)}`].filter(Boolean).join(" · ") }),
        el("span", { class: "seg-prog", "aria-hidden": "true" }, el("i", { style: `width:${p}%` }))),
      el("div", { class: "seg-btns" },
        el("button", { class: "btn primary", id: "seguir-leer", html: icon("book") + "<span>Seguir leyendo</span>", onclick: () => go(`#/leer/docs/${ult.id}`) }),
        el("button", { class: "btn", id: "seguir-presentar", html: icon("play") + "<span>Presentar</span>", onclick: () => presentarDesdeInicio(ult.id) }))
    );
  } else seguir.replaceChildren();

  const empty = $("#empty");
  const bienvenida = !items.length && !q && tab === "docs";
  actions.hidden = bienvenida;
  empty.classList.toggle("bienvenida", bienvenida);
  if (items.length) empty.hidden = true;
  else {
    empty.hidden = false;
    if (q) empty.replaceChildren(el("h2", { text: "Sin resultados" }), el("p", { text: `Nada coincide con «${home.query}».` }));
    else if (tab === "docs") empty.replaceChildren(
      el("img", { class: "bv-icono", src: "icons/icon-192.png", alt: "" }),
      el("h2", { text: "Atril, tu lector de discursos" }),
      el("p", { class: "bv-lema", text: "Prepara el discurso en Word, ábrelo aquí y léelo en el iPad con letra grande y cronómetro. Gratis, sin cuentas, y todo se queda en tu dispositivo." }),
      el("ol", { class: "bv-pasos" },
        el("li", {}, el("span", { class: "bv-ic", html: icon("open") }), el("b", { text: "Abre tu Word" }), el("span", { text: "El que preparaste en el PC: desde Archivos, iCloud, OneDrive o el correo." })),
        el("li", {}, el("span", { class: "bv-ic", html: icon("aa") }), el("b", { text: "Léelo a tu medida" }), el("span", { text: "Separa dos dedos para agrandar la letra; el texto se recoloca solo." })),
        el("li", {}, el("span", { class: "bv-ic", html: icon("play") }), el("b", { text: "Preséntalo" }), el("span", { text: "Pantalla bloqueada, cronómetro grande y aviso si vas retrasado." }))),
      el("div", { class: "bv-botones" },
        el("button", { class: "btn primary", html: icon("open") + "<span>Abrir un Word</span>", onclick: () => $("#file-input").click() }),
        el("button", { class: "btn", html: icon("book") + "<span>Probar con un ejemplo</span>", onclick: crearEjemplo })),
      el("div", { class: "bv-mas" },
        el("button", { class: "text-btn", id: "bv-guia", text: "Ver la guía: qué hace cada cosa", onclick: () => abrirGuia() }),
        el("button", { class: "text-btn", text: "¿Cómo paso el Word del PC al iPad?", onclick: ayudaWord }),
        el("button", { class: "text-btn", text: "Escribir uno nuevo", onclick: nuevoDiscurso }))
    );
    else empty.replaceChildren(
      el("h2", { text: "Aún no hay notas" }),
      el("p", { text: "Toca «Nueva nota» para empezar. Desde el menú ⋯ de cada nota puedes compartirla (WhatsApp, correo…), copiarla o guardarla como Word." })
    );
  }

  pintarAvisoCopia();
  // Primera vez con algo en la lista: invita a ver la guía (en la bienvenida ya hay un enlace)
  $("#guia-hint").hidden = !items.length || !!q || lsGet("atril.guiaVista") === "1";
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  $("#install-hint").hidden = standalone || lsGet("atril.hideInstall") === "1";
}

/* ============================================================
   Dónde y cuándo se ha dado cada discurso
   ============================================================ */
const fechaHoy = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
function fechaBonita(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${Number(m[3])} ${MESES[Number(m[2]) - 1]} ${m[1]}` : String(iso || "");
}
function ordenarDado(lista) { return (lista || []).slice().sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))); }

function resumenDado(it) {
  const lista = ordenarDado(it.dado);
  if (!lista.length) return null;
  const u = lista[0], n = lista.length;
  const cuando = `el ${fechaBonita(u.fecha)}${u.lugar ? " en " + u.lugar : ""}`;
  const texto = n === 1 ? `Dado ${cuando}` : `Dado ${n} veces; la última, ${cuando}`;
  return el("span", { class: "card-dado", html: icon("calendar") + `<span>${escapeHtml(texto)}</span>` });
}

async function lugaresUsados() {
  const vistos = new Map();
  for (const it of await store.all("docs")) for (const d of it.dado || []) if (d.lugar) vistos.set(plegarTexto(d.lugar), d.lugar);
  return [...vistos.values()].sort((a, b) => a.localeCompare(b, "es"));
}

async function abrirDado(kind, id) {
  const item = await store.get(kind, id);
  if (!item) return;
  const lista = ordenarDado(item.dado);
  const fecha = el("input", { type: "date", value: fechaHoy(), class: "campo", "aria-label": "Fecha" });
  const lugar = el("input", { type: "text", class: "campo", placeholder: "Lugar (congregación, asamblea…)", list: "dado-lugares", autocomplete: "off", "aria-label": "Lugar" });
  const lugares = el("datalist", { id: "dado-lugares" }, (await lugaresUsados()).map((l) => el("option", { value: l })));
  const notas = el("input", { type: "text", class: "campo", placeholder: "Notas (opcional)", autocomplete: "off", "aria-label": "Notas" });
  const aviso = el("p", { class: "dado-aviso", hidden: true });
  lugar.addEventListener("input", () => {
    const q = plegarTexto(lugar.value);
    const antes = q && lista.find((d) => plegarTexto(d.lugar) === q);
    aviso.hidden = !antes;
    if (antes) aviso.textContent = `Ya lo diste aquí el ${fechaBonita(antes.fecha)}.`;
  });
  const recargar = (fresco) => {
    if (reader.id === id && reader.kind === kind && reader.item) reader.item.dado = fresco.dado;
    if (currentView === "home") renderHome();
    abrirDado(kind, id);
  };
  const apuntar = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha.value)) { toast("Pon la fecha."); return; }
    const fresco = await store.get(kind, id);
    if (!fresco) return;
    fresco.dado = ordenarDado([{ id: uid(), fecha: fecha.value, lugar: lugar.value.trim().slice(0, 120), notas: notas.value.trim().slice(0, 500) }, ...(fresco.dado || [])]);
    await store.put(kind, fresco);
    toast("Apuntado.");
    recargar(fresco);
  };
  const fila = (d) => {
    const borrar = el("button", { class: "icon-btn small dado-borrar", "aria-label": "Borrar", html: icon("trash") });
    let armado = 0;
    borrar.addEventListener("click", async () => {
      if (!armado) {
        borrar.classList.add("armado");
        toast("Toca otra vez la papelera para borrarlo.");
        armado = setTimeout(() => { armado = 0; borrar.classList.remove("armado"); }, 3000);
        return;
      }
      clearTimeout(armado);
      const fresco = await store.get(kind, id);
      fresco.dado = (fresco.dado || []).filter((x) => x.id !== d.id);
      if (!fresco.dado.length) delete fresco.dado;
      await store.put(kind, fresco);
      recargar(fresco);
    });
    return el("div", { class: "dado-item" },
      el("div", { class: "dado-txt" },
        el("span", { class: "dado-fecha", text: fechaBonita(d.fecha) }),
        d.lugar ? el("span", { class: "dado-lugar", text: d.lugar }) : null,
        d.notas ? el("span", { class: "dado-notas", text: d.notas }) : null),
      borrar);
  };
  openSheet([
    el("h2", { text: "Dónde lo he dado" }),
    el("p", { class: "small-print", text: item.title || "Sin título" }),
    el("div", { class: "dado-form" }, fecha, lugar, lugares, notas, aviso,
      el("button", { class: "action primary", html: icon("calendar") + "<span>Apuntar</span>", onclick: apuntar })),
    lista.length
      ? el("div", { class: "dado-lista" }, lista.map(fila))
      : el("p", { text: "Aún no has apuntado ninguna vez. Desde el inicio puedes buscar por lugar para saber si ya lo diste allí." }),
    el("div", { class: "actions" }, el("button", { class: "action plain", text: "Cerrar", onclick: () => closeSheet() })),
  ]);
}

/* ============================================================
   Aviso de copia de seguridad
   ============================================================ */
const DIA = 86400000;
/** Cómo están protegidos los datos: cuándo fue la última copia y cuánto ha cambiado desde entonces. */
async function estadoCopia() {
  const copia = Number(lsGet("atril.copia", "0")) || 0;
  let todos = [];
  try { todos = [...(await store.all("docs")), ...(await store.all("notes"))]; } catch (e) { console.warn(e); }
  const ahora = Date.now();
  const dias = copia ? Math.max(0, Math.floor((ahora - copia) / DIA)) : null;
  const cambiados = copia ? todos.filter((i) => (i.updated || i.created || 0) > copia).length : todos.length;
  const nivel = !todos.length ? "vacio" : !copia || (cambiados && dias >= 7) ? "riesgo" : cambiados ? "aviso" : "ok";
  const cuando = !copia ? "Sin copia de seguridad" : dias === 0 ? "Copia de hoy" : dias === 1 ? "Copia de ayer" : `Copia de hace ${dias} días`;
  const pl = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
  const cambios = !todos.length ? "" : !copia ? pl(todos.length, "documento sin copiar", "documentos sin copiar") : cambiados ? pl(cambiados, "cambiado desde entonces", "cambiados desde entonces") : "todo está copiado";
  return { copia, dias, cambiados, total: todos.length, nivel, texto: [cuando, cambios].filter(Boolean).join(" · ") };
}

/** La línea de «Protección» del inicio (al final de la lista) y de Ajustes. */
async function pintarProteccion() {
  const est = await estadoCopia();
  const pie = $("#proteccion");
  if (pie) {
    pie.hidden = est.nivel === "vacio";
    pie.className = "proteccion " + est.nivel;
    pie.replaceChildren(
      el("span", { class: "prot-ic", html: icon("escudo") }),
      el("span", { class: "prot-txt" }, el("b", { text: "Protección: " }), est.texto),
      est.nivel === "ok" ? null : el("button", { class: "text-btn", id: "prot-copia", text: "Hacer copia", onclick: () => exportBackup() }));
  }
  const aj = $("#ajustes-proteccion");
  if (aj) { aj.className = "proteccion " + est.nivel; aj.replaceChildren(el("span", { class: "prot-ic", html: icon("escudo") }), el("span", { class: "prot-txt", text: est.texto })); }
  return est;
}

async function pintarAvisoCopia() {
  pintarProteccion();
  const hint = $("#backup-hint");
  const copia = Number(lsGet("atril.copia", "0")) || 0;
  const cambio = Number(lsGet("atril.cambio", "0")) || 0;
  const luego = Number(lsGet("atril.copiaLuego", "0")) || 0;
  const ahora = Date.now();
  let texto = "";
  if (ahora >= luego) {
    try {
      const todos = [...(await store.all("docs")), ...(await store.all("notes"))];
      if (todos.length) {
        if (copia) {
          const dias = Math.floor((ahora - copia) / DIA);
          const hayCambios = cambio > copia || todos.some((i) => (i.updated || 0) > copia);
          if (dias >= 7 && hayCambios) texto = `Hace ${dias} días que no haces una copia de seguridad.`;
        } else {
          const desde = Math.min(...todos.map((i) => i.created || ahora));
          if (ahora - desde >= 2 * DIA) texto = "Aún no has hecho ninguna copia de seguridad.";
        }
      }
    } catch (e) { console.warn(e); }
  }
  hint.hidden = !texto;
  if (texto) $("#backup-hint-text").replaceChildren(el("strong", { text: texto }), " Tus discursos y notas solo están en este dispositivo: guárdala en OneDrive o iCloud (en «Guardar en Archivos»).");
}

/* ---- Qué significa cada color (lo elige cada uno; se guarda en este dispositivo) ---- */
const EJEMPLOS_LEYENDA = {
  "m-amarillo": "Ideas clave", "m-verde": "Ejemplos", "m-azul": "Textos bíblicos", "m-rosa": "Preguntas",
  "l-rojo": "No saltar", "l-azul": "Leer tal cual", "l-verde": "Al público", "l-naranja": "Ilustración",
};
const significado = (tipo, id) => ((settings.leyenda || {})[`${tipo}-${id}`] || "").trim();
function abrirLeyenda() {
  const guardar = debounce(() => saveSettings(), 300);
  const fila = (tipo, c) => {
    const clave = `${tipo}-${c.id}`;
    const input = el("input", { type: "text", maxlength: 30, placeholder: `p. ej. ${EJEMPLOS_LEYENDA[clave]}`, value: significado(tipo, c.id), "aria-label": `Qué significa ${c.nombre.toLowerCase()}` });
    input.addEventListener("input", () => { settings.leyenda = { ...(settings.leyenda || {}), [clave]: input.value }; guardar(); });
    const muestra = tipo === "m" ? el("span", { class: `ley-muestra sw-${c.id}` }) : el("span", { class: `ley-muestra ley-letra l-${c.id}`, text: "A" });
    return el("label", { class: "ley-fila" }, muestra, el("span", { class: "ley-nombre", text: c.nombre }), input);
  };
  openSheet([
    el("h2", { text: "Qué significa cada color" }),
    el("p", { class: "small-print", text: "Ponle a cada color lo que significa para ti. Sale al elegir el color en el editor y en el filtro del esquema. Se guarda solo en este dispositivo: cada uno puede tener los suyos." }),
    el("div", { class: "group" }, el("span", { class: "label", text: "Resaltador" }), COLORES.map((c) => fila("m", c))),
    el("div", { class: "group" }, el("span", { class: "label", text: "Color de letra" }), LETRAS.map((c) => fila("l", c))),
    el("div", { class: "actions" }, el("button", { class: "action primary", text: "Hecho", onclick: () => closeSheet() })),
  ], { onClose: () => { saveSettings(); if (currentView === "editor") editor.pintarLeyenda(); if (currentView === "reader" && reader.lateral) reader.lateral.rellenar(); } });
}

function openSettings() {
  const wake = el("input", { type: "checkbox", role: "switch" });
  wake.checked = !!settings.wakeLock;
  wake.addEventListener("change", () => { settings.wakeLock = wake.checked; saveSettings(); });
  const grabar = el("input", { type: "checkbox", role: "switch" });
  grabar.checked = !!settings.grabar;
  grabar.addEventListener("change", () => { settings.grabar = grabar.checked; saveSettings(); });
  const toque = el("input", { type: "checkbox", role: "switch" });
  toque.checked = settings.presToque !== false;
  toque.addEventListener("change", () => { settings.presToque = toque.checked; saveSettings(); });
  const comprobar = el("input", { type: "checkbox", role: "switch", id: "ajustes-comprobar" });
  comprobar.checked = settings.presComprobar !== false;
  comprobar.addEventListener("change", () => { settings.presComprobar = comprobar.checked; saveSettings(); });
  openSheet([
    el("h2", { text: "Ajustes" }),
    el("label", { class: "switch-row" }, el("span", { text: "Mantener la pantalla encendida al leer" }), wake),
    el("label", { class: "switch-row" }, el("span", { text: "Al presentar, tocar abajo pasa la página (y arriba vuelve)" }), toque),
    el("label", { class: "switch-row" }, el("span", { text: "Comprobar la letra y el tiempo antes de presentar" }), comprobar),
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
      el("span", { class: "label", text: "Ayuda" }),
      el("div", { class: "actions" }, el("button", { class: "action", id: "ajustes-guia", html: icon("guia") + "<span>Guía de Atril: qué hace cada cosa</span>", onclick: () => { closeSheet(); abrirGuia(); } }))),
    el("div", { class: "group" },
      el("span", { class: "label", text: "Colores" }),
      el("div", { class: "actions" }, el("button", { class: "action", html: icon("marker") + "<span>Qué significa cada color</span>", onclick: () => abrirLeyenda() }))),
    el("div", { class: "group" },
      el("span", { class: "label", text: "Copia de seguridad" }),
      el("p", { class: "small-print", text: "Atril guarda solo cada cambio en este dispositivo, pero si se borra la app o se pierde el iPad, se pierde todo. La copia es un archivo con todos tus discursos y notas: guárdalo en OneDrive o iCloud. Te lo recordará cada semana si has cambiado algo." }),
      el("p", { class: "proteccion", id: "ajustes-proteccion", text: "…" }),
      el("div", { class: "actions" },
        el("button", { class: "action", html: icon("download") + "<span>Hacer copia de seguridad</span>", onclick: () => { closeSheet(); exportBackup(); } }),
        el("button", { class: "action", html: icon("upload") + "<span>Restaurar una copia</span>", onclick: () => { closeSheet(); $("#backup-input").click(); } })
      )
    ),
    el("div", { class: "group" },
      el("span", { class: "label", text: "Versión" }),
      el("p", { class: "small-print", id: "version-txt", text: `Atril ${fechaDeVersion(APP_VERSION)} (${APP_VERSION}).` }),
      el("div", { class: "actions" }, el("button", { class: "action", id: "buscar-act", html: icon("download") + "<span>Buscar actualizaciones</span>", onclick: (e) => buscarActualizaciones(e.currentTarget) }))),
    el("div", { class: "actions" }, el("button", { class: "action plain", text: "Cerrar", onclick: () => closeSheet() })),
  ].filter(Boolean));
  pintarProteccion();
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
/** Hace un cambio de diseño (barras, panel) sin perder el párrafo que se estaba leyendo; arriba del todo, se queda arriba. */
function mantenerSitio(scrollEl, contentEl, cambio) {
  const arriba = scrollEl.scrollTop <= 4;
  const a = arriba ? null : captureAnchor(scrollEl, contentEl);
  cambio();
  if (arriba) scrollEl.scrollTop = 0; else restoreAnchor(scrollEl, a);
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
    sesion.guardar();
  },
  /** Vuelve a poner el cronómetro como estaba (después de cerrarse la app sin querer). */
  restaurar(t, docKey) {
    clearInterval(this.int);
    this.elapsed = Number(t.elapsed) || 0;
    this.running = !!t.running;
    this.startedAt = Number(t.startedAt) || Date.now();
    this.docKey = docKey;
    if (this.running) this.int = setInterval(() => this.paint(), 500);
    if (this.running || this.elapsed) { ensayo.empezar({ sinGrabar: true }); if (!this.running) ensayo.pausa(); }
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
    sesion.guardar();
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
    if (this.running && Date.now() - (this.ultimaSesion || 0) > 5000) { this.ultimaSesion = Date.now(); sesion.guardar(); }
  },
};

/* ============================================================
   Sesión: si la app se cierra sin querer en medio de un discurso, al volver a abrirla
   se vuelve al mismo discurso, al mismo sitio y con el cronómetro como iba.
   ============================================================ */
const SESION = "atril.sesion";
const sesion = {
  guardar({ enLector = currentView === "reader" } = {}) {
    if (!reader.id) return;
    const enMarcha = timer.running || timer.elapsed > 0;
    if (!presentar.activo && !enMarcha) { lsSet(SESION, ""); return; }
    lsSet(SESION, JSON.stringify({
      kind: reader.kind, id: reader.id, enLector, presentando: presentar.activo && enLector,
      timer: { running: timer.running, startedAt: timer.startedAt, elapsed: timer.elapsed }, t: Date.now(),
    }));
  },
  /** Sesión que hay que recuperar al abrir la app, o null. */
  pendiente() {
    let s = null;
    try { s = JSON.parse(lsGet(SESION, "") || "null"); } catch {}
    if (!s || !s.id || Date.now() - s.t > 4 * 3600e3) return null;
    return s.presentando || (s.enLector && s.timer && s.timer.running) ? s : null;
  },
};
let sesionARestaurar = null;

/* ============================================================
   Ensayos: tiempo total y por parte, con grabación opcional
   ============================================================ */
const MIN_ENSAYO = 30;       // segundos mínimos para guardar un ensayo
const MAX_ENSAYOS = 30;      // por discurso
const MAX_GRABACIONES = 5;   // por discurso

const ensayo = {
  activo: false, kind: null, id: null, titulo: "", partes: [], ms: [], parte: 0, ultimo: 0, objetivoSeg: null,
  grab: null, grabListo: false, grabInicio: 0, marcas: [],
  soloParte: null, // {k, titulo, o}: practicando una parte suelta (no se guarda como ensayo)

  grabando() { return !!(this.grab && this.grabListo && this.grab.activa); },

  empezar({ sinGrabar = false } = {}) {
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
    if (settings.grabar && puedeGrabar() && !sinGrabar && !this.soloParte) this.empezarGrabacion();
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
      // Practicando una parte: al pasar a la siguiente, se para solo
      if (this.soloParte && k != null && k > this.soloParte.k) { this.ultimo = now; setTimeout(() => timer.reset(), 0); return; }
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
    if (this.soloParte) {
      // Una parte suelta: se dice cómo ha ido, pero no cuenta como ensayo
      const sp = this.soloParte;
      this.soloParte = null;
      if (g) g.cancelar();
      if (seg < 3) return null;
      const d = sp.o ? seg - sp.o : null;
      const txt = d == null ? "" : Math.abs(d) < 8 ? " · en tiempo" : d > 0 ? ` · +${mmss(d)}` : ` · −${mmss(-d)}`;
      toast(`«${sp.titulo}»: ${mmss(seg)}${sp.o ? ` de ${mmss(sp.o)}` : ""}${txt}`, { action: "Otra vez", onAction: () => reader.practicarParte(sp.titulo), ms: 8000 });
      return null;
    }
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
      chipGroup([["sans", "Como Word"], ["serif", "Clásica"], ["arial", "Arial"], ["georgia", "Georgia"], ["verdana", "Verdana"]], "font", "f-")),
    el("div", { class: "group" }, el("span", { class: "label", text: "Interlineado" }),
      chipGroup([[1.35, "Junto"], [1.6, "Normal"], [1.9, "Amplio"]], "lineHeight")),
    currentView === "reader" ? reader.timeGroup() : null,
    el("div", { class: "actions" }, el("button", { class: "action plain", text: "Cerrar", onclick: () => closeSheet() })),
  ].filter(Boolean), { onClose: () => { aaSheetOpen = false; } });
}

/** «(2 min)» al final de un título se muestra como una etiqueta al margen (solo en pantalla; el texto no cambia). */
function decorarMinutos(root) {
  for (const h of root.querySelectorAll("h1, h2, h3, h4")) {
    const w = document.createTreeWalker(h, NodeFilter.SHOW_TEXT);
    let ultimo = null;
    for (let n = w.nextNode(); n; n = w.nextNode()) if (n.textContent.trim()) ultimo = n;
    if (!ultimo) continue;
    const m = ultimo.textContent.match(/\s*\((\d+(?:[.,]\d+)?)\s*(min(?:utos?)?)\.?\)\s*$/i);
    if (!m) continue;
    ultimo.textContent = ultimo.textContent.slice(0, m.index);
    ultimo.after(el("span", { class: "h-min" }, el("span", { class: "par", text: " (" }), `${m[1]} ${m[2]}`, el("span", { class: "par", text: ")" })));
  }
}

/** Las pausas «‖» se ven destacadas al leer (solo en pantalla; el texto no cambia). */
function decorarPausas(root) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodos = [];
  for (let n = w.nextNode(); n; n = w.nextNode()) if (n.data.includes("‖")) nodos.push(n);
  for (const n of nodos) {
    const partes = n.data.split("‖");
    const frag = document.createDocumentFragment();
    partes.forEach((t, k) => {
      if (k) frag.append(el("span", { class: "pausa", title: "Pausa", text: "‖" }));
      if (t) frag.append(t);
    });
    n.replaceWith(frag);
  }
}

/** Índice del bloque que cruza la línea a un tercio de la pantalla (0 si se está arriba del todo). */
function bloqueEnLinea(scrollEl, contenido) {
  if (scrollEl.scrollTop <= 4) return 0;
  const r = scrollEl.getBoundingClientRect();
  const y = r.top + r.height * 0.33;
  const hijos = contenido.children;
  let elegido = 0;
  for (let i = 0; i < hijos.length; i++) {
    if (hijos[i].getBoundingClientRect().top <= y) elegido = i; else break;
  }
  return elegido;
}

/* ============================================================
   Panel lateral (como el panel de navegación de Word): solo con
   la pantalla ancha (iPad en horizontal). Marca la parte en la que se va.
   ============================================================ */
const mqPanel = window.matchMedia("(min-width: 1024px)");
function crearPanel({ aside, lista, ajuste, scrollEl, contenido, rellenar, alCambiar = () => {}, util = () => true }) {
  return {
    abierto: false,
    cabe: () => mqPanel.matches,
    /** Lo abre o lo cierra según el ajuste y el ancho de la pantalla (solo se abre solo si sirve: `util`). */
    abrir({ forzar = false } = {}) {
      const v = this.cabe() && (forzar || (settings[ajuste] !== false && util()));
      if (v !== this.abierto) mantenerSitio(scrollEl, contenido, () => { aside.hidden = !v; this.abierto = v; });
      if (v) { this.rellenar(); }
      alCambiar(v);
      return v;
    },
    alternar() {
      const abrir = !this.abierto;
      settings[ajuste] = abrir;
      saveSettings();
      this.abrir({ forzar: abrir });
    },
    rellenar() {
      if (!this.abierto) return;
      rellenar(lista);
      lista.querySelectorAll(".o-h.actual").forEach((x) => x.classList.remove("actual"));
      this.pintarActual();
    },
    /** Resalta el título de la parte que se está leyendo y lo deja a la vista. */
    pintarActual() {
      if (!this.abierto) return;
      const b = bloqueEnLinea(scrollEl, contenido);
      let actual = null;
      for (const it of lista.querySelectorAll(".o-h")) { if (Number(it.dataset.i) <= b) actual = it; else break; }
      for (const x of lista.querySelectorAll(".o-h.actual")) if (x !== actual) { x.classList.remove("actual"); x.removeAttribute("aria-current"); }
      if (actual && !actual.classList.contains("actual")) {
        actual.classList.add("actual");
        actual.setAttribute("aria-current", "true");
        const r = actual.getBoundingClientRect(), lr = lista.getBoundingClientRect();
        if (r.top < lr.top || r.bottom > lr.bottom) lista.scrollTop += r.top - lr.top - lr.height / 3;
      }
    },
  };
}

const reader = {
  kind: null, id: null, item: null, plan: null, mode: "texto", lastPace: null, aqui: null, filtro: "todo", savedScroll: null,
  conteo: null, partesCache: null,
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
    this.conteo = null; this.partesCache = null;
    const title = item.title || htmlToText(item.html).split("\n")[0].slice(0, 60) || "Sin título";
    $("#reader-title").textContent = title;
    document.title = title + " · Atril";
    this.contentEl.innerHTML = item.html || "";
    enlazarCitas(this.contentEl, settings.refLinks);
    decorarMinutos(this.contentEl);
    decorarPausas(this.contentEl);
    this.cargarAqui();
    this.setMode("texto", { keepScroll: true });
    this.buildPlan();
    views.reader.classList.remove("immersive");
    showView("reader");
    // Vuelta después de cerrarse la app sin querer: cronómetro y modo presentar como estaban
    const vuelta = sesionARestaurar && sesionARestaurar.kind === kind && sesionARestaurar.id === id ? sesionARestaurar : null;
    sesionARestaurar = null;
    if (vuelta) timer.restaurar(vuelta.timer || {}, kind + "/" + id);
    timer.paint();
    if (vuelta) {
      if (vuelta.presentando) presentar.entrar({ consejo: false });
      toast(vuelta.timer && (vuelta.timer.running || vuelta.timer.elapsed) ? "Has vuelto donde estabas. El cronómetro no se ha parado." : "Has vuelto donde estabas.", { ms: 5000 });
    }
    lsSet("atril.ultimo", JSON.stringify({ kind, id, t: Date.now() }));
    // «Presentar» desde el inicio: empieza por arriba
    const aPresentar = !vuelta && presentarAlAbrir === kind + "/" + id;
    presentarAlAbrir = null;
    // Recupera la posición de lectura
    const ratio = aPresentar ? 0 : parseFloat(lsGet(this.posKey(), "0")) || 0;
    this.lateral.abrir();
    requestAnimationFrame(() => { this.scrollEl.scrollTop = ratio * this.scrollEl.scrollHeight; this.paintProgress(); this.paintEstado(); this.paintPace(); this.lateral.pintarActual(); });
    if (aPresentar) presentar.comprobar({ desdeInicio: true });
    keepAwake(true);
  },

  leave() {
    keepAwake(false);
    if (presentar.activo) presentar.salir({ guardar: false });
    sesion.guardar({ enLector: false });
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
    const s = this.scrollEl;
    const r = s.scrollHeight ? s.scrollTop / s.scrollHeight : 0;
    lsSet(this.posKey(), String(Math.round(r * 10000) / 10000));
    lsSet(`atril.prog.${this.kind}.${this.id}`, String(this.porcentaje()));
  },

  /** Lo leído (0–100), según el desplazamiento. */
  porcentaje() {
    const s = this.scrollEl;
    const max = s.scrollHeight - s.clientHeight;
    return max > 4 ? Math.round(clamp(s.scrollTop / max, 0, 1) * 100) : 0;
  },

  buildPlan() {
    const bloques = [...this.contentEl.children];
    this.plan = crearPlan(bloques, Number(this.item && this.item.target) || 0);
    // Palabras de cada bloque (para «quedan ≈ N min» aunque no haya objetivo)
    const palabras = bloques.map((b) => contarPalabras(b.textContent || ""));
    let acc = 0;
    const inicio = palabras.map((p) => { const x = acc; acc += p; return x; });
    this.conteo = { inicioBloque: inicio, palabrasBloque: palabras, total: acc };
    this.partesCache = null;
    this.paintPace();
    this.paintEstado();
  },

  /** Barra de estado de abajo (como el pie de Kindle): parte, lo leído y lo que queda. */
  paintEstado() {
    const parte = $("#re-parte"), quedan = $("#re-quedan"), barra = $("#reader-estado");
    barra.hidden = !this.item || this.mode !== "texto" || !this.conteo || !this.conteo.total;
    if (barra.hidden) return;
    const partes = this.partesCache || (this.partesCache = this.partesEnsayo());
    const b = this.bloqueActual();
    const k = partes.length > 1 && b != null ? parteDeBloque(partes, b) : -1;
    parte.textContent = k >= 0 ? `Parte ${k + 1} de ${partes.length} · ${partes[k].titulo}` : "";
    const pct = this.porcentaje();
    const w = this.scrollEl.scrollTop <= 4 ? 0 : palabraActual(this.conteo, this.scrollEl, this.contentEl);
    const seg = this.plan ? this.plan.objetivoSeg - tiempoPrevisto(this.plan, w) : ((this.conteo.total - w) / ppm()) * 60;
    const min = Math.round(Math.max(0, seg) / 60);
    quedan.textContent = pct >= 99 ? "100 % · final" : `${pct} % · quedan ≈ ${min < 1 ? "menos de 1" : min} min`;
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
    return bloqueEnLinea(this.scrollEl, this.contentEl);
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
    if (presentar.activo) presentar.pintar({ estado, largo, corto, aviso, seg, started });
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
    const est = minutosEstimados(palabras, ppm());
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
      el("p", { class: "small-print", text: `Lectura estimada: ≈ ${est} min (${palabras.toLocaleString("es-ES")} palabras a ${ppm()} por minuto).` }),
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
    this.pintarBotonEsquema();
    if (esquema) this.scrollEl.scrollTop = 0;
    else if (!keepScroll && this.savedScroll != null) this.scrollEl.scrollTop = this.savedScroll;
    this.paintProgress();
    this.paintEstado();
  },

  pintarBotonEsquema() {
    const on = this.mode === "esquema" || this.lateral.abierto;
    const b = $("#reader-outline-btn");
    b.classList.toggle("active", on);
    b.setAttribute("aria-pressed", String(on));
  },

  /** Esquema: con la pantalla ancha, panel al lado del texto; si no, a pantalla completa. */
  toggleOutline() {
    if (this.lateral.cabe()) { if (this.mode !== "texto") this.setMode("texto"); this.lateral.alternar(); return; }
    if (this.mode === "texto") { buscador.cerrar(); prompter.cerrar(); this.savedScroll = this.scrollEl.scrollTop; this.setMode("esquema"); }
    else this.setMode("texto");
  },

  /** Esquema: títulos y frases resaltadas (con filtro por color). Tocar un punto lleva a su sitio en el texto. */
  renderOutline(out = this.outlineEl) {
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
      const opciones = [["todo", "Todo"], ["titulos", "Títulos"], ...COLORES.filter((c) => colores.has(c.id)).map((c) => [c.id, significado("m", c.id) || c.nombre])];
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
        el("p", { text: "Aquí salen los títulos y las frases resaltadas. En el editor, usa «Título 1» o «Título 2» para las partes y el resaltador para las ideas clave." })
      ));
    }
  },

  /** Toques en el esquema (a pantalla completa o en el panel). */
  clicEsquema(e, out) {
    if (e.target.closest("a")) return;
    const f = e.target.closest("[data-filtro]");
    if (f) { this.filtro = f.dataset.filtro; this.renderOutline(out); if (out !== this.outlineEl) this.lateral.pintarActual(); return; }
    const it = e.target.closest(".o-item");
    if (it) this.goToBlock(Number(it.dataset.i));
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
    this.lateral.rellenar();
  },

  irAqui() { if (this.aqui != null) this.goToBlock(this.aqui); },

  /* ---- Menú ⋯ ---- */
  /** «Más»: agrupado en Practicar, Documento, Compartir y guardar, y Ayuda (no una caja de restos). */
  openMenu() {
    const n = (this.item.ensayos || []).length;
    const d = (this.item.dado || []).length;
    actionSheet(null, [
      { grupo: "Practicar" },
      { label: n ? `Ensayos (${n})` : "Ensayos", icon: "history", run: () => this.openEnsayos() },
      { label: "Tarjetas: una parte por pantalla", icon: "cards", run: () => tarjetas.abrir() },
      { label: "Desplazamiento automático", icon: "scroll", run: () => prompter.abrir() },
      { grupo: "Documento" },
      { label: "Buscar en el texto", icon: "search", run: () => buscador.abrir() },
      this.aqui != null ? { label: "Ir a «voy por aquí»", icon: "bookmark", run: () => this.irAqui() } : null,
      this.kind === "docs" ? { label: d ? `Dónde lo he dado (${d})` : "Apuntar que lo he dado", icon: "calendar", run: () => abrirDado(this.kind, this.id) } : null,
      { grupo: "Compartir y guardar" },
      { label: "Compartir (WhatsApp, correo…)", icon: "share", run: () => abrirCompartir(this.kind, this.item) },
      { label: "Guardar como Word", icon: "word", run: () => exportWord(this.kind, this.item) },
      { label: "Guardar como PDF", icon: "pdf", run: () => exportPdf(this.kind, this.item) },
      { grupo: "Ayuda" },
      { label: "Guía de Atril", icon: "guia", run: () => abrirGuia("leer") },
    ]);
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
      contenido.push(this.analisisEnsayos(lista, objetivo));
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

  /** «Cómo vas»: mediana de los últimos ensayos, la parte que más se pasa y qué practicar. */
  analisisEnsayos(lista, objetivo) {
    // Lo previsto para cada parte sin «(N min)»: el objetivo repartido según las palabras
    let previstos = null;
    if (objetivo && this.contentEl) {
      const est = estimarPartes([...this.contentEl.children], objetivo / 60, ppm());
      if (est.palabras) previstos = new Map(est.partes.map((p) => [p.titulo, p.objetivoSeg || Math.round((objetivo * p.palabras) / est.palabras)]));
    }
    const a = analizarEnsayos(lista, objetivo, { previstos });
    if (!a) return null;
    const difTxt = (d) => (d == null ? "" : Math.abs(d) < 15 ? "en tiempo" : d > 0 ? `+${mmss(d)}` : `−${mmss(-d)}`);
    const tono = (d) => (d == null ? "" : d > 15 ? "over" : d < -15 ? "ahead" : "ok");
    const caja = el("section", { class: "ens-analisis", "aria-label": "Cómo vas" },
      el("h3", { text: "Cómo vas" }),
      el("p", { class: "ens-mediana" },
        el("span", { text: `${a.n > 1 ? `Mediana de los ${a.n} últimos` : "Último ensayo"}: ` }),
        el("strong", { text: mmss(a.mediana) }),
        a.dif != null ? el("span", { class: "ens-dif " + tono(a.dif), text: Math.abs(a.dif) < 15 ? "en tiempo" : `${difTxt(a.dif)} del objetivo` }) : null),
      a.rango != null || a.tendencia != null ? el("p", { class: "small-print", text: [
        a.rango != null ? `Del más corto al más largo hay ${mmss(a.rango)}` : "",
        a.tendencia != null ? `los 2 últimos van ${mmss(Math.abs(a.tendencia))} más ${a.tendencia < 0 ? "rápidos" : "lentos"} que los anteriores` : "",
      ].filter(Boolean).join("; ") + "." }) : null,
      el("p", { class: "ens-consejo", html: icon("bookmark") + `<span>${escapeHtml(a.consejo)}</span>` }));
    const foco = a.peor || a.corta;
    if (foco && this.kind === "docs") caja.append(el("button", { class: "btn primary ens-practicar", html: icon("play") + `<span>Practicar «${escapeHtml(foco.t)}»</span>`, onclick: () => this.practicarParte(foco.t) }));
    if (a.partes.length > 1) {
      caja.append(el("div", { class: "ens-partes" }, a.partes.map((p) => el("button", {
        class: "ens-parte ens-parte-btn", title: "Practicar esta parte", onclick: () => this.practicarParte(p.t),
      },
        el("span", { class: "ens-pt", text: p.t }),
        el("span", { class: "ens-ps " + tono(p.dif), text: mmss(p.s) + (p.o ? ` de ${mmss(p.o)}` : "") + (p.dif != null && Math.abs(p.dif) >= 15 ? ` · ${difTxt(p.dif)}` : "") })))));
      caja.append(el("p", { class: "small-print", text: "Toca una parte para practicarla sola: el cronómetro se para al llegar a la siguiente y no cuenta como ensayo." }));
    }
    return caja;
  },

  /** Practicar una parte suelta: va a su título y pone en marcha el cronómetro. */
  practicarParte(titulo) {
    closeSheet();
    if (presentar.activo) return;
    const partes = this.partesEnsayo();
    const k = partes.findIndex((p) => p.titulo === titulo);
    if (k < 0) { toast("No encuentro esa parte en el texto. ¿Le has cambiado el título?"); return; }
    if (timer.running || timer.elapsed) timer.reset();
    const b = this.contentEl.children[partes[k].bloque];
    if (b) {
      const top = b.getBoundingClientRect().top - this.scrollEl.getBoundingClientRect().top;
      this.scrollEl.scrollTop += top - Math.min(80, this.scrollEl.clientHeight * 0.15);
    }
    let o = partes[k].objetivoSeg;
    if (!o && this.plan) {
      const est = estimarPartes([...this.contentEl.children], this.plan.objetivoSeg / 60, ppm());
      const p = est.partes[k];
      if (p && est.palabras) o = Math.round((this.plan.objetivoSeg * p.palabras) / est.palabras);
    }
    ensayo.soloParte = { k, titulo, o: o || null };
    timer.toggle();
    toast(`Practicando «${titulo}»${o ? ` (${mmss(o)})` : ""}. Al llegar a la parte siguiente, el cronómetro se para.`, { ms: 5000 });
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
    const sideList = $("#reader-side-list");
    this.lateral = crearPanel({
      aside: $("#reader-side"), lista: sideList, ajuste: "panel", scrollEl: this.scrollEl, contenido: this.contentEl,
      rellenar: (out) => this.renderOutline(out),
      alCambiar: () => this.pintarBotonEsquema(),
      // En las notas sin títulos ni resaltados, el panel no se abre solo
      util: () => this.kind === "docs" || !!this.contentEl.querySelector("h1, h2, h3, h4, mark"),
    });
    sideList.addEventListener("click", (e) => this.clicEsquema(e, sideList));
    $("#reader-side-close").addEventListener("click", () => this.lateral.alternar());
    const saveLater = debounce(() => { this.savePos(); if (presentar.activo) sesion.guardar(); }, 400);
    let paceRaf = 0, estadoRaf = 0;
    this.scrollEl.addEventListener("scroll", () => {
      this.paintProgress();
      if (this.mode === "texto") saveLater();
      if (!paceRaf && (timer.running || timer.elapsed || presentar.activo)) paceRaf = requestAnimationFrame(() => { paceRaf = 0; this.paintPace(); });
      if (!estadoRaf) estadoRaf = requestAnimationFrame(() => { estadoRaf = 0; this.paintEstado(); this.lateral.pintarActual(); });
    }, { passive: true });
    // Al girar el iPad: el esquema pasa de pantalla completa a panel, o al revés
    mqPanel.addEventListener("change", () => {
      if (currentView !== "reader" || !this.item) return;
      if (mqPanel.matches && this.mode === "esquema") this.setMode("texto");
      this.lateral.abrir();
    });
    // Un toque sobre el texto oculta o muestra la barra (modo atril); dos toques marcan «voy por aquí»
    let ultimoToque = { t: 0, x: 0, y: 0 }, esperaToque = 0;
    this.contentEl.addEventListener("click", (e) => {
      // Presentando: los toques solo pasan página (y los enlaces no sacan de la app)
      if (presentar.activo) { e.preventDefault(); presentar.toque(e); return; }
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
    this.outlineEl.addEventListener("click", (e) => this.clicEsquema(e, this.outlineEl));
    $("#reader-outline-btn").addEventListener("click", () => this.toggleOutline());
    $("#reader-presentar").addEventListener("click", () => presentar.comprobar());
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
      // ⌘F / Ctrl+F: buscar en el texto (no mientras se presenta)
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "f" && !presentar.activo && !tarjetas.activo) {
        e.preventDefault(); buscador.abrir(); return;
      }
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
      if (k === "Escape") { if (buscador.abierto) buscador.cerrar(); else if (prompter.activo) prompter.cerrar(); else if (presentar.activo) presentar.mostrarSalir(); return; }
      if (this.mode === "texto" && (adelante || atras)) {
        e.preventDefault();
        this.scrollEl.scrollBy({ top: (adelante ? 1 : -1) * this.scrollEl.clientHeight * 0.85, behavior: "smooth" });
      }
    });
  },
};

/* ============================================================
   Presentar: pantalla bloqueada para dar el discurso
   ============================================================ */
const presentar = {
  activo: false, partes: [], aviso: "", reloj: 0,
  entrar({ consejo = true } = {}) {
    if (!reader.item) return;
    buscador.cerrar();
    prompter.cerrar();
    if (tarjetas.activo) tarjetas.cerrar();
    if (reader.mode !== "texto") reader.setMode("texto", { keepScroll: true });
    this.activo = true;
    this.partes = reader.partesEnsayo();
    this.aviso = "";
    // Sin barras ni panel lateral el texto se recoloca: se mantiene a la vista el mismo párrafo
    mantenerSitio(reader.scrollEl, reader.contentEl, () => {
      views.reader.classList.remove("immersive");
      views.reader.classList.add("presentando");
      $("#pres-bar").hidden = false;
      $("#pres-salir").hidden = true;
    });
    // El gesto o el botón de «atrás» (Android, o deslizar desde el borde) no sale: enseña cómo salir
    this.hash = location.hash;
    if (!(history.state && history.state.atril === "presentar")) history.pushState({ atril: "presentar" }, "");
    keepAwake(true);
    reader.paintPace();
    this.pintarReloj();
    clearInterval(this.reloj);
    this.reloj = setInterval(() => this.pintarReloj(), 15000);
    sesion.guardar();
    const toques = settings.presToque !== false;
    if (consejo && (esIOS() || esAndroid()) && lsGet("atril.consejoAcceso") !== "1") this.consejo();
    else if (consejo && toques && lsGet("atril.consejoToque") !== "1") {
      lsSet("atril.consejoToque", "1");
      toast("Toca la parte de abajo para avanzar una pantalla y la de arriba para volver.", { ms: 6000 });
    }
  },
  /**
   * Comprobación antes de presentar: duración, letra, desde dónde, pantalla encendida y cómo no salirse.
   * «Presentar ahora» es la acción principal; se puede quitar en Ajustes.
   */
  comprobar({ desdeInicio = false } = {}) {
    if (this.activo || !reader.item) return;
    if (settings.presComprobar === false) {
      if (desdeInicio) reader.scrollEl.scrollTop = 0;
      this.entrar();
      return;
    }
    const s = reader.scrollEl;
    const max = s.scrollHeight - s.clientHeight;
    const pct = max > 0 ? Math.round((s.scrollTop / max) * 100) : 0;
    let desde = desdeInicio || pct < 3 ? "inicio" : "aqui";
    const botonesDesde = el("div", { class: "chips pc-desde" });
    const pintarDesde = () => $$("button", botonesDesde).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.desde === desde)));
    botonesDesde.append(...[
      el("button", { class: "chip", "data-desde": "inicio", text: "Desde el principio", onclick: () => { desde = "inicio"; pintarDesde(); } }),
      pct >= 3 ? el("button", { class: "chip", "data-desde": "aqui", text: `Desde donde estoy (${pct} %)`, onclick: () => { desde = "aqui"; pintarDesde(); } }) : null,
    ].filter(Boolean));
    pintarDesde();
    const wake = el("input", { type: "checkbox", role: "switch", id: "pc-wake" });
    wake.checked = !!settings.wakeLock;
    wake.addEventListener("change", () => { settings.wakeLock = wake.checked; saveSettings(); });
    const siempre = el("input", { type: "checkbox", role: "switch", id: "pc-siempre" });
    siempre.checked = true;
    siempre.addEventListener("change", () => { settings.presComprobar = siempre.checked; saveSettings(); });
    const tema = { claro: "claro", sepia: "sepia", oscuro: "oscuro" }[settings.theme] || settings.theme;
    const fila = (ic, titulo, ...resto) => el("div", { class: "pc-fila" }, el("span", { class: "pc-ic", html: icon(ic) }), el("div", { class: "pc-cuerpo" }, el("b", { text: titulo }), ...resto));
    const movil = esIOS() || esAndroid();
    const { close } = openSheet([
      el("h2", { text: "Antes de presentar" }),
      el("p", { class: "co-titulo", text: reader.item.title || "" }),
      el("div", { class: "pc-lista" },
        fila("timer", "Tiempo", reader.timeGroup()),
        fila("aa", "Letra", el("div", { class: "pc-linea" }, el("p", { class: "pc-txt", text: `Tamaño ${settings.fontSize} · tema ${tema}` }),
          el("button", { class: "chip", text: "Cambiar", onclick: () => { close(); openAaSheet(); } }))),
        fila("play", "Empezar", botonesDesde),
        fila("book", "Pantalla", el("label", { class: "switch-row pc-switch" }, el("span", { text: "Que no se apague" }), wake)),
        fila("lock", "Que no te saque de aquí",
          el("p", { class: "pc-txt", text: "Para pasar página, toca abajo; para salir, toca el centro y mantén «Salir»." }),
          movil ? el("p", { class: "pc-txt", text: esAndroid() ? "El gesto de inicio solo se bloquea con «Fijar aplicaciones»." : "El gesto de inicio solo se bloquea con «Acceso guiado» (tres pulsaciones del botón superior o de inicio)." }) : null,
          movil ? el("button", { class: "text-btn", text: "¿Cómo se activa?", onclick: () => { close(); this.consejo(); } }) : null)),
      el("label", { class: "switch-row pc-switch small" }, el("span", { text: "Comprobar siempre antes de presentar" }), siempre),
      el("div", { class: "actions pc-acciones" },
        el("button", { class: "action primary pc-ya", id: "pc-ya", html: icon("play") + "<span>Presentar ahora</span>", onclick: () => {
          close();
          if (desde === "inicio") reader.scrollEl.scrollTop = 0;
          this.entrar({ consejo: false });
        } }),
        el("button", { class: "action plain", text: "Cancelar", onclick: () => close() })),
    ]);
    requestAnimationFrame(() => { const b = $("#pc-ya"); if (b) b.focus({ preventScroll: true }); });
  },

  salir({ guardar = true, quitarPaso = false } = {}) {
    if (!this.activo) return;
    this.activo = false;
    clearInterval(this.reloj);
    clearTimeout(this.ocultarSalir);
    // Se quita el paso que se puso al entrar (solo si se sale a mano; si se va a otra pantalla, ya no está)
    if (quitarPaso && history.state && history.state.atril === "presentar") history.back();
    mantenerSitio(reader.scrollEl, reader.contentEl, () => {
      views.reader.classList.remove("presentando");
      $("#pres-bar").hidden = true;
      $("#pres-salir").hidden = true;
    });
    if (guardar) sesion.guardar();
    reader.paintPace();
    reader.paintEstado();
    reader.lateral.pintarActual();
  },
  /** Enseña «Mantén pulsado para salir» unos segundos (tras el gesto de atrás o un toque en el centro). */
  mostrarSalir() {
    if (!this.activo) return;
    const s = $("#pres-salir");
    s.hidden = false;
    s.classList.remove("aparece"); void s.offsetWidth; s.classList.add("aparece");
    clearTimeout(this.ocultarSalir);
    this.ocultarSalir = setTimeout(() => { if (!s.classList.contains("cargando")) s.hidden = true; }, 5000);
  },
  /** La hora, como en el modo «Predicar» de Logos: para saber cuándo hay que terminar. */
  pintarReloj() {
    $("#pres-reloj").innerHTML = icon("clock") + `<span>${new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</span>`;
  },
  /** Un toque abajo avanza una pantalla; arriba, vuelve (como pasar página en Kindle). */
  toque(e) {
    const s = reader.scrollEl, r = s.getBoundingClientRect();
    const y = (e.clientY - r.top) / r.height;
    if (settings.presToque === false || (y >= 0.3 && y <= 0.55)) { this.mostrarSalir(); return; } // el centro enseña cómo salir
    const linea = settings.fontSize * settings.lineHeight;
    const salto = Math.max(linea * 2, s.clientHeight - linea * 2); // deja a la vista las dos últimas líneas
    if (y > 0.55) s.scrollBy({ top: salto, behavior: "smooth" });
    else s.scrollBy({ top: -salto, behavior: "smooth" });
  },
  pintar({ estado, corto, largo, aviso, seg, started }) {
    const b = $("#pres-timer");
    $("#pres-timer-text").textContent = mmss(seg);
    // Colores de semáforo, como los cronómetros de oratoria: verde, ámbar (último minuto) y rojo
    b.className = "pres-timer" + (timer.running ? " running" : "") + (aviso ? " " + aviso : "");
    const bar = $("#pres-bar");
    bar.classList.toggle("warn", aviso === "warn");
    bar.classList.toggle("over", aviso === "over");
    if (aviso && aviso !== this.aviso) { bar.classList.remove("destello"); void bar.offsetWidth; bar.classList.add("destello"); }
    this.aviso = aviso;
    $("#pres-hint").textContent = !started ? "Toca para empezar" : timer.running ? "Mantén pulsado para pausar" : "En pausa · toca para seguir";
    const chip = $("#pres-pace");
    chip.hidden = !estado;
    chip.className = "pace " + estado;
    chip.textContent = largo || "";
    // Lo que queda hasta el tiempo objetivo
    const plan = reader.plan, quedan = $("#pres-quedan");
    const resta = plan ? plan.objetivoSeg - seg : 0;
    quedan.hidden = !plan || resta <= 0;
    quedan.textContent = !plan ? "" : started ? `Quedan ${mmss(resta)}` : `Objetivo ${mmss(plan.objetivoSeg)}`;
    // Parte actual y la siguiente
    const partes = this.partes;
    const b0 = reader.bloqueActual();
    const k = partes.length && b0 != null ? parteDeBloque(partes, b0) : 0;
    const p = partes[k];
    $("#pres-parte").textContent = partes.length > 1 ? `Parte ${k + 1} de ${partes.length} · ${p.titulo}` : (reader.item.title || "");
    const sig = partes[k + 1];
    $("#pres-sigue").textContent = sig ? `Sigue: ${sig.titulo}${sig.objetivoSeg ? ` (${String(Math.round(sig.objetivoSeg / 6) / 10).replace(".", ",")} min)` : ""}` : partes.length > 1 ? "Última parte" : "";
    const prog = $("#pres-prog");
    if (prog.childElementCount !== partes.length) prog.replaceChildren(...partes.map(() => el("i")));
    [...prog.children].forEach((x, i) => { x.className = i < k ? "hecha" : i === k ? "actual" : ""; });
  },
  consejo() {
    const android = esAndroid();
    openSheet([
      el("h2", { text: "Para no salirte del discurso" }),
      el("p", { text: "Mientras presentas, Atril no sale con toques sueltos ni con el gesto de «atrás»." }),
      el("p", { class: "consejo-salir", text: "Para salir: toca el centro de la pantalla y mantén pulsado «Salir» hasta que se llene." }),
      el("p", { text: android
        ? "El gesto de ir a la pantalla de inicio es del sistema y ninguna app lo puede bloquear. Para que tampoco funcione, usa «Fijar aplicaciones» de Android:"
        : "El gesto de ir a la pantalla de inicio es del iPad y ninguna app lo puede bloquear. Para que tampoco funcione, usa «Acceso guiado»:" }),
      android
        ? el("ol", { class: "lista-pasos" },
          el("li", { text: "Ajustes → Seguridad (o Seguridad y privacidad → Más ajustes) → Fijar aplicaciones: actívalo." }),
          el("li", { text: "Abre Atril, toca el botón de aplicaciones recientes, toca el icono de Atril y elige «Fijar»." }),
          el("li", { text: "Para soltarla, mantén pulsados a la vez «atrás» y «recientes» (o desliza hacia arriba y mantén)." }))
        : el("ol", { class: "lista-pasos" },
          el("li", { text: "Ajustes → Accesibilidad → Acceso guiado: actívalo y pon un código." }),
          el("li", { text: "En Atril, pulsa tres veces el botón de inicio (o el botón superior si tu iPad no tiene) y toca Iniciar." }),
          el("li", { text: "Al terminar, vuelve a pulsar tres veces, escribe el código y toca Finalizar." })),
      settings.presToque !== false ? el("p", { text: "Para pasar página, toca la parte de abajo de la pantalla; para volver, la de arriba. También puedes deslizar el dedo." }) : null,
      el("p", { class: "small-print", text: "Si aun así se cierra, al abrir Atril volverás al mismo sitio con el cronómetro en marcha." }),
      el("div", { class: "actions" }, el("button", { class: "action primary", text: "Entendido", onclick: () => { lsSet("atril.consejoAcceso", "1"); lsSet("atril.consejoToque", "1"); closeSheet(); } })),
    ].filter(Boolean));
  },
  init() {
    // El cronómetro: un toque lo pone en marcha; para pausarlo hay que mantenerlo pulsado
    const t = $("#pres-timer");
    let espera = 0, largo = false;
    t.addEventListener("pointerdown", () => {
      largo = false;
      clearTimeout(espera);
      espera = setTimeout(() => { largo = true; if (timer.running) { timer.toggle(); toast("Cronómetro en pausa."); } }, 650);
    });
    const soltar = () => clearTimeout(espera);
    t.addEventListener("pointerup", soltar);
    t.addEventListener("pointercancel", soltar);
    t.addEventListener("pointerleave", soltar);
    t.addEventListener("contextmenu", (e) => e.preventDefault());
    t.addEventListener("click", () => {
      if (largo) { largo = false; return; }
      if (!timer.running) timer.toggle();
      else toast("Para pausar, mantén pulsado el cronómetro.");
    });
    // Salir: mantener pulsado
    const s = $("#pres-salir");
    let salida = 0;
    s.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      s.classList.add("cargando");
      clearTimeout(salida);
      clearTimeout(this.ocultarSalir);
      salida = setTimeout(() => { s.classList.remove("cargando"); this.salir({ quitarPaso: true }); }, 800);
    });
    const cancelar = () => {
      clearTimeout(salida);
      if (!s.classList.contains("cargando")) return;
      s.classList.remove("cargando");
      this.ocultarSalir = setTimeout(() => { if (this.activo) s.hidden = true; }, 3000);
    };
    s.addEventListener("pointerup", cancelar);
    s.addEventListener("pointercancel", cancelar);
    s.addEventListener("pointerleave", cancelar);
    s.addEventListener("contextmenu", (e) => e.preventDefault());
    s.addEventListener("click", () => { if (this.activo) toast("Mantén pulsado para salir."); });
    // «Atrás» mientras se presenta: se vuelve a poner el paso y se enseña cómo salir
    window.addEventListener("popstate", () => {
      if (!this.activo || location.hash !== this.hash) return;
      history.pushState({ atril: "presentar" }, "");
      this.mostrarSalir();
    });
  },
};
const esIOS = () => /iP(ad|hone|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const esAndroid = () => /Android/i.test(navigator.userAgent);

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
    $("#cards-prog").replaceChildren(...this.lista.map((_, k) => el("i", { class: k < this.i ? "hecha" : k === this.i ? "actual" : "" })));
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
/* ---- Partes del documento por títulos (panel de navegación del editor) ---- */
const nivelDe = (b) => { const m = /^H([1-4])$/.exec(b && b.tagName); return m ? Number(m[1]) : 0; };
/** Donde termina la parte que empieza en el título i: en el siguiente título de su nivel o superior. */
function finDeSeccion(hijos, i) {
  const n = nivelDe(hijos[i]);
  let fin = i + 1;
  while (fin < hijos.length && !(nivelDe(hijos[fin]) && nivelDe(hijos[fin]) <= n)) fin++;
  return fin;
}
/** El título de la parte hermana anterior (dir -1) o siguiente (dir 1) del mismo nivel, o -1. */
function hermanaDe(hijos, i, dir) {
  const n = nivelDe(hijos[i]);
  if (!n) return -1;
  if (dir > 0) { const f = finDeSeccion(hijos, i); return f < hijos.length && nivelDe(hijos[f]) === n ? f : -1; }
  for (let j = i - 1; j >= 0; j--) {
    const k = nivelDe(hijos[j]);
    if (k && k < n) return -1;
    if (k === n) return j;
  }
  return -1;
}

const editor = {
  kind: null, id: null, item: null, dirty: false, saving: null,
  area: $("#editor"), titleInput: $("#editor-title"), scrollEl: $("#editor-scroll"),

  async open(kind, id, stale = () => false) {
    const item = await store.get(kind, id);
    if (stale()) return;
    if (!item) { toast("Ese documento ya no existe."); throw new Error("no existe"); }
    this.kind = kind; this.id = id; this.item = item; this.dirty = false;
    this.original = item; this.versionHecha = false; // para «Versiones anteriores»
    this.titleInput.value = item.title || "";
    this.titleInput.placeholder = kind === "notes" ? "Título de la nota" : "Título del discurso";
    this.ponerHtml(item.html && item.html !== "<p><br></p>" ? item.html : "<p><br></p>");
    $("#save-state").textContent = "";
    document.title = (item.title || "Editar") + " · Atril";
    this.togglePalette(false);
    this.togglePaletteLetra(false);
    $("#dictado-ayuda").hidden = true;
    reemplazo.cerrar();
    this.cinta("inicio");
    this.pintarTiempo();
    showView("editor");
    this.scrollEl.scrollTop = 0;
    this.lateral.abrir();
    this.paintToolbar();
    // Nota dictada: el cursor en el texto y la ayuda del micrófono; documento nuevo: el cursor en el título
    if (dictarAlAbrir === kind + "/" + id) { dictarAlAbrir = null; this.dictar(); }
    else if (!item.title && (!item.html || item.html === "<p><br></p>")) this.titleInput.focus();
  },

  markDirty() {
    this.dirty = true;
    $("#save-state").textContent = "";
    this.saveLater();
    this.tiempoLater();
  },

  /** Tiempo estimado en la barra (solo discursos). */
  zoom(d) {
    setFontSize(settings.fontSize + d, { scrollEl: this.scrollEl, contentEl: this.area });
    saveSettings();
    this.pintarZoom();
  },
  pintarZoom() { $("#ed-zoom").textContent = `${Math.round((settings.fontSize / DEFAULTS.fontSize) * 100)} %`; },

  pintarTiempo() {
    const chip = $("#editor-time");
    this.totalPalabras = contarPalabras(this.area.textContent || "");
    this.pintarSeleccion();
    this.pintarZoom();
    if (this.kind !== "docs" || !this.item) { chip.hidden = true; this.estimacion = null; return; }
    const e = (this.estimacion = estimarPartes(this.area.children, this.item.target, ppm()));
    chip.hidden = !e.palabras;
    if (!e.palabras) return;
    const min = Math.max(1, Math.round(e.seg / 60));
    chip.textContent = e.objetivoSeg ? `≈ ${min} / ${Math.round(e.objetivoSeg / 60)} min` : `≈ ${min} min`;
    let estado = "";
    if (e.objetivoSeg) {
      estado = e.seg > e.objetivoSeg + 30 ? "over" : e.partes.some((p) => p.objetivoSeg && p.seg > p.objetivoSeg + 20) ? "warn" : "ok";
    }
    chip.className = "time-chip" + (estado ? " " + estado : "");
  },

  /** Palabras del documento y, si hay texto seleccionado, cuántas y cuánto se tarda en decirlas (como Word). */
  pintarSeleccion() {
    const n = this.totalPalabras || 0;
    let txt = `${n.toLocaleString("es-ES")} ${n === 1 ? "palabra" : "palabras"}`;
    const sel = window.getSelection();
    if (sel && sel.rangeCount && !sel.isCollapsed && this.area.contains(sel.anchorNode)) {
      const k = contarPalabras(String(sel));
      if (k) {
        const seg = Math.max(1, Math.round((k / ppm()) * 60));
        txt = `${k.toLocaleString("es-ES")} de ${txt} · ≈ ${seg < 60 ? seg + " s" : mmss(seg)}`;
      }
    }
    const e = $("#ed-palabras");
    if (e.textContent !== txt) e.textContent = txt;
  },

  /** Hoja con el tiempo estimado por partes, la duración objetivo y el ritmo al hablar. */
  abrirTiempo() {
    this.pintarTiempo();
    const e = this.estimacion;
    if (!e) return;
    const tono = (seg, obj) => (!obj ? "" : seg > obj + 20 ? "over" : seg < obj - 30 ? "ahead" : "ok");
    const contenido = [el("h2", { text: "Tiempo estimado" })];
    contenido.push(el("p", { class: "est-total", text: `≈ ${mmss(e.seg)} hablando a ${ppm()} palabras por minuto (${e.palabras.toLocaleString("es-ES")} palabras).` }));
    if (e.objetivoSeg) {
      const dif = e.objetivoSeg - e.seg;
      contenido.push(el("p", { class: "est-estado " + (dif < -30 ? "over" : "ok"),
        text: dif >= 0 ? `Te sobran ${mmss(dif)} para llegar a ${mmss(e.objetivoSeg)}.` : `Te pasas ${mmss(-dif)} de ${mmss(e.objetivoSeg)}.` }));
    }
    if (e.partes.length > 1) {
      contenido.push(el("div", { class: "est-partes" }, e.partes.map((p) => el("div", { class: "ens-parte" },
        el("span", { class: "ens-pt", text: p.titulo || "Parte" }),
        el("span", { class: "ens-ps " + tono(p.seg, p.objetivoSeg), text: `≈ ${mmss(p.seg)}${p.objetivoSeg ? ` de ${mmss(p.objetivoSeg)}` : ""}` })))));
    }
    // Duración objetivo
    const objetivo = el("input", { type: "number", inputmode: "numeric", min: 0, max: 240, step: 1, class: "num-input", "aria-label": "Minutos de objetivo", value: Number(this.item.target) || "", placeholder: "—" });
    const fijar = (n) => {
      n = clamp(Math.round(Number(n) || 0), 0, 240);
      this.item.target = n || undefined;
      if (!n) delete this.item.target;
      this.markDirty();
      this.abrirTiempo();
    };
    objetivo.addEventListener("change", () => fijar(objetivo.value));
    objetivo.addEventListener("keydown", (ev) => { if (ev.key === "Enter") objetivo.blur(); });
    const actual = () => Number(objetivo.value) || Math.max(1, Math.round(e.seg / 60));
    contenido.push(el("div", { class: "group" }, el("span", { class: "label", text: "Duración objetivo" }),
      el("div", { class: "size-row" },
        el("button", { class: "chip", text: "−", "aria-label": "Un minuto menos", onclick: () => fijar(actual() - 1) }),
        objetivo, el("span", { class: "unit", text: "min" }),
        el("button", { class: "chip", text: "+", "aria-label": "Un minuto más", onclick: () => fijar(actual() + 1) }),
        el("button", { class: "chip", text: "Quitar", onclick: () => fijar(0) }))));
    // Ritmo al hablar
    const real = ritmoDeEnsayos(this.item.ensayos, e.palabras);
    const opciones = [[110, "Despacio · 110"], [130, "Normal · 130"], [150, "Rápido · 150"]];
    if (real) opciones.push([real, `Según tus ensayos · ${real}`]);
    contenido.push(el("div", { class: "group" }, el("span", { class: "label", text: "Tu ritmo al hablar (palabras por minuto)" }),
      el("div", { class: "chips" }, opciones.map(([val, label]) => el("button", {
        class: "chip" + (val === real ? " ritmo-real" : ""), "aria-pressed": String(ppm() === val), text: label,
        onclick: () => { settings.ppm = val; saveSettings(); this.abrirTiempo(); },
      }))),
      el("p", { class: "small-print", text: "Hablando en público lo normal son 120–140 palabras por minuto. El ritmo cambia las estimaciones en toda la app." })));
    contenido.push(el("div", { class: "actions" }, el("button", { class: "action plain", text: "Cerrar", onclick: () => closeSheet() })));
    openSheet(contenido, { onClose: () => this.pintarTiempo() });
  },

  async save() {
    if (!this.dirty || !this.item) return;
    this.dirty = false;
    const html = sanitize(this.area.innerHTML);
    let title = this.titleInput.value.trim();
    if (!title) title = htmlToText(html).split("\n")[0].trim().slice(0, 60);
    const item = { ...this.item, html, title: title || (this.kind === "notes" ? "Nota sin título" : "Sin título"), updated: Date.now() };
    if (!this.versionHecha && this.original && (html !== this.original.html || item.title !== this.original.title)) {
      this.versionHecha = true;
      if (item.source && !item.alPC) item.alPC = this.original.updated || this.original.created || 1;
      await guardarVersion(this.kind, this.original, "Antes de editar");
    }
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
    // Órdenes que no cambian el texto
    const otras = {
      buscar: () => reemplazo.abrir(),
      tiempo: () => (this.kind === "docs" ? this.abrirTiempo() : toast(`${contarPalabras(this.area.textContent || "").toLocaleString("es-ES")} palabras.`)),
      leer: async () => { await this.flush(); go(`#/leer/${this.kind}/${this.id}`); },
      menos: () => this.zoom(-2),
      mas: () => this.zoom(2),
      aspecto: () => openAaSheet(),
      navegacion: () => (this.lateral.cabe() ? this.lateral.alternar() : this.navegacionHoja()),
      dibujo: () => this.nuevoDibujo(),
      dictar: () => this.dictar(),
      letra: () => this.togglePaletteLetra(),
      parte: () => this.parteNueva(),
      minutos: () => this.minutosParte(),
      pausa: () => this.insertarPausa(),
      versiones: () => this.abrirVersiones(),
    };
    if (otras[cmd]) { otras[cmd](); return; }
    this.area.focus();
    const d = document;
    switch (cmd) {
      case "strike": d.execCommand("strikeThrough"); break;
      case "h3": d.execCommand("formatBlock", false, "<h3>"); break;
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
        this.quitarLetraEnSeleccion();
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

  /** Panel de navegación (como en Word): los títulos, lo que dura cada parte y flechas para cambiarlas de sitio. */
  rellenarNavegacion(out) {
    out.replaceChildren();
    const hijos = [...this.area.children];
    const palabras = hijos.map((b) => contarPalabras(b.textContent || ""));
    let n = 0;
    hijos.forEach((b, i) => {
      const nivel = nivelDe(b);
      if (!nivel) return;
      const txt = (b.textContent || "").trim();
      if (!txt) return;
      const min = minutosDeTitulo(txt);
      const fin = finDeSeccion(hijos, i);
      const seg = Math.round((palabras.slice(i, fin).reduce((a, x) => a + x, 0) / ppm()) * 60);
      const tono = !min ? "" : seg > min * 60 + 20 ? "over" : seg < min * 60 - 30 ? "corto" : "ok";
      const sube = hermanaDe(hijos, i, -1) >= 0, baja = hermanaDe(hijos, i, 1) >= 0;
      out.append(el("div", { class: `o-item o-h o-h${nivel} nav-item`, "data-i": i },
        el("button", { class: "nav-ir", text: min ? tituloSinMinutos(txt) : txt }),
        el("div", { class: "nav-pie" },
          el("span", { class: "nav-t " + tono, text: min ? `≈ ${mmss(seg)} de ${String(min).replace(".", ",")} min` : `≈ ${mmss(seg)}` }),
          sube ? el("button", { class: "nav-mover", "data-dir": "-1", "aria-label": "Subir esta parte", html: icon("up") }) : null,
          baja ? el("button", { class: "nav-mover", "data-dir": "1", "aria-label": "Bajar esta parte", html: icon("down") }) : null)));
      n++;
    });
    if (!n) out.append(el("div", { class: "o-empty" },
      el("h2", { text: "Sin títulos" }),
      el("p", { text: "Usa «Título 1», «Título 2» o «Título 3» para las partes del discurso y aparecerán aquí." })));
  },

  /** Con la pantalla estrecha, la navegación sale en una hoja. */
  navegacionHoja() {
    const lista = el("div");
    this.rellenarNavegacion(lista);
    const titulos = [...lista.querySelectorAll(".o-item")];
    if (!titulos.length) { toast("No hay títulos. Usa «Título 1» o «Título 2» para las partes."); return; }
    actionSheet("Ir a", titulos.map((t) => ({ label: t.querySelector(".nav-ir").textContent, icon: "next", run: () => this.irABloque(Number(t.dataset.i)) })));
  },

  /** Cambia de sitio una parte entera (su título y todo lo que tiene debajo), como en el panel de navegación de Word. */
  moverParte(i, dir) {
    const hijos = [...this.area.children];
    const otra = hermanaDe(hijos, i, dir);
    if (otra < 0) return;
    const antes = this.area.innerHTML;
    const nodos = hijos.slice(i, finDeSeccion(hijos, i));
    const ref = dir < 0 ? hijos[otra] : hijos[finDeSeccion(hijos, otra)] || null;
    for (const n of nodos) this.area.insertBefore(n, ref);
    this.markDirty();
    this.lateral.rellenar();
    this.irABloque([...this.area.children].indexOf(nodos[0]));
    toast("Parte cambiada de sitio.", {
      action: "Deshacer", ms: 6000,
      onAction: () => { this.area.innerHTML = antes; this.markDirty(); this.lateral.rellenar(); this.pintarTiempo(); },
    });
  },

  irABloque(i) {
    const b = this.area.children[i];
    if (!b) return;
    const top = b.getBoundingClientRect().top - this.scrollEl.getBoundingClientRect().top;
    this.scrollEl.scrollTop += top - 24;
    this.lateral.pintarActual();
  },

  /** Atajos de teclado (iPad con teclado), los de Word y Google Docs. */
  atajo(e) {
    if (!(e.metaKey || e.ctrlKey)) return;
    const k = (e.key || "").toLowerCase(), c = e.code || "";
    let cmd = null;
    if (e.altKey && /^Digit[0-3]$/.test(c)) cmd = c === "Digit0" ? "p" : "h" + c.slice(-1);
    else if (e.altKey && c === "KeyH") { e.preventDefault(); this.aplicarColor(settings.markColor || "amarillo"); return; }
    else if (e.shiftKey && !e.altKey && k === "x") cmd = "strike";
    else if (e.shiftKey && !e.altKey && c === "Digit8") cmd = "ul";
    else if (e.shiftKey && !e.altKey && c === "Digit7") cmd = "ol";
    else if (!e.shiftKey && !e.altKey && k === "f") cmd = "buscar";
    else if (!e.shiftKey && !e.altKey && k === "s") { e.preventDefault(); this.flush().then(() => toast("Guardado.")); return; }
    if (!cmd) return;
    e.preventDefault();
    this.exec(cmd);
  },

  atajosHoja() {
    const cmd = esIOS() || /Mac/.test(navigator.platform) ? "⌘" : "Ctrl+";
    const alt = esIOS() || /Mac/.test(navigator.platform) ? "⌥" : "Alt+";
    const filas = [
      [`${cmd}B · ${cmd}I · ${cmd}U`, "Negrita, cursiva, subrayado"],
      [`${cmd}⇧X`, "Tachado"],
      [`${cmd}${alt}H`, "Resaltar"],
      [`${cmd}${alt}1 · 2 · 3`, "Título 1, 2 o 3"],
      [`${cmd}${alt}0`, "Texto normal"],
      [`${cmd}⇧8 · ${cmd}⇧7`, "Viñetas · lista numerada"],
      [`${cmd}F`, "Buscar y reemplazar"],
      [`${cmd}Z · ${cmd}⇧Z`, "Deshacer · rehacer"],
      [`${cmd}S`, "Guardar ahora (ya se guarda solo)"],
    ];
    openSheet([
      el("h2", { text: "Atajos de teclado" }),
      el("p", { class: "small-print", text: "Con un teclado conectado al iPad." }),
      el("div", { class: "atajos" }, filas.map(([k, t]) => el("div", { class: "atajo" }, el("kbd", { text: k }), el("span", { text: t })))),
      el("div", { class: "actions" }, el("button", { class: "action plain", text: "Cerrar", onclick: () => closeSheet() })),
    ]);
  },

  /** Pestañas de la cinta: Inicio, Revisar y Vista. */
  cinta(nombre) {
    $$(".ribbon-tabs [data-rtab]").forEach((t) => t.setAttribute("aria-selected", String(t.dataset.rtab === nombre)));
    $$("#view-editor [data-rpanel]").forEach((p) => { p.hidden = p.dataset.rpanel !== nombre; });
    if (nombre !== "inicio") { this.togglePalette(false); this.togglePaletteLetra(false); }
  },

  /* ---- Color de la letra (como el botón «A» de Word) ---- */
  togglePaletteLetra(force) {
    const p = $("#palette-letra");
    const show = force ?? p.hidden;
    if (show) { this.togglePalette(false); this.pintarLeyenda(); }
    p.hidden = !show;
    $('#toolbar button[data-cmd="letra"]').setAttribute("aria-expanded", String(show));
    if (show) this.paintPaletteLetra();
  },
  /** Color de letra donde está el cursor: "rojo", "azul", "verde", "naranja" o null. */
  letraActual() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    let n = sel.anchorNode;
    if (n && n.nodeType === 3) n = n.parentElement;
    for (; n && n !== this.area && this.area.contains(n); n = n.parentElement) {
      let c;
      if (n.style && n.style.color) c = claseDeLetra(n.style.color); // un color neutro explícito = sin color
      else if (n.tagName === "FONT" && n.getAttribute("color")) c = claseDeLetra(n.getAttribute("color"));
      else if (!(c = claseLetraValida(n.getAttribute("class")))) continue;
      return c ? c.slice(2) : null;
    }
    return null;
  },
  paintPaletteLetra() {
    const actual = this.letraActual();
    $$("#palette-letra [data-letra]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.letra === actual)));
  },
  /** Pone el color con la orden del navegador (así «deshacer» funciona); al guardar pasa a <span class="t-…">. */
  aplicarLetra(id) {
    this.area.focus();
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    if (sel.isCollapsed) { toast("Selecciona primero el texto que quieres poner de color."); return; }
    const css = getComputedStyle(document.documentElement);
    const color = (id === "quitar" ? css.getPropertyValue("--text") : css.getPropertyValue("--t-" + id)).trim();
    if (!color) return;
    document.execCommand("styleWithCSS", false, true);
    document.execCommand("foreColor", false, color);
    document.execCommand("styleWithCSS", false, false);
    if (id !== "quitar") { settings.letraColor = id; saveSettings(); }
    this.markDirty();
    this.paintToolbar();
  },
  quitarLetraEnSeleccion() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    $$("span, font", this.area).forEach((n) => {
      if (!range.intersectsNode(n)) return;
      if (n.style && n.style.color) n.style.color = "";
      if (n.tagName === "FONT") n.removeAttribute("color");
      const k = claseLetraValida(n.getAttribute("class"));
      if (k) n.classList.remove(k);
      if (!n.getAttribute("class")) n.removeAttribute("class");
      if (!n.getAttribute("style")) n.removeAttribute("style");
      if (!n.attributes.length) n.replaceWith(...n.childNodes);
    });
  },

  /* ---- Insertar ---- */
  /** El bloque de primer nivel donde está el cursor (o null). */
  bloqueDelCursor() {
    const sel = window.getSelection();
    let n = sel && sel.rangeCount ? sel.anchorNode : null;
    if (!n || !this.area.contains(n)) return null;
    while (n && n.parentNode !== this.area) n = n.parentNode;
    return n && n.nodeType === 1 ? n : null;
  },
  /** El título de la parte en la que está el cursor (el mismo bloque si es un título). */
  tituloDelCursor() {
    const b = this.bloqueDelCursor();
    if (!b) return null;
    if (/^H[1-4]$/.test(b.tagName)) return b;
    const nivel = nivelDeCorte([...this.area.children].map((x) => ({ tag: x.tagName }))) || 2;
    for (let p = b.previousElementSibling; p; p = p.previousElementSibling) {
      const m = /^H([1-4])$/.exec(p.tagName);
      if (m && Number(m[1]) <= nivel) return p;
    }
    return null;
  },
  insertarPausa() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !this.area.contains(sel.anchorNode)) { toast("Pon el cursor donde quieres la pausa."); return; }
    this.area.focus();
    const n = sel.anchorNode, o = sel.anchorOffset;
    const antes = n.nodeType === 3 ? n.data.slice(0, o) : "";
    document.execCommand("insertText", false, (antes && !/\s$/.test(antes) ? " " : "") + "‖ ");
    this.markDirty();
  },
  /** Parte nueva: un título con sus minutos después del párrafo donde está el cursor. */
  parteNueva() {
    const nivel = nivelDeCorte([...this.area.children].map((x) => ({ tag: x.tagName }))) || 2;
    const tag = "H" + Math.max(2, nivel);
    let minutos = 2;
    const titulo = el("input", { type: "text", placeholder: "Título de la parte (p. ej. Punto 2)", autocomplete: "off" });
    const chips = el("div", { class: "chips" }, [0, 1, 2, 3, 5, 8, 10].map((m) => {
      const b = el("button", { class: "chip", "aria-pressed": String(m === minutos), text: m ? `${m} min` : "Sin minutos" });
      b.addEventListener("click", () => { minutos = m; $$(".chip", chips).forEach((c) => c.setAttribute("aria-pressed", String(c === b))); });
      return b;
    }));
    const ref = this.bloqueDelCursor();
    const insertar = () => {
      const t = titulo.value.trim() || "Nueva parte";
      const h = document.createElement(tag);
      h.textContent = minutos ? `${t} (${minutos} min)` : t;
      const p = document.createElement("p");
      p.innerHTML = "<br>";
      if (ref && ref.parentNode === this.area) ref.after(h, p); else this.area.append(h, p);
      closeSheet();
      this.area.focus();
      const r = document.createRange(); r.setStart(p, 0); r.collapse(true);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
      h.scrollIntoView({ block: "center" });
      this.markDirty();
    };
    titulo.addEventListener("keydown", (e) => { if (e.key === "Enter") insertar(); });
    openSheet([
      el("h2", { text: "Parte nueva" }),
      titulo,
      el("div", { class: "group" }, el("span", { class: "label", text: "Minutos de esta parte" }), chips),
      el("p", { class: "small-print", text: "Se añade después del párrafo donde tienes el cursor. Con los minutos, el cronómetro te dirá si vas adelantado o retrasado en cada parte." }),
      el("div", { class: "actions" },
        el("button", { class: "action primary", text: "Insertar", onclick: insertar }),
        el("button", { class: "action plain", text: "Cancelar", onclick: () => closeSheet() })),
    ]);
    setTimeout(() => titulo.focus(), 60);
  },
  /** Pone o cambia los minutos «(N min)» del título de la parte donde está el cursor. */
  minutosParte() {
    const h = this.tituloDelCursor();
    if (!h) { toast("Pon el cursor en una parte del discurso (en su título o en su texto)."); return; }
    const nombre = tituloSinMinutos(h.textContent || "") || "esta parte";
    const actual = minutosDeTitulo(h.textContent || "");
    const poner = (n) => {
      const w = document.createTreeWalker(h, NodeFilter.SHOW_TEXT);
      let ult = null;
      for (let t = w.nextNode(); t; t = w.nextNode()) if (t.textContent.trim()) ult = t;
      const limpio = (x) => x.replace(/\s*\(\s*\d{1,3}(?:[.,]\d)?\s*(?:min|mins|minutos?)\.?\s*\)\s*$/i, "").replace(/\s*[—–-]\s*\d{1,3}(?:[.,]\d)?\s*(?:min|mins|minutos?)\.?\s*$/i, "");
      if (ult) ult.textContent = limpio(ult.textContent).replace(/\s+$/, "") + (n ? ` (${n} min)` : "");
      else if (n) h.append(` (${n} min)`);
      closeSheet();
      this.markDirty();
      this.pintarTiempo();
      this.lateral.rellenar();
      toast(n ? `«${nombre}»: ${n} min.` : `«${nombre}» ya no tiene minutos.`);
    };
    const num = el("input", { type: "number", inputmode: "numeric", min: 1, max: 120, step: 1, class: "num-input", value: actual || "", placeholder: "—", "aria-label": "Minutos" });
    num.addEventListener("keydown", (e) => { if (e.key === "Enter" && Number(num.value) > 0) poner(Math.round(Number(num.value))); });
    openSheet([
      el("h2", { text: `Minutos de «${nombre}»` }),
      el("div", { class: "chips" }, [1, 2, 3, 4, 5, 8, 10, 15].map((m) =>
        el("button", { class: "chip", "aria-pressed": String(actual === m), text: `${m} min`, onclick: () => poner(m) }))),
      el("div", { class: "size-row" }, num, el("span", { class: "unit", text: "min" }),
        el("button", { class: "chip", text: "Poner", onclick: () => { if (Number(num.value) > 0) poner(Math.round(Number(num.value))); } }),
        actual ? el("button", { class: "chip", text: "Quitar", onclick: () => poner(0) }) : null),
      el("p", { class: "small-print", text: "Se escribe al final del título, «(5 min)», como en el Word: así funciona también si lo abres en el PC." }),
      el("div", { class: "actions" }, el("button", { class: "action plain", text: "Cancelar", onclick: () => closeSheet() })),
    ]);
  },

  /** Pone el HTML en el editor; los dibujos son bloques que no se editan como texto (se tocan para cambiarlos). */
  ponerHtml(html) {
    this.area.innerHTML = html;
    this.area.querySelectorAll("figure.dibujo").forEach((f) => f.setAttribute("contenteditable", "false"));
  },

  /* ---- Dibujos y escritura a mano ---- */
  async lienzo(opciones) {
    try {
      const { abrirLienzo } = await import("./lienzo.js");
      abrirLienzo({ confirmar: confirmDialog, icono: icon, ...opciones });
    } catch (e) { console.error(e); toast("No se pudo abrir el dibujo. Inténtalo de nuevo."); }
  },
  /** Dibujo nuevo: después del párrafo donde está el cursor (o al final). */
  nuevoDibujo() {
    const ref = this.bloqueDelCursor();
    this.lienzo({
      titulo: "Dibujo o escritura a mano",
      alGuardar: (d) => {
        const f = figuraDibujo(d);
        f.setAttribute("contenteditable", "false");
        if (ref && ref.parentNode === this.area) ref.after(f); else this.area.append(f);
        if (!f.nextElementSibling) { const p = document.createElement("p"); p.innerHTML = "<br>"; f.after(p); }
        // Si el párrafo donde estaba el cursor estaba vacío, el dibujo ocupa su sitio
        if (ref && ref.tagName === "P" && !ref.textContent.trim() && !ref.querySelector("img")) ref.remove();
        f.scrollIntoView({ block: "nearest" });
        this.markDirty();
      },
    });
  },
  editarDibujo(f) {
    const datos = limpiarDibujo(f.getAttribute("data-dibujo"));
    if (!datos) return;
    this.lienzo({
      datos, titulo: "Dibujo o escritura a mano",
      alGuardar: (d) => { const nf = figuraDibujo(d); nf.setAttribute("contenteditable", "false"); f.replaceWith(nf); this.markDirty(); },
      alQuitar: () => {
        const antes = this.area.innerHTML;
        f.remove();
        this.markDirty();
        toast("Dibujo quitado.", { action: "Deshacer", ms: 6000, onAction: () => { this.area.innerHTML = antes; this.markDirty(); } });
      },
    });
  },

  /* ---- Dictar (con el micrófono del teclado del iPad) ---- */
  dictar() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !this.area.contains(sel.anchorNode)) {
      // Cursor al final del texto
      const ult = [...this.area.children].reverse().find((b) => b.tagName !== "FIGURE") || this.area;
      const r = document.createRange();
      r.selectNodeContents(ult); r.collapse(false);
      sel.removeAllRanges(); sel.addRange(r);
    }
    this.area.focus();
    $("#dictado-ayuda").hidden = false;
  },

  /* ---- Versiones anteriores ---- */
  async abrirVersiones() {
    await this.flush();
    abrirVersiones(this.kind, this.id, {
      alRecuperar: async (nuevo) => {
        this.item = nuevo; this.original = nuevo; this.versionHecha = false;
        this.titleInput.value = nuevo.title || "";
        this.ponerHtml(nuevo.html);
        this.pintarTiempo();
        this.lateral.rellenar();
      },
    });
  },

  /** Paleta del resaltador (debajo de la barra). */
  togglePalette(force) {
    const p = $("#palette");
    const show = force ?? p.hidden;
    if (show) { this.togglePaletteLetra(false); this.pintarLeyenda(); }
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

  /** Pone debajo de cada color de las paletas lo que significa (si se ha elegido). */
  pintarLeyenda() {
    for (const [sel, tipo, attr, lista] of [["#palette", "m", "color", COLORES], ["#palette-letra", "l", "letra", LETRAS]]) {
      const pal = $(sel);
      let alguno = false;
      for (const c of lista) {
        const b = pal.querySelector(`[data-${attr}="${c.id}"]`);
        const nombre = significado(tipo, c.id);
        if (nombre) alguno = true;
        b.setAttribute("aria-label", nombre ? `${c.nombre}: ${nombre}` : c.nombre);
        let cap = b.querySelector(".sw-nombre");
        if (!cap) { cap = el("span", { class: "sw-nombre" }); b.append(cap); }
        cap.textContent = nombre;
      }
      pal.classList.toggle("con-leyenda", alguno);
    }
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
      strike: state("strikeThrough"),
      h1: block === "h1", h2: block === "h2", h3: block === "h3", p: block === "p" || block === "div", highlight: !!this.selectionMark(),
      letra: !!this.letraActual(),
    };
    $$("#toolbar button[data-cmd]").forEach((b) => b.classList.toggle("active", !!map[b.dataset.cmd]));
    if (!$("#palette").hidden) this.paintPalette();
    if (!$("#palette-letra").hidden) this.paintPaletteLetra();
    $("#barra-letra").className = "barra-letra l-" + (this.letraActual() || settings.letraColor || "rojo");
    this.pintarSeleccion();
  },

  init() {
    this.saveLater = debounce(() => this.save(), 700);
    this.tiempoLater = debounce(() => { this.pintarTiempo(); this.lateral.rellenar(); }, 400);
    // Panel de navegación (iPad en horizontal)
    const sideList = $("#editor-side-list");
    const navBtn = $('#view-editor [data-cmd="navegacion"]');
    this.lateral = crearPanel({
      aside: $("#editor-side"), lista: sideList, ajuste: "panelEditor", scrollEl: this.scrollEl, contenido: this.area,
      rellenar: (out) => this.rellenarNavegacion(out),
      alCambiar: (v) => { navBtn.setAttribute("aria-pressed", String(v)); navBtn.classList.toggle("active", v); },
      util: () => this.kind === "docs" || !!this.area.querySelector("h1, h2, h3, h4"),
    });
    sideList.addEventListener("pointerdown", (e) => { if (e.target.closest(".o-item")) e.preventDefault(); }); // no quita el teclado
    sideList.addEventListener("click", (e) => {
      const it = e.target.closest(".o-item");
      if (!it) return;
      const m = e.target.closest(".nav-mover");
      if (m) this.moverParte(Number(it.dataset.i), Number(m.dataset.dir));
      else this.irABloque(Number(it.dataset.i));
    });
    $("#editor-side-close").addEventListener("click", () => this.lateral.alternar());
    let navRaf = 0;
    this.scrollEl.addEventListener("scroll", () => { if (!navRaf) navRaf = requestAnimationFrame(() => { navRaf = 0; this.lateral.pintarActual(); }); }, { passive: true });
    mqPanel.addEventListener("change", () => { if (currentView === "editor" && this.item) this.lateral.abrir(); });
    this.area.addEventListener("keydown", (e) => this.atajo(e));
    // Tocar un dibujo lo abre para cambiarlo
    this.area.addEventListener("click", (e) => { const f = e.target.closest && e.target.closest("figure.dibujo"); if (f && this.area.contains(f)) { e.preventDefault(); this.editarDibujo(f); } });
    $("#dictado-ok").addEventListener("click", () => { $("#dictado-ayuda").hidden = true; this.area.focus(); });
    $("#editor-time").addEventListener("click", () => this.abrirTiempo());
    $$(".ribbon-tabs [data-rtab]").forEach((t) => t.addEventListener("click", () => this.cinta(t.dataset.rtab)));
    $("#ed-menos").addEventListener("click", () => this.zoom(-2));
    $("#ed-mas").addEventListener("click", () => this.zoom(2));
    reemplazo.init();
    attachPinch(this.scrollEl, this.area);
    this.area.addEventListener("input", () => { this.markDirty(); if (reemplazo.abierto) reemplazo.despues(); });
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
    $$("#view-editor .ribbon button[data-cmd]").forEach((b) => {
      b.tabIndex = -1;
      b.addEventListener("pointerdown", (e) => e.preventDefault());
      b.addEventListener("mousedown", (e) => e.preventDefault());
      b.addEventListener("click", () => this.exec(b.dataset.cmd));
    });
    $$("#palette-letra button").forEach((b) => {
      b.tabIndex = -1;
      b.addEventListener("pointerdown", (e) => e.preventDefault());
      b.addEventListener("mousedown", (e) => e.preventDefault());
      b.addEventListener("click", () => { if (b.dataset.letra === "cerrar") this.togglePaletteLetra(false); else this.aplicarLetra(b.dataset.letra); });
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
    $("#editor-share").addEventListener("click", async () => { await this.flush(); abrirCompartir(this.kind, this.item); });
    $("#editor-more").addEventListener("click", async () => {
      await this.flush();
      const item = this.item;
      actionSheet(item.title, [
        { label: "Compartir (WhatsApp, correo…)", icon: "share", run: () => abrirCompartir(this.kind, item) },
        { label: "Guardar como Word", icon: "word", run: () => exportWord(this.kind, item) },
        { label: "Guardar como PDF", icon: "pdf", run: () => exportPdf(this.kind, item) },
        { label: "Tamaño de letra y tema", icon: "aa", run: () => openAaSheet() },
        { label: "Versiones anteriores", icon: "history", run: () => this.abrirVersiones() },
        { label: "Qué significa cada color", icon: "marker", run: () => abrirLeyenda() },
        { label: "Atajos de teclado", icon: "template", run: () => this.atajosHoja() },
        { label: "Guía de Atril", icon: "guia", run: () => abrirGuia("editar") },
        { label: "Eliminar", icon: "trash", danger: true, run: async () => { await deleteItem(this.kind, item); } },
      ]);
    });
  },
};

/* ============================================================
   Buscar y reemplazar (editor)
   ============================================================ */
const reemplazo = {
  abierto: false, rangos: [], i: 0,
  hayResaltado: () => !!(window.CSS && CSS.highlights && window.Highlight),
  abrir() {
    const sel = window.getSelection();
    const elegido = sel && sel.rangeCount && editor.area.contains(sel.anchorNode) ? String(sel).trim() : "";
    $("#replacebar").hidden = false;
    this.abierto = true;
    const q = $("#rep-buscar");
    if (elegido && elegido.length <= 80 && !elegido.includes("\n")) q.value = elegido;
    q.focus();
    q.select();
    this.buscar();
  },
  cerrar() {
    if (!this.abierto) return;
    this.abierto = false;
    $("#replacebar").hidden = true;
    this.limpiar();
    $("#rep-count").textContent = "";
  },
  limpiar() {
    if (this.hayResaltado()) { CSS.highlights.delete("rep"); CSS.highlights.delete("rep-actual"); }
    this.rangos = [];
  },
  buscar(mantener = false) {
    this.limpiar();
    const q = $("#rep-buscar").value;
    this.rangos = rangosCoincidencias(editor.area, q);
    const n = this.rangos.length;
    if (!n) { $("#rep-count").textContent = q.trim().length >= 2 ? "Sin resultados" : ""; return; }
    this.i = mantener ? Math.min(this.i, n - 1) : 0;
    if (!mantener) {
      // La primera coincidencia a la vista
      const top = editor.scrollEl.getBoundingClientRect().top;
      const k = this.rangos.findIndex((r) => r.getBoundingClientRect().top >= top);
      this.i = k < 0 ? 0 : k;
    }
    this.pintar();
  },
  pintar() {
    const n = this.rangos.length;
    if (!n) return;
    const r = this.rangos[this.i];
    if (this.hayResaltado()) {
      CSS.highlights.set("rep", new Highlight(...this.rangos));
      CSS.highlights.set("rep-actual", new Highlight(r));
    }
    const sr = editor.scrollEl.getBoundingClientRect();
    const rr = r.getBoundingClientRect();
    if (rr.top < sr.top + 20 || rr.bottom > sr.bottom - 20) editor.scrollEl.scrollTop += rr.top - sr.top - sr.height * 0.35;
    $("#rep-count").textContent = `${this.i + 1} de ${n}`;
  },
  ir(d) {
    const n = this.rangos.length;
    if (!n) { this.buscar(); return; }
    this.i = (this.i + d + n) % n;
    this.pintar();
  },
  /** Cambia un trozo por el texto nuevo, conservando el formato de donde empieza. */
  cambiar(r, texto) {
    r.deleteContents();
    if (texto) r.insertNode(document.createTextNode(texto));
  },
  uno() {
    if (!this.rangos.length) { this.buscar(); return; }
    const antes = editor.area.innerHTML;
    this.cambiar(this.rangos[this.i], $("#rep-por").value);
    editor.area.normalize();
    editor.markDirty();
    this.buscar(true);
    this.ofrecerDeshacer(antes, "Reemplazado.");
  },
  todo() {
    if (!this.rangos.length) this.buscar();
    const n = this.rangos.length;
    if (!n) return;
    const antes = editor.area.innerHTML;
    const texto = $("#rep-por").value;
    for (const r of [...this.rangos].reverse()) this.cambiar(r, texto);
    editor.area.normalize();
    editor.markDirty();
    this.buscar();
    this.ofrecerDeshacer(antes, n === 1 ? "Se ha reemplazado 1 vez." : `Se ha reemplazado ${n} veces.`);
  },
  ofrecerDeshacer(antes, texto) {
    toast(texto, { action: "Deshacer", ms: 6000, onAction: () => { editor.area.innerHTML = antes; editor.markDirty(); if (this.abierto) this.buscar(true); } });
  },
  despues: debounce(() => { if (reemplazo.abierto) reemplazo.buscar(true); }, 300),
  init() {
    const q = $("#rep-buscar");
    const later = debounce(() => this.buscar(), 220);
    q.addEventListener("input", later);
    q.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); later.cancel(); if (!this.rangos.length) this.buscar(); else this.ir(e.shiftKey ? -1 : 1); }
      else if (e.key === "Escape") this.cerrar();
    });
    $("#rep-por").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); this.uno(); } else if (e.key === "Escape") this.cerrar(); });
    $("#rep-next").addEventListener("click", () => this.ir(1));
    $("#rep-prev").addEventListener("click", () => this.ir(-1));
    $("#rep-uno").addEventListener("click", () => this.uno());
    $("#rep-todo").addEventListener("click", () => this.todo());
    $("#rep-close").addEventListener("click", () => this.cerrar());
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
  $("#btn-guia").addEventListener("click", () => abrirGuia());
  $("#guia-hint-ver").addEventListener("click", () => abrirGuia());
  $("#guia-hint-no").addEventListener("click", () => { lsSet("atril.guiaVista", "1"); $("#guia-hint").hidden = true; });
  $("#hide-install-hint").addEventListener("click", () => { lsSet("atril.hideInstall", "1"); $("#install-hint").hidden = true; });
  $("#backup-now").addEventListener("click", () => exportBackup());
  $("#backup-later").addEventListener("click", () => { lsSet("atril.copiaLuego", String(Date.now() + 3 * DIA)); $("#backup-hint").hidden = true; });
  $("#file-input").addEventListener("change", (e) => { const f = e.target.files; importFiles(f).finally(() => { e.target.value = ""; }); });
  $("#backup-input").addEventListener("change", (e) => { const f = e.target.files && e.target.files[0]; if (f) importBackup(f).finally(() => { e.target.value = ""; }); });

  reader.init();
  buscador.init();
  tarjetas.init();
  prompter.init();
  presentar.init();
  editor.init();

  window.addEventListener("hashchange", route);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && currentView === "reader") keepAwake(true);
    if (document.visibilityState === "hidden") { if (currentView === "editor") editor.flush(); if (currentView === "reader") { reader.savePos(); sesion.guardar(); } }
  });
  window.addEventListener("pagehide", () => { if (currentView === "editor") editor.flush(); if (currentView === "reader") sesion.guardar(); });

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
  setTimeout(limpiarVersiones, 9000);

  // ¿Se cerró la app en medio de un discurso? Se vuelve directamente a él
  const pend = sesion.pendiente();
  const h = location.hash || "#/";
  const suyo = pend && `#/leer/${pend.kind}/${pend.id}`;
  if (pend && (h === "#/" || h === "#" || h === suyo)) {
    sesionARestaurar = pend;
    if (h !== suyo) history.replaceState(null, "", suyo);
  }
  route();
  registerSW();
}

/** «20261109-336d0a44» → «del 9 de noviembre de 2026». */
function fechaDeVersion(v) {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(v || "");
  if (!m) return "";
  return "del " + new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

let actualizandoAMano = false;
async function recargarConLoNuevo() { if (currentView === "editor") await editor.flush(); location.reload(); }

/** Ajustes → «Buscar actualizaciones»: mira la versión publicada y, si es otra, la instala y recarga. */
async function buscarActualizaciones(boton) {
  if (!navigator.onLine) { toast("Sin conexión. Conéctate a internet para buscar actualizaciones."); return; }
  const span = boton && boton.querySelector("span");
  const poner = (t) => { if (span) span.textContent = t; };
  if (boton) boton.disabled = true;
  poner("Buscando…");
  try {
    const sw = await fetch("sw.js?comprobar=" + Date.now(), { cache: "no-store" }).then((r) => r.text());
    const publicada = (/const VERSION = "([^"]+)"/.exec(sw) || [])[1];
    if (!publicada || publicada === APP_VERSION) { toast("Ya tienes la última versión de Atril."); return; }
    poner("Actualizando…");
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (!reg) { await recargarConLoNuevo(); return; }
    actualizandoAMano = true;
    await reg.update();
    // Cuando la versión nueva toma el control, se recarga (y si tarda, se recarga igual)
    setTimeout(() => { if (actualizandoAMano) recargarConLoNuevo(); }, 15000);
  } catch (e) {
    console.warn(e);
    toast("No se pudo comprobar. Inténtalo más tarde.");
  } finally {
    if (!actualizandoAMano) { if (boton) boton.disabled = false; poner("Buscar actualizaciones"); }
  }
}

function registerSW() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  // La primera vez que el service worker toma el control no hay nada que actualizar
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register("sw.js").catch((e) => console.warn("SW", e));
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController) { hadController = true; return; }
    if (actualizandoAMano) { actualizandoAMano = false; recargarConLoNuevo(); return; }
    toast("Hay una versión nueva de Atril.", { action: "Actualizar", onAction: recargarConLoNuevo, ms: 10000 });
  });
  // En el iPad la app se queda abierta días: al volver a ella, mira si hay versión nueva (como mucho cada 6 h)
  let ultimaVez = Date.now();
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState !== "visible" || Date.now() - ultimaVez < 6 * 3600 * 1000 || !navigator.onLine) return;
    ultimaVez = Date.now();
    try { const reg = await navigator.serviceWorker.getRegistration(); if (reg) await reg.update(); } catch {}
  });
}

init();

// Exportado para las pruebas automáticas
window.__atril = {
  sanitize, htmlToText, textToHtml, store, settings: () => settings, setFontSize, importFiles, exportWord, crearPdf,
  timer, reader, editor, ensayo, buscador, tarjetas, prompter, crearPlantilla, abrirDado, pintarAvisoCopia, reemplazo, presentar, sesion, textoParaCompartir, abrirCompartir, abrirGuia,
};
