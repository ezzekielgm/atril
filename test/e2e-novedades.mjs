// «Novedades», «Para Claude», «Contar un problema a Ezequiel» y la línea iluminada al pasar página en Presentar.
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

const browser = await pw.chromium.launch();
const errors = [];
async function nuevo() {
  const ctx = await browser.newContext({ viewport: { width: 1080, height: 810 }, hasTouch: true, isMobile: true, locale: "es-ES" });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new globalThis.URL(URL).origin });
  await ctx.addInitScript(() => { window.__atrilProbarNovedades = true; });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(URL);
  await page.waitForSelector("#view-home:not([hidden])");
  return { ctx, page };
}
const portapapeles = (page) => page.evaluate(() => navigator.clipboard.readText());

// ============ Novedades ============
{
  const { ctx, page } = await nuevo();
  await page.waitForTimeout(2000);
  ok("A quien estrena Atril no se le enseñan las novedades", !(await page.isVisible(".sheet >> text=Novedades de Atril")) && (await page.evaluate(() => localStorage.getItem("atril.novedades"))) !== null);
  // Alguien que ya lo usaba (tiene discursos) y no ha visto estas
  await page.evaluate(async () => {
    await window.__atril.store.put("docs", { id: "n1", title: "Uno", html: "<p>Hola</p>", created: Date.now(), updated: Date.now() });
    localStorage.removeItem("atril.novedades");
  });
  await page.reload();
  await page.waitForSelector(".sheet >> text=Novedades de Atril", { timeout: 6000 }).catch(() => {});
  ok("Quien ya lo usaba ve las novedades al abrir", await page.isVisible(".sheet >> text=Novedades de Atril"));
  const txt = await page.textContent(".sheet");
  ok("…con lo que ha cambiado (p. ej. «Salir» en Presentar y «Para Claude»)", txt.includes("Salir") && txt.includes("Para Claude"), txt.slice(0, 120));
  await page.screenshot({ path: `${OUTDIR}/novedades.png` });
  await page.click("#novedades-ok");
  await page.reload();
  await page.waitForTimeout(2200);
  ok("Una vez vistas, no vuelven a salir", !(await page.isVisible(".sheet >> text=Novedades de Atril")));
  await page.click('button:has-text("Ajustes")');
  await page.click("#ajustes-novedades");
  ok("Ajustes → Versión → «Novedades» las enseña siempre", await page.isVisible(".sheet >> text=Novedades de Atril"));
  await page.click("#novedades-ok");

  // ============ Contar un problema a Ezequiel ============
  await page.click('button:has-text("Ajustes")');
  await page.click("#ajustes-contar");
  ok("Ajustes → «Contar un problema o una idea a Ezequiel»", await page.isVisible(".sheet >> text=Por WhatsApp (eliges su chat)") && await page.isVisible(".sheet >> text=Copiar el mensaje"));
  await page.click(".sheet >> text=Copiar el mensaje");
  await page.waitForTimeout(300);
  const msg = await portapapeles(page);
  ok("El mensaje va con la versión y el aparato (y sin ningún número guardado)", msg.startsWith("Hola, Ezequiel.") && /\d{8}-[0-9a-f]{8}/.test(msg) && /iPad|móvil|tableta|ordenador/.test(msg), msg.replace(/\n/g, " ⏎ "));
  await ctx.close();
}

// ============ Para Claude ============
{
  const { ctx, page } = await nuevo();
  await page.evaluate(async () => {
    await window.__atril.store.put("notes", { id: "nota1", title: "Asamblea del sábado", html: "<p>El amor es paciente (1 Corintios 13:4).</p><p>Ideas sueltas.</p>", created: Date.now(), updated: Date.now() });
    await window.__atril.store.put("docs", { id: "doc1", title: "La paciencia", target: 10, html: "<h2>Introducción</h2><p>Texto del discurso.</p>", created: Date.now(), updated: Date.now() });
  });
  await page.evaluate(() => window.__atril.abrirCompartir("notes", { id: "nota1", title: "Asamblea del sábado", html: "<p>El amor es paciente (1 Corintios 13:4).</p><p>Ideas sueltas.</p>" }));
  ok("Compartir tiene la sección «Para Claude»", await page.isVisible(".sheet >> text=Para Claude"));
  ok("En una nota: «Ordenar estas notas» y «Resumir»", await page.isVisible(".co-claude-ordenar") && await page.isVisible(".co-claude-resumir") && !(await page.isVisible(".co-claude-pdf")));
  await page.screenshot({ path: `${OUTDIR}/para-claude.png` });
  await page.click(".co-claude-ordenar");
  await page.waitForTimeout(300);
  let t = await portapapeles(page);
  ok("Copia la petición y luego las notas", t.startsWith("Son notas que tomé en una asamblea") && t.includes("Asamblea del sábado") && t.includes("El amor es paciente"), t.slice(0, 90));
  ok("Sin las marcas de WhatsApp (texto limpio)", !/\*[^*]+\*/.test(t));
  await page.evaluate(() => window.__atril.abrirCompartir("docs", { id: "doc1", title: "La paciencia", target: 10, html: "<h2>Introducción</h2><p>Texto del discurso.</p>" }));
  ok("En un discurso: «Mejorar el discurso»", await page.isVisible(".co-claude-mejorar"));
  await page.click(".co-claude-mejorar");
  await page.waitForTimeout(300);
  t = await portapapeles(page);
  ok("…con su duración en la petición", t.startsWith("Es mi discurso «La paciencia» y debe durar 10 minutos") && t.includes("Texto del discurso"), t.slice(0, 90));
  // Nota escrita a mano: también en PDF
  const conDibujo = await page.evaluate(() => window.__atril.sanitize('<figure class="dibujo" data-dibujo=\'{"w":1000,"h":300,"t":[{"c":"k-negro","h":"b","s":3,"p":[10,10,0.5,200,100,0.5]}]}\'></figure>'));
  await page.evaluate((html) => window.__atril.abrirCompartir("notes", { id: "nota2", title: "A mano", html }), conDibujo);
  ok("Si hay escritura a mano: «Con lo escrito a mano (PDF)»", await page.isVisible(".co-claude-pdf"));
  await page.click(".co-claude-pdf");
  await page.waitForTimeout(400);
  t = await portapapeles(page);
  ok("…copia la petición para pegarla junto al PDF", t.startsWith("Te paso en PDF unas notas"));
  await ctx.close();
}

// ============ Presentar: la línea por la que sigues ============
{
  const { ctx, page } = await nuevo();
  await page.evaluate(async () => {
    localStorage.setItem("atril.consejoAcceso", "1");
    const html = Array.from({ length: 8 }, (_, i) => `<h2>Parte ${i + 1}</h2><p>${Array.from({ length: 70 }, (_, k) => "palabra" + (i * 70 + k)).join(" ")}.</p>`).join("");
    await window.__atril.store.put("docs", { id: "largo", title: "Largo", html, created: Date.now(), updated: Date.now() });
    location.hash = "#/leer/docs/largo";
  });
  await page.waitForSelector("#view-reader:not([hidden])");
  await page.click("#reader-presentar");
  await page.click("#pc-ya");
  await page.waitForSelector("#pres-bar:not([hidden])");
  const sc = await page.$eval("#reader-scroll", (s) => { const r = s.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.85, top: r.top }; });
  // La palabra de la penúltima línea antes de pasar
  const antes = await page.evaluate(() => {
    const s = document.querySelector("#reader-scroll"), r = s.getBoundingClientRect();
    const lh = window.__atril.settings().fontSize * window.__atril.settings().lineHeight;
    const c = document.caretRangeFromPoint(r.left + r.width / 2, r.bottom - lh * 1.5);
    return c && c.startContainer.nodeValue ? c.startContainer.nodeValue.slice(c.startOffset).split(" ")[0] : "";
  });
  await page.touchscreen.tap(sc.x, sc.y);
  await page.waitForTimeout(800);
  const m = await page.evaluate(() => { const e = document.querySelector("#pres-sigue-aqui"); const r = e.getBoundingClientRect(); return { hidden: e.hidden, top: r.top, bottom: r.bottom }; });
  ok("Al pasar página se iluminan las líneas por las que sigues, arriba", !m.hidden && Math.abs(m.top - sc.top) < 4, JSON.stringify(m));
  const dentro = await page.evaluate(({ y1, y2 }) => {
    const s = document.querySelector("#reader-scroll"), r = s.getBoundingClientRect();
    const c = document.caretRangeFromPoint(r.left + r.width / 2, (y1 + y2) / 2);
    return c && c.startContainer.nodeValue ? c.startContainer.nodeValue : "";
  }, { y1: m.top, y2: m.bottom });
  ok("…y son las que estaban abajo del todo", antes && dentro.includes(antes.replace(/[^a-z0-9]/gi, "")), `«${antes}»`);
  await page.screenshot({ path: `${OUTDIR}/presentar-sigue-aqui.png` });
  await page.waitForTimeout(1800);
  ok("Se quita sola", await page.evaluate(() => document.querySelector("#pres-sigue-aqui").hidden));
  await ctx.close();
}

await browser.close();
ok("Sin errores en la consola", errors.length === 0, errors.slice(0, 3).join(" | "));
const fallos = results.filter((r) => !r.pass);
console.log(`\n${results.length - fallos.length}/${results.length} pruebas superadas`);
process.exit(fallos.length ? 1 : 0);
