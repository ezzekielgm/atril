// Pruebas de dibujar y escribir a mano (lienzo, lápiz y dedo, goma, deshacer, recorte, editar y quitar), notas a mano,
// dictar (ayuda y teclado), seguridad del HTML de los dibujos y exportar con dibujos a Word y PDF.
// Uso: igual que e2e.mjs (con dist/ servido en el puerto 8080).
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
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
const ctx = await browser.newContext({ viewport: { width: 1080, height: 810 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1, locale: "es-ES", acceptDownloads: true });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await page.goto(URL);
await page.waitForSelector("#view-home:not([hidden])");
await page.evaluate(async () => {
  localStorage.setItem("atril.hideInstall", "1");
  localStorage.setItem("atril.copia", String(Date.now()));
  await window.__atril.store.put("docs", { id: "d1", title: "Con dibujo", html: "<h2>Uno</h2><p>Primer párrafo.</p><p>Segundo párrafo.</p>", created: 1, updated: 1 });
});

/** Dibuja un trazo en el lienzo con eventos de puntero del tipo indicado (pen, touch o mouse). */
const trazo = (tipo, puntos, presion = 0.5) => page.evaluate(({ tipo, puntos, presion }) => {
  const svg = document.querySelector(".lz-svg");
  const r = svg.getBoundingClientRect();
  const ev = (nombre, [fx, fy]) => svg.dispatchEvent(new PointerEvent(nombre, {
    bubbles: true, cancelable: true, pointerId: tipo === "pen" ? 7 : tipo === "touch" ? 8 : 1, pointerType: tipo, isPrimary: true,
    clientX: r.left + fx * r.width, clientY: r.top + fy * r.height, pressure: presion, button: 0, buttons: 1,
  }));
  ev("pointerdown", puntos[0]);
  for (const p of puntos.slice(1)) ev("pointermove", p);
  ev("pointerup", puntos[puntos.length - 1]);
}, { tipo, puntos, presion });
const linea = (x0, y0, x1, y1, n = 12) => Array.from({ length: n }, (_, k) => [x0 + ((x1 - x0) * k) / (n - 1), y0 + ((y1 - y0) * k) / (n - 1)]);
const nTrazos = () => page.$$eval(".lienzo .lz-svg g:not(.lz-pauta) path", (ps) => ps.length);

// ============ Dibujar en un discurso ============
await page.goto(URL + "#/editar/docs/d1");
await page.waitForSelector("#view-editor:not([hidden])");
await page.evaluate(() => {
  const p = document.querySelectorAll("#editor p")[0];
  const r = document.createRange(); r.selectNodeContents(p); r.collapse(false);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.querySelector("#editor").focus();
});
await page.click(".ribbon-tabs [data-rtab=insertar]");
ok("Insertar tiene «Dibujo o a mano» y «Dictar»", (await page.isVisible('[data-cmd="dibujo"]')) && (await page.isVisible('[data-cmd="dictar"]')));
await page.click('[data-cmd="dibujo"]');
await page.waitForSelector(".lienzo .lz-svg");
ok("Se abre el lienzo a pantalla completa con sus herramientas", (await page.$$(".lienzo [data-h]")).length === 3 && (await page.$$(".lienzo .lz-color")).length === 4);
ok("La hoja tiene líneas para escribir", (await page.$$(".lz-pauta line")).length > 3);
await trazo("mouse", linea(0.1, 0.2, 0.6, 0.25));
await trazo("pen", linea(0.1, 0.35, 0.7, 0.4), 0.9);
ok("Se dibuja con el ratón/dedo y con el lápiz", (await nTrazos()) === 2);
await trazo("touch", linea(0.2, 0.6, 0.8, 0.6));
ok("Con el lápiz usado, el dedo no pinta (se puede apoyar la mano)", (await nTrazos()) === 2);
const anchos = await page.evaluate(() => {
  const ps = [...document.querySelectorAll(".lienzo .lz-svg g:not(.lz-pauta) path")];
  return ps.map((p) => p.getBBox().height);
});
ok("El trazo con presión del lápiz es más grueso", anchos[1] > anchos[0], anchos.map((x) => x.toFixed(1)).join(" vs "));
// Rotulador rojo… no: rotulador amarillo, y color azul con el bolígrafo
await page.click(".lienzo [data-h=r]");
await trazo("pen", linea(0.1, 0.22, 0.6, 0.22), 0.5);
await page.click(".lienzo [data-h=b]");
await page.click(".lienzo .lz-color.k-azul");
await trazo("pen", linea(0.3, 0.5, 0.5, 0.55), 0.5);
ok("Rotulador debajo de la tinta y colores", await page.evaluate(() => {
  const ps = [...document.querySelectorAll(".lienzo .lz-svg g:not(.lz-pauta) path")];
  return ps[0].getAttribute("class") === "k-amarillo rotu" && ps.some((p) => p.getAttribute("class") === "k-azul");
}));
await page.click(".lienzo [aria-label=Deshacer]");
ok("Deshacer quita el último trazo", (await nTrazos()) === 3);
await page.click(".lienzo [aria-label=Rehacer]");
ok("Rehacer lo vuelve a poner", (await nTrazos()) === 4);
await page.click(".lienzo [data-h=g]");
await trazo("pen", [[0.4, 0.52], [0.41, 0.53]]);
ok("La goma borra el trazo que toca", (await nTrazos()) === 3);
await page.click(".lienzo [data-h=b]");
await page.screenshot({ path: `${OUTDIR}/90-lienzo.png` });
await page.click(".lienzo .lz-hecho");
await page.waitForSelector(".lienzo", { state: "detached" });
const fig = await page.evaluate(() => { const f = document.querySelector("#editor figure.dibujo"); return f && { ce: f.getAttribute("contenteditable"), antes: f.previousElementSibling.textContent, d: JSON.parse(f.getAttribute("data-dibujo")) }; });
ok("El dibujo entra en el texto después del párrafo del cursor", fig && fig.antes === "Primer párrafo." && fig.ce === "false");
ok("Se recorta el espacio vacío de arriba y de abajo", fig && fig.d.h < 400 && fig.d.t.length === 3, fig && `alto ${fig.d.h}`);
await page.evaluate(() => window.__atril.editor.flush());
let html = await page.evaluate(async () => (await window.__atril.store.get("docs", "d1")).html);
ok("Se guarda como <figure class=\"dibujo\"> con sus datos", /<figure class="dibujo" data-dibujo="\{[^"]*&quot;t&quot;/.test(html) || /<figure class="dibujo" data-dibujo=/.test(html));
ok("Lo guardado no lleva «contenteditable»", !html.includes("contenteditable"));
await page.screenshot({ path: `${OUTDIR}/91-editor-dibujo.png` });

// Tocar el dibujo lo abre para cambiarlo; «Quitar dibujo» lo quita con deshacer
await page.click("#editor figure.dibujo");
await page.waitForSelector(".lienzo .lz-svg");
ok("Tocar el dibujo lo abre con sus trazos", (await nTrazos()) === 3);
await trazo("pen", linea(0.2, 0.1, 0.3, 0.2), 0.6);
await page.click(".lienzo .lz-hecho");
await page.waitForSelector(".lienzo", { state: "detached" });
ok("Al cambiarlo se guarda el nuevo", await page.evaluate(() => JSON.parse(document.querySelector("#editor figure.dibujo").getAttribute("data-dibujo")).t.length === 4));
await page.click("#editor figure.dibujo");
await page.waitForSelector(".lienzo .lz-svg");
await page.click(".lienzo >> text=Quitar dibujo");
await page.click(".sheet .action.danger");
await page.waitForSelector(".lienzo", { state: "detached" });
ok("«Quitar dibujo» lo quita", (await page.$$("#editor figure.dibujo")).length === 0);
await page.click("#toast >> text=Deshacer");
ok("…y «Deshacer» lo devuelve", (await page.$$("#editor figure.dibujo")).length === 1);
// Cancelar con cambios pregunta
await page.click("#editor figure.dibujo");
await page.waitForSelector(".lienzo .lz-svg");
await trazo("pen", linea(0.5, 0.1, 0.6, 0.2));
await page.click(".lienzo >> text=Cancelar");
ok("Cancelar con cambios pregunta antes", await page.isVisible(".sheet >> text=¿Salir sin guardar el dibujo?"));
await page.click(".sheet .action.danger");
await page.waitForSelector(".lienzo", { state: "detached" });
ok("…y no guarda el trazo nuevo", await page.evaluate(() => JSON.parse(document.querySelector("#editor figure.dibujo").getAttribute("data-dibujo")).t.length === 4));
await page.evaluate(() => window.__atril.editor.flush());

// ============ Lector y Presentar ============
await page.goto(URL + "#/leer/docs/d1");
await page.waitForSelector("#view-reader:not([hidden])");
ok("En el lector el dibujo se ve, a lo ancho del texto", await page.evaluate(() => { const s = document.querySelector("#reader-content figure.dibujo svg"); return s && s.getBoundingClientRect().width > 300 && s.querySelectorAll("path").length === 4; }));
ok("En el tema oscuro la tinta negra se vuelve clara", await page.evaluate(() => {
  document.documentElement.dataset.theme = "oscuro";
  const p = document.querySelector("#reader-content figure.dibujo path.k-negro");
  const c = p ? getComputedStyle(p).fill : "";
  document.documentElement.dataset.theme = "claro";
  return c === "rgb(236, 235, 232)";
}));
await page.screenshot({ path: `${OUTDIR}/92-lector-dibujo.png` });

// ============ Seguridad: del SVG que llega no se guarda nada ============
const limpio = await page.evaluate(() => window.__atril.sanitize('<figure class="dibujo" data-dibujo=\'{"h":300,"t":[{"c":"negro","h":"b","s":4,"p":[10,10,50,100,100,50,200,50,50]}]}\'><svg onload="alert(1)"><script>alert(2)</script><foreignObject><img src=x onerror=alert(3)></foreignObject><path d="M0 0"/></svg></figure><figure><img src="x"></figure><p>fin</p>'));
ok("El dibujo se rehace solo a partir de sus datos", /^<figure class="dibujo" data-dibujo="[^"]+"><svg viewBox="0 0 1000 300" role="img" aria-label="Dibujo"><path class="k-negro" d="M[\d.,\sQTZ-]+"><\/path><\/svg><\/figure><p>fin<\/p>$/.test(limpio), limpio.slice(0, 160));
ok("Sin scripts ni atributos peligrosos, y fuera los <figure> que no son dibujos", !/onload|script|onerror|foreignObject|alert/.test(limpio));
ok("Datos con valores raros se corrigen", await page.evaluate(() => {
  const h = window.__atril.sanitize('<figure class="dibujo" data-dibujo=\'{"h":99999,"t":[{"c":"<b>","h":"x","s":999,"p":[-5,99999,500,"a",2,3,10,20,30]}]}\'></figure>');
  const d = JSON.parse(new DOMParser().parseFromString(h, "text/html").querySelector("figure").getAttribute("data-dibujo"));
  return d.h === 4000 && d.t[0].c === "negro" && d.t[0].h === "b" && d.t[0].s === 60 && d.t[0].p.join() === "0,4000,100,10,20,30";
}));

// ============ Exportar a Word y PDF con el dibujo ============
const item = await page.evaluate(async () => window.__atril.store.get("docs", "d1"));
await page.evaluate((it) => window.__atril.exportWord("docs", it), item);
await page.waitForSelector(".sheet >> text=Word listo");
const [dlw] = await Promise.all([page.waitForEvent("download"), page.click(".sheet .action.primary")]);
const rutaW = `${OUTDIR}/con-dibujo.docx`;
await dlw.saveAs(rutaW);
const zip = await JSZip.loadAsync(fs.readFileSync(rutaW));
const media = Object.keys(zip.files).filter((n) => n.startsWith("word/media/"));
ok("En el Word el dibujo va como imagen", media.length === 1 && /\.png$/.test(media[0]), media.join(", "));
const docXml = await zip.file("word/document.xml").async("string");
ok("…entre los dos párrafos", docXml.indexOf("Primer párrafo") < docXml.indexOf("<w:drawing") && docXml.indexOf("<w:drawing") < docXml.indexOf("Segundo párrafo"));
await page.evaluate((it) => window.__atril.crearPdf("docs", it), item);
await page.waitForSelector(".sheet >> text=PDF listo");
const [dlp] = await Promise.all([page.waitForEvent("download"), page.click(".sheet .action.primary")]);
const rutaP = `${OUTDIR}/con-dibujo.pdf`;
await dlp.saveAs(rutaP);
const pdf = fs.readFileSync(rutaP).toString("latin1");
ok("En el PDF el dibujo va como imagen", /\/Subtype\s*\/Image/.test(pdf));

// ============ Notas a mano y dictadas ============
await page.goto(URL + "#/");
await page.waitForSelector("#view-home:not([hidden])");
await page.click(".segmented [data-tab=notes]");
ok("En Notas hay «Nota a mano» y «Dictar»", (await page.isVisible("#nota-mano")) && (await page.isVisible("#nota-dictar")));
await page.click("#nota-mano");
await page.waitForSelector(".lienzo .lz-svg");
ok("«Nota a mano» abre el lienzo", (await page.textContent(".lz-titulo")) === "Nota a mano");
await trazo("pen", linea(0.1, 0.1, 0.5, 0.15), 0.7);
await trazo("pen", linea(0.1, 0.2, 0.4, 0.25), 0.7);
await page.click(".lienzo .lz-hecho");
await page.waitForSelector("#view-editor:not([hidden])");
const nota = await page.evaluate(async () => (await window.__atril.store.all("notes")).find((n) => n.title.startsWith("Nota a mano")));
ok("…y la guarda como nota y la abre", !!nota && nota.html.startsWith('<figure class="dibujo"') && (await page.$$("#editor figure.dibujo")).length === 1, nota && nota.title);
await page.goto(URL + "#/");
await page.waitForSelector("#view-home:not([hidden])");
await page.click(".segmented [data-tab=notes]");
await page.click("#nota-dictar");
await page.waitForSelector("#view-editor:not([hidden])");
await page.waitForTimeout(200);
ok("«Dictar» abre una nota nueva con el cursor puesto", await page.evaluate(() => document.activeElement === document.querySelector("#editor")));
ok("…y explica cómo dictar con el micrófono del teclado", (await page.isVisible("#dictado-ayuda")) && (await page.textContent("#dictado-ayuda")).includes("micrófono del teclado"));
await page.screenshot({ path: `${OUTDIR}/93-dictar.png` });
ok("En una nota sin títulos no sale solo el panel de navegación", await page.isHidden("#editor-side"));
await page.click("#dictado-ok");
ok("«Entendido» quita la ayuda", await page.isHidden("#dictado-ayuda"));

ok("Sin errores en la consola", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const fallos = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - fallos}/${results.length} pruebas superadas`);
process.exit(fallos ? 1 : 0);
