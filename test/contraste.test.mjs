// Contraste de los colores de los temas (claro, sepia y oscuro) según WCAG 2.2 AA:
// texto normal ≥ 4,5:1 y texto grande ≥ 3:1. Lee las variables de src/styles.css. Uso: node test/contraste.test.mjs
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const css = fs.readFileSync(fileURLToPath(new URL("../src/styles.css", import.meta.url)), "utf8");
const temas = {};
for (const m of css.matchAll(/\[data-theme="(\w+)"\]\s*\{([^}]*)\}/g)) {
  const vars = {};
  for (const v of m[2].matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,6})\b/g)) vars[v[1]] = v[2];
  temas[m[1]] = vars;
}

const rgb = (hex) => {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
};
const lum = (hex) => { const [r, g, b] = rgb(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// [texto, fondo, mínimo, para qué]
const PARES = [
  ["text", "bg", 4.5, "texto del discurso"], ["text", "desk", 4.5, "texto sobre el fondo"], ["text", "surface", 4.5, "texto en paneles"],
  ["muted", "bg", 4.5, "texto secundario"], ["muted", "desk", 4.5, "texto secundario sobre el fondo"], ["muted", "surface", 4.5, "texto secundario en paneles"],
  ["heading", "bg", 3, "títulos (texto grande)"], ["accent", "bg", 4.5, "enlaces y botones de texto"], ["accent", "desk", 4.5, "enlaces sobre el fondo"],
  ["accent-text", "accent", 4.5, "botón principal"], ["on-vivo", "accent-vivo", 4.5, "botón Presentar"], ["bar-text", "bar", 4.5, "barra de arriba"], ["text", "accent-soft", 4.5, "elementos seleccionados"],
  ["danger", "bg", 4.5, "avisos en rojo"], ["ok", "bg", 4.5, "«en tiempo» en verde"], ["warn", "bg", 4.5, "avisos en ámbar"], ["warn", "warn-bg", 4.5, "aviso sobre fondo ámbar"],
  ["t-rojo", "bg", 4.5, "letra roja"], ["t-azul", "bg", 4.5, "letra azul"], ["t-verde", "bg", 4.5, "letra verde"], ["t-naranja", "bg", 4.5, "letra naranja"],
];

let fallos = 0, total = 0;
for (const [tema, v] of Object.entries(temas)) {
  for (const [a, b, min, que] of PARES) {
    if (!v[a] || !v[b]) continue;
    total++;
    const r = ratio(v[a], v[b]);
    const ok = r >= min;
    if (!ok) fallos++;
    console.log(`${ok ? "✔" : "✘"} ${tema}: ${que} (--${a} sobre --${b}) ${r.toFixed(2)}:1${ok ? "" : ` — mínimo ${min}:1`}`);
  }
  // El texto sobre los resaltados (en el tema oscuro, --mark-text)
  for (const m of ["mark", "mark-verde", "mark-azul", "mark-rosa"]) {
    if (!v[m]) continue;
    total++;
    const t = v["mark-text"] || v.text;
    const r = ratio(t, v[m]);
    if (r < 4.5) fallos++;
    console.log(`${r >= 4.5 ? "✔" : "✘"} ${tema}: texto sobre --${m} ${r.toFixed(2)}:1`);
  }
}
// Cronómetro de Presentar: blanco sobre el verde del semáforo
const verde = (css.match(/\.pres-timer\.running\s*\{[^}]*background:\s*(#[0-9a-fA-F]{6})/) || [])[1];
if (verde) { total++; const r = ratio("#ffffff", verde); if (r < 4.5) fallos++; console.log(`${r >= 4.5 ? "✔" : "✘"} cronómetro en marcha (blanco sobre ${verde}) ${r.toFixed(2)}:1`); }

// Ámbar y rojo del semáforo (los colores salen del CSS de .pres-timer.warn / .over)
const regla = (sel) => css.match(new RegExp(sel.replace(/\./g, "\\.") + "\\s*\\{([^}]*)\\}"));
for (const [sel, que] of [[".pres-timer.warn", "cronómetro en el último minuto"], [".pres-timer.over", "cronómetro pasado de tiempo"]]) {
  const r = regla(sel);
  const fondo = r && (r[1].match(/background:\s*(#[0-9a-fA-F]{6})/) || [])[1];
  const texto = r && (r[1].match(/[^-]color:\s*(#[0-9a-fA-F]{3,6})/) || [])[1];
  total++;
  if (!fondo || !texto) { fallos++; console.log(`✘ ${que}: sin colores fijos en ${sel}`); continue; }
  const q = ratio(texto, fondo);
  if (q < 4.5) fallos++;
  console.log(`${q >= 4.5 ? "✔" : "✘"} ${que} (${texto} sobre ${fondo}) ${q.toFixed(2)}:1`);
}

console.log(`\n${total - fallos}/${total} pruebas superadas`);
process.exit(fallos ? 1 : 0);
