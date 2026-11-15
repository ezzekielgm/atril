// Lo que encontró Ezequiel usando Atril con el lápiz (15-11-2026):
// 1) «Escribir a mano» no pasaba a letra: era la nota a mano (lienzo), que dibuja. Ahora hay «Lápiz → texto».
// 2) La escritura a mano se veía borrosa: bordes «peludos» por el temblor del lápiz y la imagen del Word/PDF agrandada.
// 3) El Word se guardaba con otra terminación: se comparte solo el archivo y en el iPad no se usa el enlace de descarga.
// Uso: igual que e2e.mjs (con dist/ servido en el puerto 8080).
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { pw = require("/opt/npm-tools/node_modules/playwright"); }
const URL = process.env.ATRIL_URL || "http://localhost:8080/";
const OUTDIR = fileURLToPath(new globalThis.URL("./out", import.meta.url));
fs.mkdirSync(OUTDIR, { recursive: true });
const results = [];
const ok = (name, cond, extra = "") => { results.push({ name, pass: !!cond }); console.log(`${cond ? "✔" : "✘"} ${name}${extra ? " — " + extra : ""}`); };
const UA = "Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";

const browser = await pw.chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1080, height: 810 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, userAgent: UA, locale: "es-ES" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await page.goto(URL);
await page.waitForSelector("#view-home:not([hidden])");

// ============ 1. Lápiz → texto ============
await page.click('[data-tab="notes"]');
await page.waitForSelector("#nota-lapiz");
ok("En Notas: «Lápiz → texto» y «A mano (dibujo)», distintos", (await page.textContent("#nota-lapiz")).includes("Lápiz → texto") && (await page.textContent("#nota-mano")).includes("A mano (dibujo)"));
await page.click("#nota-lapiz");
await page.waitForSelector("#view-editor:not([hidden])");
ok("Abre una nota de texto con la ayuda de escribir con el lápiz", await page.isVisible("#lapiz-ayuda") && (await page.textContent("#lapiz-ayuda")).includes("Escribir a mano"));
ok("…en una hoja de texto donde el iPad puede escribir (editable, grande)", await page.evaluate(() => { const e = document.querySelector("#editor"); return e.isContentEditable && e.getBoundingClientRect().height > 400; }));
ok("…y no pone el cursor en el título (para escribir directamente en la hoja)", await page.evaluate(() => document.activeElement !== document.querySelector("#editor-title")));
await page.click("#lapiz-ok");
ok("«Entendido» quita la ayuda", await page.isHidden("#lapiz-ayuda"));
const notaId = await page.evaluate(() => location.hash.split("/").pop());
ok("La nota se llama «Notas · fecha»", (await page.inputValue("#editor-title")).startsWith("Notas · "));

// ============ 2. El trazo del lápiz: nítido ============
await page.click('[data-rtab="insertar"]');
await page.click('[data-cmd="dibujo"]');
await page.waitForSelector(".lienzo .lz-svg");
ok("El lienzo avisa de que ahí se queda a mano (y dónde pasa a letra)", (await page.textContent(".lz-ayuda")).includes("Lápiz → texto"));
// Escritura de prueba con el lápiz: bucles («lelele») con muchos puntos y un pequeño temblor, presión suave
const caja = await page.$eval(".lienzo .lz-svg", (s) => { const r = s.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width }; });
const puntos = [];
let semilla = 3; const azar = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);
for (let t = 0; t <= 6 * 2 * Math.PI; t += 0.02) {
  const x = 60 + (t / (2 * Math.PI)) * 22 + Math.sin(t) * 10, y = 160 - (1 - Math.cos(t)) * 18;
  puntos.push([caja.x + x + (azar() - 0.5) * 0.5, caja.y + y + (azar() - 0.5) * 0.5]);
}
await page.evaluate(({ puntos }) => {
  const svg = document.querySelector(".lienzo .lz-svg");
  const ev = (tipo, [x, y]) => svg.dispatchEvent(new PointerEvent(tipo, { pointerId: 7, pointerType: "pen", clientX: x, clientY: y, pressure: 0.25, bubbles: true, cancelable: true, isPrimary: true, button: 0 }));
  ev("pointerdown", puntos[0]);
  for (const p of puntos.slice(1)) ev("pointermove", p);
  ev("pointerup", puntos[puntos.length - 1]);
}, { puntos });
const tr = await page.evaluate(() => {
  const p = document.querySelector(".lienzo .lz-svg g:not(.lz-pauta) path");
  return p ? { clase: p.getAttribute("class"), ancho: Number(p.getAttribute("stroke-width")), d: p.getAttribute("d"), cs: getComputedStyle(p) && { fill: getComputedStyle(p).fill, cap: getComputedStyle(p).strokeLinecap } } : null;
});
ok("El trazo es una línea de bolígrafo (redonda, sin relleno)", tr && tr.clase === "tz k-negro" && tr.cs.fill === "none" && tr.cs.cap === "round", JSON.stringify(tr && { c: tr.clase, f: tr.cs.fill }));
ok("Escribiendo suave sale fino (2–3 de grosor)", tr && tr.ancho >= 2 && tr.ancho <= 3, String(tr && tr.ancho));
const segmentos = tr ? (tr.d.match(/Q/g) || []).length : 0;
ok("El temblor del lápiz se filtra (muchos menos tramos que puntos)", segmentos > 20 && segmentos < puntos.length / 2, `${segmentos} tramos de ${puntos.length} puntos`);
await page.screenshot({ path: `${OUTDIR}/lapiz-trazo.png`, clip: { x: caja.x + 30, y: caja.y + 100, width: 220, height: 90 } });
await page.click(".lienzo .lz-hecho");
await page.waitForSelector(".lienzo", { state: "detached" });
await page.waitForSelector("#editor figure.dibujo");
const guardado = await page.evaluate(() => JSON.parse(document.querySelector("#editor figure.dibujo").getAttribute("data-dibujo")).t[0].p.slice(0, 6));
ok("Se guarda con un decimal (sin escalones de medio punto)", guardado.some((v, i) => i % 3 !== 2 && !Number.isInteger(v)), guardado.join(","));

// La imagen para el Word y el PDF: hecha a su tamaño (2000 px), no agrandada
const img = await page.evaluate(async () => {
  const html = await window.__atril.htmlParaExportar(document.querySelector("#editor").innerHTML);
  const box = document.createElement("div"); box.innerHTML = html;
  const i = box.querySelector("img");
  const im = new Image(); im.src = i.src; await im.decode();
  // ¿Hay píxeles medio grises en los bordes (borroso) o casi todo es tinta o fondo?
  const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight;
  const g = c.getContext("2d"); g.drawImage(im, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let tinta = 0, medio = 0;
  // Con fondo blanco: tinta = oscuro, borde = gris intermedio
  for (let k = 0; k < d.length; k += 4) { const l = (d[k] + d[k + 1] + d[k + 2]) / 3; if (l < 70) tinta++; else if (l < 200) medio++; }
  return { w: im.naturalWidth, h: im.naturalHeight, src: i.src, nitidez: tinta / Math.max(1, tinta + medio) };
});
ok("La imagen del Word/PDF se hace a 2000 px de ancho", img.w === 2000, `${img.w}×${img.h}`);
ok("…y nítida (la mayoría de píxeles del trazo son tinta, no borde gris)", img.nitidez > 0.6, img.nitidez.toFixed(2));
fs.writeFileSync(`${OUTDIR}/lapiz-word.png`, Buffer.from(img.src.split(",")[1], "base64"));

// ============ 3. Guardar como Word en el iPad ============
await page.evaluate(() => {
  window.__compartido = [];
  navigator.canShare = () => true;
  navigator.share = async (d) => { window.__compartido.push({ claves: Object.keys(d), archivos: (d.files || []).map((f) => ({ n: f.name, t: f.type, s: f.size })) }); };
});
await page.evaluate(({ id }) => window.__atril.exportWord("notes", { id, title: "Asamblea: notas", html: "<p>Hola</p>" }), { id: notaId });
await page.waitForSelector(".sheet >> text=Word listo");
ok("La hoja recomienda «Guardar en Archivos» (así queda como .docx)", (await page.textContent(".sheet")).includes("Guardar en Archivos"));
await page.click(".sheet .action.primary");
await page.waitForTimeout(200);
const comp = await page.evaluate(() => window.__compartido);
ok("Se comparte solo el archivo (sin título aparte)", comp.length === 1 && comp[0].claves.join() === "files", JSON.stringify(comp));
ok("…llamado .docx («Asamblea - notas.docx») y con el tipo de Word", comp[0] && comp[0].archivos[0].n === "Asamblea - notas.docx" && comp[0].archivos[0].t === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" && comp[0].archivos[0].s > 1000, JSON.stringify(comp[0] && comp[0].archivos[0]));
// Si el menú no se abre, en el iPad no se descarga con un enlace (abriría un visor sin poder guardar)
await page.evaluate(() => {
  window.__descargas = 0;
  const orig = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () { if (this.download) window.__descargas++; else orig.call(this); };
  navigator.share = async () => { throw new DOMException("no", "NotAllowedError"); };
});
await page.evaluate(({ id }) => window.__atril.exportWord("notes", { id, title: "Otra", html: "<p>Hola</p>" }), { id: notaId });
await page.waitForSelector(".sheet >> text=Word listo");
await page.click(".sheet .action.primary");
await page.waitForTimeout(300);
ok("Si el menú no se abre, pide volver a tocar (sin descargar ni cerrar la hoja)", (await page.evaluate(() => window.__descargas)) === 0 && await page.isVisible(".sheet >> text=Word listo") && (await page.textContent(".toast")).includes("Vuelve a tocar"));

await browser.close();
ok("Sin errores en la consola", errors.length === 0, errors.slice(0, 3).join(" | "));
const fallos = results.filter((r) => !r.pass);
console.log(`\n${results.length - fallos.length}/${results.length} pruebas superadas`);
process.exit(fallos.length ? 1 : 0);
