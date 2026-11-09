// Pruebas del Word del PC al día (mismo nombre, «Cambiado en el iPad», aviso al salir del editor y al sustituir),
// qué significa cada color, el aviso de copia de seguridad y «Buscar actualizaciones».
// Uso: igual que e2e.mjs (con dist/ servido en el puerto 8080).
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

// Un Word «del PC»
const ruta = `${OUTDIR}/Mi discurso.docx`;
const blob = await buildDocx("Mi discurso", "<h2>Introducción (2 min)</h2><p>Texto original del PC.</p>");
fs.writeFileSync(ruta, Buffer.from(await blob.arrayBuffer()));

const browser = await pw.chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1, locale: "es-ES", acceptDownloads: true });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await page.goto(URL);
await page.waitForSelector("#view-home:not([hidden])");
await page.evaluate(() => { localStorage.setItem("atril.hideInstall", "1"); localStorage.setItem("atril.copia", String(Date.now())); });
const item = () => page.evaluate(async () => (await window.__atril.store.all("docs")).find((d) => d.source === "Mi discurso.docx"));
const aInicio = async () => {
  if ((await page.evaluate(() => location.hash)) === "#/") await page.reload(); else await page.goto(URL + "#/");
  await page.waitForSelector("#view-home:not([hidden])");
  await page.waitForTimeout(250);
};

// ============ El Word del PC ============
await page.setInputFiles("#file-input", ruta);
await page.waitForSelector("#view-reader:not([hidden])");
let it = await item();
ok("Al abrir un Word queda apuntado como igual que el del PC", it && it.alPC && it.source === "Mi discurso.docx");
await aInicio();
ok("Recién abierto no sale «Cambiado en el iPad»", (await page.$$(".card-sinpc")).length === 0);
await page.goto(URL + `#/editar/docs/${it.id}`);
await page.waitForSelector("#view-editor:not([hidden])");
await page.click("#editor p");
await page.keyboard.press("End");
await page.keyboard.type(" Retoque en el iPad.");
await page.waitForTimeout(900);
await aInicio();
ok("Al salir del editor ofrece pasarlo al Word del PC", (await page.textContent("#toast")).includes("¿Los pasas también al Word del PC?") && (await page.isVisible("#toast >> text=Guardar Word")));
ok("La tarjeta dice «Cambiado en el iPad»", (await page.textContent(".card:has-text('Mi discurso') .card-meta")).includes("Cambiado en el iPad"));
await page.screenshot({ path: `${OUTDIR}/80-cambiado-ipad.png` });
await page.click("#toast >> text=Guardar Word");
await page.waitForSelector(".sheet >> text=Word listo");
ok("El Word se guarda con el mismo nombre que el del PC", await page.isVisible(".sheet >> text=Mi discurso.docx"));
ok("Explica cómo sustituir el del PC", (await page.textContent(".sheet .nota-pc")).includes("«Reemplazar»"));
await page.screenshot({ path: `${OUTDIR}/81-word-mismo-nombre.png` });
const [dl] = await Promise.all([page.waitForEvent("download"), page.click(".sheet .action.primary")]);
ok("El archivo descargado se llama igual", dl.suggestedFilename() === "Mi discurso.docx", dl.suggestedFilename());
await page.waitForTimeout(400);
ok("Después de guardarlo, ya no sale «Cambiado en el iPad»", (await page.$$(".card-sinpc")).length === 0);

// Otro retoque y, sin guardarlo, se abre otra vez el Word del PC
it = await item();
await page.evaluate(async (id) => { const A = window.__atril; const d = await A.store.get("docs", id); await A.store.put("docs", { ...d, html: d.html.replace("Retoque", "Segundo retoque"), updated: Date.now() + 5000 }); }, it.id);
await aInicio();
await page.setInputFiles("#file-input", ruta);
await page.waitForSelector(".sheet >> text=Sustituir por esta versión");
ok("Al sustituir avisa de que hay cambios del iPad que no están en el Word", (await page.textContent(".sheet")).includes("Ojo: lo cambiaste en el iPad"));
await page.click(".sheet >> text=Sustituir por esta versión");
await page.waitForSelector("#view-reader:not([hidden])");
it = await item();
const vers = await page.evaluate(async (id) => (await window.__atril.store.all("versiones")).filter((v) => v.docId === id).map((v) => v.motivo), it.id);
ok("Los cambios del iPad quedan en «Versiones anteriores»", vers.includes("Antes de cambiarlo por el Word nuevo") && !it.html.includes("retoque"));

// ============ Qué significa cada color ============
await aInicio();
await page.click("#btn-settings");
await page.click(".sheet >> text=Qué significa cada color");
const inputs = await page.$$(".sheet .ley-fila input");
ok("Se puede poner nombre a los 8 colores", inputs.length === 8);
await inputs[0].fill("Ideas clave");
await inputs[4].fill("No saltar");
await page.click(".sheet >> text=Hecho");
await page.waitForTimeout(300);
ok("Se guarda en los ajustes del dispositivo", await page.evaluate(() => { const l = window.__atril.settings().leyenda; return l["m-amarillo"] === "Ideas clave" && l["l-rojo"] === "No saltar"; }));
await page.evaluate(async () => {
  await window.__atril.store.put("docs", { id: "ley", title: "Colores", html: "<h2>Uno</h2><p><mark>clave</mark> y <mark class=\"c-verde\">ejemplo</mark></p>", created: 1, updated: 1 });
});
await page.goto(URL + "#/editar/docs/ley");
await page.waitForSelector("#view-editor:not([hidden])");
await page.click("#editor p");
await page.click('#toolbar [data-cmd="highlight"]');
ok("La paleta del resaltador enseña el significado", (await page.textContent('#palette [data-color="amarillo"]')) === "Ideas clave" && (await page.getAttribute('#palette [data-color="amarillo"]', "aria-label")) === "Amarillo: Ideas clave");
await page.click('#toolbar [data-cmd="letra"]');
ok("La del color de letra también", (await page.textContent('#palette-letra [data-letra="rojo"]')).includes("No saltar"));
await page.screenshot({ path: `${OUTDIR}/82-leyenda-paleta.png` });
await page.goto(URL + "#/leer/docs/ley");
await page.waitForSelector("#view-reader:not([hidden])");
await page.click("#reader-outline-btn");
const filtros = await page.$$eval("#reader-outline [data-filtro]", (bs) => bs.map((b) => b.textContent));
ok("El filtro del esquema usa el significado", filtros.includes("Ideas clave") && filtros.includes("Verde"), filtros.join(", "));
await page.click("#reader-outline-btn");

// ============ Copia de seguridad ============
await page.evaluate(() => { localStorage.setItem("atril.copia", String(Date.now() - 8 * 86400000)); localStorage.setItem("atril.cambio", String(Date.now())); localStorage.removeItem("atril.copiaLuego"); });
await aInicio();
ok("Avisa de la copia a la semana (si hay cambios)", (await page.isVisible("#backup-hint")) && (await page.textContent("#backup-hint")).includes("Hace 8 días"));
await page.evaluate(() => localStorage.setItem("atril.copia", String(Date.now() - 5 * 86400000)));
await aInicio();
ok("Antes de una semana no avisa", await page.isHidden("#backup-hint"));

// ============ Buscar actualizaciones ============
await page.click("#btn-settings");
ok("Ajustes enseña la versión con su fecha", /^Atril del \d+ de \w+ de \d{4} \(\d{8}-[0-9a-f]{8}\)\.$/.test(await page.textContent("#version-txt")), await page.textContent("#version-txt"));
await page.click("#buscar-act");
await page.waitForFunction(() => document.querySelector("#toast") && !document.querySelector("#toast").hidden && document.querySelector("#toast").textContent.includes("última versión"), null, { timeout: 8000 }).catch(() => {});
ok("Si no hay nada nuevo, dice que ya tienes la última", (await page.textContent("#toast")).includes("Ya tienes la última versión"));
ok("El botón vuelve a estar listo", (await page.textContent("#buscar-act")).includes("Buscar actualizaciones") && !(await page.$eval("#buscar-act", (b) => b.disabled)));
// Con una versión nueva publicada (se simula), se pone a actualizar
await page.route("**/sw.js?comprobar=*", (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: 'const VERSION = "29991231-abcdef12";' }));
await page.click("#buscar-act");
await page.waitForTimeout(300);
ok("Si hay una versión nueva, se pone a actualizar", (await page.textContent("#buscar-act")).includes("Actualizando"));
await page.unroute("**/sw.js?comprobar=*");

ok("Sin errores en la consola", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const fallos = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - fallos}/${results.length} pruebas superadas`);
process.exit(fallos ? 1 : 0);
