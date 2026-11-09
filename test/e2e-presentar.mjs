// Pruebas de «Presentar» (pantalla bloqueada), volver donde estabas si la app se cierra, sustituir la versión de un Word,
// bienvenida con ejemplo, botones con nombre y barra de abajo en el móvil. Uso: igual que e2e.mjs.
import fs from "node:fs";
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
const pulsar = async (page, sel, ms) => { await page.hover(sel); await page.mouse.down(); await page.waitForTimeout(ms); await page.mouse.up(); };

const browser = await pw.chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1.5, locale: "es-ES", acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

// ============ Vista previa del enlace ============
const html = await (await fetch(URL)).text();
ok("El enlace se ve con nombre, descripción e imagen al mandarlo", /og:title" content="Atril, lector de discursos"/.test(html) && /og:description" content="Lee tus discursos de Word/.test(html) && /og:image" content="https:\/\/[^"]+\/icons\/og\.jpg"/.test(html));
ok("La imagen de la vista previa existe", (await fetch(URL + "icons/og.jpg")).ok);

// ============ Bienvenida y ejemplo ============
await page.goto(URL);
await page.waitForSelector("#view-home:not([hidden])");
ok("Al entrar por primera vez se explica qué es la app", (await page.isVisible("text=Atril, tu lector de discursos")) && (await page.isVisible(".bv-pasos")) && (await page.isHidden("#home-actions")));
await page.screenshot({ path: `${OUTDIR}/50-bienvenida.png` });
await page.click("text=¿Cómo paso el Word del PC al iPad?");
ok("Explica cómo pasar el Word del PC al iPad", (await page.textContent(".sheet")).includes("OneDrive"));
await page.click(".sheet >> text=Cerrar");
await page.click("text=Probar con un ejemplo");
await page.waitForSelector("#view-reader:not([hidden])");
const ej = await page.evaluate(() => window.__atril.reader.item);
ok("«Probar con un ejemplo» abre un discurso de muestra", ej.title === "Ejemplo: la paciencia" && ej.target === 5);

// ============ Botones con nombre ============
const nombres = await page.$$eval(".reader-tools .tool .lbl", (xs) => xs.map((x) => x.textContent));
ok("Los botones del lector llevan su nombre", nombres.join(",") === "Esquema,Letra,Presentar,Editar,Más", nombres.join(","));
ok("«Volver» dice a dónde", (await page.textContent("#reader-back")).includes("Discursos"));
await page.screenshot({ path: `${OUTDIR}/51-lector-botones.png` });

// ============ Presentar ============
await page.evaluate(() => { window.__atril.setFontSize(56); document.querySelector("#reader-scroll").scrollTop = 0; });
await page.waitForTimeout(200);
await page.click("#reader-presentar");
await page.waitForSelector("#pres-bar:not([hidden])");
if (await page.isVisible(".sheet >> text=Entendido")) await page.click(".sheet >> text=Entendido");
ok("Presentar: barra con cronómetro grande y la parte actual", (await page.isHidden(".reader-bar")) && (await page.textContent("#pres-parte")).startsWith("Parte 1 de 4") && (await page.textContent("#pres-sigue")).startsWith("Sigue: Por qué vale la pena"),
  `${await page.textContent("#pres-parte")} | ${await page.textContent("#pres-sigue")}`);
ok("El cronómetro está quieto hasta que lo tocas", (await page.textContent("#pres-hint")) === "Toca para empezar" && !(await page.evaluate(() => window.__atril.timer.running)));
await page.click("#pres-timer");
ok("Un toque lo pone en marcha", await page.evaluate(() => window.__atril.timer.running));
await page.click("#pres-timer");
ok("Otro toque no lo para (hay que mantenerlo pulsado)", await page.evaluate(() => window.__atril.timer.running));
await page.tap("#reader-content p >> nth=1");
await page.waitForTimeout(450);
ok("Tocar el texto no cambia nada", (await page.isVisible("#pres-bar")) && !(await page.evaluate(() => document.querySelector("#view-reader").classList.contains("immersive"))));
ok("Las citas no sacan de la app", await page.evaluate(() => getComputedStyle(document.querySelector("#reader-content a.bref")).pointerEvents === "none"));
await page.evaluate(() => {
  const s = document.querySelector("#reader-scroll");
  const h = [...document.querySelectorAll("#reader-content h2")][2];
  s.scrollTop += h.getBoundingClientRect().top - s.getBoundingClientRect().top - 120;
});
await page.waitForTimeout(300);
ok("La parte se actualiza al avanzar", (await page.textContent("#pres-parte")).startsWith("Parte 3 de 4"), await page.textContent("#pres-parte"));
await page.screenshot({ path: `${OUTDIR}/52-presentar.png` });
await pulsar(page, "#pres-timer", 900);
ok("Mantener pulsado pausa el cronómetro", !(await page.evaluate(() => window.__atril.timer.running)));
await page.click("#pres-timer");
ok("Un toque lo reanuda", await page.evaluate(() => window.__atril.timer.running));
await page.click("#pres-salir");
ok("Un toque en «Salir» no sale", await page.isVisible("#pres-bar"));

// ============ Si la app se cierra sin querer ============
const antes = await page.evaluate(() => { const t = window.__atril.timer; t.startedAt -= 60000; t.paint(); return t.ms(); });
await page.goto(URL); // como si se abriera de nuevo desde el icono
await page.waitForSelector("#view-reader:not([hidden])", { timeout: 5000 }).catch(() => {});
const vuelta = await page.evaluate(() => ({ vista: !document.querySelector("#view-reader").hidden, presentando: window.__atril.presentar.activo, corre: window.__atril.timer.running, ms: window.__atril.timer.ms(), titulo: window.__atril.reader.item && window.__atril.reader.item.title }));
ok("Al volver a abrir Atril, está en el mismo discurso y presentando", vuelta.vista && vuelta.presentando && vuelta.titulo === "Ejemplo: la paciencia", JSON.stringify(vuelta));
ok("El cronómetro no se ha parado", vuelta.corre && vuelta.ms >= antes, `${Math.round(antes / 1000)} s → ${Math.round(vuelta.ms / 1000)} s`);
await pulsar(page, "#pres-salir", 1100);
ok("Mantener pulsado «Salir» sale de presentar", (await page.isHidden("#pres-bar")) && (await page.isVisible(".reader-bar")));
await page.click("#timer-toggle");
await page.click("#timer-reset");
await page.waitForTimeout(300);
await page.click("#reader-back");
await page.waitForSelector("#view-home:not([hidden])");
await page.goto(URL);
await page.waitForSelector("#view-home:not([hidden])");
ok("Si sales tú, al abrir de nuevo se queda en el inicio", await page.isVisible("#view-home"));

// ============ Sustituir la versión de un Word ============
const v1 = `${OUTDIR}/Mi discurso.docx`;
fs.writeFileSync(v1, Buffer.from(await (await buildDocx("Mi discurso", "<h1>Mi discurso</h1><p>Primera versión del texto.</p>")).arrayBuffer()));
await page.setInputFiles("#file-input", v1);
await page.waitForSelector("#view-reader:not([hidden])");
const id1 = await page.evaluate(() => window.__atril.reader.id);
await page.evaluate(async (id) => {
  const it = await window.__atril.store.get("docs", id);
  it.target = 7; it.dado = [{ id: "d", fecha: "2026-10-01", lugar: "Norte", notas: "" }];
  it.ensayos = [{ id: "e", fecha: Date.now(), seg: 400, objetivoSeg: 420, partes: [], audio: false }];
  await window.__atril.store.put("docs", it);
}, id1);
fs.writeFileSync(v1, Buffer.from(await (await buildDocx("Mi discurso", "<h1>Mi discurso</h1><p>Segunda versión, corregida en el PC.</p>")).arrayBuffer()));
await page.click("#reader-back");
await page.waitForSelector("#view-home:not([hidden])");
await page.setInputFiles("#file-input", v1);
await page.waitForSelector(".sheet >> text=Sustituir por esta versión");
ok("Al abrir otra vez el mismo Word, pregunta si sustituirlo", (await page.textContent(".sheet h2")) === "Ya tienes «Mi discurso»");
await page.screenshot({ path: `${OUTDIR}/53-sustituir.png` });
await page.click(".sheet >> text=Sustituir por esta versión");
await page.waitForSelector("#view-reader:not([hidden])");
const sust = await page.evaluate(async () => ({ id: window.__atril.reader.id, docs: (await window.__atril.store.all("docs")).length, it: window.__atril.reader.item }));
ok("Sustituye el texto en el mismo discurso", sust.id === id1 && sust.it.html.includes("Segunda versión") && sust.docs === 2, `${sust.docs} discursos`);
ok("Conserva ensayos, duración y dónde lo diste", sust.it.target === 7 && sust.it.ensayos.length === 1 && sust.it.dado.length === 1);
await page.click("#reader-back");
await page.waitForSelector("#view-home:not([hidden])");
await page.setInputFiles("#file-input", v1);
await page.click(".sheet >> text=Añadir como otro discurso");
await page.waitForSelector("#view-reader:not([hidden])");
ok("O lo añade como otro discurso", (await page.evaluate(async () => (await window.__atril.store.all("docs")).length)) === 3);

// ============ Móvil ============
await page.setViewportSize({ width: 384, height: 832 });
await page.goto(URL + "#/leer/docs/" + id1);
await page.waitForSelector("#view-reader:not([hidden])");
await page.waitForTimeout(300);
const barra = await page.evaluate(() => {
  const r = document.querySelector(".reader-tools").getBoundingClientRect();
  const h = document.querySelector(".reader-bar");
  return { abajo: Math.round(innerHeight - r.bottom), alto: Math.round(r.height), desborda: h.scrollWidth > h.clientWidth + 1 };
});
ok("En el móvil, las herramientas van abajo", barra.abajo <= 1 && barra.alto >= 56, JSON.stringify(barra));
ok("La barra de arriba cabe", !barra.desborda);
await page.screenshot({ path: `${OUTDIR}/54-movil-barra.png` });
await page.tap("#reader-content p >> nth=0");
await page.waitForTimeout(500);
ok("En modo atril, la barra de abajo también se esconde", await page.evaluate(() => document.querySelector(".reader-tools").getBoundingClientRect().top >= innerHeight - 2));
await page.tap("#reader-content p >> nth=0");
await page.waitForTimeout(500);
await page.click("#reader-presentar");
await page.waitForSelector("#pres-bar:not([hidden])");
const pres = await page.evaluate(() => { const b = document.querySelector("#pres-bar"); return b.scrollWidth <= b.clientWidth + 1; });
ok("Presentar cabe en el móvil", pres);
await page.screenshot({ path: `${OUTDIR}/55-movil-presentar.png` });

ok("Sin errores en la consola", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const fallos = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - fallos}/${results.length} pruebas superadas`);
process.exit(fallos ? 1 : 0);
