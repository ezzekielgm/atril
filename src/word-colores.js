// Colores de la letra al abrir un Word. mammoth no lee el color de la letra, así que antes de convertir
// se marca el texto de cada trozo con color en el XML con caracteres privados (U+E101…U+E104 al principio,
// U+E1FF al final) y después se cambian por <span class="t-rojo|t-azul|t-verde|t-naranja">.
// Se carga solo al abrir un Word.
import JSZip from "jszip";
import { claseDeLetra, LETRAS } from "./colores.js";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const ABRE = 0xe101;
const CIERRA = "";
const MARCAS = /[-]/g;

const hijo = (el, nombre) => [...el.childNodes].find((x) => x.nodeType === 1 && x.localName === nombre && x.namespaceURI === W);

/** Devuelve el .docx con el texto de color marcado (o el mismo si no hay colores o algo falla). */
export async function marcarColores(arrayBuffer) {
  let zip;
  try { zip = await JSZip.loadAsync(arrayBuffer); } catch { return arrayBuffer; }
  const f = zip.file("word/document.xml");
  if (!f) return arrayBuffer;
  const xml = await f.async("string");
  if (!xml.includes("w:color")) return arrayBuffer;
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) return arrayBuffer;
  let n = 0;
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
  if (!/[-]/.test(html)) return html;
  const doc = new DOMParser().parseFromString(`<!DOCTYPE html><body>${html}</body>`, "text/html");
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
  return doc.body.innerHTML;
}
