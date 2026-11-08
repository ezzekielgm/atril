// Colores del resaltador. En el HTML: <mark> (amarillo) o <mark class="c-verde|c-azul|c-rosa">.

export const COLORES = [
  { id: "amarillo", nombre: "Amarillo", clase: "", hex: "#fff176" },
  { id: "verde", nombre: "Verde", clase: "c-verde", hex: "#b9f6ca" },
  { id: "azul", nombre: "Azul", clase: "c-azul", hex: "#b3e5fc" },
  { id: "rosa", nombre: "Rosa", clase: "c-rosa", hex: "#f8bbd0" },
];

const CLASES = new Set(["c-verde", "c-azul", "c-rosa"]);

/** Clase de color válida de un <mark> ("" = amarillo). */
export function claseValida(valor) {
  for (const c of String(valor || "").split(/\s+/)) if (CLASES.has(c)) return c;
  return "";
}

/** Id del color de un <mark>: "amarillo", "verde", "azul" o "rosa". */
export function colorDeMark(m) {
  const c = claseValida(m && m.getAttribute && m.getAttribute("class"));
  return c ? c.slice(2) : "amarillo";
}

/** Convierte "#rgb", "#rrggbb", "rgb(a)" o un nombre de color básico en [r, g, b]. */
export function rgbDe(color) {
  const s = String(color || "").trim().toLowerCase();
  const NOMBRES = {
    yellow: [255, 255, 0], lime: [0, 255, 0], green: [0, 128, 0], cyan: [0, 255, 255], aqua: [0, 255, 255],
    blue: [0, 0, 255], magenta: [255, 0, 255], fuchsia: [255, 0, 255], pink: [255, 192, 203], red: [255, 0, 0],
    orange: [255, 165, 0], gold: [255, 215, 0], lightgreen: [144, 238, 144], lightblue: [173, 216, 230],
    turquoise: [64, 224, 208], violet: [238, 130, 238], gray: [128, 128, 128], grey: [128, 128, 128],
    silver: [192, 192, 192], white: [255, 255, 255], black: [0, 0, 0],
  };
  if (NOMBRES[s]) return NOMBRES[s];
  let m = s.match(/^#([0-9a-f]{3})$/);
  if (m) return [...m[1]].map((h) => parseInt(h + h, 16));
  m = s.match(/^#([0-9a-f]{6})/);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  m = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/);
  if (m) return [m[1], m[2], m[3]].map((x) => Math.round(Number(x)));
  return null;
}

/** Clase de <mark> que corresponde a un color de fondo cualquiera (se elige por el tono). */
export function claseDeFondo(color) {
  const rgb = rgbDe(color);
  if (!rgb) return "";
  const [r, g, b] = rgb.map((x) => x / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d < 0.08) return ""; // gris o blanco: amarillo de siempre
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  if (h >= 20 && h < 75) return "";
  if (h >= 75 && h < 170) return "c-verde";
  if (h >= 170 && h < 260) return "c-azul";
  return "c-rosa";
}
