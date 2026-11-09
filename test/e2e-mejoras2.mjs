// Pruebas del tiempo estimado en el editor, «dónde lo he dado» y el aviso de copia de seguridad.
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
const DIA = 86400000;

const browser = await pw.chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1.5, acceptDownloads: true, locale: "es-ES" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await page.goto(URL);
await page.waitForSelector("#view-home:not([hidden])");
const doc = (id) => page.evaluate((x) => window.__atril.store.get("docs", x), id);
const idActual = () => page.evaluate(() => location.hash.split("/").pop());

// ============ 1. Tiempo estimado en el editor ============
await page.click("text=Escribir uno nuevo");
await page.click(".sheet >> text=Con plantilla");
await page.fill('.sheet input[type="text"]', "La paciencia");
await page.fill(".sheet .num-input", "10");
await page.dispatchEvent(".sheet .num-input", "change");
await page.click(".sheet >> text=Crear");
await page.waitForSelector("#view-editor:not([hidden])");
const ID = await idActual();
await page.waitForSelector("#editor-time:not([hidden])");
ok("El editor muestra el tiempo estimado y el objetivo", /^≈ \d+ \/ 10 min$/.test(await page.textContent("#editor-time")), await page.textContent("#editor-time"));
// Se alarga mucho el punto 1 (tiene 3 min): ≈ 5 min a 130 palabras por minuto
await page.evaluate(() => {
  const p = [...document.querySelectorAll("#editor p")].find((x) => x.textContent.startsWith("Idea principal"));
  p.textContent = Array.from({ length: 650 }, (_, i) => (i % 9 ? "palabra" : "Frase")).join(" ") + ".";
  document.querySelector("#editor").dispatchEvent(new Event("input", { bubbles: true }));
});
await page.waitForTimeout(700);
const chip = await page.evaluate(() => ({ t: document.querySelector("#editor-time").textContent, c: document.querySelector("#editor-time").className }));
ok("Se actualiza al escribir y avisa si una parte se pasa", /^≈ [67] \/ 10 min$/.test(chip.t) && chip.c.includes("warn"), `${chip.t} (${chip.c})`);
await page.click("#editor-time");
await page.waitForSelector(".sheet >> text=Tiempo estimado");
const hoja = await page.textContent(".sheet");
ok("La hoja da el tiempo de cada parte", /Punto 1≈ 5:\d\d de 3:00/.test(hoja) && hoja.includes("Te sobran"), hoja.replace(/\s+/g, " ").slice(0, 160));
await page.screenshot({ path: `${OUTDIR}/30-tiempo-editor.png` });
await page.click(".sheet >> text=Despacio · 110");
ok("Cambiar el ritmo al hablar", await page.evaluate(() => window.__atril.settings().ppm === 110) && (await page.textContent(".sheet .est-total")).includes("110 palabras"));
await page.click('.sheet [aria-label="Un minuto más"]');
await page.waitForTimeout(1200);
ok("Cambiar la duración objetivo desde el editor", (await doc(ID)).target === 11, String((await doc(ID)).target));
await page.click(".sheet >> text=Cerrar");
ok("La barra refleja el nuevo objetivo", / \/ 11 min$/.test(await page.textContent("#editor-time")), await page.textContent("#editor-time"));
// Ritmo real según los ensayos
await page.evaluate(async (id) => {
  const it = await window.__atril.store.get("docs", id);
  it.ensayos = [{ id: "e1", fecha: Date.now(), seg: 400, objetivoSeg: 660, partes: [], audio: false }];
  await window.__atril.store.put("docs", it);
}, ID);
await page.click("#editor-back");
await page.waitForSelector("#view-reader:not([hidden])");
await page.click("#reader-edit");
await page.waitForSelector("#view-editor:not([hidden])");
await page.click("#editor-time");
const real = page.locator(".sheet .chip.ritmo-real");
ok("Propone tu ritmo real según tus ensayos", (await real.count()) === 1, (await real.count()) ? await real.textContent() : "");
if (await real.count()) {
  const n = parseInt((await real.textContent()).replace(/\D+/g, ""));
  await real.click();
  ok("Usar el ritmo de los ensayos", await page.evaluate((x) => window.__atril.settings().ppm === x, n), String(n));
}
await page.click(".sheet >> text=Despacio · 110");
await page.click(".sheet >> text=Normal · 130");
await page.click(".sheet >> text=Cerrar");
// Las notas no llevan tiempo
await page.click("#editor-back");
await page.goto(URL + "#/");
await page.click('.segmented [data-tab="notes"]');
await page.click("text=Nueva nota");
await page.waitForSelector("#view-editor:not([hidden])");
await page.keyboard.type("Una nota corta");
await page.waitForTimeout(600);
ok("Las notas no muestran el tiempo", await page.isHidden("#editor-time"));
await page.click("#editor-back");
await page.click('.segmented [data-tab="docs"]');

// ============ 2. Dónde lo he dado ============
await page.goto(URL + "#/leer/docs/" + ID);
await page.waitForSelector("#view-reader:not([hidden])");
await page.click("#reader-more");
await page.click(".sheet >> text=Apuntar que lo he dado");
await page.fill('.sheet input[type="date"]', "2026-09-14");
await page.fill('.sheet input[aria-label="Lugar"]', "Congregación Norte");
await page.fill('.sheet input[aria-label="Notas"]', "Gustó la ilustración del jardín");
await page.click(".sheet >> text=Apuntar");
await page.waitForSelector(".sheet .dado-item");
await page.fill('.sheet input[type="date"]', "2026-10-20");
await page.fill('.sheet input[aria-label="Lugar"]', "congregacion norte");
ok("Avisa si ya lo diste en ese lugar (sin mirar acentos)", (await page.textContent(".sheet .dado-aviso")) === "Ya lo diste aquí el 14 sep 2026.", await page.textContent(".sheet .dado-aviso"));
await page.fill('.sheet input[aria-label="Lugar"]', "Asamblea de circuito");
ok("Sin aviso en un lugar nuevo", await page.isHidden(".sheet .dado-aviso"));
await page.click(".sheet >> text=Apuntar");
await page.waitForTimeout(300);
const registro = (await doc(ID)).dado || [];
ok("Guarda fecha, lugar y notas, del más reciente al más antiguo", registro.length === 2 && registro[0].lugar === "Asamblea de circuito" && registro[1].notas === "Gustó la ilustración del jardín",
  registro.map((d) => `${d.fecha} ${d.lugar}`).join(" | "));
ok("La lista de lugares sugiere los ya usados", (await page.$$eval("#dado-lugares option", (o) => o.map((x) => x.value))).includes("Congregación Norte"));
await page.screenshot({ path: `${OUTDIR}/31-dado.png` });
await page.click(".sheet >> text=Cerrar");
await page.goto(URL + "#/");
await page.waitForSelector("#view-home:not([hidden])");
const tarjeta = await page.textContent(".card:has-text('La paciencia') .card-dado");
ok("La lista muestra cuántas veces y la última", tarjeta === "Dado 2 veces; la última, el 20 oct 2026 en Asamblea de circuito", tarjeta);
await page.fill("#search", "norte");
await page.waitForTimeout(400);
ok("Buscar por lugar encuentra el discurso", (await page.$$(".card")).length === 1 && (await page.isVisible("text=La paciencia")));
await page.fill("#search", "congregacion sur");
await page.waitForTimeout(400);
ok("Un lugar donde no lo has dado no sale", (await page.$$(".card")).length === 0);
await page.fill("#search", "");
await page.waitForTimeout(300);
// Borrar una entrada (dos toques en la papelera)
await page.click(".card:has-text('La paciencia') .card-more");
await page.click(".sheet >> text=Dónde lo he dado (2)");
await page.click(".sheet .dado-item >> nth=0 >> .dado-borrar");
await page.click(".sheet .dado-item >> nth=0 >> .dado-borrar");
await page.waitForTimeout(300);
ok("Borrar una entrada", ((await doc(ID)).dado || []).length === 1);
await page.click(".sheet >> text=Cerrar");

// ============ 3. Aviso de copia de seguridad ============
await page.evaluate(() => { localStorage.setItem("atril.copia", String(Date.now() - 20 * 86400000)); localStorage.setItem("atril.cambio", String(Date.now())); localStorage.removeItem("atril.copiaLuego"); });
await page.reload();
await page.waitForSelector("#view-home:not([hidden])");
await page.waitForTimeout(300);
ok("Avisa si hace más de una semana de la última copia", (await page.isVisible("#backup-hint")) && (await page.textContent("#backup-hint")).includes("Hace 20 días"), (await page.textContent("#backup-hint-text")).slice(0, 60));
await page.screenshot({ path: `${OUTDIR}/32-aviso-copia.png` });
await page.click("#backup-now");
await page.waitForSelector(".sheet >> text=Copia de seguridad lista");
const [dl] = await Promise.all([page.waitForEvent("download"), page.click(".sheet .action.primary")]);
const copiaPath = `${OUTDIR}/${dl.suggestedFilename()}`;
await dl.saveAs(copiaPath);
await page.waitForTimeout(300);
ok("Al hacer la copia, el aviso desaparece", (await page.isHidden("#backup-hint")) && (await page.evaluate(() => Date.now() - Number(localStorage.getItem("atril.copia")) < 60000)));
const copia = JSON.parse(fs.readFileSync(copiaPath, "utf8"));
ok("La copia lleva el registro de dónde lo has dado", copia.docs.some((d) => (d.dado || []).length === 1));
await page.evaluate(() => localStorage.setItem("atril.copia", String(Date.now() - 30 * 86400000)));
await page.reload();
await page.waitForSelector("#backup-hint:not([hidden])");
await page.click("#backup-later");
await page.reload();
await page.waitForSelector("#view-home:not([hidden])");
await page.waitForTimeout(300);
ok("«Más tarde» lo aplaza", await page.isHidden("#backup-hint"));
await page.evaluate(() => { localStorage.setItem("atril.copiaLuego", "0"); localStorage.setItem("atril.copia", String(Date.now() - 3 * 86400000)); localStorage.setItem("atril.cambio", String(Date.now())); });
await page.reload();
await page.waitForSelector("#view-home:not([hidden])");
await page.waitForTimeout(300);
ok("Sin aviso si la copia es reciente", await page.isHidden("#backup-hint"));
// Nunca se ha hecho copia y hay discursos de hace más de una semana
await page.evaluate(async () => {
  localStorage.removeItem("atril.copia");
  const t = Date.now() - 10 * 86400000;
  await window.__atril.store.put("notes", { id: "vieja", title: "Nota vieja", html: "<p>Hola</p>", created: t, updated: t });
});
await page.reload();
await page.waitForSelector("#view-home:not([hidden])");
await page.waitForTimeout(300);
ok("Avisa si nunca has hecho una copia", (await page.textContent("#backup-hint")).includes("Aún no has hecho ninguna copia"));
// Restaurar una copia con registro (y una entrada mal formada que se descarta)
const restaurar = `${OUTDIR}/restaurar-dado.json`;
fs.writeFileSync(restaurar, JSON.stringify({ app: "atril", format: 1, docs: [{ id: "z1", title: "Restaurado", html: "<p>x</p>", created: 1, updated: 2,
  dado: [{ id: "a", fecha: "2026-01-05", lugar: "Sur", notas: "" }, { fecha: "mal", lugar: "X" }] }], notes: [] }));
await page.setInputFiles("#backup-input", restaurar);
await page.waitForTimeout(800);
const z = await doc("z1");
ok("Restaurar una copia conserva el registro", z && z.dado && z.dado.length === 1 && z.dado[0].lugar === "Sur", JSON.stringify(z && z.dado));

// ============ 4. Móvil ============
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(URL + "#/editar/docs/" + ID);
await page.waitForSelector("#view-editor:not([hidden])");
await page.waitForTimeout(300);
const desborda = await page.evaluate(() => { const b = document.querySelector("#view-editor .topbar"); return b.scrollWidth > b.clientWidth + 1; });
ok("La barra del editor (con el tiempo) cabe en un móvil", !desborda);
await page.screenshot({ path: `${OUTDIR}/33-editor-movil.png` });
await page.goto(URL + "#/");
await page.waitForSelector("#view-home:not([hidden])");
await page.screenshot({ path: `${OUTDIR}/34-inicio-movil.png` });

ok("Sin errores en la consola", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const fallos = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - fallos}/${results.length} pruebas superadas`);
process.exit(fallos ? 1 : 0);
