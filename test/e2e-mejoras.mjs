// Pruebas de colores, búsqueda, «voy por aquí», tarjetas, desplazamiento automático, ensayos, grabación,
// plantilla y PDF. Uso: igual que e2e.mjs (con dist/ servido en el puerto 8080).
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { buildDocx } from "../src/docx-export.js";
const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { pw = require("/opt/npm-tools/node_modules/playwright"); }
const URL = process.env.ATRIL_URL || "http://localhost:8080/";
const OUTDIR = fileURLToPath(new globalThis.URL("./out", import.meta.url));
fs.mkdirSync(OUTDIR, { recursive: true });
const results = [];
const ok = (name, cond, extra = "") => { results.push({ name, pass: !!cond }); console.log(`${cond ? "✔" : "✘"} ${name}${extra ? " — " + extra : ""}`); };
const hay = (bin) => { try { execFileSync("which", [bin], { stdio: "ignore" }); return true; } catch { return false; } };

const relleno = "Este es un párrafo de relleno para que el discurso tenga una longitud realista y se pueda desplazar con calma. ".repeat(10);
const HTML = `<h1>El amor nunca falla</h1>
<h2>Introducción (1 min)</h2><p>¿Qué es el <strong>amor</strong> verdadero? Lo vemos en 1 Cor. 13:4. ${relleno}</p>
<h2>Punto principal (2 min)</h2><p>Habla con pasión y con cariño. <mark>El amor es paciente</mark> y <mark class="c-verde">es bondadoso</mark>. ${relleno}</p><p>${relleno}</p>
<h2>Conclusión (1 min)</h2><p>Recordemos que <mark class="c-azul">el amor nunca falla</mark>. ${relleno}</p>`;

// Un Word con resaltados de colores, hecho con el mismo exportador de la app
const docxColores = `${OUTDIR}/colores.docx`;
fs.writeFileSync(docxColores, Buffer.from(await (await buildDocx("Colores",
  `<h1>Colores</h1><p>Uno <mark>amarillo</mark>, dos <mark class="c-verde">verde</mark>, tres <mark class="c-azul">azul</mark> y cuatro <mark class="c-rosa">rosa</mark>.</p>`)).arrayBuffer()));

const browser = await pw.chromium.launch({ args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });
const ctx = await browser.newContext({
  viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1.5,
  permissions: ["microphone"], acceptDownloads: true, locale: "es-ES",
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
const cdp = await ctx.newCDPSession(page);
await page.goto(URL);
await page.waitForSelector("#view-home:not([hidden])");
const ID = "mejoras1";
await page.evaluate(async ({ html, id }) => {
  const now = Date.now();
  await window.__atril.store.put("docs", { id, title: "El amor nunca falla", html, created: now, updated: now });
}, { html: HTML, id: ID });
const abrir = async () => {
  await page.goto(URL + "#/leer/docs/" + ID);
  await page.waitForSelector("#view-reader:not([hidden])");
  await page.waitForTimeout(150);
};
await abrir();

// ============ 1. Colores ============
const limpio = await page.evaluate(() => window.__atril.sanitize(
  '<p><span style="background-color: rgb(185, 246, 202)">verde</span> <b style="background:#f8bbd0">rosa</b> <mark class="c-azul x">azul</mark> <mark class="c-rojo">raro</mark> ' +
  '<mark>uno <span style="background-color:#b3e5fc">dos</span> tres</mark></p>'));
ok("Los fondos de colores se guardan como <mark> de su color", limpio.includes('<mark class="c-verde">verde</mark>') && /<mark class="c-rosa"><strong>rosa<\/strong><\/mark>|<strong><mark class="c-rosa">rosa<\/mark><\/strong>/.test(limpio) && limpio.includes('<mark class="c-azul">azul</mark>') && limpio.includes("<mark>raro</mark>"), limpio);
ok("Un resaltado dentro de otro se parte en trozos", limpio.includes('<mark>uno </mark><mark class="c-azul">dos</mark><mark> tres</mark>'), limpio);

// Esquema con filtro por color
await page.click("#reader-outline-btn");
await page.waitForSelector("#reader-outline:not([hidden])");
const filtros = await page.$$eval("#reader-outline .o-filtro .chip", (xs) => xs.map((x) => x.textContent));
ok("El esquema ofrece filtrar por color", filtros.join(",") === "Todo,Títulos,Amarillo,Verde,Azul", filtros.join(","));
await page.click('#reader-outline [data-filtro="verde"]');
let puntos = await page.$$eval("#reader-outline .o-m", (xs) => xs.map((x) => x.textContent));
ok("Filtrar por verde deja solo los resaltados verdes", puntos.length === 1 && puntos[0] === "es bondadoso", puntos.join(" | "));
ok("Los títulos siguen a la vista al filtrar", (await page.$$("#reader-outline .o-h")).length === 4);
await page.screenshot({ path: `${OUTDIR}/20-esquema-colores.png` });
await page.click('#reader-outline [data-filtro="titulos"]');
ok("«Títulos» oculta los resaltados", (await page.$$("#reader-outline .o-m")).length === 0);
await page.click("#reader-outline-btn");

// Importar un Word con colores
await page.goto(URL + "#/");
await page.waitForSelector("#view-home:not([hidden])");
await page.setInputFiles("#file-input", docxColores);
await page.waitForSelector("#view-reader:not([hidden])", { timeout: 15000 });
const imp = await page.innerHTML("#reader-content");
ok("Al abrir un Word se respetan los colores del resaltado",
  imp.includes("<mark>amarillo</mark>") && imp.includes('<mark class="c-verde">verde</mark>') && imp.includes('<mark class="c-azul">azul</mark>') && imp.includes('<mark class="c-rosa">rosa</mark>'), imp);

// Editor: paleta de colores
await page.click("#reader-edit");
await page.waitForSelector("#view-editor:not([hidden])");
await page.evaluate(() => {
  const p = [...document.querySelectorAll("#editor p")].pop();
  const t = p.firstChild; // «Uno »
  const r = document.createRange(); r.setStart(t, 0); r.setEnd(t, 3);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
});
await page.click('#toolbar [data-cmd="highlight"]');
ok("El marcador abre la paleta de colores", await page.isVisible("#palette"));
await page.screenshot({ path: `${OUTDIR}/21-paleta.png` });
await page.click('#palette [data-color="rosa"]');
// Cambiar el color de un resaltado que ya existe: cursor dentro del verde y tocar azul
await page.evaluate(() => {
  const m = document.querySelector("#editor mark.c-verde");
  const r = document.createRange(); r.setStart(m.firstChild, 2); r.collapse(true);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
});
await page.click('#palette [data-color="azul"]');
// Quitar el amarillo
await page.evaluate(() => {
  const m = [...document.querySelectorAll("#editor mark")].find((x) => x.textContent === "amarillo");
  const r = document.createRange(); r.setStart(m.firstChild, 1); r.collapse(true);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
});
await page.click('#palette [data-color="quitar"]');
await page.waitForTimeout(1200);
const editado = await page.evaluate(async () => {
  const id = location.hash.split("/").pop();
  return (await window.__atril.store.get("docs", id)).html;
});
ok("Resaltar en rosa desde la paleta", editado.includes('<mark class="c-rosa">Uno</mark>'), editado);
ok("Cambiar el color de un resaltado", editado.includes('<mark class="c-azul">verde</mark>') && !editado.includes("c-verde"));
ok("Quitar un resaltado", !editado.includes("<mark>amarillo</mark>") && editado.includes("amarillo"));
await page.click("#editor-back");

// ============ 2. Buscar ============
await abrir();
await page.click("#reader-more");
await page.click(".sheet >> text=Buscar en el texto");
await page.waitForSelector("#findbar:not([hidden])");
await page.fill("#find-input", "pasion");
await page.waitForTimeout(400);
ok("Busca sin tener en cuenta los acentos", (await page.textContent("#find-count")) === "1 de 1" && (await page.textContent("#reader-content .hit.cur")) === "pasión", await page.textContent("#find-count"));
await page.fill("#find-input", "el AMOR");
await page.waitForTimeout(400);
const nAmor = await page.evaluate(() => window.__atril.buscador.hits.length);
ok("Encuentra todas las coincidencias, aunque crucen negritas", nAmor >= 3, String(nAmor));
const primero = await page.textContent("#find-count");
await page.click("#find-next");
ok("Botón siguiente", (await page.textContent("#find-count")) !== primero, `${primero} → ${await page.textContent("#find-count")}`);
await page.screenshot({ path: `${OUTDIR}/22-buscar.png` });
await page.click("#find-close");
ok("Al cerrar la búsqueda el texto queda como estaba", (await page.$$("#reader-content .hit")).length === 0 && (await page.isHidden("#findbar")));

// ============ 3. Voy por aquí ============
await page.evaluate(() => { document.querySelector("#reader-scroll").scrollTop = 0; });
await page.dblclick("#reader-content > p >> nth=1");
await page.waitForTimeout(400);
let aqui = await page.evaluate(() => [...document.querySelectorAll("#reader-content > *")].findIndex((x) => x.classList.contains("aqui")));
ok("Doble toque marca «voy por aquí»", aqui === 4, String(aqui));
ok("El doble toque no oculta la barra", !(await page.evaluate(() => document.querySelector("#view-reader").classList.contains("immersive"))));
await page.screenshot({ path: `${OUTDIR}/23-voy-por-aqui.png` });
await abrir();
aqui = await page.evaluate(() => [...document.querySelectorAll("#reader-content > *")].findIndex((x) => x.classList.contains("aqui")));
ok("La marca se recuerda al volver a abrir", aqui === 4);
await page.click("#reader-outline-btn");
ok("El esquema muestra «Voy por aquí»", await page.isVisible("#reader-outline .o-aqui"));
await page.click("#reader-outline .o-aqui");
await page.waitForTimeout(200);
const posAqui = await page.evaluate(() => {
  const s = document.querySelector("#reader-scroll").getBoundingClientRect();
  return Math.round(document.querySelector("#reader-content .aqui").getBoundingClientRect().top - s.top);
});
ok("Tocarlo en el esquema lleva al párrafo", posAqui >= 0 && posAqui < 200, String(posAqui));
await page.dblclick("#reader-content .aqui");
await page.waitForTimeout(400);
ok("Otro doble toque quita la marca", (await page.$$("#reader-content .aqui")).length === 0);

// ============ 4. Tarjetas ============
await page.evaluate(() => { document.querySelector("#reader-scroll").scrollTop = 0; });
await page.click("#reader-more");
await page.click(".sheet >> text=Tarjetas");
await page.waitForSelector("#cards:not([hidden])");
ok("Modo tarjetas: 3 tarjetas, empieza por la primera", (await page.textContent("#cards-count")) === "1 / 3", await page.textContent("#cards-count"));
ok("La tarjeta lleva el título de la parte (sin los minutos)", (await page.textContent("#cards-title")) === "Introducción");
await page.screenshot({ path: `${OUTDIR}/24-tarjetas.png` });
const box = await page.locator("#cards-stage").boundingBox();
await page.touchscreen.tap(box.x + box.width * 0.85, box.y + box.height * 0.5);
await page.waitForTimeout(350);
ok("Tocar a la derecha pasa a la siguiente", (await page.textContent("#cards-count")) === "2 / 3" && (await page.textContent("#cards-title")) === "Punto principal");
// Deslizar el dedo hacia la izquierda
const y = Math.round(box.y + box.height * 0.5);
await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: Math.round(box.x + box.width * 0.8), y }] });
for (let k = 1; k <= 6; k++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: Math.round(box.x + box.width * (0.8 - k * 0.09)), y }] });
await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
await page.waitForTimeout(350);
ok("Deslizar hacia la izquierda pasa a la siguiente", (await page.textContent("#cards-count")) === "3 / 3", await page.textContent("#cards-count"));
await page.keyboard.press("ArrowLeft");
ok("Con el teclado o un pedal, flecha izquierda vuelve", (await page.textContent("#cards-count")) === "2 / 3");
await page.click("#cards-close");
await page.waitForTimeout(200);
const vuelta = await page.evaluate(() => {
  const s = document.querySelector("#reader-scroll").getBoundingClientRect();
  const h = [...document.querySelectorAll("#reader-content h2")][1];
  return Math.round(h.getBoundingClientRect().top - s.top);
});
ok("Al salir, el texto queda en la parte de la última tarjeta", vuelta >= 0 && vuelta < 200, String(vuelta));

// ============ 5. Desplazamiento automático ============
await page.evaluate(() => { document.querySelector("#reader-scroll").scrollTop = 0; });
await page.click("#reader-more");
await page.click(".sheet >> text=Desplazamiento automático");
await page.waitForSelector("#tp-bar:not([hidden])");
const velocidad = await page.textContent("#tp-speed");
await page.waitForTimeout(1500);
const s1 = await page.evaluate(() => document.querySelector("#reader-scroll").scrollTop);
ok("El texto sube solo", s1 > 5, `${Math.round(s1)} px en 1,5 s a ${velocidad}`);
await page.screenshot({ path: `${OUTDIR}/25-teleprompter.png` });
await page.click("#tp-play");
await page.waitForTimeout(200);
const s2 = await page.evaluate(() => document.querySelector("#reader-scroll").scrollTop);
await page.waitForTimeout(600);
const s3 = await page.evaluate(() => document.querySelector("#reader-scroll").scrollTop);
ok("Pausa", Math.abs(s3 - s2) < 1, `${s2} → ${s3}`);
await page.click("#tp-faster");
ok("Más deprisa", parseInt(await page.textContent("#tp-speed")) === parseInt(velocidad) + 10, await page.textContent("#tp-speed"));
await page.click("#tp-close");
ok("Terminar el desplazamiento", (await page.isHidden("#tp-bar")) && !(await page.evaluate(() => document.querySelector("#view-reader").classList.contains("immersive"))));

// ============ 6. Ensayos con tiempo por parte ============
await page.evaluate(() => { document.querySelector("#reader-scroll").scrollTop = 0; });
await page.click("#timer-toggle");
// Simula 20 s leyendo la introducción y 15 s en la conclusión
await page.evaluate(() => { const { timer, ensayo } = window.__atril; timer.startedAt -= 20000; ensayo.ultimo -= 20000; timer.paint(); });
await page.evaluate(() => {
  const s = document.querySelector("#reader-scroll");
  const h = [...document.querySelectorAll("#reader-content h2")][2];
  s.scrollTop += h.getBoundingClientRect().top - s.getBoundingClientRect().top - 100;
});
await page.evaluate(() => { const { timer, ensayo } = window.__atril; ensayo.tic(); timer.startedAt -= 15000; ensayo.ultimo -= 15000; timer.paint(); });
await page.click("#timer-toggle");
await page.click("#timer-reset");
await page.waitForSelector("#toast >> text=Ensayo guardado");
const ens = await page.evaluate(async (id) => (await window.__atril.store.get("docs", id)).ensayos, ID);
const e0 = ens && ens[0];
ok("Al poner el cronómetro a cero se guarda el ensayo", e0 && e0.seg >= 35 && e0.seg < 40, e0 && `${e0.seg} s`);
ok("Tiempo de cada parte", e0 && e0.partes.length === 3 && Math.abs(e0.partes[0].s - 20) <= 1 && e0.partes[1].s <= 1 && Math.abs(e0.partes[2].s - 15) <= 1,
  e0 && e0.partes.map((p) => `${p.t}: ${p.s}s/${p.o}s`).join(", "));
ok("El ensayo guarda el objetivo de cada parte", e0 && e0.objetivoSeg === 240 && e0.partes[1].o === 120);
// Un intento de menos de 30 s no se guarda
await page.click("#timer-toggle");
await page.waitForTimeout(300);
await page.click("#timer-toggle");
await page.click("#timer-reset");
await page.waitForTimeout(300);
ok("Los intentos de menos de 30 s no se guardan", (await page.evaluate(async (id) => (await window.__atril.store.get("docs", id)).ensayos.length, ID)) === 1);
await page.click("#reader-more");
await page.click(".sheet >> text=Ensayos (1)");
await page.waitForSelector(".sheet .ens-fila");
await page.click(".sheet .ens-fila");
const detalle = await page.textContent(".sheet .ens-detalle");
ok("La hoja de ensayos muestra el desglose por partes", detalle.includes("Introducción") && detalle.includes("Conclusión") && detalle.includes("de 1:00"), detalle.replace(/\s+/g, " ").slice(0, 120));
await page.screenshot({ path: `${OUTDIR}/26-ensayos.png` });

// ============ 7. Grabar el ensayo ============
await page.click("#grabar-switch");
ok("Se activa «Grabar audio al ensayar»", await page.evaluate(() => window.__atril.settings().grabar === true));
await page.click(".sheet >> text=Cerrar");
await page.evaluate(() => { document.querySelector("#reader-scroll").scrollTop = 0; });
await page.click("#timer-toggle");
await page.waitForFunction(() => window.__atril.ensayo.grabando(), null, { timeout: 8000 }).catch(() => {});
ok("Graba mientras corre el cronómetro", await page.evaluate(() => window.__atril.ensayo.grabando() && document.querySelector("#timer").classList.contains("rec")));
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const s = document.querySelector("#reader-scroll");
  const h = [...document.querySelectorAll("#reader-content h2")][1];
  s.scrollTop += h.getBoundingClientRect().top - s.getBoundingClientRect().top - 100;
  window.__atril.timer.paint();
});
await page.waitForTimeout(1200);
await page.evaluate(() => { const { timer, ensayo } = window.__atril; timer.startedAt -= 31000; ensayo.ultimo -= 31000; timer.paint(); });
await page.click("#timer-toggle");
ok("Al pausar, la grabación también se pausa", await page.evaluate(() => !document.querySelector("#timer").classList.contains("running")));
await page.click("#timer-reset");
for (let k = 0; k < 40; k++) {
  if ((await page.evaluate(async (id) => ((await window.__atril.store.get("docs", id)).ensayos || []).length, ID)) === 2) break;
  await page.waitForTimeout(200);
}
const grab = await page.evaluate(async (id) => {
  const it = await window.__atril.store.get("docs", id);
  const g = await window.__atril.store.get("grabaciones", it.ensayos[0].id);
  return { audio: it.ensayos[0].audio, size: g && g.blob.size, tipo: g && g.mime, marcas: g && g.marcas };
}, ID);
ok("La grabación se guarda en el dispositivo", grab.audio && grab.size > 1000, `${grab.size} bytes, ${grab.tipo}`);
ok("Marca dónde empieza cada parte", grab.marcas && grab.marcas.length >= 2 && grab.marcas[0].i === 0 && grab.marcas[1].i === 1, JSON.stringify(grab.marcas));
await page.click("#reader-more");
await page.click(".sheet >> text=Ensayos (2)");
await page.click(".sheet .ens-item >> nth=0 >> .ens-fila");
await page.click(".sheet >> text=Escuchar");
await page.waitForSelector(".sheet audio");
const dur = await page.evaluate(() => new Promise((res) => {
  const a = document.querySelector(".sheet audio");
  if (a.readyState >= 1) res(a.duration); else a.addEventListener("loadedmetadata", () => res(a.duration), { once: true });
  setTimeout(() => res(-1), 4000);
}));
ok("Se puede escuchar la grabación", dur !== -1, `duración ${dur}`);
ok("Botones para saltar a cada parte", (await page.$$eval(".sheet .chips .chip", (xs) => xs.map((x) => x.textContent))).some((t) => t.startsWith("Punto principal")));
await page.screenshot({ path: `${OUTDIR}/27-grabacion.png` });
await page.click(".sheet >> text=Guardar el audio");
await page.waitForSelector(".sheet >> text=Audio listo");
const [dlAudio] = await Promise.all([page.waitForEvent("download"), page.click(".sheet .action.primary")]);
ok("Guardar el audio como archivo", /^Ensayo .+\.(m4a|webm|ogg)$/.test(dlAudio.suggestedFilename()), dlAudio.suggestedFilename());
await page.evaluate(() => { window.__atril.settings().grabar = false; });

// ============ 8. PDF ============
await page.click("#reader-more");
await page.click(".sheet >> text=Guardar como PDF");
await page.click(".sheet >> text=Grande");
await page.click(".sheet >> text=Crear el PDF");
await page.waitForSelector(".sheet >> text=PDF listo", { timeout: 20000 });
const [dlPdf] = await Promise.all([page.waitForEvent("download"), page.click(".sheet .action.primary")]);
const pdfPath = `${OUTDIR}/${dlPdf.suggestedFilename()}`;
await dlPdf.saveAs(pdfPath);
const cabecera = fs.readFileSync(pdfPath).subarray(0, 5).toString();
ok("Crea el PDF", cabecera === "%PDF-" && dlPdf.suggestedFilename() === "El amor nunca falla.pdf", dlPdf.suggestedFilename());
if (hay("pdftotext")) {
  const txt = execFileSync("pdftotext", ["-layout", pdfPath, "-"]).toString();
  ok("El PDF tiene el texto con acentos y signos", txt.includes("El amor nunca falla") && txt.includes("¿Qué es el amor verdadero?") && txt.includes("pasión"), txt.slice(0, 80).replace(/\s+/g, " "));
  const paginas = execFileSync("pdfinfo", [pdfPath]).toString().match(/Pages:\s+(\d+)/);
  ok("Varias páginas con letra grande", paginas && Number(paginas[1]) >= 2, paginas && paginas[1] + " páginas");
}

// ============ 9. Plantilla de discurso nuevo ============
await page.goto(URL + "#/");
await page.waitForSelector("#view-home:not([hidden])");
await page.click('.segmented [data-tab="docs"]');
await page.click("text=Nuevo discurso");
await page.click(".sheet >> text=Con plantilla");
await page.fill('.sheet input[type="text"]', "Cómo mantener la calma");
await page.fill(".sheet .num-input", "12");
await page.dispatchEvent(".sheet .num-input", "change");
await page.click('.sheet .chips .chip >> text="3"');
const reparto = await page.textContent(".sheet .reparto");
ok("La plantilla reparte los minutos", reparto === "Introducción 1 min · Punto 1: 4 min · Punto 2: 3 min · Punto 3: 3 min · Conclusión 1 min", reparto);
await page.screenshot({ path: `${OUTDIR}/28-plantilla.png` });
await page.click(".sheet >> text=Crear");
await page.waitForSelector("#view-editor:not([hidden])");
const nuevo = await page.evaluate(async () => window.__atril.store.get("docs", location.hash.split("/").pop()));
ok("Crea el discurso con su objetivo y sus partes", nuevo.title === "Cómo mantener la calma" && nuevo.target === 12 && nuevo.html.includes("<h2>Punto 1 (4 min)</h2>") && nuevo.html.includes("Ilustración"),
  `${nuevo.title} · ${nuevo.target} min`);
ok("El editor abre con el título puesto", (await page.inputValue("#editor-title")) === "Cómo mantener la calma");

// ============ 10. Móvil ============
await abrir();
await page.setViewportSize({ width: 390, height: 844 });
await page.evaluate(() => { const t = window.__atril.timer; t.elapsed = 30000; t.running = false; t.docKey = "docs/mejoras1"; t.paint(); });
const desborda = (sel) => page.evaluate((s) => { const b = document.querySelector(s); return b.scrollWidth > b.clientWidth + 1; }, sel);
ok("La barra del lector (con ⋯) cabe en un móvil", !(await desborda(".reader-bar")));
await page.click("#reader-more");
await page.click(".sheet >> text=Buscar en el texto");
ok("La barra de búsqueda cabe en un móvil", !(await desborda("#findbar")));
await page.click("#find-close");
await page.click("#reader-more");
await page.click(".sheet >> text=Tarjetas");
ok("La barra de las tarjetas cabe en un móvil", !(await desborda(".cards-bar")) && !(await desborda(".cards-nav")));
await page.screenshot({ path: `${OUTDIR}/29-tarjetas-movil.png` });
await page.click("#cards-close");

ok("Sin errores en la consola", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const fallos = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - fallos}/${results.length} pruebas superadas`);
process.exit(fallos ? 1 : 0);
