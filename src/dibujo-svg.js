// Dibujos y escritura a mano (Apple Pencil o dedo) dentro de los documentos.
// En el HTML: <figure class="dibujo" data-dibujo='{"w":1000,"h":600,"t":[…]}'><svg …>…</svg></figure>
// Lo que manda son los datos (`data-dibujo`): el SVG se vuelve a generar siempre a partir de ellos, así que
// del HTML que entra nunca se guarda ningún SVG ajeno.
// Trazo: {c: color, h: "b" (bolígrafo) | "r" (rotulador), s: grosor, q: 1 si trae presión real (lápiz), p: [x, y, presión 0–100, …]}
// Se pinta como una línea de bolígrafo (trazo redondo de grosor fijo) sobre los puntos suavizados: el lápiz da
// muchos puntos con un pequeño temblor, y dibujar el contorno punto a punto (como se hacía con perfect-freehand)
// dejaba los bordes «peludos», que en el iPad se veían borrosos (a petición de Ezequiel: «no se ve nada fina»).

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
      // Con un decimal: redondear a enteros metía escalones de medio punto que también se veían como temblor
      const px = Math.round(Number(src[i]) * 10) / 10, py = Math.round(Number(src[i + 1]) * 10) / 10, pr = Math.round(Number(src[i + 2]));
      if (![px, py, pr].every(Number.isFinite)) continue;
      p.push(Math.min(ANCHO, Math.max(0, px)), Math.min(h, Math.max(0, py)), Math.min(100, Math.max(0, pr)));
    }
    if (p.length >= 3) t.push({ c, h: tipo, s, q: x.q ? 1 : 0, p });
  }
  return { w: ANCHO, h, t };
}

const media = (a, b) => (a + b) / 2;
const n1 = (v) => (Math.round(v * 10) / 10).toString();
const MIN_DIST = 1.2; // en unidades del dibujo (1000 de ancho)

/** Los puntos del trazo sin los casi repetidos y suavizados (media 1-2-3-2-1) para quitar el temblor. */
export function puntosSuaves(tr) {
  const p = tr.p, crudos = [];
  for (let i = 0; i + 2 < p.length; i += 3) {
    const l = crudos[crudos.length - 1];
    if (!l || Math.hypot(l[0] - p[i], l[1] - p[i + 1]) >= MIN_DIST) crudos.push([p[i], p[i + 1]]);
  }
  // El último punto siempre (que la línea llegue hasta donde se levantó el lápiz)
  const n = p.length - (p.length % 3);
  if (n >= 6) {
    const ux = p[n - 3], uy = p[n - 2], l = crudos[crudos.length - 1];
    if (l && (l[0] !== ux || l[1] !== uy) && Math.hypot(l[0] - ux, l[1] - uy) > 0.3) crudos.push([ux, uy]);
  }
  if (crudos.length < 5) return crudos;
  const w = [1, 2, 3, 2, 1];
  return crudos.map((q, i) => {
    if (i < 2 || i > crudos.length - 3) return q;
    let x = 0, y = 0;
    for (let k = -2; k <= 2; k++) { x += crudos[i + k][0] * w[k + 2]; y += crudos[i + k][1] * w[k + 2]; }
    return [x / 9, y / 9];
  });
}

/**
 * Grosor de la línea. El bolígrafo, algo más fino que el número guardado (los de antes se veían gruesos) y, con
 * el lápiz, según cuánto se apretó de media en ese trazo (escribir suave = más fino), sin que varíe a mitad de trazo.
 */
export function anchoDe(tr) {
  if (tr.h === "r") return tr.s;
  let f = 1;
  if (tr.q) {
    let suma = 0, n = 0;
    for (let i = 2; i < tr.p.length; i += 3) { suma += tr.p[i]; n++; }
    if (n) f = 0.75 + 0.5 * Math.min(1, Math.max(0, suma / n / 100));
  }
  return Math.round(tr.s * 0.7 * f * 10) / 10;
}

/** «d» del trazo: curvas suaves que pasan por los puntos medios (como un bolígrafo). */
export function pathDe(tr) {
  const p = puntosSuaves(tr);
  if (!p.length) return "";
  const xy = (q) => `${n1(q[0])},${n1(q[1])}`;
  if (p.length === 1) return `M${xy(p[0])}l0.01,0`; // un punto
  let d = `M${xy(p[0])}`;
  for (let i = 1; i < p.length - 1; i++) d += `Q${xy(p[i])} ${n1(media(p[i][0], p[i + 1][0]))},${n1(media(p[i][1], p[i + 1][1]))}`;
  return d + `L${xy(p[p.length - 1])}`;
}
export const claseDe = (tr) => `tz k-${tr.c}${tr.h === "r" ? " rotu" : ""}`;

/** El <svg> del dibujo (texto). Con `colores: true` lleva los colores fijos (para Word y PDF). */
export function svgDibujo(d, { colores = false, fondo = "", escala = 1 } = {}) {
  // Los rotuladores debajo de la tinta, como en papel
  const orden = [...d.t.filter((tr) => tr.h === "r"), ...d.t.filter((tr) => tr.h !== "r")];
  const paths = orden.map((tr) => {
    const dd = pathDe(tr);
    if (!dd) return "";
    if (!colores) return `<path class="${claseDe(tr)}" stroke-width="${anchoDe(tr)}" d="${dd}"/>`;
    const op = tr.h === "r" ? ' stroke-opacity="0.55"' : "";
    return `<path fill="none" stroke="${HEX[tr.h][tr.c]}" stroke-width="${anchoDe(tr)}" stroke-linecap="round" stroke-linejoin="round"${op} d="${dd}"/>`;
  }).join("");
  // Para hacer la imagen del Word o del PDF: el tamaño de verdad en píxeles (si no, se agranda y queda borrosa)
  const extra = colores ? ` xmlns="http://www.w3.org/2000/svg" width="${Math.round(d.w * escala)}" height="${Math.round(d.h * escala)}"` : ' role="img" aria-label="Dibujo"';
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
