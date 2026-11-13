// Cronómetro también en el editor (a petición de Ezequiel: «tener el cronómetro en todos los casos,
// incluso cuando estoy escribiendo un discurso nuevo»).
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
const errors = [];
const vigilar = (page) => {
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
};

// ============ iPad (táctil) ============
const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1.5, locale: "es-ES" });
const page = await ctx.newPage();
vigilar(page);
await page.goto(URL);
await page.waitForSelector("#view-home:not([hidden])");
const t = () => page.evaluate(() => window.__atril.timer);
const texto = () => page.textContent("#editor-timer-text");
const idActual = () => page.evaluate(() => location.hash.split("/").pop());

// Discurso nuevo con plantilla de 10 minutos
await page.click("text=Escribir uno nuevo");
await page.click(".sheet >> text=Con plantilla");
await page.fill('.sheet input[type="text"]', "Discurso nuevo");
await page.fill(".sheet .num-input", "10");
await page.dispatchEvent(".sheet .num-input", "change");
await page.click(".sheet >> text=Crear");
await page.waitForSelector("#view-editor:not([hidden])");
const ID = await idActual();
ok("El editor de un discurso nuevo tiene el cronómetro", await page.isVisible("#editor-timer-toggle") && (await texto()) === "00:00", await texto());
ok("A cero no hay botón de poner a cero", await page.isHidden("#editor-timer-reset"));

// Escribiendo: tocar el cronómetro no quita el cursor del texto
await page.click("#editor p");
const antes = await page.evaluate(() => document.activeElement && document.activeElement.id);
await page.tap("#editor-timer-toggle");
await page.waitForTimeout(1300);
const st = await t();
ok("Se pone en marcha al tocarlo", st.running && /^00:0[1-2]$/.test(await texto()), await texto());
ok("…sin quitar el cursor del texto (el teclado no se cierra)", antes === "editor" && (await page.evaluate(() => document.activeElement && document.activeElement.id)) === "editor", antes);
ok("En el editor es un cronómetro sin más (no empieza un ensayo)", st.libre && !(await page.evaluate(() => window.__atril.ensayo.activo)) && st.docKey === "docs/" + ID, st.docKey);
await page.screenshot({ path: `${OUTDIR}/crono-editor-ipad.png` });

// Se sigue escribiendo con el cronómetro en marcha
await page.keyboard.type(" Hola");
ok("Se puede seguir escribiendo", (await page.textContent("#editor")).includes("Hola"));

// Pausa y poner a cero (tocar)
await page.tap("#editor-timer-toggle");
ok("Se pausa al tocarlo otra vez y aparece «poner a cero»", !(await t()).running && await page.isVisible("#editor-timer-reset"));

// Colores: ámbar en el último minuto, rojo al pasarse del objetivo (10 min)
await page.evaluate(() => { const tm = window.__atril.timer; tm.elapsed = 9.5 * 60e3; tm.paint(); });
ok("Ámbar en el último minuto del objetivo", await page.evaluate(() => document.querySelector("#editor-timer").classList.contains("warn")));
await page.evaluate(() => { const tm = window.__atril.timer; tm.elapsed = 10.5 * 60e3; tm.paint(); });
ok("Rojo al pasarse", await page.evaluate(() => document.querySelector("#editor-timer").classList.contains("over")) && (await texto()) === "10:30");
await page.screenshot({ path: `${OUTDIR}/crono-editor-rojo.png` });
await page.evaluate(() => { const tm = window.__atril.timer; tm.elapsed = 40e3; tm.paint(); });

// Al pasar a leer el mismo discurso, el cronómetro sigue igual
await page.click("#editor-read");
await page.waitForSelector("#view-reader:not([hidden])");
ok("Al pasar a Leer sigue el mismo tiempo", (await page.textContent("#timer-text")) === "00:40", await page.textContent("#timer-text"));
await page.tap("#timer-toggle");
await page.waitForTimeout(300);
ok("…y se puede seguir desde el lector", (await t()).running);
await page.tap("#timer-toggle");
// Vuelta al editor: el mismo cronómetro
await page.click("#reader-edit");
await page.waitForSelector("#view-editor:not([hidden])");
ok("Vuelta al editor: el mismo cronómetro", (await texto()) === (await page.textContent("#timer-text")) && (await texto()) !== "00:00", await texto());

// A cero: lo puesto en marcha en el editor no se guarda como ensayo
await page.tap("#editor-timer-reset");
await page.waitForTimeout(300);
const d = await page.evaluate((id) => window.__atril.store.get("docs", id), ID);
ok("A cero (no cuenta como ensayo)", (await texto()) === "00:00" && !(d.ensayos || []).length, String((d.ensayos || []).length));

// Un ensayo empezado en el lector sigue en marcha al ir a editar y se guarda al ponerlo a cero
await page.click("#editor-read");
await page.waitForSelector("#view-reader:not([hidden])");
await page.tap("#timer-toggle");
ok("En el lector sí es un ensayo", await page.evaluate(() => window.__atril.ensayo.activo && !window.__atril.timer.libre));
await page.click("#reader-edit");
await page.waitForSelector("#view-editor:not([hidden])");
ok("Al ir a editar, el ensayo sigue en marcha", (await t()).running && await page.evaluate(() => document.querySelector("#editor-timer").classList.contains("running")));
await page.evaluate(() => { const tm = window.__atril.timer; tm.startedAt -= 45e3; tm.paint(); });
await page.tap("#editor-timer-toggle");
await page.tap("#editor-timer-reset");
await page.waitForTimeout(500);
const d2 = await page.evaluate((id) => window.__atril.store.get("docs", id), ID);
ok("…y al ponerlo a cero en el editor se guarda el ensayo", (d2.ensayos || []).length === 1, String((d2.ensayos || []).length));

// Otro documento: el cronómetro empieza de cero
await page.tap("#editor-timer-toggle");
await page.waitForTimeout(200);
await page.evaluate(() => { location.hash = "#/"; });
await page.waitForSelector("#view-home:not([hidden])");
await page.click("#home-actions >> text=Nuevo discurso");
await page.click(".sheet >> text=En blanco");
await page.waitForSelector("#view-editor:not([hidden])");
ok("Al abrir otro documento, el cronómetro empieza de cero", (await texto()) === "00:00" && !(await t()).running, await texto());

// Notas: también lo tienen
await page.evaluate(() => { location.hash = "#/"; });
await page.waitForSelector("#view-home:not([hidden])");
const nota = await page.evaluate(async () => {
  const n = { id: "n-crono", title: "Nota", html: "<p>Una nota</p>", created: Date.now(), updated: Date.now() };
  await window.__atril.store.put("notes", n);
  return n.id;
});
await page.evaluate((id) => { location.hash = `#/editar/notes/${id}`; }, nota);
await page.waitForSelector("#view-editor:not([hidden])");
ok("Las notas también tienen el cronómetro", await page.isVisible("#editor-timer-toggle"));
await page.setViewportSize({ width: 820, height: 1180 });
await page.waitForTimeout(300);
ok("iPad en vertical: cabe en la barra", await page.evaluate(() => { const b = document.querySelector("#view-editor .word-bar"); return b.scrollWidth <= b.clientWidth + 1 && document.querySelector("#editor-more").getBoundingClientRect().right <= b.getBoundingClientRect().right + 0.5; }));
await ctx.close();

// ============ Móvil ============
const ctxM = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, locale: "es-ES" });
const pm = await ctxM.newPage();
vigilar(pm);
await pm.goto(URL);
await pm.waitForSelector("#view-home:not([hidden])");
await pm.click("text=Escribir uno nuevo");
await pm.click(".sheet >> text=En blanco");
await pm.waitForSelector("#view-editor:not([hidden])");
await pm.fill("#editor-title", "Mi discurso nuevo");
await pm.click("#editor");
const caja = await pm.evaluate(() => {
  const r = (s) => document.querySelector(s).getBoundingClientRect();
  const bar = r("#view-editor .word-bar"), tm = r("#editor-timer-toggle"), ti = r("#editor-title"), mas = r("#editor-more");
  return { visible: tm.width > 0 && tm.right <= bar.right, titulo: ti.width, alto: tm.height, mas: mas.right <= bar.right + 0.5, desborda: document.querySelector("#view-editor .word-bar").scrollWidth > bar.width + 1 };
});
ok("Móvil: cabe en la barra del editor sin desbordar", caja.visible && caja.mas && !caja.desborda && caja.titulo >= 110 && caja.alto >= 36, JSON.stringify(caja));
await pm.screenshot({ path: `${OUTDIR}/crono-editor-movil.png` });
await ctxM.close();

// ============ Ordenador (diseño de escritorio) ============
const ctxD = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "es-ES" });
const pd = await ctxD.newPage();
vigilar(pd);
await pd.goto(URL);
await pd.waitForSelector("#view-home:not([hidden])");
await pd.keyboard.press("Control+n");
await pd.click(".sheet >> text=En blanco");
await pd.waitForSelector("#view-editor:not([hidden])");
await pd.fill("#editor-title", "Discurso del PC");
ok("Ordenador: el editor tiene el cronómetro", await pd.isVisible("#editor-timer-toggle"));
await pd.click("#menubar >> text=Discurso");
await pd.click(".menu-lista >> text=Poner en marcha el cronómetro");
await pd.waitForTimeout(200);
ok("Ordenador: menú Discurso → Poner en marcha el cronómetro", await pd.evaluate(() => window.__atril.timer.running));
await pd.click("#menubar >> text=Discurso");
ok("…y el menú ya dice «Parar el cronómetro»", await pd.isVisible(".menu-lista >> text=Parar el cronómetro"));
await pd.keyboard.press("Escape");
await pd.screenshot({ path: `${OUTDIR}/crono-editor-pc.png` });
await ctxD.close();

await browser.close();
ok("Sin errores en la consola", errors.length === 0, errors.slice(0, 3).join(" | "));
const fallos = results.filter((r) => !r.pass);
console.log(`\n${results.length - fallos.length}/${results.length} pruebas superadas`);
process.exit(fallos.length ? 1 : 0);
