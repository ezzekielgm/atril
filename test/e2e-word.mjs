// Pruebas del editor al estilo Word: cinta, estilos, tachado, buscar y reemplazar, zoom y barra de estado.
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

const browser = await pw.chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1.5, locale: "es-ES" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await page.goto(URL);
await page.waitForSelector("#view-home:not([hidden])");
ok("La letra por defecto es la de Word", await page.evaluate(() => document.documentElement.dataset.font === "sans" && getComputedStyle(document.documentElement).getPropertyValue("--read-font").includes("Carlito")));
const ID = "w1";
await page.evaluate(async (id) => {
  const now = Date.now();
  await window.__atril.store.put("docs", { id, title: "La paciencia", target: 5, created: now, updated: now,
    html: "<h1>La paciencia</h1><p>Primer párrafo sobre la paciencia.</p><p>Segundo párrafo: la paciencia es un fruto.</p><p>Tercer párrafo con Paciencia al final.</p>" });
}, ID);
await page.goto(URL + "#/editar/docs/" + ID);
await page.waitForSelector("#view-editor:not([hidden])");
const html = () => page.evaluate(async (id) => (await window.__atril.store.get("docs", id)).html, ID);
const elegir = (sel, ini, fin) => page.evaluate(({ sel, ini, fin }) => {
  const t = document.querySelector(sel).firstChild;
  const r = document.createRange(); r.setStart(t, ini); r.setEnd(t, fin ?? ini);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
}, { sel, ini, fin });

ok("La cinta empieza en «Inicio»", (await page.getAttribute('[data-rtab="inicio"]', "aria-selected")) === "true" && (await page.isVisible("#toolbar")) && (await page.isHidden('[data-rpanel="revisar"]')));
ok("La barra de estado cuenta las palabras", /^\d+ palabras$/.test(await page.textContent("#ed-palabras")), await page.textContent("#ed-palabras"));
await page.screenshot({ path: `${OUTDIR}/40-editor-word.png` });

// Estilos de la galería
await elegir("#editor p:nth-of-type(1)", 3);
await page.click('#toolbar [data-cmd="h2"]');
await elegir("#editor p:nth-of-type(1)", 3);
await page.click('#toolbar [data-cmd="h3"]');
await page.waitForTimeout(1000);
let h = await html();
ok("Galería de estilos: Título 2 y Título 3", h.includes("<h2>Primer párrafo sobre la paciencia.</h2>") && h.includes("<h3>Segundo párrafo: la paciencia es un fruto.</h3>"), h.slice(0, 160));
ok("El estilo activo se marca en la galería", await page.evaluate(() => document.querySelector('#toolbar [data-cmd="h3"]').classList.contains("active")));
await elegir("#editor p", 0, 6);
await page.click('#toolbar [data-cmd="strike"]');
await page.waitForTimeout(1000);
ok("Tachado", (await html()).includes("<s>Tercer</s>"), (await html()).slice(-90));

// Revisar → Buscar y reemplazar
await page.click('[data-rtab="revisar"]');
ok("Pestaña «Revisar»", (await page.isVisible('[data-rpanel="revisar"]')) && (await page.isHidden("#toolbar")));
await page.click('[data-rpanel="revisar"] [data-cmd="buscar"]');
await page.waitForSelector("#replacebar:not([hidden])");
await page.fill("#rep-buscar", "paciencia");
await page.waitForTimeout(400);
ok("Busca sin mirar mayúsculas", (await page.textContent("#rep-count")) === "1 de 4", await page.textContent("#rep-count"));
await page.fill("#rep-por", "calma");
await page.click("#rep-uno");
await page.waitForTimeout(300);
ok("Reemplazar una", (await page.textContent("#rep-count")) === "1 de 3" && (await page.evaluate(() => document.querySelector("#editor h1").textContent)) === "La calma", await page.textContent("#rep-count"));
await page.screenshot({ path: `${OUTDIR}/41-reemplazar.png` });
await page.click("#rep-todo");
await page.waitForTimeout(1100);
h = await html();
ok("Reemplazar todo", !/paciencia/i.test(h) && (h.match(/calma/g) || []).length === 4, h.replace(/<[^>]+>/g, " ").slice(0, 140));
await page.click("#toast button");
await page.waitForTimeout(1100);
h = await html();
ok("Deshacer el reemplazo", (h.match(/paciencia/gi) || []).length === 3 && h.includes("La calma"), (h.match(/paciencia/gi) || []).length + " de paciencia");
await page.click("#rep-close");
ok("Cerrar la búsqueda", await page.isHidden("#replacebar"));

// Vista: zoom y modo lectura
await page.click('[data-rtab="vista"]');
const antes = await page.evaluate(() => window.__atril.settings().fontSize);
await page.click('[data-rpanel="vista"] [data-cmd="mas"]');
const despues = await page.evaluate(() => window.__atril.settings().fontSize);
ok("Vista: letra más grande", despues === antes + 2 && (await page.textContent("#ed-zoom")).endsWith("%"), `${antes} → ${despues}, ${await page.textContent("#ed-zoom")}`);
await page.click("#ed-menos");
ok("Zoom de la barra de estado", (await page.evaluate(() => window.__atril.settings().fontSize)) === antes);
await page.click('[data-rpanel="vista"] [data-cmd="leer"]');
await page.waitForSelector("#view-reader:not([hidden])");
ok("Vista: modo lectura abre el lector", true);

// Ajustes de letra
await page.click("#reader-aa");
const letras = await page.$$eval(".sheet .chips .chip", (xs) => xs.map((x) => x.textContent));
ok("La letra se elige entre «Como Word» y «Clásica»", letras.includes("Como Word") && letras.includes("Clásica"));
await page.click(".sheet >> text=Cerrar");

// Móvil
await page.setViewportSize({ width: 384, height: 832 });
await page.goto(URL + "#/");
await page.waitForSelector("#view-home:not([hidden])");
const altos = await page.$$eval("#home-actions .btn", (bs) => bs.map((b) => Math.round(b.getBoundingClientRect().height)));
ok("Los botones del inicio caben en una línea en el móvil", altos.every((x) => x <= 48), altos.join(", "));
await page.goto(URL + "#/editar/docs/" + ID);
await page.waitForSelector("#view-editor:not([hidden])");
const desborda = (sel) => page.evaluate((s) => { const b = document.querySelector(s); return b.scrollWidth > b.clientWidth + 1; }, sel);
ok("Barra azul y barra de estado caben en el móvil", !(await desborda("#view-editor .topbar")) && !(await desborda(".statusbar")));
await page.screenshot({ path: `${OUTDIR}/42-editor-movil.png` });

ok("Sin errores en la consola", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const fallos = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - fallos}/${results.length} pruebas superadas`);
process.exit(fallos ? 1 : 0);
