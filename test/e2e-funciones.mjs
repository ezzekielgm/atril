// Pruebas de citas bíblicas, esquema y tiempo objetivo. Uso: igual que e2e.mjs
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

const largo = "Este es un párrafo de relleno para que el discurso tenga una longitud realista y se pueda desplazar. ".repeat(12);
const HTML = `<h1>La esperanza que nos sostiene</h1>
<h2>Introducción (1 min)</h2><p>Empezamos leyendo Sal 37:4 con atención. ${largo}</p>
<h2>Punto principal (2 min)</h2><p>Pablo explica en 1 Cor. 13:4-7 cómo es el amor. <mark>El amor es paciente y bondadoso</mark>. ${largo}</p><p>${largo}</p>
<h2>Conclusión (1 min)</h2><p>Recordemos Juan 3:16 y Revelación 21:4. <mark>Hay un futuro mejor</mark>. ${largo}</p>`;

const browser = await pw.chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1.5 });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await page.goto(URL);
await page.waitForSelector("#view-home:not([hidden])");
const id = await page.evaluate(async (html) => {
  const id = "prueba1"; const now = Date.now();
  await window.__atril.store.put("docs", { id, title: "La esperanza", html, created: now, updated: now });
  return id;
}, HTML);
await page.goto(URL + "#/leer/docs/" + id);
await page.waitForSelector("#view-reader:not([hidden])");

// --- Citas bíblicas
const refs = await page.$$eval("#reader-content a.bref", (as) => as.map((a) => [a.textContent, a.getAttribute("href")]));
ok("Detecta las 4 citas", refs.length === 4, refs.map((r) => r[0]).join(" | "));
ok("Enlace a JW Library correcto (Sal 37:4)", refs[0] && refs[0][1] === "jwlibrary:///finder?srcid=jwlshare&wtlocale=S&prefer=lang&pub=nwtsty&bible=19037004");
ok("Rango 1 Cor. 13:4-7", refs[1] && refs[1][1].endsWith("bible=46013004-46013007"));
ok("Revelación 21:4", refs.some((r) => r[1].endsWith("bible=66021004")));
const htmlGuardado = await page.evaluate(async () => (await window.__atril.store.get("docs", "prueba1")).html);
ok("Los enlaces no se guardan en el documento", !htmlGuardado.includes("bref"));
await page.screenshot({ path: `${OUTDIR}/10-citas.png` });

// --- Esquema
await page.click("#reader-outline-btn");
await page.waitForSelector("#reader-outline:not([hidden])");
const esquema = await page.$$eval("#reader-outline .o-item", (xs) => xs.map((x) => x.className.split(" ").pop() + ":" + x.textContent.trim()));
ok("El esquema muestra títulos y resaltados", esquema.length === 6, esquema.join(" | "));
ok("Muestra los minutos de cada parte", (await page.$$eval("#reader-outline .o-min", (xs) => xs.map((x) => x.textContent))).join(",") === "1 min,2 min,1 min");
await page.screenshot({ path: `${OUTDIR}/11-esquema.png` });
await page.click("#reader-outline .o-m >> text=Hay un futuro mejor");
await page.waitForSelector("#reader-content:not([hidden])");
await page.waitForTimeout(200);
const salto = await page.evaluate(() => {
  const s = document.querySelector("#reader-scroll").getBoundingClientRect();
  const b = [...document.querySelectorAll("#reader-content p")].find((p) => p.textContent.includes("Hay un futuro mejor"));
  const r = b.getBoundingClientRect();
  return { top: Math.round(r.top - s.top), flash: b.classList.contains("flash") };
});
ok("Tocar un punto del esquema lleva a su sitio", salto.top >= 0 && salto.top < 200 && salto.flash, JSON.stringify(salto));

// --- Tiempo objetivo
await page.evaluate(() => { document.querySelector("#reader-scroll").scrollTop = 0; });
await page.click("#reader-aa");
await page.waitForSelector(".sheet >> text=Duración del discurso");
const info = await page.textContent(".sheet");
ok("Muestra la lectura estimada", /Lectura estimada: ≈ \d+ min/.test(info));
ok("Detecta las partes con minutos", info.includes("Hay 3 partes con minutos"));
await page.fill(".sheet .num-input", "5");
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUTDIR}/12-panel-tiempo.png` });
await page.click(".sheet >> text=Cerrar");
const target = await page.evaluate(async () => (await window.__atril.store.get("docs", "prueba1")).target);
ok("Guarda el objetivo (5 min)", target === 5, String(target));

await page.click("#timer-toggle");
await page.waitForTimeout(1200);
ok("Al empezar, va en tiempo", (await page.textContent("#pace")).includes("En tiempo"), await page.textContent("#pace"));
// Ir a la conclusión con poco tiempo transcurrido -> adelantado
await page.evaluate(() => { const s = document.querySelector("#reader-scroll"); s.scrollTop = s.scrollHeight; });
await page.waitForTimeout(700);
const adel = await page.textContent("#pace");
ok("Si vas por la conclusión enseguida: adelantado", adel.includes("Adelantado"), adel);
// Volver al principio con mucho tiempo -> retrasado
await page.evaluate(() => { document.querySelector("#reader-scroll").scrollTop = 0; const t = window.__atril.timer; t.elapsed = 150000; t.startedAt = Date.now(); t.paint(); });
await page.waitForTimeout(300);
const ret = await page.textContent("#pace");
ok("Si sigues en la introducción a los 2:30: retrasado", ret.includes("Retrasado"), ret);
await page.evaluate(() => { const t = window.__atril.timer; t.elapsed = 4.6 * 60000; t.startedAt = Date.now(); t.paint(); });
ok("Cerca del final, el cronómetro se pone naranja", await page.evaluate(() => document.querySelector("#timer").classList.contains("warn")));
await page.evaluate(() => { const t = window.__atril.timer; t.elapsed = 6 * 60000; t.startedAt = Date.now(); t.paint(); });
const pas = await page.textContent("#pace");
ok("Al pasarse, rojo y «Te pasas»", await page.evaluate(() => document.querySelector("#timer").classList.contains("over")) && pas.includes("Te pasas 1:0"), pas);
await page.screenshot({ path: `${OUTDIR}/13-ritmo.png` });

// --- Cronómetro flotante en modo atril
await page.tap("#reader-content p >> nth=1");
await page.waitForTimeout(300);
const flot = await page.evaluate(() => { const f = document.querySelector("#float-timer"); return { visible: !f.hidden && getComputedStyle(f).display !== "none", txt: f.textContent, cls: f.className }; });
ok("En modo atril se ve un cronómetro pequeño", flot.visible && /\d+:\d\d/.test(flot.txt) && flot.cls.includes("over"), JSON.stringify(flot));
await page.screenshot({ path: `${OUTDIR}/14-modo-atril-cronometro.png` });
await page.click("#float-timer");
ok("Tocarlo pausa el cronómetro", await page.evaluate(() => !window.__atril.timer.running));

// --- Inicio: tiempo estimado y objetivo en la tarjeta
await page.goto(URL + "#/");
await page.waitForSelector(".card");
const meta = await page.textContent(".card-meta");
ok("La tarjeta muestra tiempo estimado y objetivo", /≈ \d+ min/.test(meta) && meta.includes("objetivo 5 min"), meta);

// --- Ajuste: citas en jw.org
await page.click("#btn-settings");
await page.click(".sheet >> text=Abrir en jw.org");
await page.click(".sheet >> text=Cerrar");
await page.goto(URL + "#/leer/docs/" + id);
await page.waitForSelector("#view-reader:not([hidden])");
const href = await page.getAttribute("#reader-content a.bref", "href");
ok("Con el ajuste «jw.org» enlaza a la web", href.startsWith("https://www.jw.org/finder?") && href.endsWith("bible=19037004"), href);

// --- Vista de móvil
await page.setViewportSize({ width: 390, height: 844 });
await page.evaluate(() => { const t = window.__atril.timer; t.elapsed = 30000; t.running = false; t.paint(); });
await page.screenshot({ path: `${OUTDIR}/15-movil.png` });
const desborda = await page.evaluate(() => { const b = document.querySelector(".reader-bar"); return b.scrollWidth > b.clientWidth + 1; });
ok("La barra del lector cabe en un móvil", !desborda);

ok("Sin errores en la consola", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const fallos = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - fallos}/${results.length} pruebas superadas`);
process.exit(fallos ? 1 : 0);
