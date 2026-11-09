// Pruebas de edición: color de letra (editor, guardado, Word de ida y vuelta), tipos de letra, pestaña Insertar
// (pausa, parte nueva, minutos), palabras y tiempo de la selección, panel de navegación con tiempo por parte
// y mover partes, y versiones anteriores. Uso: igual que e2e.mjs (con dist/ servido en el puerto 8080).
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
const errors = [];

const relleno = "Jehová es paciente con nosotros porque quiere que todos lleguen al arrepentimiento. ".repeat(3);
const HTML = `<h1>La paciencia</h1><h2>Introducción (2 min)</h2><p>Primera idea clave del discurso. ${relleno}</p>
<h2>Por qué es importante (5 min)</h2><p>${relleno}</p><p>${relleno}</p>
<h2>Cómo cultivarla (5 min)</h2><p>${relleno}</p>
<h2>Conclusión (2 min)</h2><p>Última frase del discurso. ${relleno}</p>`;

const browser = await pw.chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1, locale: "es-ES" });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await page.goto(URL);
await page.waitForSelector("#view-home:not([hidden])");
await page.evaluate(async (html) => {
  localStorage.setItem("atril.hideInstall", "1");
  localStorage.setItem("atril.copia", String(Date.now()));
  const now = Date.now();
  await window.__atril.store.put("docs", { id: "e1", title: "La paciencia", html, created: now - 1e8, updated: now - 1e8, target: 14 });
}, HTML);
await page.reload();
await page.waitForSelector("#view-home:not([hidden])");

// ============ Limpieza del HTML (sanitize) ============
const san = (h) => page.evaluate((x) => window.__atril.sanitize(x), h);
ok("Se conserva <span class=\"t-rojo\">", (await san('<p>a <span class="t-rojo">rojo</span></p>')) === '<p>a <span class="t-rojo">rojo</span></p>');
ok("Un color en línea pasa a su clase", (await san('<p><span style="color: rgb(192, 0, 0)">x</span></p>')) === '<p><span class="t-rojo">x</span></p>');
ok("<font color> pasa a su clase", (await san('<p><font color="#0070C0">x</font></p>')) === '<p><span class="t-azul">x</span></p>');
ok("El color de un párrafo se conserva dentro", (await san('<p style="color:#00B050">a <b>b</b></p>')) === '<p><span class="t-verde">a <strong>b</strong></span></p>', await san('<p style="color:#00B050">a <b>b</b></p>'));
const auto = await san('<p><span class="t-azul">uno <span style="color: rgb(32, 31, 30)">dos</span> tres</span></p>');
ok("«Automático» dentro de un color lo parte", auto === '<p><span class="t-azul">uno </span>dos<span class="t-azul"> tres</span></p>', auto);
ok("El color en línea manda sobre la clase", (await san('<p><span class="t-azul" style="color: rgb(192, 0, 0)">x</span></p>')) === '<p><span class="t-rojo">x</span></p>');
ok("Las clases desconocidas se quitan", (await san('<p><span class="t-morado">x</span> <span class="t-rojo"></span></p>')) === "<p>x </p>");
ok("El negro o el gris no son color", (await san('<p><span style="color:#000">x</span><font color="#444">y</font></p>')) === "<p>xy</p>");

// ============ Editor: color de letra ============
await page.goto(URL + "#/editar/docs/e1");
await page.waitForSelector("#view-editor:not([hidden])");
await page.waitForTimeout(300);
const seleccionar = (texto) => page.evaluate((t) => {
  const ed = document.querySelector("#editor");
  const w = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const k = n.data.indexOf(t);
    if (k >= 0) { const r = document.createRange(); r.setStart(n, k); r.setEnd(n, k + t.length); const s = getSelection(); s.removeAllRanges(); s.addRange(r); ed.focus(); return true; }
  }
  return false;
}, texto);
const guardado = async () => { await page.evaluate(() => window.__atril.editor.flush()); return page.evaluate(async () => (await window.__atril.store.get("docs", "e1")).html); };
await seleccionar("idea clave");
await page.click('#toolbar [data-cmd="letra"]');
ok("El botón «A» abre los colores de letra", (await page.isVisible("#palette-letra")) && (await page.$$("#palette-letra .sw-letra")).length === 4);
await page.click('#palette-letra [data-letra="rojo"]');
await page.waitForTimeout(100);
let html = await guardado();
ok("Poner la letra en rojo se guarda como <span class=\"t-rojo\">", /<span class="t-rojo">idea clave<\/span>/.test(html), (html.match(/.{0,30}idea clave.{0,20}/) || [""])[0]);
ok("El botón marca el color donde está el cursor", (await page.getAttribute("#barra-letra", "class")).includes("l-rojo") && (await page.$eval('#toolbar [data-cmd="letra"]', (b) => b.classList.contains("active"))));
await page.screenshot({ path: `${OUTDIR}/70-color-letra.png` });
await seleccionar("Última frase");
await page.click('#palette-letra [data-letra="azul"]');
await page.keyboard.press("Control+z");
await page.waitForTimeout(100);
html = await guardado();
ok("«Deshacer» quita el color recién puesto", !/t-azul/.test(html) && /t-rojo/.test(html));
await seleccionar("idea clave");
await page.click('#palette-letra [data-letra="quitar"]');
await page.waitForTimeout(100);
html = await guardado();
ok("«Automático» devuelve el color normal", !/t-rojo/.test(html) && html.includes("Primera idea clave del discurso"));
await seleccionar("idea clave");
await page.click('#palette-letra [data-letra="verde"]');
await page.click('#palette-letra [data-letra="cerrar"]');
await guardado();

// ============ Palabras y tiempo de la selección ============
await page.evaluate(() => {
  const h = document.querySelectorAll("#editor h2")[1];
  const r = document.createRange(); r.selectNodeContents(h);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.querySelector("#editor").focus();
});
await page.waitForTimeout(150);
const sel = await page.textContent("#ed-palabras");
ok("Con texto seleccionado dice cuántas palabras y cuánto se tarda", /^6 de \d+ palabras · ≈ 3 s$/.test(sel), sel);

// ============ Insertar: pausa, parte nueva y minutos ============
await page.click(".ribbon-tabs [data-rtab=insertar]");
ok("Hay pestaña «Insertar» con parte nueva, minutos y pausa", (await page.isVisible('[data-rpanel=insertar] [data-cmd="parte"]')) && (await page.isVisible('[data-cmd="minutos"]')) && (await page.isVisible('[data-cmd="pausa"]')));
await page.evaluate(() => {
  const p = [...document.querySelectorAll("#editor p")][0];
  const t = p.lastChild.nodeType === 3 ? p.lastChild : p.firstChild;
  const r = document.createRange(); r.setStart(t, t.data.indexOf("Jehová")); r.collapse(true);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.querySelector("#editor").focus();
});
await page.click('[data-cmd="pausa"]');
await page.waitForTimeout(100);
ok("«Pausa» escribe ‖ donde está el cursor", (await page.textContent("#editor p")).includes("discurso. ‖ Jehová"), (await page.textContent("#editor p")).slice(0, 80));
await page.click('[data-cmd="minutos"]');
ok("«Minutos de la parte» sabe en qué parte estás", (await page.textContent(".sheet h2")) === "Minutos de «Introducción»");
await page.click(".sheet >> text=4 min");
ok("Cambia los minutos en el título", await page.evaluate(() => document.querySelectorAll("#editor h2")[0].textContent === "Introducción (4 min)"));
await page.click('[data-cmd="parte"]');
await page.fill(".sheet input[type=text]", "Un ejemplo");
await page.click(".sheet >> text=3 min");
await page.click(".sheet >> text=Insertar");
await page.waitForTimeout(150);
const titulos = await page.$$eval("#editor h2", (hs) => hs.map((h) => h.textContent));
ok("«Parte nueva» añade el título con sus minutos después del párrafo", titulos[1] === "Un ejemplo (3 min)", titulos.join(" | "));
await page.keyboard.type("Texto del ejemplo.");
ok("El cursor queda listo para escribir la parte", await page.evaluate(() => [...document.querySelectorAll("#editor h2")][1].nextElementSibling.textContent === "Texto del ejemplo."));
await page.waitForTimeout(700);

// ============ Panel de navegación: tiempo por parte y mover partes ============
const nav = () => page.$$eval("#editor-side-list .nav-item", (xs) => xs.map((x) => ({ t: x.querySelector(".nav-ir").textContent, d: x.querySelector(".nav-t").textContent, c: x.querySelector(".nav-t").className, sube: !!x.querySelector('[data-dir="-1"]'), baja: !!x.querySelector('[data-dir="1"]') })));
let n1 = await nav();
const intro = n1.find((x) => x.t === "Introducción");
ok("Cada parte dice lo que dura y su objetivo", intro && /^≈ \d+:\d\d de 4 min$/.test(intro.d) && /ok|corto|over/.test(intro.c), intro && intro.d);
ok("Las flechas solo salen donde se puede mover", n1[0].t === "La paciencia" && !n1[0].sube && !n1[0].baja && !n1.find((x) => x.t === "Introducción").sube && !n1.find((x) => x.t === "Conclusión").baja);
await page.screenshot({ path: `${OUTDIR}/71-navegacion.png` });
await page.click("#editor-side-list .nav-item:has-text('Conclusión') [data-dir='-1']");
await page.waitForTimeout(150);
let orden = await page.$$eval("#editor h2", (hs) => hs.map((h) => h.textContent.replace(/ \(.*/, "")));
ok("Subir una parte la cambia de sitio con todo su texto", orden.join("|") === "Introducción|Un ejemplo|Por qué es importante|Conclusión|Cómo cultivarla" && (await page.evaluate(() => [...document.querySelectorAll("#editor h2")][3].nextElementSibling.textContent.startsWith("Última frase"))), orden.join("|"));
await page.click("#toast button");
await page.waitForTimeout(150);
orden = await page.$$eval("#editor h2", (hs) => hs.map((h) => h.textContent.replace(/ \(.*/, "")));
ok("«Deshacer» la devuelve a su sitio", orden.join("|") === "Introducción|Un ejemplo|Por qué es importante|Cómo cultivarla|Conclusión", orden.join("|"));
await page.click("#editor-side-list .nav-item:has-text('Introducción') [data-dir='1']");
await page.waitForTimeout(150);
orden = await page.$$eval("#editor h2", (hs) => hs.map((h) => h.textContent.replace(/ \(.*/, "")));
ok("Bajar una parte también funciona", orden[0] === "Un ejemplo" && orden[1] === "Introducción", orden.join("|"));
html = await guardado();

// ============ Versiones anteriores ============
await page.click(".ribbon-tabs [data-rtab=revisar]");
await page.click('[data-cmd="versiones"]');
await page.waitForSelector(".sheet .version");
ok("Se guardó la versión de antes de editar", (await page.textContent(".sheet .versiones")).includes("Antes de editar"));
await page.click(".sheet .version >> text=Ver");
ok("Se puede ver una versión antes de recuperarla", (await page.textContent(".sheet .ver-previa")).includes("Primera idea clave"));
await page.click(".sheet >> text=Recuperar esta versión");
await page.waitForTimeout(300);
const rec = await page.evaluate(async () => (await window.__atril.store.get("docs", "e1")).html);
ok("«Recuperar» vuelve al texto de antes", !rec.includes("‖") && !rec.includes("Un ejemplo") && (await page.textContent("#editor")).includes("Introducción (2 min)"));
await page.click('[data-cmd="versiones"]');
await page.waitForSelector(".sheet .version");
ok("Lo que había antes de recuperar queda guardado", (await page.textContent(".sheet .versiones")).includes("Antes de recuperar otra versión"));
await page.click(".sheet .version button:has-text('Recuperar') >> nth=0");
await page.waitForTimeout(300);
ok("…y se puede volver a ello", (await page.evaluate(async () => (await window.__atril.store.get("docs", "e1")).html)).includes("‖"));

// ============ Lector: pausa, colores y tipos de letra ============
await page.goto(URL + "#/leer/docs/e1");
await page.waitForSelector("#view-reader:not([hidden])");
await page.waitForTimeout(250);
ok("Al leer, la pausa ‖ se ve destacada", (await page.$$("#reader-content .pausa")).length === 1);
ok("Al leer, la letra de color se ve de color", (await page.$eval("#reader-content .t-verde", (s) => getComputedStyle(s).color)) === "rgb(0, 128, 58)");
await page.click("#reader-aa");
const letras = await page.$$eval(".sheet .chip.f-sans, .sheet .chip.f-serif, .sheet .chip.f-arial, .sheet .chip.f-georgia, .sheet .chip.f-verdana", (bs) => bs.map((b) => b.textContent));
ok("Hay cinco tipos de letra", letras.join(",") === "Como Word,Clásica,Arial,Georgia,Verdana", letras.join(","));
await page.click(".sheet .chip.f-georgia");
ok("Elegir Georgia cambia la letra del texto", (await page.$eval("#reader-content", (c) => getComputedStyle(c).fontFamily)).startsWith("Georgia"));
await page.screenshot({ path: `${OUTDIR}/72-letra-georgia.png` });
await page.click(".sheet .chip.f-sans");
await page.click(".sheet >> text=Cerrar");
await page.evaluate(() => { document.documentElement.dataset.theme = "oscuro"; });
ok("En el tema oscuro el color se aclara para que se lea", (await page.$eval("#reader-content .t-verde", (s) => getComputedStyle(s).color)) === "rgb(90, 209, 138)");
await page.evaluate(() => { document.documentElement.dataset.theme = "claro"; });

// ============ Word: los colores van y vuelven ============
const blob = await buildDocx("Colores", `<h2>Parte (1 min)</h2><p>Normal <span class="t-rojo">rojo</span> y <strong><span class="t-azul">azul</span></strong>, <mark><span class="t-naranja">naranja</span></mark>.</p>`);
const ruta = `${OUTDIR}/colores-letra.docx`;
fs.writeFileSync(ruta, Buffer.from(await blob.arrayBuffer()));
await page.goto(URL + "#/");
await page.waitForSelector("#view-home:not([hidden])");
await page.setInputFiles("#file-input", ruta);
await page.waitForSelector("#view-reader:not([hidden])");
await page.waitForTimeout(300);
const imp = await page.evaluate(() => window.__atril.reader.item.html);
ok("Al abrir un Word con letra de color, se conservan los colores", /<span class="t-rojo">rojo<\/span>/.test(imp) && /<strong><span class="t-azul">azul<\/span><\/strong>/.test(imp) && /<mark><span class="t-naranja">naranja<\/span><\/mark>/.test(imp), imp.slice(0, 220));
ok("Y el texto normal sigue normal", /<p>Normal <span/.test(imp) && !/[-]/.test(imp));

// ============ Móvil ============
await page.setViewportSize({ width: 384, height: 832 });
await page.goto(URL + "#/editar/docs/e1");
await page.waitForSelector("#view-editor:not([hidden])");
ok("Móvil: la pestaña Insertar cabe", await page.evaluate(() => { const t = document.querySelector(".ribbon-tabs"); return t.scrollWidth <= t.clientWidth + 1; }));
await page.click('[data-cmd="navegacion"]').catch(() => {});
await page.click(".ribbon-tabs [data-rtab=vista]");
await page.click('[data-cmd="navegacion"]');
ok("Móvil: la navegación sale como lista «Ir a»", (await page.isVisible(".sheet >> text=Ir a")) && (await page.isVisible(".sheet >> text=Introducción")));
await page.screenshot({ path: `${OUTDIR}/73-movil-ir-a.png` });

ok("Sin errores en la consola", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const fallos = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - fallos}/${results.length} pruebas superadas`);
process.exit(fallos ? 1 : 0);
