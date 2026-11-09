// Textos bíblicos debajo de las citas (lector y editor) y Word con los datos de Atril dentro
// (duración, ensayos, dónde se ha dado). Uso: igual que e2e.mjs (con dist/ servido en el puerto 8080).
import fs from "node:fs";
import path from "node:path";
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

const browser = await pw.chromium.launch();
async function nuevo({ width = 1080, height = 810 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true, deviceScaleFactor: 1, locale: "es-ES" });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new globalThis.URL(URL).origin });
  await ctx.addInitScript(() => {
    window.__abiertos = [];
    window.open = (u) => { window.__abiertos.push(u); return null; };
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(URL);
  await page.waitForSelector("#view-home:not([hidden])");
  await page.evaluate(() => { localStorage.setItem("atril.hideInstall", "1"); localStorage.setItem("atril.copia", String(Date.now())); localStorage.setItem("atril.guiaVista", "1"); });
  return { ctx, page };
}
const ir = async (page, hash, vista) => { await page.goto(URL + hash); await page.waitForSelector(`#view-${vista}:not([hidden])`); await page.waitForTimeout(300); };
const crear = (page, kind, item) => page.evaluate(async ([k, it]) => { const now = Date.now() - 60000; const x = { id: "t" + Math.random().toString(36).slice(2), created: now, updated: now, ...it, html: window.__atril.sanitize(it.html) }; await window.__atril.store.put(k, x); return x; }, [kind, item]);
const leer = (page, kind, id) => page.evaluate(([k, i]) => window.__atril.store.get(k, i), [kind, id]);
const copiar = (page, t) => page.evaluate((x) => navigator.clipboard.writeText(x), t);
const boton = (page, texto) => page.locator("#overlay .sheet button", { hasText: texto }).first();
const toastTxt = (page) => page.locator("#toast").textContent();

// =================== Limpieza del HTML ===================
{
  const { ctx, page } = await nuevo();
  const s = await page.evaluate(() => window.__atril.sanitize('<blockquote class="versiculo"><p>Texto</p></blockquote><blockquote class="otra" style="color:red"><p>Otra</p></blockquote>'));
  ok("Se conserva <blockquote class=\"versiculo\"> y se quita otra clase", s === '<blockquote class="versiculo"><p>Texto</p></blockquote><blockquote><p>Otra</p></blockquote>', s);
  await ctx.close();
}

// =================== Lector ===================
{
  const { ctx, page } = await nuevo();
  const doc = await crear(page, "docs", {
    title: "La alegría",
    html: "<h2>Introducción (2 min)</h2><p>Lea Filip. 4:4 y también Rom. 12:12 con atención.</p><ul><li>Punto con Sal 37:4</li><li>Otro</li></ul><p>Final sin citas.</p>",
  });
  await ir(page, `#/leer/docs/${doc.id}`, "reader");
  const enlaces = await page.locator("#reader-content a.bref").allTextContents();
  ok("Las citas se pueden tocar", enlaces.join("|") === "Filip. 4:4|Rom. 12:12|Sal 37:4", enlaces.join("|"));

  await page.locator("#reader-content a.bref", { hasText: "Filip. 4:4" }).click();
  await page.waitForSelector("#overlay:not([hidden]) .sheet");
  const titulo = await page.locator("#overlay .sheet h2").textContent();
  const opciones = await page.locator("#overlay .sheet .menu .action").allTextContents();
  ok("Tocar una cita abre su menú (con el nombre entero del libro)", titulo === "Filipenses 4:4", titulo);
  ok("Abrir en JW Library, en jw.org y pegar el versículo", opciones.join("|") === "Abrir en JW Library|Abrir en jw.org|Pegar el versículo copiado", opciones.join("|"));
  ok("No se sale de la app al tocar la cita", (await page.evaluate(() => location.hash)).startsWith("#/leer/docs/"));

  // Pegar el versículo copiado
  await copiar(page, "Estén siempre alegres+ en el Señor.* Lo diré otra vez: ¡estén alegres!");
  await boton(page, "Pegar el versículo copiado").click();
  await page.waitForSelector("#reader-content blockquote.versiculo");
  const v1 = await page.locator("#reader-content blockquote.versiculo").first().textContent();
  ok("El versículo aparece debajo, limpio y con su cita", v1 === "Estén siempre alegres en el Señor. Lo diré otra vez: ¡estén alegres! (Filipenses 4:4)", v1);
  const sig = await page.evaluate(() => { const p = [...document.querySelectorAll("#reader-content p")].find((x) => x.textContent.startsWith("Lea Filip")); return p.nextElementSibling && p.nextElementSibling.className; });
  ok("Justo después del párrafo de la cita", sig === "versiculo", sig);
  let guardado = await leer(page, "docs", doc.id);
  ok("Se guarda en el documento (sin los enlaces del lector)", guardado.html.includes('<blockquote class="versiculo"><p>Estén siempre alegres') && !guardado.html.includes("bref"));
  ok("Aviso con «Deshacer»", (await toastTxt(page)).includes("Texto de Filipenses 4:4 puesto debajo") && (await page.locator("#toast button").textContent()) === "Deshacer");

  // Segunda cita del mismo párrafo: va después del primer versículo
  await page.locator("#reader-content a.bref", { hasText: "Rom. 12:12" }).click();
  await page.waitForSelector("#overlay:not([hidden]) .sheet");
  await copiar(page, "Alégrense por la esperanza. (Romanos 12:12)");
  await boton(page, "Pegar el versículo copiado").click();
  await page.waitForFunction(() => document.querySelectorAll("#reader-content blockquote.versiculo").length === 2);
  const orden = await page.locator("#reader-content blockquote.versiculo").allTextContents();
  ok("El de la segunda cita va detrás, y si ya trae la referencia no se repite", orden[0].endsWith("(Filipenses 4:4)") && orden[1] === "Alégrense por la esperanza. (Romanos 12:12)", orden.join(" | "));

  // Deshacer
  await page.locator("#toast button", { hasText: "Deshacer" }).click();
  await page.waitForFunction(() => document.querySelectorAll("#reader-content blockquote.versiculo").length === 1);
  guardado = await leer(page, "docs", doc.id);
  ok("«Deshacer» lo quita también del documento", (guardado.html.match(/versiculo/g) || []).length === 1);

  // Cambiar y quitar
  await page.locator("#reader-content a.bref", { hasText: "Filip. 4:4" }).click();
  await page.waitForSelector("#overlay:not([hidden]) .sheet");
  const ops2 = await page.locator("#overlay .sheet .menu .action").allTextContents();
  ok("Con texto debajo: cambiarlo o quitarlo", ops2.includes("Cambiar por el que he copiado") && ops2.includes("Quitar el texto de debajo"), ops2.join("|"));
  await copiar(page, "Alégrense siempre en el Señor.");
  await boton(page, "Cambiar por el que he copiado").click();
  await page.waitForFunction(() => document.querySelector("#reader-content blockquote.versiculo").textContent.startsWith("Alégrense siempre"));
  ok("Cambiar no duplica", (await page.locator("#reader-content blockquote.versiculo").count()) === 1);
  await page.locator("#reader-content a.bref", { hasText: "Filip. 4:4" }).click();
  await page.waitForSelector("#overlay:not([hidden]) .sheet");
  await boton(page, "Quitar el texto de debajo").click();
  await page.waitForFunction(() => !document.querySelector("#reader-content blockquote.versiculo"));
  ok("Quitar el texto de debajo", !(await leer(page, "docs", doc.id)).html.includes("versiculo"));

  // En una lista: dentro del punto
  await page.locator("#reader-content a.bref", { hasText: "Sal 37:4" }).click();
  await page.waitForSelector("#overlay:not([hidden]) .sheet");
  await copiar(page, "Deléitate en Jehová, y él te dará lo que tu corazón desee.");
  await boton(page, "Pegar el versículo copiado").click();
  await page.waitForSelector("#reader-content li blockquote.versiculo");
  const li = await page.evaluate(() => document.querySelector("#reader-content li blockquote.versiculo").closest("li").firstChild.textContent);
  ok("En una lista, el versículo va dentro de su punto", li.startsWith("Punto con"), li);

  // Portapapeles vacío: se pega a mano
  await copiar(page, "");
  await page.locator("#reader-content a.bref", { hasText: "Rom. 12:12" }).click();
  await page.waitForSelector("#overlay:not([hidden]) .sheet");
  await boton(page, "Pegar el versículo copiado").click();
  await page.waitForSelector("#overlay:not([hidden]) textarea.versiculo-input");
  ok("Sin nada copiado, se puede pegar a mano", (await page.locator("#overlay .sheet h2").textContent()) === "Romanos 12:12");
  await page.fill("textarea.versiculo-input", "Alégrense por la esperanza.");
  await page.click("#versiculo-ok");
  await page.waitForFunction(() => [...document.querySelectorAll("#reader-content blockquote.versiculo")].some((v) => v.textContent.includes("Romanos 12:12")));
  ok("Y queda debajo de su cita", true);

  // Al volver de jw.org, ofrece pegarlo
  await page.locator("#reader-content a.bref", { hasText: "Filip. 4:4" }).click();
  await page.waitForSelector("#overlay:not([hidden]) .sheet");
  await boton(page, "Abrir en jw.org").click();
  const abierto = await page.evaluate(() => window.__abiertos.slice(-1)[0]);
  ok("Abre jw.org en la cita exacta", abierto === "https://www.jw.org/finder?srcid=jwlshare&wtlocale=S&prefer=lang&pub=nwtsty&bible=50004004", abierto);
  await page.evaluate(async () => {
    const vis = (v) => { Object.defineProperty(document, "visibilityState", { configurable: true, get: () => v }); document.dispatchEvent(new Event("visibilitychange")); };
    vis("hidden"); await new Promise((r) => setTimeout(r, 50)); vis("visible");
  });
  await page.waitForFunction(() => document.querySelector("#toast") && !document.querySelector("#toast").hidden && document.querySelector("#toast").textContent.includes("¿Pegar"));
  ok("Al volver a Atril, ofrece pegar lo copiado", (await toastTxt(page)).includes("¿Pegar el texto de Filipenses 4:4 debajo de la cita?"));
  await copiar(page, "Estén siempre alegres en el Señor.");
  await page.locator("#toast button", { hasText: "Pegar" }).click();
  await page.waitForFunction(() => [...document.querySelectorAll("#reader-content blockquote.versiculo")].some((v) => v.textContent.includes("Filipenses 4:4")));
  ok("Y lo pega con un toque", true);
  const orden2 = await page.locator("#reader-content p + blockquote.versiculo, #reader-content blockquote.versiculo + blockquote.versiculo").allTextContents();
  ok("Los versículos siguen el orden de las citas del párrafo", orden2.length === 2 && orden2[0].includes("Filipenses 4:4") && orden2[1].includes("Romanos 12:12"), orden2.join(" | "));
  // La cita que va dentro del versículo lleva al párrafo: no se pega un versículo dentro de otro
  await page.locator("#reader-content blockquote.versiculo a.bref", { hasText: "Romanos 12:12" }).click();
  await page.waitForSelector("#overlay:not([hidden]) .sheet");
  ok("Tocar la referencia de un versículo: cambiarlo o quitarlo", (await page.locator("#overlay .sheet .menu .action").allTextContents()).includes("Quitar el texto de debajo"));
  await page.locator("#overlay .sheet button", { hasText: "Cancelar" }).click();
  await page.screenshot({ path: path.join(OUTDIR, "citas-lector.png") });

  // Presentar: las citas no se pueden tocar
  await ctx.close();
}

// =================== Editor: Insertar → Texto bíblico ===================
{
  const { ctx, page } = await nuevo();
  const doc = await crear(page, "docs", { title: "Ed", html: "<p>Primero.</p><p>Como dice Hebreos 11:1, la fe es real.</p><p>Último.</p>" });
  await ir(page, `#/editar/docs/${doc.id}`, "editor");
  await page.click('[data-rtab="insertar"]').catch(() => {});
  await page.evaluate(() => {
    const p = [...document.querySelectorAll("#editor p")][0];
    const r = document.createRange(); r.setStart(p.firstChild, 2); r.collapse(true);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  });
  await page.evaluate(() => window.__atril.editor.exec("versiculo"));
  ok("Sin cita en el párrafo, lo explica", (await toastTxt(page)).includes("Pon el cursor en el párrafo de la cita"));
  await page.evaluate(() => {
    const p = [...document.querySelectorAll("#editor p")][1];
    const r = document.createRange(); r.setStart(p.firstChild, 5); r.collapse(true);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  });
  ok("Botón «Texto bíblico» en Insertar", await page.locator('[data-cmd="versiculo"]').count() === 1);
  await page.evaluate(() => window.__atril.editor.exec("versiculo"));
  await page.waitForSelector("#overlay:not([hidden]) .sheet");
  ok("Menú de la cita del cursor", (await page.locator("#overlay .sheet h2").textContent()) === "Hebreos 11:1");
  await copiar(page, "La fe es la expectativa segura de lo que se espera.");
  await boton(page, "Pegar el versículo copiado").click();
  await page.waitForSelector("#editor blockquote.versiculo");
  const sig = await page.evaluate(() => [...document.querySelectorAll("#editor > *")].map((x) => x.tagName + (x.className ? "." + x.className : "")).join(","));
  ok("En el editor también va justo debajo", sig === "P,P,BLOCKQUOTE.versiculo,P", sig);
  await page.evaluate(() => window.__atril.editor.flush());
  const g = await leer(page, "docs", doc.id);
  ok("Y se guarda", g.html.includes('<blockquote class="versiculo"><p>La fe es la expectativa segura de lo que se espera. (Hebreos 11:1)</p></blockquote>'), g.html);
  await page.locator("#toast button", { hasText: "Deshacer" }).click();
  ok("«Deshacer» en el editor", (await page.locator("#editor blockquote.versiculo").count()) === 0);
  await ctx.close();
}

// =================== Word con los datos de Atril ===================
{
  const { ctx, page } = await nuevo();
  const datos = {
    target: 25, guardado: Date.now(),
    ensayos: [{ id: "w1", fecha: Date.now() - 86400000, seg: 1530, objetivoSeg: 1500, partes: [{ t: "Introducción (2 min)", s: 140, o: 120 }], audio: true }],
    dado: [{ id: "d1", fecha: "2026-10-05", lugar: "Congregación Norte", notas: "" }],
  };
  const html = `<h1>Discurso con datos</h1><p>Lea Filipenses 4:4.</p><blockquote class="versiculo"><p>Estén siempre alegres en el Señor. (Filipenses 4:4)</p></blockquote>`;
  const ruta = path.join(OUTDIR, "Discurso con datos.docx");
  fs.writeFileSync(ruta, Buffer.from(await (await buildDocx("Discurso con datos", html, { datos })).arrayBuffer()));
  await page.setInputFiles("#file-input", ruta);
  await page.waitForSelector("#view-reader:not([hidden])");
  await page.waitForTimeout(300);
  const id = await page.evaluate(() => window.__atril.reader.id);
  let d = await leer(page, "docs", id);
  ok("Al abrir el Word, trae la duración", d.target === 25, String(d.target));
  ok("Trae los ensayos (sin audio)", d.ensayos && d.ensayos.length === 1 && d.ensayos[0].seg === 1530 && d.ensayos[0].audio === false);
  ok("Trae dónde se ha dado", d.dado && d.dado[0].lugar === "Congregación Norte");
  ok("Y el versículo sigue siendo un versículo", (await page.locator("#reader-content blockquote.versiculo").count()) === 1);

  // Sustituir por una versión nueva: se suman los ensayos, sin repetir
  await page.evaluate(async (i) => { const s = window.__atril.store; const x = await s.get("docs", i); x.ensayos = [{ id: "ipad1", fecha: Date.now(), seg: 1490, objetivoSeg: 1500, partes: [], audio: false }, ...x.ensayos]; await s.put("docs", x); }, id);
  datos.ensayos.push({ id: "w2", fecha: Date.now() - 2 * 86400000, seg: 1600, objetivoSeg: 1500, partes: [] });
  fs.writeFileSync(ruta, Buffer.from(await (await buildDocx("Discurso con datos", html, { datos })).arrayBuffer()));
  await page.goto(URL + "#/");
  await page.waitForSelector("#view-home:not([hidden])");
  await page.setInputFiles("#file-input", ruta);
  await page.waitForSelector("#overlay:not([hidden]) .sheet");
  await boton(page, "Sustituir por esta versión").click();
  await page.waitForSelector("#view-reader:not([hidden])");
  d = await leer(page, "docs", id);
  ok("Al sustituirlo, se juntan los ensayos de los dos sin repetir", d.ensayos.map((e) => e.id).join(",") === "ipad1,w1,w2", d.ensayos.map((e) => e.id).join(","));
  ok("Y «dónde lo he dado» no se repite", d.dado.length === 1);
  await ctx.close();
}

await browser.close();
const fallos = results.filter((r) => !r.pass).length;
const errs = errors.filter((e) => !/jwlibrary|ERR_UNKNOWN_URL_SCHEME|scheme does not have a registered handler/i.test(e));
if (errs.length) console.log("Errores en la página:\n" + errs.join("\n"));
console.log(`\n${results.length - fallos} de ${results.length} bien${errs.length ? `, ${errs.length} errores` : ""}`);
process.exit(fallos || errs.length ? 1 : 0);
