// Diseño de escritorio (pantalla grande con ratón): menús, biblioteca, panel del discurso, Ctrl+K,
// Presentar a pantalla completa y que en el iPad no cambie nada. Uso: igual que e2e.mjs (dist/ en el 8080).
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
const browser = await pw.chromium.launch();

const HTML = `<h1>La alegría</h1><h2>Introducción (2 min)</h2><p>Lea Filipenses 4:4 y Gálatas 5:22.</p><blockquote class="versiculo"><p>Estén siempre alegres en el Señor. (Filipenses 4:4)</p></blockquote><h2>Desarrollo (8 min)</h2><p>${"Texto del desarrollo con muchas palabras. ".repeat(60)}</p><h2>Conclusión (2 min)</h2><p>Final.</p>`;
async function sembrar(page) {
  await page.evaluate(async (html) => {
    localStorage.setItem("atril.hideInstall", "1"); localStorage.setItem("atril.copia", String(Date.now() + 60000)); localStorage.setItem("atril.guiaVista", "1"); localStorage.setItem("atril.consejoAcceso", "1");
    const s = window.__atril.store, now = Date.now() - 60000;
    await s.put("docs", { id: "a1", title: "La alegría", html: window.__atril.sanitize(html), created: now, updated: now, target: 12,
      ensayos: [1, 2, 3].map((k) => ({ id: "e" + k, fecha: now - k * 86400000, seg: 700 + k * 20, objetivoSeg: 720, partes: [], audio: false })),
      dado: [{ id: "x", fecha: "2026-10-05", lugar: "Congregación Norte", notas: "" }] });
    await s.put("docs", { id: "a2", title: "La paciencia", html: "<h1>La paciencia</h1><p>Texto.</p>", created: now - 5000, updated: now - 5000, target: 5 });
    await s.put("notes", { id: "n1", title: "Ideas sueltas", html: "<p>Una idea.</p>", created: now, updated: now });
  }, HTML);
}
async function nuevo(opts) {
  const ctx = await browser.newContext({ locale: "es-ES", deviceScaleFactor: 1, ...opts });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(URL);
  await page.waitForSelector("#view-home:not([hidden])");
  await sembrar(page);
  await page.reload();
  await page.waitForSelector("#view-home:not([hidden])");
  await page.waitForTimeout(400);
  return { ctx, page };
}
const visible = (page, sel) => page.evaluate((s) => { const n = document.querySelector(s); if (!n) return false; const r = n.getBoundingClientRect(); return getComputedStyle(n).display !== "none" && r.width > 0 && r.height > 0; }, sel);

// =================== Ordenador ===================
{
  const { ctx, page } = await nuevo({ viewport: { width: 1440, height: 900 } });
  ok("En pantalla grande con ratón se activa el diseño de escritorio", await page.evaluate(() => document.documentElement.classList.contains("ancho")));
  ok("Barra de menús y biblioteca a la vista", (await visible(page, "#menubar")) && (await visible(page, "#biblioteca")));
  ok("Sin la cabecera grande del iPad", !(await visible(page, ".home-hero")));
  const tiles = await page.locator("#home-resumen > div").count();
  ok("El inicio enseña un resumen (discursos, ensayos, último dado, copia)", tiles === 4, String(tiles));
  const filas = await page.locator("#bib-lista .bib-item .bib-tit").allTextContents();
  ok("La biblioteca lista discursos y notas", filas.join("|") === "La alegría|La paciencia|Ideas sueltas", filas.join("|"));
  ok("Con su duración", (await page.locator('#bib-lista .bib-item[data-id="a1"] .bib-min').textContent()) === "12′");

  // Abrir desde la biblioteca
  await page.click('#bib-lista .bib-item[data-id="a1"]');
  await page.waitForSelector("#view-reader:not([hidden])");
  await page.waitForTimeout(500);
  ok("Un clic en la biblioteca abre el discurso", (await page.textContent("#reader-title")) === "La alegría");
  ok("Y lo marca en la lista", await page.locator('#bib-lista .bib-item.activo[data-id="a1"]').count() === 1);
  ok("Panel del discurso a la derecha", await visible(page, "#inspector"));
  const tiempo = await page.textContent("#insp-tiempo");
  ok("Tiempo estimado frente al objetivo", /≈ \d+:\d\d de 12:00/.test(tiempo), tiempo.slice(0, 60));
  ok("Una barra por parte", (await page.locator("#insp-tiempo .insp-barra i").count()) === 3, String(await page.locator("#insp-tiempo .insp-barra i").count()));
  ok("El esquema va en el panel", await visible(page, "#inspector #reader-side .side-list"));
  ok("Ensayos en barras", (await page.locator("#insp-ensayos .insp-ensayos i").count()) === 3);
  ok("Citas con cuántas tienen el texto", (await page.textContent("#insp-citas .insp-h small")) === "1 de 2 con texto");
  ok("Dónde lo he dado", (await page.textContent("#insp-dado")).includes("Congregación Norte"));
  const r = await page.evaluate(() => { const v = document.querySelector("#view-reader").getBoundingClientRect(); return { l: Math.round(v.left), r: Math.round(v.right) }; });
  ok("El discurso, entre la biblioteca y el panel", r.l === 264 && r.r === 1440 - 312, JSON.stringify(r));
  await page.screenshot({ path: `${OUTDIR}/escritorio-lector.png` });

  // Una cita del panel abre su menú
  await page.click('#insp-citas .insp-cita:not(.tiene)');
  await page.waitForSelector("#overlay:not([hidden]) .sheet");
  ok("Tocar una cita del panel abre su menú", (await page.textContent("#overlay .sheet h2")) === "Gálatas 5:22");
  await page.keyboard.press("Escape");
  ok("Escape cierra la hoja", await page.locator("#overlay").isHidden());

  // Menús
  await page.click(".menubar-btn >> text=Archivo");
  ok("El menú Archivo se abre", await visible(page, ".menu-lista"));
  const items = await page.locator(".menu-lista .menu-item .menu-txt").allTextContents();
  ok("Con sus órdenes", items.includes("Abrir un Word…") && items.includes("Guardar como PDF…") && items.includes("Hacer copia de seguridad"), items.join("|"));
  await page.hover(".menubar-btn >> text=Ver");
  ok("Pasar el ratón a otro menú lo cambia", (await page.locator(".menu-lista .menu-txt").allTextContents()).includes("Panel del discurso (derecha)"));
  await page.click(".menu-lista .menu-item >> text=Panel del discurso (derecha)");
  await page.waitForTimeout(200);
  ok("Ver → Panel del discurso lo quita y el texto se ensancha", !(await visible(page, "#inspector")) && (await page.evaluate(() => Math.round(document.querySelector("#view-reader").getBoundingClientRect().right))) === 1440);
  await page.click(".menubar-btn >> text=Ver");
  await page.click(".menu-lista .menu-item >> text=Panel del discurso (derecha)");
  await page.waitForTimeout(200);
  ok("Y lo vuelve a poner", await visible(page, "#inspector"));
  await page.click(".menubar-btn >> text=Editar");
  ok("En el lector, «Deshacer» está apagado", await page.locator('.menu-lista .menu-item.apagado >> text=Deshacer').count() === 1);
  await page.keyboard.press("Escape");
  ok("Escape cierra el menú", await page.locator(".menu-lista").count() === 0);

  // Ctrl+E al editor
  await page.keyboard.press("Control+e");
  await page.waitForSelector("#view-editor:not([hidden])");
  await page.waitForTimeout(500);
  ok("Ctrl+E pasa al editor", true);
  ok("La navegación del editor va en el panel", await visible(page, "#inspector #editor-side .side-list"));
  const antes = await page.textContent("#insp-tiempo .insp-grande b");
  await page.evaluate(() => { const p = document.querySelector("#editor p:last-of-type"); p.textContent += " " + "palabra ".repeat(260); p.dispatchEvent(new InputEvent("input", { bubbles: true })); });
  await page.waitForFunction((a) => document.querySelector("#insp-tiempo .insp-grande b").textContent !== a, antes, { timeout: 5000 }).catch(() => {});
  ok("El tiempo del panel cambia al escribir", (await page.textContent("#insp-tiempo .insp-grande b")) !== antes, antes + " → " + (await page.textContent("#insp-tiempo .insp-grande b")));
  await page.screenshot({ path: `${OUTDIR}/escritorio-editor.png` });
  await page.keyboard.press("Control+e");
  await page.waitForSelector("#view-reader:not([hidden])");

  // Ctrl+K
  await page.keyboard.press("Control+k");
  await page.waitForSelector(".sheet.paleta input:focus");
  await page.keyboard.type("pacien");
  await page.waitForTimeout(150);
  ok("Ctrl+K busca en todo", (await page.locator(".paleta-fila").first().textContent()).includes("La paciencia"));
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector("#reader-title") && document.querySelector("#reader-title").textContent === "La paciencia");
  ok("Y Enter lo abre", true);

  // Presentar con F5, a pantalla completa
  await page.click('#bib-lista .bib-item[data-id="a1"]');
  await page.waitForFunction(() => document.querySelector("#reader-title").textContent === "La alegría");
  await page.keyboard.press("F5");
  await page.waitForSelector("#pc-ya");
  await page.click("#pc-ya");
  await page.waitForTimeout(400);
  const pres = await page.evaluate(() => { const v = document.querySelector("#view-reader").getBoundingClientRect(); return { l: v.left, r: v.right, t: v.top }; });
  ok("F5 → Presentar ocupa toda la ventana", pres.l === 0 && pres.r === 1440 && pres.t === 0 && !(await visible(page, "#menubar")) && !(await visible(page, "#biblioteca")) && !(await visible(page, "#inspector")), JSON.stringify(pres));
  await page.screenshot({ path: `${OUTDIR}/escritorio-presentar.png` });
  await page.evaluate(() => window.__atril.presentar.salir({ quitarPaso: true }));
  await page.waitForTimeout(300);
  ok("Al salir, vuelven los paneles", (await visible(page, "#menubar")) && (await visible(page, "#inspector")));

  // Biblioteca: buscar
  await page.fill("#biblioteca input[type=search]", "ideas");
  await page.waitForTimeout(300);
  ok("Buscar en la biblioteca filtra", (await page.locator("#bib-lista .bib-item").allTextContents()).length === 1);
  await page.fill("#biblioteca input[type=search]", "");

  // Quitar el diseño desde Ajustes
  await page.keyboard.press("Control+,");
  await page.waitForSelector("#ajustes-disenopc");
  await page.click("#ajustes-disenopc");
  await page.waitForTimeout(200);
  ok("Se puede quitar en Ajustes", !(await page.evaluate(() => document.documentElement.classList.contains("ancho"))));
  ok("El esquema vuelve a su sitio en el lector", await page.evaluate(() => !!document.querySelector("#view-reader .split-body > #reader-side")));
  await page.click("#ajustes-disenopc");
  await page.waitForTimeout(200);
  ok("Y volver a ponerlo", await page.evaluate(() => document.documentElement.classList.contains("ancho")));
  await page.keyboard.press("Escape");

  // Ventana estrecha: el diseño de siempre
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.waitForTimeout(300);
  ok("En una ventana estrecha, el diseño de siempre", !(await page.evaluate(() => document.documentElement.classList.contains("ancho"))) && !(await visible(page, "#menubar")));
  await ctx.close();
}

// =================== iPad (aunque sea grande) ===================
{
  const { ctx, page } = await nuevo({
    viewport: { width: 1366, height: 1024 }, hasTouch: true, isMobile: true,
    userAgent: "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  });
  ok("En el iPad no cambia nada (ni en el de 12,9\")", !(await page.evaluate(() => document.documentElement.classList.contains("ancho"))) && !(await visible(page, "#menubar")) && (await visible(page, ".home-hero")));
  await page.evaluate(() => window.__atril.reader && null);
  await page.goto(URL + "#/leer/docs/a1");
  await page.waitForSelector("#view-reader:not([hidden])");
  await page.waitForTimeout(400);
  ok("Y el esquema sigue al lado del texto, como antes", await page.evaluate(() => !!document.querySelector("#view-reader .split-body > #reader-side")));
  await ctx.close();
}

await browser.close();
const fallos = results.filter((r) => !r.pass).length;
if (errors.length) console.log("Errores en la página:\n" + errors.join("\n"));
console.log(`\n${results.length - fallos} de ${results.length} bien${errors.length ? `, ${errors.length} errores` : ""}`);
process.exit(fallos || errors.length ? 1 : 0);
