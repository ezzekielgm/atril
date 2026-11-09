// Dibujos y escritura a mano (Apple Pencil o dedo) dentro de los documentos.
// En el HTML: <figure class="dibujo" data-dibujo='{"w":1000,"h":600,"t":[…]}'><svg …>…</svg></figure>
// Lo que manda son los datos (`data-dibujo`): el SVG se vuelve a generar siempre a partir de ellos, así que
// del HTML que entra nunca se guarda ningún SVG ajeno.
// Trazo: {c: color, h: "b" (bolígrafo) | "r" (rotulador), s: grosor, q: 1 si trae presión real (lápiz), p: [x, y, presión 0–100, …]}
import { getStroke } from "perfect-freehand";

export const ANCHO = 1000;
export const TINTAS = {
  b: ["negro", "azul", "rojo", "verde"],
  r: ["amarillo", "verde", "azul", "rosa"],
};
// Colores fijos para el Word y el PDF (en pantalla cada tema tiene los suyos, en styles.css)
const HEX = {
  b: { negro: "#201F1E", azul: "#0070C0", rojo: "#C00000", verde: "#00873C" },
  r: { amarillo: "#FFE14D", verde: "#7BE495", azul: "#7CCBF5", rosa: "#F7A1C4" },
};
const MAX_TRAZOS = 800, MAX_PUNTOS = 3000;

/** Datos de un dibujo limpios y con sus límites, o null si no valen. Acepta el objeto o el texto JSON. */
export function limpiarDibujo(entrada) {
  let d = entrada;
  if (typeof d === "string") { try { d = JSON.parse(d); } catch { return null; } }
  if (!d || typeof d !== "object" || !Array.isArray(d.t)) return null;
  const h = Math.round(Math.min(4000, Math.max(120, Number(d.h) || 600)));
  const t = [];
  for (const x of d.t.slice(0, MAX_TRAZOS)) {
    if (!x || typeof x !== "object") continue;
    const tipo = x.h === "r" ? "r" : "b";
    const c = TINTAS[tipo].includes(x.c) ? x.c : TINTAS[tipo][0];
    const s = Math.round(Math.min(60, Math.max(1, Number(x.s) || (tipo === "r" ? 24 : 4))) * 10) / 10;
    const p = [];
    const src = Array.isArray(x.p) ? x.p.slice(0, MAX_PUNTOS * 3) : [];
    for (let i = 0; i + 2 < src.length; i += 3) {
      const px = Math.round(Number(src[i])), py = Math.round(Number(src[i + 1])), pr = Math.round(Number(src[i + 2]));
      if (![px, py, pr].every(Number.isFinite)) continue;
      p.push(Math.min(ANCHO, Math.max(0, px)), Math.min(h, Math.max(0, py)), Math.min(100, Math.max(0, pr)));
    }
    if (p.length >= 3) t.push({ c, h: tipo, s, q: x.q ? 1 : 0, p });
  }
  return { w: ANCHO, h, t };
}

const media = (a, b) => (a + b) / 2;
const n1 = (v) => (Math.round(v * 10) / 10).toString();
/** El contorno de perfect-freehand como «d» de un path de SVG (curvas suaves). */
function svgDeContorno(puntos) {
  const len = puntos.length;
  if (len < 4) return "";
  let a = puntos[0], b = puntos[1];
  const c = puntos[2];
  let d = `M${n1(a[0])},${n1(a[1])} Q${n1(b[0])},${n1(b[1])} ${n1(media(b[0], c[0]))},${n1(media(b[1], c[1]))} T`;
  for (let i = 2; i < len - 1; i++) { a = puntos[i]; b = puntos[i + 1]; d += `${n1(media(a[0], b[0]))},${n1(media(a[1], b[1]))} `; }
  return d + "Z";
}

/** «d» del trazo: con presión del lápiz, el bolígrafo engorda al apretar; el rotulador es de grosor fijo. */
export function pathDe(tr, { ultimo = true } = {}) {
  const pts = [];
  for (let i = 0; i + 2 < tr.p.length; i += 3) pts.push([tr.p[i], tr.p[i + 1], tr.p[i + 2] / 100]);
  const rotu = tr.h === "r";
  const contorno = getStroke(pts, {
    size: tr.s,
    thinning: rotu ? 0 : 0.6,
    smoothing: 0.55,
    streamline: rotu ? 0.6 : 0.4,
    simulatePressure: !rotu && !tr.q,
    last: ultimo,
    start: { cap: true },
    end: { cap: true },
  });
  return svgDeContorno(contorno);
}
export const claseDe = (tr) => `k-${tr.c}${tr.h === "r" ? " rotu" : ""}`;

/** El <svg> del dibujo (texto). Con `colores: true` lleva los colores fijos (para Word y PDF). */
export function svgDibujo(d, { colores = false, fondo = "" } = {}) {
  // Los rotuladores debajo de la tinta, como en papel
  const orden = [...d.t.filter((tr) => tr.h === "r"), ...d.t.filter((tr) => tr.h !== "r")];
  const paths = orden.map((tr) => {
    const dd = pathDe(tr);
    if (!dd) return "";
    if (!colores) return `<path class="${claseDe(tr)}" d="${dd}"/>`;
    const op = tr.h === "r" ? ' fill-opacity="0.55"' : "";
    return `<path fill="${HEX[tr.h][tr.c]}"${op} d="${dd}"/>`;
  }).join("");
  const extra = colores ? ` xmlns="http://www.w3.org/2000/svg" width="${d.w}" height="${d.h}"` : ' role="img" aria-label="Dibujo"';
  const bg = fondo ? `<rect width="100%" height="100%" fill="${fondo}"/>` : "";
  return `<svg viewBox="0 0 ${d.w} ${d.h}"${extra}>${bg}${paths}</svg>`;
}

/** El <figure> del dibujo (elemento, del documento indicado). */
export function figuraDibujo(d, doc = document) {
  const f = doc.createElement("figure");
  f.className = "dibujo";
  f.setAttribute("data-dibujo", JSON.stringify(d));
  f.innerHTML = svgDibujo(d);
  return f;
}
