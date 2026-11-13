// Pruebas de lo que pidió la auditoría: comprobación antes de presentar, análisis de ensayos y practicar
// una parte, estado de la copia de seguridad, menú «Más» agrupado, ayuda del Word del PC y PDF con letras propias.
// Uso: igual que e2e.mjs (con dist/ servido en el puerto 8080). Necesita pdftotext y pdffonts (poppler).
import fs from "node:fs";
import { execFileSync } from "node:child_process";
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
async function nuevo({ width = 1080, height = 810 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true, deviceScaleFactor: 1, locale: "es-ES" });
  await ctx.addInitScript(() => {
    window.__compartido = [];
    Object.defineProperty(navigator, "share", { configurable: true, value: async (d) => { window.__compartido.push(d); } });
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(URL);
  await page.waitForSelector("#view-home:not([hidden])");
  await page.evaluate(() => { for (const [k, v] of Object.entries({ "atril.hideInstall": "1", "atril.consejoAcceso": "1", "atril.consejoToque": "1", "atril.guiaVista": "1" })) localStorage.setItem(k, v); });
  return { ctx, page };
}
const ir = async (page, hash, vista) => { await page.goto(URL + hash); await page.waitForSelector(`#view-${vista}:not([hidden])`); await page.waitForTimeout(350); };
const crear = (page, kind, item) => page.evaluate(async ([k, it]) => { const now = Date.now(); const x = { id: "t" + Math.random().toString(36).slice(2), created: now, updated: now, ...it, html: window.__atril.sanitize(it.html) }; await window.__atril.store.put(k, x); return x; }, [kind, item]);
const parrafos = (n) => Array.from({ length: n }, () => `<p>${"Texto de la parte para tener algo que leer con calma. ".repeat(8)}</p>`).join("");
const DISCURSO = `<h1>Prueba</h1><h2>Introducción (2 min)</h2>${parrafos(3)}<h2>Punto uno (4 min)</h2>${parrafos(4)}<h2>Conclusión (2 min)</h2>${parrafos(3)}`;

// =================== Comprobación antes de presentar ===================
{
  const { ctx, page } = await nuevo();
  const doc = await crear(page, "docs", { title: "Prueba", html: DISCURSO, target: 8 });
  await ir(page, `#/leer/docs/${doc.id}`, "reader");
  const nombres = await page.$$eval(".reader-tools .tool .lbl", (xs) => xs.map((x) => x.textContent));
  ok("El lector tiene 7 botones: Nuevo, Esquema, Letra, Desplazar, Presentar, Editar y Más (Nuevo y Desplazar los pidió Ezequiel)", nombres.join(",") === "Nuevo,Esquema,Letra,Desplazar,Presentar,Editar,Más", nombres.join(","));
  await page.evaluate(() => { const s = document.querySelector("#reader-scroll"); s.scrollTop = (s.scrollHeight - s.clientHeight) * 0.5; });
  await page.waitForTimeout(200);
  await page.click("#reader-presentar");
  await page.waitForSelector("#pc-ya");
  const hoja = await page.textContent(".sheet");
  ok("«Presentar» abre antes la comprobación", hoja.includes("Antes de presentar") && hoja.includes("Tiempo") && hoja.includes("Letra") && hoja.includes("Empezar") && hoja.includes("Que no se apague"));
  ok("…con el tiempo del discurso", (await page.inputValue(".sheet .num-input")) === "8");
  ok("…y «Desde donde estoy» elegido si ya estabas leyendo", (await page.getAttribute(".pc-desde [data-desde='aqui']", "aria-pressed")) === "true");
  ok("«Presentar ahora» es el botón principal y tiene foco", await page.evaluate(() => document.activeElement && document.activeElement.id === "pc-ya"));
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${OUTDIR}/130-antes-de-presentar.png` });
  await page.click(".sheet .size-row button[aria-label='Un minuto más']");
  await page.waitForTimeout(700);
  ok("Desde la comprobación se cambia la duración", (await page.evaluate(async (id) => (await window.__atril.store.get("docs", id)).target, doc.id)) === 9);
  await page.click(".pc-desde [data-desde='inicio']");
  await page.click("#pc-ya");
  await page.waitForSelector("#pres-bar:not([hidden])");
  ok("«Desde el principio» empieza arriba", (await page.$eval("#reader-scroll", (s) => s.scrollTop)) < 5);
  ok("Sin el consejo de la primera vez encima (ya estaba en la comprobación)", !(await page.isVisible(".sheet")));
  await page.evaluate(() => window.__atril.presentar.salir({ quitarPaso: true }));
  await page.waitForTimeout(300);
  // Quitar la comprobación
  await page.click("#reader-presentar");
  await page.waitForSelector("#pc-ya");
  await page.click(".sheet label:has(#pc-siempre)");
  await page.click(".sheet .action.plain");
  await page.click("#reader-presentar");
  await page.waitForTimeout(300);
  ok("Si se quita, «Presentar» entra directamente", (await page.isVisible("#pres-bar")) && !(await page.isVisible("#pc-ya")));
  await page.evaluate(() => window.__atril.presentar.salir({ quitarPaso: true }));
  await ir(page, "#/", "home");
  await page.click("#btn-settings");
  ok("Ajustes tiene el interruptor y está apagado", (await page.isVisible("#ajustes-comprobar")) && !(await page.isChecked("#ajustes-comprobar")));
  await page.click(".sheet label:has(#ajustes-comprobar)");
  await page.click(".sheet .action.plain >> nth=-1");
  // Desde el inicio («Seguir donde lo dejaste» → Presentar): desde el principio
  await crear(page, "docs", { title: "Otro", html: "<p>Otro texto.</p>" });
  await page.evaluate((id) => localStorage.setItem("atril.ultimo", JSON.stringify({ kind: "docs", id, t: Date.now() })), doc.id);
  await page.reload(); await page.waitForSelector("#view-home:not([hidden])");
  await page.click("#seguir-presentar");
  await page.waitForSelector("#pc-ya");
  ok("Desde el inicio, la comprobación propone empezar desde el principio", (await page.getAttribute(".pc-desde [data-desde='inicio']", "aria-pressed")) === "true");
  await page.click(".sheet .action.plain");
  await ctx.close();
}

// =================== Ensayos: cómo vas y practicar una parte ===================
{
  const { ctx, page } = await nuevo();
  const ens = (seg, intro, punto, concl) => ({ id: "e" + seg, fecha: Date.now() - seg * 1000, seg, objetivoSeg: 480, audio: false,
    partes: [{ t: "Introducción", s: intro, o: 120 }, { t: "Punto uno", s: punto, o: 240 }, { t: "Conclusión", s: concl, o: 120 }] });
  const doc = await crear(page, "docs", { title: "Ensayado", html: DISCURSO, target: 8, ensayos: [ens(520, 165, 240, 115), ens(530, 170, 245, 115), ens(510, 160, 235, 115)] });
  await ir(page, `#/leer/docs/${doc.id}`, "reader");
  await page.click("#reader-more");
  await page.click(".sheet >> text=Ensayos (3)");
  await page.waitForSelector(".ens-analisis");
  const txt = await page.textContent(".ens-analisis");
  ok("Ensayos enseña «Cómo vas» con la mediana", txt.includes("Mediana de los 3 últimos") && txt.includes("8:40") && txt.includes("+0:40 del objetivo"), txt.slice(0, 120));
  ok("…dice qué parte se pasa y qué practicar", txt.includes("Practica «Introducción»: se pasa 0:45 de media"));
  ok("…con el tiempo de cada parte", (await page.$$eval(".ens-parte-btn", (xs) => xs.length)) === 3);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUTDIR}/131-ensayos-como-vas.png` });
  await page.click(".ens-practicar");
  await page.waitForTimeout(300);
  ok("«Practicar» cierra la hoja, va a la parte y pone el cronómetro en marcha", !(await page.isVisible(".sheet")) && (await page.evaluate(() => window.__atril.timer.running)) && (await page.textContent("#toast")).includes("Practicando «Introducción»"));
  ok("…y se ve el título de esa parte", await page.evaluate(() => { const h = [...document.querySelectorAll("#reader-content h2")].find((x) => x.textContent.startsWith("Introducción")); const r = h.getBoundingClientRect(), s = document.querySelector("#reader-scroll").getBoundingClientRect(); return r.top >= s.top - 2 && r.top < s.top + s.height / 2; }));
  // Pasa el tiempo y se llega a la parte siguiente: se para solo y no cuenta como ensayo
  await page.evaluate(() => { const t = window.__atril.timer; t.startedAt -= 130000; });
  await page.evaluate(() => { const h = [...document.querySelectorAll("#reader-content h2")].find((x) => x.textContent.startsWith("Punto uno")); const s = document.querySelector("#reader-scroll"); s.scrollTop += h.getBoundingClientRect().top - s.getBoundingClientRect().top - 40; });
  await page.waitForTimeout(1300);
  const t2 = await page.textContent("#toast");
  ok("Al llegar a la parte siguiente, el cronómetro se para solo", !(await page.evaluate(() => window.__atril.timer.running)) && (await page.evaluate(() => window.__atril.timer.ms())) === 0);
  ok("…y dice cómo ha ido esa parte", t2.includes("«Introducción»: 2:1") && t2.includes("de 2:00"), t2);
  ok("…sin guardarlo como ensayo", (await page.evaluate(async (id) => (await window.__atril.store.get("docs", id)).ensayos.length, doc.id)) === 3);
  // Un ensayo normal sigue guardándose
  await page.evaluate(() => { window.__atril.timer.toggle(); window.__atril.timer.startedAt -= 60000; window.__atril.timer.reset(); });
  await page.waitForTimeout(400);
  ok("Un ensayo normal se sigue guardando", (await page.evaluate(async (id) => (await window.__atril.store.get("docs", id)).ensayos.length, doc.id)) === 4);
  await ctx.close();
}

// =================== Menú «Más» agrupado y ayuda del Word ===================
{
  const { ctx, page } = await nuevo();
  const doc = await crear(page, "docs", { title: "Menú", html: DISCURSO });
  await ir(page, `#/leer/docs/${doc.id}`, "reader");
  await page.click("#reader-more");
  const grupos = await page.$$eval(".sheet .menu-grupo", (xs) => xs.map((x) => x.textContent));
  ok("«Más» va por grupos: Practicar, Documento, Compartir y guardar, Ayuda", grupos.join(",") === "Practicar,Documento,Compartir y guardar,Ayuda", grupos.join(","));
  const practicar = await page.evaluate(() => [...document.querySelector(".sheet .menu-grupo").nextElementSibling.querySelectorAll(".action")].map((b) => b.textContent));
  ok("Practicar: ensayos, tarjetas y desplazamiento", practicar.length === 3 && practicar[0].startsWith("Ensayos") && practicar[1].startsWith("Tarjetas"), practicar.join(" | "));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUTDIR}/132-mas-agrupado.png` });
  await page.click(".sheet .action.plain");
  await ir(page, "#/", "home");
  ok("Sin ningún Word abierto, sale «¿Cómo paso el Word del PC?»", await page.isVisible(".ayuda-word"));
  await crear(page, "docs", { title: "Del PC", html: "<p>Hola</p>", source: "Del PC.docx" });
  await page.reload(); await page.waitForSelector("#view-home:not([hidden])");
  ok("Con un Word ya abierto, esa ayuda se quita", await page.isHidden(".ayuda-word"));
  await ctx.close();
}

// =================== Protección (copia de seguridad) ===================
{
  const { ctx, page } = await nuevo();
  await page.evaluate(() => localStorage.removeItem("atril.copia"));
  ok("Sin nada guardado no sale la protección", await page.isHidden("#proteccion"));
  const a = await crear(page, "docs", { title: "Uno", html: "<p>Uno</p>" });
  await crear(page, "notes", { title: "Nota", html: "<p>Nota</p>" });
  await page.reload(); await page.waitForSelector("#view-home:not([hidden])");
  await page.waitForTimeout(300);
  let txt = await page.textContent("#proteccion");
  ok("Sin copia: lo dice, cuántos faltan y ofrece hacerla", txt.includes("Sin copia de seguridad") && txt.includes("2 documentos sin copiar") && (await page.getAttribute("#proteccion", "class")).includes("riesgo") && (await page.isVisible("#prot-copia")), txt);
  await page.evaluate(() => localStorage.setItem("atril.copia", String(Date.now() + 1000)));
  await page.reload(); await page.waitForSelector("#view-home:not([hidden])");
  await page.waitForTimeout(300);
  txt = await page.textContent("#proteccion");
  ok("Con copia de hoy: «todo está copiado» y sin botón", txt.includes("Copia de hoy · todo está copiado") && (await page.getAttribute("#proteccion", "class")).includes("ok") && !(await page.isVisible("#prot-copia")), txt);
  // La copia fue hace 3 días; la nota no ha cambiado desde antes y el discurso sí
  await page.evaluate(async (id) => {
    const dia = 86400000;
    for (const n of await window.__atril.store.all("notes")) { n.created = n.updated = Date.now() - 5 * dia; await window.__atril.store.put("notes", n); }
    const it = await window.__atril.store.get("docs", id); it.created = Date.now() - 5 * dia; it.updated = Date.now() - 1000; await window.__atril.store.put("docs", it);
    localStorage.setItem("atril.copia", String(Date.now() - 3 * dia));
  }, a.id);
  await page.reload(); await page.waitForSelector("#view-home:not([hidden])");
  await page.waitForTimeout(300);
  txt = await page.textContent("#proteccion");
  ok("Con cambios: «hace 3 días · 1 cambiado desde entonces»", txt.includes("Copia de hace 3 días · 1 cambiado desde entonces") && (await page.getAttribute("#proteccion", "class")).includes("aviso"), txt);
  await page.evaluate(() => document.querySelector("#proteccion").scrollIntoView());
  await page.screenshot({ path: `${OUTDIR}/133-proteccion.png` });
  await page.click("#btn-settings");
  await page.waitForTimeout(300);
  ok("Ajustes enseña el mismo estado", (await page.textContent("#ajustes-proteccion")).includes("1 cambiado desde entonces"));
  await page.click(".sheet .action.plain >> nth=-1");
  await page.click("#prot-copia");
  await page.waitForSelector(".sheet .action.primary");
  await page.click(".sheet .action.primary");
  await page.waitForTimeout(500);
  txt = await page.textContent("#proteccion");
  ok("Al hacer la copia, pasa a «todo está copiado»", txt.includes("Copia de hoy · todo está copiado"), txt);
  await ctx.close();
}

// =================== PDF con las letras de Atril ===================
{
  const { ctx, page } = await nuevo();
  const html = "<h1>Título «con» comillas</h1><p>Ágape: agápē, Jehová, ¿qué? ¡sí! — “dijo” … Ωμέγα ‖ pausa</p><p><strong>Negrita ñ</strong> <em>cursiva ü</em></p>";
  for (const [font, familia] of [["sans", "Carlito"], ["serif", "Literata"]]) {
    await page.evaluate((f) => { window.__atril.settings().font = f; }, font);
    await page.evaluate((h) => window.__atril.crearPdf("docs", { title: "Prueba «ñ»", html: h }), html);
    await page.waitForSelector(".sheet .action.primary");
    await page.click(".sheet .action.primary");
    await page.waitForTimeout(300);
    const bytes = await page.evaluate(async () => Array.from(new Uint8Array(await window.__compartido.at(-1).files[0].arrayBuffer())));
    const ruta = `${OUTDIR}/pdf-${font}.pdf`;
    fs.writeFileSync(ruta, Buffer.from(bytes));
    const texto = execFileSync("pdftotext", [ruta, "-"]).toString();
    const fuentes = execFileSync("pdffonts", [ruta]).toString();
    ok(`PDF (${familia}): conserva tildes, «», “”, — y la ē`, ["agápē", "Jehová", "«con»", "“dijo”", "—", "¿qué?"].every((x) => texto.includes(x)), texto.split("\n")[2]);
    ok(`PDF (${familia}): también el griego`, texto.includes("Ωμέγα"));
    ok(`PDF (${familia}): con la letra de Atril incrustada (normal, negrita y cursiva)`, ["Regular", "Bold", "Italic"].every((v) => fuentes.includes(`${familia}-${v}`)), fuentes.split("\n").slice(2).map((l) => l.split(" ")[0]).join(" "));
    ok(`PDF (${familia}): lo que la letra no tiene se cambia por algo parecido`, texto.includes("|| pausa"));
  }
  await ctx.close();
}

ok("Sin errores en la consola", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const fallos = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - fallos}/${results.length} pruebas superadas`);
process.exit(fallos ? 1 : 0);
