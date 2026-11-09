// Prueba de punta a punta con Playwright (Chromium emulando un iPad con pantalla táctil).
// Uso: npm run build && (cd dist && python3 -m http.server 8080 &) && node test/e2e.mjs
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { pw = require("/opt/npm-tools/node_modules/playwright"); }

const URL = process.env.ATRIL_URL || "http://localhost:8080/";
const DOCX = process.env.ATRIL_DOCX || fileURLToPath(new globalThis.URL("./discurso-prueba.docx", import.meta.url));
const OUTDIR = fileURLToPath(new globalThis.URL("./out", import.meta.url));
fs.mkdirSync(OUTDIR, { recursive: true });

const results = [];
const ok = (name, cond, extra = "") => { results.push({ name, pass: !!cond, extra }); console.log(`${cond ? "✔" : "✘"} ${name}${extra ? " — " + extra : ""}`); };

const browser = await pw.chromium.launch();
const context = await browser.newContext({
  viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  userAgent: "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  acceptDownloads: true, permissions: ["clipboard-read", "clipboard-write"], locale: "es-ES",
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

await page.goto(URL);
await page.waitForSelector("#view-home:not([hidden])");
ok("La pantalla de inicio carga con la bienvenida", (await page.isVisible("text=Atril, tu lector de discursos")) && (await page.isVisible("text=Abrir un Word")));
await page.screenshot({ path: `${OUTDIR}/01-inicio-vacio.png` });

// --- Abrir un Word
await page.setInputFiles("#file-input", DOCX);
await page.waitForSelector("#view-reader:not([hidden])", { timeout: 15000 });
const readerHtml = await page.innerHTML("#reader-content");
ok("Abre el .docx en el lector", readerHtml.includes("gratitud"));
ok("Conserva títulos", /<h1>/.test(readerHtml) && /<h2>/.test(readerHtml), (readerHtml.match(/<h[12]>[^<]*/g) || []).slice(0, 3).join(" | "));
ok("Conserva negrita y cursiva", /<strong>cambia nuestra forma/.test(readerHtml) && /<em>tres cosas/.test(readerHtml));
ok("Conserva el resaltado", /<mark>la gratitud se practica/.test(readerHtml));
ok("Conserva el subrayado", /<u>/.test(readerHtml));
ok("Conserva listas", /<ol>/.test(readerHtml) && /<ul>/.test(readerHtml));
ok("Conserva la tabla", /<table>/.test(readerHtml));
await page.screenshot({ path: `${OUTDIR}/02-lector.png` });

// --- Zoom con dos dedos (eventos táctiles reales vía CDP)
const fsBefore = await page.evaluate(() => getComputedStyle(document.querySelector("#reader-content")).fontSize);
await page.evaluate(() => { document.querySelector("#reader-scroll").scrollTop = 900; });
await page.waitForTimeout(200);
const anchorText = await page.evaluate(() => {
  const s = document.querySelector("#reader-scroll"); const r = s.getBoundingClientRect();
  let n = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height * 0.35, 260));
  while (n && n.parentElement && n.parentElement.id !== "reader-content") n = n.parentElement;
  return n ? n.textContent.slice(0, 40) : "";
});
const cdp = await context.newCDPSession(page);
async function pinch(fromGap, toGap, cx = 410, cy = 600, steps = 10) {
  const pts = (gap) => [{ x: cx - gap / 2, y: cy, id: 0 }, { x: cx + gap / 2, y: cy, id: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pts(fromGap) });
  for (let i = 1; i <= steps; i++) {
    const g = fromGap + ((toGap - fromGap) * i) / steps;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pts(g) });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(150);
}
await pinch(150, 300);
const fsAfterOpen = await page.evaluate(() => getComputedStyle(document.querySelector("#reader-content")).fontSize);
ok("Separar dos dedos agranda la letra", parseFloat(fsAfterOpen) > parseFloat(fsBefore) * 1.5, `${fsBefore} → ${fsAfterOpen}`);
const anchorAfter = await page.evaluate(() => {
  const s = document.querySelector("#reader-scroll"); const r = s.getBoundingClientRect();
  let n = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height * 0.35, 260));
  while (n && n.parentElement && n.parentElement.id !== "reader-content") n = n.parentElement;
  return n ? n.textContent.slice(0, 40) : "";
});
ok("Al hacer zoom no se pierde por dónde ibas", anchorAfter === anchorText, `«${anchorText}» / «${anchorAfter}»`);
const noHScroll = await page.evaluate(() => { const c = document.querySelector("#reader-scroll"); return c.scrollWidth <= c.clientWidth + 1; });
ok("El texto se reajusta al ancho (sin desplazamiento lateral)", noHScroll);
const pageScale = await page.evaluate(() => window.visualViewport ? window.visualViewport.scale : 1);
ok("La página en sí no se amplía (solo la letra)", Math.abs(pageScale - 1) < 0.01, `escala ${pageScale}`);
await page.screenshot({ path: `${OUTDIR}/03-lector-zoom.png` });
await pinch(300, 150);
const fsAfterClose = await page.evaluate(() => getComputedStyle(document.querySelector("#reader-content")).fontSize);
ok("Pellizcar achica la letra", parseFloat(fsAfterClose) < parseFloat(fsAfterOpen), `${fsAfterOpen} → ${fsAfterClose}`);
const savedSize = await page.evaluate(() => JSON.parse(localStorage.getItem("atril.settings")).fontSize);
ok("Recuerda el tamaño elegido", savedSize === parseFloat(fsAfterClose), `${savedSize}`);

// --- Modo atril (ocultar barra) y cronómetro
await page.click("#timer-toggle");
await page.waitForTimeout(1300);
const t = await page.textContent("#timer-text");
ok("El cronómetro cuenta", t !== "00:00", t);
await page.click("#timer-toggle");
await page.tap("#reader-content p >> nth=3");
await page.waitForTimeout(500);
ok("Tocar el texto oculta la barra", await page.evaluate(() => document.querySelector("#view-reader").classList.contains("immersive")));
await page.screenshot({ path: `${OUTDIR}/04-modo-atril.png` });
await page.tap("#reader-content p >> nth=3");
await page.waitForTimeout(500);

// --- Tema y tamaño desde el panel Aa
await page.click("#reader-aa");
await page.click("text=Sepia");
await page.screenshot({ path: `${OUTDIR}/05-panel-aa-sepia.png` });
await page.click("text=Oscuro");
await page.click(".sheet >> text=Cerrar");
await page.screenshot({ path: `${OUTDIR}/06-lector-oscuro.png` });
ok("Cambia a tema oscuro", (await page.getAttribute("html", "data-theme")) === "oscuro");
await page.click("#reader-aa"); await page.click("text=Claro"); await page.click(".sheet >> text=Cerrar");

// --- Editar: cambiar unas letras, negrita y resaltado
await page.click("#reader-edit");
await page.waitForSelector("#view-editor:not([hidden])");
await page.evaluate(() => {
  const ed = document.querySelector("#editor");
  const p = [...ed.querySelectorAll("p")].find((x) => x.textContent.startsWith("Gracias por vuestra"));
  const range = document.createRange();
  range.setStart(p.firstChild, 0); range.setEnd(p.firstChild, "Gracias".length);
  ed.focus();
  const s = getSelection(); s.removeAllRanges(); s.addRange(range);
});
await page.keyboard.type("Muchas gracias");
await page.evaluate(() => {
  const ed = document.querySelector("#editor");
  const p = [...ed.querySelectorAll("p")].find((x) => x.textContent.startsWith("Muchas gracias"));
  const tn = p.firstChild; const range = document.createRange();
  range.setStart(tn, 0); range.setEnd(tn, "Muchas gracias".length);
  const s = getSelection(); s.removeAllRanges(); s.addRange(range);
});
await page.click('#toolbar [data-cmd="bold"]');
await page.click('#toolbar [data-cmd="highlight"]');
await page.click('#palette [data-color="amarillo"]');
await page.waitForTimeout(1200);
ok("Autoguardado", (await page.textContent("#save-state")) === "Guardado");
await page.screenshot({ path: `${OUTDIR}/07-editor.png` });
await page.click("#editor-back");
await page.waitForSelector("#view-reader:not([hidden])");
const after = await page.innerHTML("#reader-content");
const afterText = await page.textContent("#reader-content");
ok("El cambio de texto se guarda", afterText.includes("Muchas gracias por vuestra atención"));
const lastP = (after.match(/<p>(?:(?!<p>).)*Muchas gracias.*?<\/p>/) || [""])[0];
ok("Negrita y resaltado nuevos se guardan como <strong>/<mark>", /<mark><strong>Muchas gracias<\/strong><\/mark>|<strong><mark>Muchas gracias<\/mark><\/strong>/.test(lastP), lastP);

// --- Guardar como Word
await page.click("#reader-edit");
await page.click("#editor-more");
await page.click(".sheet >> text=Guardar como Word");
await page.waitForSelector(".sheet >> text=Word listo", { timeout: 20000 });
const [download] = await Promise.all([page.waitForEvent("download"), page.click(".sheet .action.primary")]);
const outDocx = `${OUTDIR}/${download.suggestedFilename()}`;
await download.saveAs(outDocx);
ok("Genera el archivo Word", fs.existsSync(outDocx) && fs.statSync(outDocx).size > 3000, download.suggestedFilename());
await page.click("#editor-back");

// --- Notas
await page.goto(URL + "#/");
await page.click('.segmented [data-tab="notes"]');
await page.click("text=Nueva nota");
await page.waitForSelector("#view-editor:not([hidden])");
await page.fill("#editor-title", "Ideas para el discurso del domingo");
await page.click("#editor");
await page.keyboard.type("Empezar con una pregunta al público.");
await page.keyboard.press("Enter");
await page.keyboard.type("Contar la experiencia del viaje.");
await page.waitForTimeout(1000);
await page.click("#editor-back");
await page.waitForSelector("#view-home:not([hidden])");
ok("La nota aparece en la lista", await page.waitForSelector("text=Ideas para el discurso del domingo", { timeout: 5000 }).then(() => true, () => false));
await page.screenshot({ path: `${OUTDIR}/08-notas.png` });
await page.click(".card-more");
await page.click(".sheet >> text=Copiar el texto");
await page.waitForTimeout(300);
const clip = await page.evaluate(() => navigator.clipboard.readText());
ok("Copiar el texto de la nota", clip.includes("Empezar con una pregunta") && clip.includes("Contar la experiencia"), JSON.stringify(clip));

// --- Copia de seguridad
await page.click("#btn-settings");
await page.click(".sheet >> text=Hacer copia de seguridad");
await page.waitForSelector(".sheet >> text=Copia de seguridad lista");
const [bk] = await Promise.all([page.waitForEvent("download"), page.click(".sheet .action.primary")]);
const bkPath = `${OUTDIR}/${bk.suggestedFilename()}`;
await bk.saveAs(bkPath);
const bkData = JSON.parse(fs.readFileSync(bkPath, "utf8"));
ok("La copia de seguridad incluye discursos y notas", bkData.docs.length === 1 && bkData.notes.length === 1);

// --- Funciona sin conexión
await page.goto(URL + "#/");
await page.evaluate(() => navigator.serviceWorker.ready);
await page.waitForTimeout(500);
await page.reload();
await page.evaluate(() => navigator.serviceWorker.ready);
await context.setOffline(true);
await page.reload();
await page.waitForSelector("#view-home:not([hidden])", { timeout: 10000 });
await page.click('.segmented [data-tab="docs"]');
ok("Abre sin conexión", await page.isVisible("text=La importancia de la gratitud") || await page.isVisible(".card"));
await page.click(".card-main");
await page.waitForSelector("#view-reader:not([hidden])");
ok("Lee un discurso sin conexión", (await page.innerHTML("#reader-content")).includes("gratitud"));
await page.click("#reader-edit");
await page.click("#editor-more");
await page.click(".sheet >> text=Guardar como Word");
const offlineWord = await page.waitForSelector(".sheet >> text=Word listo", { timeout: 15000 }).then(() => true, () => false);
ok("Guarda como Word sin conexión", offlineWord);
await context.setOffline(false);

// --- Restaurar copia en un navegador limpio
const ctx2 = await browser.newContext({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true });
const p2 = await ctx2.newPage();
await p2.goto(URL);
await p2.waitForSelector("#view-home:not([hidden])");
await p2.setInputFiles("#backup-input", bkPath);
await p2.waitForTimeout(800);
ok("Restaurar la copia en otro dispositivo", await p2.waitForSelector("text=La importancia de la gratitud", { timeout: 5000 }).then(() => true, () => false));
await p2.close(); await ctx2.close();

ok("Sin errores en la consola", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
fs.writeFileSync(`${OUTDIR}/results.json`, JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} pruebas superadas`);
process.exit(failed.length ? 1 : 0);
