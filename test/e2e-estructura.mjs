// Pruebas de la reestructuración por pantallas (ideas de Kindle, Word, Logos y los cronómetros de oratoria):
// «Seguir donde lo dejaste», progreso y fijar en el inicio; panel lateral y barra de estado en el lector;
// semáforo, hora, «quedan» y pasar página tocando en Presentar; panel de navegación y atajos en el editor.
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
const errors = [];

const relleno = "Jehová es paciente con nosotros porque quiere que todos lleguen al arrepentimiento. Cuando imitamos esa paciencia, nuestras relaciones mejoran. ".repeat(4);
const HTML = `<h1>La paciencia</h1><h2>Introducción (2 min)</h2><p>${relleno}</p><p>${relleno}</p>
<h2>Por qué es importante (5 min)</h2><p><mark>La paciencia nos ayuda</mark> ${relleno}</p><p>${relleno}</p><p>${relleno}</p>
<h2>Cómo cultivarla (5 min)</h2><p>${relleno}</p><p>${relleno}</p><p>${relleno}</p>
<h2>Conclusión (2 min)</h2><p>${relleno}</p><p>${relleno}</p>`;

const browser = await pw.chromium.launch();
async function nueva(viewport) {
  const ctx = await browser.newContext({ viewport, hasTouch: true, isMobile: true, deviceScaleFactor: 1, locale: "es-ES" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(URL);
  await page.waitForSelector("#view-home:not([hidden])");
  await page.evaluate(async (html) => {
    localStorage.setItem("atril.hideInstall", "1");
    localStorage.setItem("atril.copia", String(Date.now()));
    localStorage.setItem("atril.consejoAcceso", "1");
    const A = window.__atril, now = Date.now();
    await A.store.put("docs", { id: "p1", title: "La paciencia", html, created: now - 3e8, updated: now - 2e8, target: 14 });
    await A.store.put("docs", { id: "p2", title: "El amor", html: "<h1>El amor</h1><p>" + "El amor es sufrido y bondadoso. ".repeat(80) + "</p>", created: now - 1e8, updated: now - 1e7 });
    await A.store.put("docs", { id: "p3", title: "La fe", html: "<p>" + "La fe es la expectativa segura. ".repeat(40) + "</p>", created: now, updated: now });
  }, HTML);
  await page.reload();
  await page.waitForSelector("#view-home:not([hidden])");
  return { ctx, page };
}
const abrir = async (page, ruta, vista) => { await page.goto(URL + ruta); await page.waitForSelector(`#view-${vista}:not([hidden])`); await page.waitForTimeout(250); };
const alFinal = (page) => page.evaluate(() => { const s = document.querySelector("#reader-scroll"); s.scrollTop = s.scrollHeight; });

// ===================== iPad en vertical =====================
{
  const { ctx, page } = await nueva({ width: 820, height: 1180 });

  // ---- Inicio: aún no se ha abierto nada ----
  ok("Sin haber leído nada no sale «Seguir donde lo dejaste»", await page.isHidden("#seguir"));
  ok("Sin haber leído nada no hay barras de progreso", (await page.$$(".card-prog")).length === 0);

  // ---- Lector: barra de estado (como el pie de Kindle) ----
  await abrir(page, "#/leer/docs/p1", "reader");
  ok("Barra de estado: parte en la que vas", (await page.textContent("#re-parte")).startsWith("Parte 1 de 4 · Introducción"), await page.textContent("#re-parte"));
  ok("Barra de estado: lo que queda según el objetivo", (await page.textContent("#re-quedan")) === "0 % · quedan ≈ 14 min", await page.textContent("#re-quedan"));
  ok("En vertical no hay panel lateral", await page.isHidden("#reader-side"));
  await page.click("#reader-outline-btn");
  ok("En vertical, «Esquema» sigue saliendo a pantalla completa", (await page.isVisible("#reader-outline")) && (await page.isHidden("#reader-estado")));
  await page.click("#reader-outline-btn");
  await page.evaluate(() => {
    const s = document.querySelector("#reader-scroll");
    const h = [...document.querySelectorAll("#reader-content h2")][2];
    s.scrollTop += h.getBoundingClientRect().top - s.getBoundingClientRect().top - 60;
  });
  await page.waitForTimeout(200);
  const estado = await page.textContent("#re-quedan");
  const m = estado.match(/^(\d+) % · quedan ≈ (\d+) min$/);
  ok("Al avanzar cambian la parte, el porcentaje y lo que queda", (await page.textContent("#re-parte")).startsWith("Parte 3 de 4") && m && Number(m[1]) > 30 && Number(m[2]) <= 8 && Number(m[2]) >= 5, `${await page.textContent("#re-parte")} | ${estado}`);
  await page.screenshot({ path: `${OUTDIR}/60-lector-estado.png` });
  await alFinal(page);
  await page.waitForTimeout(200);
  ok("Al final dice «100 % · final»", (await page.textContent("#re-quedan")) === "100 % · final", await page.textContent("#re-quedan"));
  await page.keyboard.press("Control+f");
  ok("⌘F / Ctrl+F abre la búsqueda en el lector", await page.isVisible("#findbar"));
  await page.keyboard.press("Escape");

  // ---- Inicio: seguir, progreso y fijar ----
  await page.evaluate(() => { const s = document.querySelector("#reader-scroll"); s.scrollTop = (s.scrollHeight - s.clientHeight) * 0.4; });
  await page.waitForTimeout(600);
  await abrir(page, "#/", "home");
  ok("Sale «Seguir donde lo dejaste» con el último discurso", (await page.isVisible("#seguir")) && (await page.textContent(".seg-titulo")) === "La paciencia");
  const meta = await page.textContent(".seg-meta");
  ok("Dice cuánto se ha leído y cuándo se abrió", /^Leído el \d+ % · abierto hoy, \d\d:\d\d$/.test(meta), meta);
  const anchoBarra = await page.$eval(".card-prog i", (i) => i.style.width);
  ok("La tarjeta del discurso lleva su barra de progreso", (await page.$$(".card-prog")).length === 1 && /^\d+%$/.test(anchoBarra), anchoBarra);
  await page.screenshot({ path: `${OUTDIR}/61-inicio-seguir.png` });
  await page.click("#seguir-leer");
  await page.waitForSelector("#view-reader:not([hidden])");
  await page.waitForTimeout(300);
  const pos = await page.evaluate(() => { const s = document.querySelector("#reader-scroll"); return s.scrollTop / (s.scrollHeight - s.clientHeight); });
  ok("«Seguir leyendo» vuelve al sitio", pos > 0.3 && pos < 0.5, pos.toFixed(2));
  await abrir(page, "#/", "home");
  await page.click("#seguir-presentar"); await page.click("#pc-ya");
  await page.waitForSelector("#pres-bar:not([hidden])");
  await page.waitForTimeout(300);
  ok("«Presentar» desde el inicio entra en Presentar desde el principio", (await page.evaluate(() => document.querySelector("#reader-scroll").scrollTop)) < 5 && (await page.textContent("#pres-parte")).startsWith("Parte 1 de 4"));
  await page.evaluate(() => window.__atril.presentar.salir());
  await abrir(page, "#/", "home");

  // Fijar arriba
  const titulos = () => page.$$eval("#list .card-title", (xs) => xs.map((x) => x.textContent));
  ok("Sin fijar, el orden es por fecha de edición", (await titulos())[0] === "La fe", (await titulos()).join(", "));
  await page.click("#list .card:has-text('El amor') .card-more");
  await page.click(".sheet >> text=Fijar arriba");
  await page.waitForTimeout(250);
  ok("«Fijar arriba» lo pone el primero y lo marca", (await titulos())[0] === "El amor" && (await page.textContent("#list .card:first-child .card-meta")).includes("Fijado"));
  const editado = await page.evaluate(async () => (await window.__atril.store.get("docs", "p2")).updated);
  ok("Fijar no cambia la fecha de edición", editado < Date.now() - 1e6);
  await page.click("#list .card:has-text('El amor') .card-more");
  ok("El menú ofrece quitarlo de arriba y presentar", (await page.isVisible(".sheet >> text=Quitar de arriba")) && (await page.isVisible(".sheet >> text=Presentar")));
  await page.click(".sheet >> text=Quitar de arriba");
  await page.waitForTimeout(250);
  ok("«Quitar de arriba» lo devuelve a su sitio", (await titulos())[0] === "La fe");
  await page.fill("#search", "amor");
  await page.waitForTimeout(300);
  ok("Al buscar no sale «Seguir donde lo dejaste»", await page.isHidden("#seguir"));
  await page.fill("#search", "");
  await page.waitForTimeout(250);

  // ---- Presentar: semáforo, hora, quedan y pasar página ----
  await abrir(page, "#/leer/docs/p1", "reader");
  await page.evaluate(() => { window.__atril.setFontSize(30); document.querySelector("#reader-scroll").scrollTop = 0; });
  await page.click("#reader-presentar"); await page.click("#pc-ya");
  await page.waitForSelector("#pres-bar:not([hidden])");
  ok("Presentar enseña la hora", /^\d\d:\d\d$/.test((await page.textContent("#pres-reloj")).trim()), await page.textContent("#pres-reloj"));
  ok("Antes de empezar enseña el objetivo", (await page.textContent("#pres-quedan")) === "Objetivo 14:00");
  ok("La barra de estado no sale al presentar", await page.isHidden("#reader-estado"));
  await page.click("#pres-timer");
  ok("En marcha: «Quedan» y semáforo en verde", (await page.textContent("#pres-quedan")).startsWith("Quedan 1") && (await page.$eval("#pres-timer", (b) => getComputedStyle(b).backgroundColor)) === "rgb(46, 125, 50)");
  // Pasar página tocando
  const top = () => page.evaluate(() => document.querySelector("#reader-scroll").scrollTop);
  const caja = await page.$eval("#reader-scroll", (s) => { const r = s.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top, h: r.height, ch: s.clientHeight }; });
  await page.touchscreen.tap(caja.x, caja.y + caja.h * 0.85);
  await page.waitForTimeout(700);
  const t1 = await top();
  ok("Tocar abajo avanza casi una pantalla", t1 > caja.ch * 0.7 && t1 < caja.ch, `${Math.round(t1)} de ${caja.ch}`);
  await page.touchscreen.tap(caja.x, caja.y + caja.h * 0.45);
  await page.waitForTimeout(700);
  ok("Tocar en medio no mueve nada", Math.abs((await top()) - t1) < 2);
  await page.touchscreen.tap(caja.x, caja.y + caja.h * 0.12);
  await page.waitForTimeout(700);
  ok("Tocar arriba vuelve atrás", (await top()) < 5, String(await top()));
  await page.evaluate(() => { const s = window.__atril.settings(); s.presToque = false; });
  await page.touchscreen.tap(caja.x, caja.y + caja.h * 0.85);
  await page.waitForTimeout(700);
  ok("Con el ajuste apagado, tocar no pasa página", (await top()) < 5);
  await page.evaluate(() => { const s = window.__atril.settings(); s.presToque = true; });
  // Último minuto y tiempo pasado
  await page.evaluate(() => { const t = window.__atril.timer; t.elapsed = 13 * 60 * 1000 + 20000; t.startedAt = Date.now(); t.paint(); });
  await page.waitForTimeout(100);
  ok("Último minuto: ámbar, raya arriba y destello", await page.evaluate(() => { const b = document.querySelector("#pres-bar"); return b.classList.contains("warn") && b.classList.contains("destello") && document.querySelector("#pres-timer").classList.contains("warn"); }));
  await page.screenshot({ path: `${OUTDIR}/62-presentar-ambar.png` });
  await page.evaluate(() => { const t = window.__atril.timer; t.elapsed = 15 * 60 * 1000; t.startedAt = Date.now(); t.paint(); });
  await page.waitForTimeout(100);
  ok("Pasado de tiempo: rojo y sin «Quedan»", await page.evaluate(() => document.querySelector("#pres-bar").classList.contains("over") && document.querySelector("#pres-quedan").hidden));
  await page.evaluate(() => { window.__atril.timer.reset(); window.__atril.presentar.salir(); });
  await ctx.close();
}

// ===================== iPad en horizontal =====================
{
  const { ctx, page } = await nueva({ width: 1180, height: 820 });
  await abrir(page, "#/leer/docs/p1", "reader");
  ok("En horizontal, el esquema sale al lado del texto", (await page.isVisible("#reader-side")) && (await page.isVisible("#reader-content")));
  ok("El botón «Esquema» se ve activo", (await page.getAttribute("#reader-outline-btn", "aria-pressed")) === "true");
  ok("El panel tiene los títulos y lo resaltado", (await page.$$("#reader-side-list .o-h")).length === 5 && (await page.$$("#reader-side-list .o-m")).length === 1);
  await page.click("#reader-side-list .o-h:has-text('Cómo cultivarla')");
  await page.waitForTimeout(300);
  const actual = await page.textContent("#reader-side-list .o-h.actual");
  ok("Tocar un título lleva a esa parte y la marca en el panel", actual.startsWith("Cómo cultivarla") && (await page.textContent("#re-parte")).startsWith("Parte 3 de 4"), actual);
  await page.screenshot({ path: `${OUTDIR}/63-lector-panel.png` });
  await page.evaluate(() => { const s = document.querySelector("#reader-scroll"); s.scrollTop = 0; });
  await page.waitForTimeout(250);
  ok("Al volver arriba el panel marca el principio", (await page.textContent("#reader-side-list .o-h.actual")).startsWith("La paciencia"));
  // Presentar oculta el panel y conserva el párrafo a la vista
  await page.evaluate(() => { const s = document.querySelector("#reader-scroll"); const h = [...document.querySelectorAll("#reader-content h2")][1]; s.scrollTop += h.getBoundingClientRect().top - s.getBoundingClientRect().top - 100; });
  await page.waitForTimeout(250);
  const antes = await page.evaluate(() => [...document.querySelectorAll("#reader-content h2")][1].getBoundingClientRect().top);
  await page.click("#reader-presentar"); await page.click("#pc-ya");
  await page.waitForSelector("#pres-bar:not([hidden])");
  const despues = await page.evaluate(() => [...document.querySelectorAll("#reader-content h2")][1].getBoundingClientRect().top);
  ok("Al presentar se quita el panel sin perder el sitio", (await page.isHidden("#reader-side")) && Math.abs(despues - antes) < 140, `${Math.round(antes)} → ${Math.round(despues)}`);
  await page.evaluate(() => window.__atril.presentar.salir());
  ok("Al salir de Presentar vuelve el panel", await page.isVisible("#reader-side"));
  await page.click("#reader-outline-btn");
  ok("«Esquema» cierra el panel", (await page.isHidden("#reader-side")) && (await page.getAttribute("#reader-outline-btn", "aria-pressed")) === "false");
  await abrir(page, "#/leer/docs/p2", "reader");
  ok("El panel cerrado se recuerda", await page.isHidden("#reader-side"));
  await page.click("#reader-outline-btn");
  ok("Y se vuelve a abrir con «Esquema»", await page.isVisible("#reader-side"));
  // Girar el iPad
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.waitForTimeout(250);
  ok("Al girar a vertical se quita el panel", await page.isHidden("#reader-side"));
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.waitForTimeout(250);
  ok("Al girar a horizontal vuelve", await page.isVisible("#reader-side"));

  // ---- Editor: panel de navegación y atajos ----
  await abrir(page, "#/editar/docs/p1", "editor");
  ok("Editor en horizontal: panel de navegación con los títulos", (await page.isVisible("#editor-side")) && (await page.$$eval("#editor-side-list .o-h .nav-ir", (xs) => xs.map((x) => x.textContent))).join("|").startsWith("La paciencia|Introducción|Por qué"));
  await page.click("#editor-side-list .o-h:has-text('Conclusión')");
  await page.waitForTimeout(250);
  ok("Tocar un título lleva a esa parte", (await page.textContent("#editor-side-list .o-h.actual")).startsWith("Conclusión"));
  await page.screenshot({ path: `${OUTDIR}/64-editor-panel.png` });
  // Atajos de teclado: ⌘⌥2 = Título 2, ⌘⇧X = tachado, ⌘F = buscar, ⌘S = guardar
  await page.evaluate(() => {
    const ed = document.querySelector("#editor");
    const p = ed.querySelectorAll("p")[0];
    const r = document.createRange(); r.setStart(p.firstChild, 0); r.setEnd(p.firstChild, 6);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r); ed.focus();
  });
  await page.keyboard.press("Control+Shift+KeyX");
  await page.waitForTimeout(100);
  ok("⌘⇧X tacha la selección", await page.evaluate(() => !!document.querySelector("#editor p s, #editor p strike, #editor p [style*='line-through']")));
  await page.keyboard.press("Control+Alt+Digit3");
  await page.waitForTimeout(100);
  ok("⌘⌥3 convierte el párrafo en Título 3", await page.evaluate(() => document.querySelectorAll("#editor h3").length === 1));
  await page.waitForTimeout(600);
  ok("El panel se actualiza con el nuevo título", (await page.$$("#editor-side-list .o-h3")).length === 1);
  await page.keyboard.press("Control+Alt+Digit0");
  await page.waitForTimeout(100);
  ok("⌘⌥0 lo devuelve a texto normal", await page.evaluate(() => document.querySelectorAll("#editor h3").length === 0));
  await page.keyboard.press("Control+s");
  await page.waitForTimeout(300);
  ok("⌘S guarda y lo dice", (await page.textContent("#toast")).includes("Guardado"));
  await page.keyboard.press("Control+f");
  ok("⌘F abre buscar y reemplazar", await page.isVisible("#replacebar"));
  await page.click("#rep-close");
  await page.click(".ribbon-tabs [data-rtab=vista]");
  await page.click('[data-cmd="navegacion"]');
  ok("Vista → «Panel de navegación» lo cierra", (await page.isHidden("#editor-side")) && (await page.getAttribute('[data-cmd="navegacion"]', "aria-pressed")) === "false");
  await page.click("#editor-more");
  await page.click(".sheet >> text=Atajos de teclado");
  ok("Hay una hoja con los atajos de teclado", (await page.$$(".sheet .atajo")).length >= 8);
  await page.click(".sheet >> text=Cerrar");
  await ctx.close();
}

// ===================== Móvil =====================
{
  const { ctx, page } = await nueva({ width: 384, height: 832 });
  await abrir(page, "#/leer/docs/p1", "reader");
  ok("Móvil: la barra de estado cabe encima de los botones", (await page.isVisible("#reader-estado")) && (await page.evaluate(() => document.querySelector("#reader-estado").getBoundingClientRect().bottom <= document.querySelector(".reader-tools").getBoundingClientRect().top + 1)));
  await page.click("#reader-presentar"); await page.click("#pc-ya");
  await page.waitForSelector("#pres-bar:not([hidden])");
  await page.click("#pres-timer");
  ok("Móvil: Presentar cabe a lo ancho", await page.evaluate(() => { const b = document.querySelector("#pres-bar"); return b.scrollWidth <= b.clientWidth + 1 && [...b.querySelectorAll(".pres-fila > *:not([hidden])")].every((x) => x.getBoundingClientRect().right <= innerWidth); }));
  await page.screenshot({ path: `${OUTDIR}/65-movil-presentar.png` });
  await page.evaluate(() => { window.__atril.timer.reset(); window.__atril.presentar.salir(); });
  await abrir(page, "#/", "home");
  const alto = await page.$$eval(".seg-btns .btn", (bs) => bs.map((b) => b.getBoundingClientRect().height));
  ok("Móvil: los botones de «Seguir» caben en una línea", alto.length === 2 && alto.every((h) => h < 56), alto.join(", "));
  await page.screenshot({ path: `${OUTDIR}/66-movil-inicio.png` });
  await ctx.close();
}

ok("Sin errores en la consola", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const fallos = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - fallos}/${results.length} pruebas superadas`);
process.exit(fallos ? 1 : 0);
