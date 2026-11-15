// Colores de la letra al abrir un Word. mammoth no lee el color de la letra, así que antes de convertir
// se marca el texto de cada trozo con color en el XML con caracteres privados (U+E101…U+E104 al principio,
// U+E1FF al final) y después se cambian por <span class="t-rojo|t-azul|t-verde|t-naranja">.
// También la alineación y la sangría de cada párrafo (mammoth tampoco las lee): una marca al principio
// del párrafo (U+E201…E203 alineación, U+E211…E214 sangría) que ponerColores() cambia por clases (formato.js).
// Se carga solo al abrir un Word.
import JSZip from "jszip";
import { claseDeLetra, LETRAS } from "./colores.js";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const ABRE = 0xe101;
const CIERRA = "";
const MARCAS = /[\ue100-\ue2ff]/g;

const hijo = (el, nombre) => [...el.childNodes].find((x) => x.nodeType === 1 && x.localName === nombre && x.namespaceURI === W);

const ALINEA = { center: 0xe201, right: 0xe202, both: 0xe203, distribute: 0xe203 };
const CLASE_ALINEA = { 0xe201: "al-centro", 0xe202: "al-derecha", 0xe203: "al-justificar" };
const SANGRIA = 0xe210; // + nivel (1…4)
const MARCA_PARRAFO = /^[\ue201-\ue203\ue211-\ue214]+/;

/** Marca la alineación y la sangría de los párrafos (no las de las listas, que ya tienen la suya). */
function marcarParrafos(doc) {
  let n = 0;
  for (const p of doc.getElementsByTagNameNS(W, "p")) {
    const pPr = hijo(p, "pPr");
    if (!pPr || hijo(pPr, "numPr")) continue;
    let marca = "";
    const jc = hijo(pPr, "jc");
    const v = jc && (jc.getAttributeNS(W, "val") || jc.getAttribute("w:val"));
    if (ALINEA[v]) marca += String.fromCharCode(ALINEA[v]);
    const ind = hijo(pPr, "ind");
    const izq = ind && Number(ind.getAttributeNS(W, "left") || ind.getAttribute("w:left") || ind.getAttributeNS(W, "start") || ind.getAttribute("w:start") || 0);
    const nivel = izq >= 360 ? Math.min(4, Math.max(1, Math.round(izq / 720))) : 0; // 720 = 1,27 cm, una sangría de Word
    if (nivel) marca += String.fromCharCode(SANGRIA + nivel);
    if (!marca) continue;
    const t = p.getElementsByTagNameNS(W, "t")[0];
    if (!t) continue;
    t.textContent = marca + t.textContent;
    n++;
  }
  return n;
}

/** Cambia las marcas de párrafo por clases de alineación y sangría. */
function ponerParrafos(doc) {
  for (const b of doc.body.querySelectorAll("p, h1, h2, h3, h4")) {
    const w = doc.createTreeWalker(b, NodeFilter.SHOW_TEXT);
    const t = w.nextNode();
    const m = t && MARCA_PARRAFO.exec(t.data);
    if (!m) continue;
    t.data = t.data.slice(m[0].length);
    const clases = [];
    for (const ch of m[0]) {
      const c = ch.charCodeAt(0);
      if (CLASE_ALINEA[c]) clases.push(CLASE_ALINEA[c]);
      else clases.push("sang-" + (c - SANGRIA));
    }
    b.className = clases.join(" ");
  }
}

/** Devuelve el .docx con el texto de color marcado (o el mismo si no hay colores o algo falla). */
export async function marcarColores(arrayBuffer) {
  let zip;
  try { zip = await JSZip.loadAsync(arrayBuffer); } catch { return arrayBuffer; }
  const f = zip.file("word/document.xml");
  if (!f) return arrayBuffer;
  const xml = await f.async("string");
  if (!/w:color|w:jc|w:ind/.test(xml)) return arrayBuffer;
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) return arrayBuffer;
  let n = marcarParrafos(doc);
  for (const r of doc.getElementsByTagNameNS(W, "r")) {
    const rPr = hijo(r, "rPr");
    const c = rPr && hijo(rPr, "color");
    if (!c) continue;
    const val = c.getAttributeNS(W, "val") || c.getAttribute("w:val") || "";
    if (!/^[0-9a-f]{6}$/i.test(val)) continue; // "auto" = color normal
    const k = LETRAS.findIndex((l) => l.clase === claseDeLetra("#" + val));
    if (k < 0) continue;
    for (const t of r.getElementsByTagNameNS(W, "t")) {
      if (!t.textContent) continue;
      t.textContent = String.fromCharCode(ABRE + k) + t.textContent + CIERRA;
      n++;
    }
  }
  if (!n) return arrayBuffer;
  zip.file("word/document.xml", new XMLSerializer().serializeToString(doc));
  return zip.generateAsync({ type: "arraybuffer" });
}

/** Cambia las marcas del HTML de mammoth por <span class="t-…">; las sueltas se quitan. */
export function ponerColores(html) {
  if (!/[\ue100-\ue2ff]/.test(html)) return html;
  const doc = new DOMParser().parseFromString(`<!DOCTYPE html><body>${html}</body>`, "text/html");
  ponerParrafos(doc);
  const w = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const nodos = [];
  for (let t = w.nextNode(); t; t = w.nextNode()) if (/[-]/.test(t.data)) nodos.push(t);
  const re = /([-])([^-]*)/g;
  for (const t of nodos) {
    const s = t.data;
    const frag = doc.createDocumentFragment();
    let ultimo = 0;
    for (const m of s.matchAll(re)) {
      if (m.index > ultimo) frag.append(s.slice(ultimo, m.index).replace(MARCAS, ""));
      const span = doc.createElement("span");
      span.className = LETRAS[m[1].charCodeAt(0) - ABRE].clase;
      span.textContent = m[2];
      frag.append(span);
      ultimo = m.index + m[0].length;
    }
    frag.append(s.slice(ultimo).replace(MARCAS, ""));
    t.replaceWith(frag);
  }
  // Marcas de párrafo sueltas (en sitios donde no cuentan, como un cuadro de texto)
  const w2 = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  for (let t = w2.nextNode(); t; t = w2.nextNode()) if (/[\ue200-\ue2ff]/.test(t.data)) t.data = t.data.replace(/[\ue200-\ue2ff]/g, "");
  return doc.body.innerHTML;
}
