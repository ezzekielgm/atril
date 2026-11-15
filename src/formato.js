// Formato al estilo de Word (a petición de Ezequiel: «todas las opciones que puedas de las herramientas de Word»):
// tamaño y tipo de letra de un trozo, alineación y sangría de un párrafo. En el documento se guardan como clases
// (span.tam-14, span.f-georgia, p.al-centro, p.sang-2) para que sanitize() las pueda comprobar; el editor los pone
// con execCommand (<font size>, <font face>, style="text-align") y sanitize() los convierte. Sin DOM: se usa
// también en docx-export.js y en las pruebas.

/** Tamaños de letra (en puntos, como en Word). 12 es el normal: no lleva clase. `n` = el de <font size>. */
export const TAMANOS = [
  { n: 1, pt: 8 }, { n: 2, pt: 10 }, { n: 3, pt: 12, normal: true }, { n: 4, pt: 14 },
  { n: 5, pt: 18 }, { n: 6, pt: 24 }, { n: 7, pt: 36 },
];
export const PT_NORMAL = 12;

/** Tipos de letra que se pueden elegir para un trozo. `word` = el nombre que lleva en el Word. */
export const FUENTES = [
  { clase: "f-calibri", nombre: "Como Word", css: '"Carlito", Calibri, sans-serif', word: "Calibri", buscar: /calibri|carlito/ },
  { clase: "f-literata", nombre: "Clásica", css: '"Literata", Georgia, serif', word: "Georgia", buscar: /literata/ },
  { clase: "f-arial", nombre: "Arial", css: "Arial, Helvetica, sans-serif", word: "Arial", buscar: /arial|helvetica/ },
  { clase: "f-georgia", nombre: "Georgia", css: "Georgia, serif", word: "Georgia", buscar: /georgia/ },
  { clase: "f-verdana", nombre: "Verdana", css: "Verdana, sans-serif", word: "Verdana", buscar: /verdana/ },
  { clase: "f-times", nombre: "Times New Roman", css: '"Times New Roman", Times, serif', word: "Times New Roman", buscar: /times/ },
];
/** Nombre especial para «la letra del documento» (quita el tipo de letra de un trozo). */
export const FUENTE_AUTO = "atril-auto";

export const ALINEACIONES = { center: "al-centro", right: "al-derecha", justify: "al-justificar" };
export const MAX_SANGRIA = 4;

const TAM_RE = /^tam-(8|10|14|18|24|36)$/;
const FUENTE_RE = new RegExp("^(" + FUENTES.map((f) => f.clase).join("|") + ")$");

export const claseTamanoValida = (c) => (TAM_RE.test(String(c || "").trim()) ? String(c).trim() : "");
export const claseFuenteValida = (c) => (FUENTE_RE.test(String(c || "").trim()) ? String(c).trim() : "");

/** Clase de tamaño para unos puntos: el más cercano de la lista; el normal (12) es «tam-auto». */
export function claseDePuntos(pt) {
  if (!(pt > 0)) return "";
  let mejor = TAMANOS[0];
  for (const t of TAMANOS) if (Math.abs(t.pt - pt) < Math.abs(mejor.pt - pt) || (Math.abs(t.pt - pt) === Math.abs(mejor.pt - pt) && t.normal)) mejor = t;
  return mejor.normal ? "tam-auto" : "tam-" + mejor.pt;
}
/** De <font size="5"> o de un estilo «font-size: 18pt / 24px». Las medidas relativas (em, %) no cuentan. */
export function claseDeTamano({ size, css } = {}) {
  if (size != null && size !== "") {
    const n = Number(String(size).trim());
    const t = TAMANOS.find((x) => x.n === n);
    return t ? (t.normal ? "tam-auto" : "tam-" + t.pt) : "";
  }
  const m = /^([\d.]+)\s*(pt|px)$/i.exec(String(css || "").trim());
  if (!m) return "";
  return claseDePuntos(m[2].toLowerCase() === "px" ? Number(m[1]) * 0.75 : Number(m[1]));
}
/** De <font face="Georgia"> o «font-family: Georgia, serif». */
export function claseDeFuente(familia) {
  const f = String(familia || "").toLowerCase().replace(/["']/g, "");
  if (!f) return "";
  if (f.includes(FUENTE_AUTO)) return "f-auto";
  const primera = f.split(",")[0].trim();
  const x = FUENTES.find((y) => y.buscar.test(primera));
  return x ? x.clase : "";
}
export const puntosDeClase = (c) => { const m = /^tam-(\d+)$/.exec(c || ""); return m ? Number(m[1]) : PT_NORMAL; };

/** Clases de párrafo que se conservan: alineación (una) y sangría (una). */
export function clasesDeBloque(clase, textAlign) {
  const tokens = String(clase || "").split(/\s+/);
  let al = tokens.find((t) => /^al-(centro|derecha|justificar)$/.test(t)) || "";
  const ta = String(textAlign || "").trim().toLowerCase();
  if (ta) al = ALINEACIONES[ta] || ""; // el estilo manda (lo acaba de poner el editor); «left» quita la alineación
  const s = tokens.map((t) => /^sang-([1-9])$/.exec(t)).find(Boolean);
  const sang = s ? "sang-" + Math.min(MAX_SANGRIA, Number(s[1])) : "";
  return [al, sang].filter(Boolean).join(" ");
}

/** Hoja de estilo para el Word (docx/html la entiende): tamaños en puntos, letras, alineación y sangría. */
export function cssParaWord() {
  return [
    ...TAMANOS.filter((t) => !t.normal).map((t) => `span.tam-${t.pt} { font-size: ${t.pt}pt; }`),
    ...FUENTES.map((f) => `span.${f.clase} { font-family: "${f.word}"; }`),
    ".al-centro { text-align: center; } .al-derecha { text-align: right; } .al-justificar { text-align: justify; }",
    ...Array.from({ length: MAX_SANGRIA }, (_, i) => `.sang-${i + 1} { margin-left: ${36 * (i + 1)}pt; }`),
  ].join(" ");
}
