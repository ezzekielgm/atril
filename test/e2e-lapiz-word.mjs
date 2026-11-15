// Lo que encontró Ezequiel usando Atril con el lápiz (15-11-2026):
// 1) «Escribir a mano» no pasaba a letra: era la nota a mano (lienzo), que dibuja. Ahora «Nota a mano» tiene «A texto»
//    (un <textarea> donde el iPad convierte la letra) y «A mano» (dibujo).
// 2) La escritura a mano se veía borrosa y gruesa: bordes «peludos» por el temblor del lápiz y la imagen del Word/PDF agrandada.
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

// ============ 1. «Nota a mano» → «A texto» (lo que pidió: «estoy escribiendo en nota a mano y no lo pasa a texto») ============
await page.click('[data-tab="notes"]');
await page.waitForSelector("#nota-mano");
ok("En Notas hay un solo botón para el lápiz: «Nota a mano»", (await page.textContent("#nota-mano")).includes("Nota a mano") && !(await page.$("#nota-lapiz")));
await page.click("#nota-mano");
await page.waitForSelector(".lienzo .lz-svg");
ok("Empieza en «A texto»", (await page.getAttribute(".lienzo [data-m=texto]", "aria-pressed")) === "true" && (await page.getAttribute(".lienzo [data-m=tinta]", "aria-pressed")) === "false");
const hojaTexto = await page.evaluate(() => {
  const t = document.querySelector(".lienzo .lz-texto"), r = t.getBoundingClientRect();
  const svg = document.querySelector(".lienzo .lz-svg");
  return { tag: t.tagName, visible: getComputedStyle(t).display !== "none", alto: r.height, ancho: r.width, svgToques: getComputedStyle(svg).pointerEvents };
});
ok("…con una hoja de texto de verdad (<textarea>, donde el iPad pasa a letra) que ocupa la hoja", hojaTexto.tag === "TEXTAREA" && hojaTexto.visible && hojaTexto.alto > 400 && hojaTexto.ancho > 800 && hojaTexto.svgToques === "none", JSON.stringify(hojaTexto));
ok("…y la ayuda explica «Escribir a mano» del iPad", (await page.textContent(".lz-ayuda")).includes("Escribir a mano"));
ok("…sin las herramientas de dibujar (no hacen falta)", await page.isHidden(".lienzo [data-h=b]"));
const lapizEn = (sel, puntos) => page.evaluate(({ sel, puntos }) => {
  const el = document.querySelector(sel);
  const ev = (tipo, [x, y]) => el.dispatchEvent(new PointerEvent(tipo, { pointerId: 9, pointerType: "pen", clientX: x, clientY: y, pressure: 0.4, bubbles: true, cancelable: true, isPrimary: true, button: 0 }));
  ev("pointerdown", puntos[0]); for (const q of puntos.slice(1)) ev("pointermove", q); ev("pointerup", puntos[puntos.length - 1]);
}, { sel, puntos });
await lapizEn(".lienzo .lz-svg", [[200, 300], [260, 310], [320, 305]]);
ok("En «A texto» el lápiz no dibuja", (await page.$$(".lienzo .lz-svg g:not(.lz-pauta) path")).length === 0);
// Lo que escribe «Escribir a mano» llega al <textarea> como texto
await page.fill(".lienzo .lz-texto", "Primera idea del discurso\nSegunda idea: Juan 3:16\n\n");
await page.screenshot({ path: `${OUTDIR}/lapiz-a-texto.png` });

// «A mano»: se dibuja, fino de serie
await page.click(".lienzo [data-m=tinta]");
ok("«A mano» quita la hoja de texto y enseña las herramientas", await page.isHidden(".lienzo .lz-texto") && await page.isVisible(".lienzo [data-h=b]") && (await page.textContent(".lz-ayuda")).includes("como un dibujo"));
ok("Atril recuerda el modo para la próxima nota", (await page.evaluate(() => localStorage.getItem("atril.lienzoModo"))) === "tinta");

// ============ 2. El trazo del lápiz: nítido y fino ============
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
ok("Escribiendo suave sale fino (1,2–2 de grosor; antes 2–3,5)", tr && tr.ancho >= 1.2 && tr.ancho <= 2, String(tr && tr.ancho));
ok("El grosor de serie es el fino-medio (2,5), con «Fino» todavía más fino", await page.evaluate(() => {
  const g = [...document.querySelectorAll(".lienzo .lz-grosor")];
  return g.length === 3 && g[1].getAttribute("aria-pressed") === "true";
}));
const segmentos = tr ? (tr.d.match(/Q/g) || []).length : 0;
ok("El temblor del lápiz se filtra (muchos menos tramos que puntos)", segmentos > 20 && segmentos < puntos.length / 2, `${segmentos} tramos de ${puntos.length} puntos`);
await page.screenshot({ path: `${OUTDIR}/lapiz-trazo.png`, clip: { x: caja.x + 30, y: caja.y + 100, width: 220, height: 90 } });
await page.click(".lienzo .lz-hecho");
await page.waitForSelector(".lienzo", { state: "detached" });
await page.waitForSelector("#view-editor:not([hidden]) #editor figure.dibujo");
const notaId = await page.evaluate(() => location.hash.split("/").pop());
const nota1 = await page.evaluate(async (id) => (await window.__atril.store.get("notes", id)), notaId);
ok("Se guarda la nota con lo dibujado y, debajo, lo escrito «A texto» (una línea = un párrafo)", nota1 && nota1.title.startsWith("Nota a mano · ") && /^<figure class="dibujo"[^]*<\/figure><p>Primera idea del discurso<\/p><p>Segunda idea: Juan 3:16<\/p>/.test(nota1.html), nota1 && nota1.html.replace(/data-dibujo="[^"]*"|<svg[^]*<\/svg>/g, "…").slice(0, 200));

// Solo texto (sin dibujar nada): la nota es solo texto
await page.goto(URL + "#/");
await page.waitForSelector("#view-home:not([hidden])");
await page.click('[data-tab="notes"]');
await page.click("#nota-mano");
await page.waitForSelector(".lienzo .lz-svg");
ok("La siguiente nota empieza como la dejaste («A mano»)", (await page.getAttribute(".lienzo [data-m=tinta]", "aria-pressed")) === "true");
await page.click(".lienzo [data-m=texto]");
await page.fill(".lienzo .lz-texto", "Asamblea de circuito\nTema: la paciencia");
await page.click(".lienzo .lz-hecho");
await page.waitForSelector("#view-editor:not([hidden])");
const nota2 = await page.evaluate(async () => (await window.__atril.store.all("notes")).find((n) => n.html.includes("Asamblea de circuito")));
ok("Solo con «A texto», la nota es texto normal (se puede editar, copiar y pasar a Claude)", nota2 && !nota2.html.includes("<figure") && nota2.html.startsWith("<p>Asamblea de circuito</p><p>Tema: la paciencia</p>"), nota2 && nota2.html);

// En el editor, Insertar → «Dibujo o a mano» también tiene «A texto»; empieza en «A mano»
await page.evaluate(() => {
  const p = document.querySelector("#editor p");
  const r = document.createRange(); r.selectNodeContents(p); r.collapse(false);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.querySelector("#editor").focus();
});
await page.click('[data-rtab="insertar"]');
await page.click('[data-cmd="dibujo"]');
await page.waitForSelector(".lienzo .lz-svg");
ok("En el editor el lienzo empieza en «A mano» y tiene «A texto»", (await page.getAttribute(".lienzo [data-m=tinta]", "aria-pressed")) === "true" && await page.isVisible(".lienzo [data-m=texto]"));
await page.click(".lienzo [data-m=texto]");
await page.fill(".lienzo .lz-texto", "Añadido con el lápiz");
await page.click(".lienzo .lz-hecho");
await page.waitForSelector(".lienzo", { state: "detached" });
ok("…y lo escrito entra como párrafo después del cursor", await page.evaluate(() => {
  const ps = [...document.querySelectorAll("#editor p")].map((p) => p.textContent);
  return ps[0] === "Asamblea de circuito" && ps[1] === "Añadido con el lápiz" && ps[2] === "Tema: la paciencia";
}), await page.evaluate(() => [...document.querySelectorAll("#editor p")].map((p) => p.textContent).join(" | ")));
await page.goto(URL + `#/editar/notes/${notaId}`);
await page.waitForSelector("#view-editor:not([hidden]) #editor figure.dibujo");
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
