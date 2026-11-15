// Herramientas de Word en el editor (a petición de Ezequiel: «pegar, copiar, cortar, alinear y todas las otras
// opciones que puedas»): alineación, sangría, tamaño y tipo de letra, subíndice, mayúsculas, estilos, tabla,
// línea, salto de página, fecha, símbolo, copiar formato, pegar con formato, ortografía; que se guarden, se vean
// en el lector y vayan y vuelvan del Word. Uso: con dist/ servido en el puerto 8080.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { buildDocx } from "../src/docx-export.js";
import JSZip from "jszip";
const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { pw = require("/opt/npm-tools/node_modules/playwright"); }
const URL = process.env.ATRIL_URL || "http://localhost:8080/";
const results = [];
const ok = (name, cond, extra = "") => { results.push({ name, pass: !!cond }); console.log(`${cond ? "✔" : "✘"} ${name}${extra ? " — " + extra : ""}`); };

// ---------- El Word que se guarda (sin navegador) ----------
{
  const html = `<h1 class="al-centro">Título</h1><p class="al-derecha sang-2">Uno <span class="tam-18">grande</span> <span class="f-georgia">otra</span> H<sub>2</sub>O</p><p>antes</p><hr class="salto"><p class="al-justificar">después</p>`;
  const zip = await JSZip.loadAsync(Buffer.from(await (await buildDocx("Prueba", html)).arrayBuffer()));
  const xml = await zip.file("word/document.xml").async("string");
  ok("Word: título centrado", /<w:pStyle w:val="Heading1"\/><w:jc w:val="center"\/>/.test(xml));
  ok("Word: alineado a la derecha y con sangría", /<w:ind w:left="1440"\/><w:jc w:val="right"\/>/.test(xml));
  ok("Word: tamaño 18 y letra Georgia", xml.includes('<w:sz w:val="36"/>') && /w:ascii="Georgia"/.test(xml));
  ok("Word: subíndice", xml.includes('<w:vertAlign w:val="subscript"/>'));
  ok("Word: salto de página y justificado", xml.includes("<w:pageBreakBefore/>") && xml.includes('<w:jc w:val="both"/>'));
  var docxBase64 = Buffer.from(await (await buildDocx("Formato", html)).arrayBuffer()).toString("base64");
}

const browser = await pw.chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, locale: "es-ES", permissions: ["clipboard-read", "clipboard-write"] });
const page = await ctx.newPage();
const errores = [];
page.on("pageerror", (e) => errores.push(String(e)));
await page.goto(URL);
await page.waitForSelector("#view-home:not([hidden])");
await page.evaluate(async () => {
  await window.__atril.store.put("docs", { id: "w", title: "Herramientas", html: "<p>Hola mundo bonito</p><p>Segundo párrafo</p><p>Tercero</p>", created: Date.now(), updated: Date.now() });
  location.hash = "#/editar/docs/w";
});
await page.waitForSelector("#view-editor:not([hidden])");
await page.waitForTimeout(300);

/** Selecciona `palabra` (o pone el cursor en ella si `cursor`) dentro del párrafo n. */
const elegir = (n, palabra, { cursor = false } = {}) => page.evaluate(([n, palabra, cursor]) => {
  const ed = document.querySelector("#editor");
  ed.focus();
  const p = ed.querySelectorAll("p, h1, h2, h3, blockquote, td")[n];
  const w = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
  for (let t = w.nextNode(); t; t = w.nextNode()) {
    const i = t.data.indexOf(palabra);
    if (i < 0) continue;
    const r = document.createRange();
    r.setStart(t, i); r.setEnd(t, cursor ? i : i + palabra.length);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    document.dispatchEvent(new Event("selectionchange"));
    return true;
  }
  return false;
}, [n, palabra, cursor]);
const guardado = () => page.evaluate(async () => { await window.__atril.editor.flush(); return (await window.__atril.store.get("docs", "w")).html; });
const boton = (cmd) => page.click(`#view-editor [data-cmd="${cmd}"]`);
const opcion = (aria) => page.click(`#palette-opciones .opc[aria-label="${aria}"]`);

// Alineación
await elegir(0, "mundo", { cursor: true });
await boton("centro");
let h = await guardado();
ok("Centrar: el párrafo queda centrado al guardar", h.startsWith('<p class="al-centro">'), h.slice(0, 60));
ok("…y el botón «Centrar» se marca", await page.evaluate(() => document.querySelector('#view-editor [data-cmd="centro"]').classList.contains("active")));
await boton("izquierda");
h = await guardado();
ok("Alinear a la izquierda quita la alineación", h.startsWith("<p>"), h.slice(0, 40));
await boton("justificar");
// Sangría
await boton("masSangria"); await boton("masSangria");
h = await guardado();
ok("Aumentar sangría dos veces: dos escalones (y sigue justificado)", /^<p class="al-justificar sang-2">/.test(h), h.slice(0, 50));
await boton("menosSangria");
h = await guardado();
ok("Disminuir sangría", /^<p class="al-justificar sang-1">/.test(h), h.slice(0, 50));

// Tamaño y tipo de letra
await elegir(0, "mundo");
await boton("tamano");
ok("«Tamaño» enseña los tamaños de Word", (await page.$$eval("#palette-opciones .opc", (xs) => xs.map((x) => x.textContent))).join(",") === "8,10,12,14,18,24,36");
await opcion("18 puntos");
h = await guardado();
ok("Tamaño 18: se guarda como span.tam-18", h.includes('<span class="tam-18">mundo</span>'), h.slice(0, 120));
await elegir(0, "mundo");
ok("El selector dice el tamaño donde está el cursor", (await page.textContent("#sel-tamano")) === "18");
await elegir(0, "bonito");
await boton("fuente");
await opcion("Georgia");
h = await guardado();
ok("Letra Georgia: span.f-georgia", h.includes('<span class="f-georgia">bonito</span>'), h.slice(0, 160));
await elegir(0, "bonito");
ok("El selector dice la letra", (await page.textContent("#sel-fuente")) === "Georgia");
await boton("fuente");
await opcion("La del documento");
h = await guardado();
ok("«La del documento» la quita", !h.includes("f-georgia"), h.slice(0, 160));
await elegir(0, "mundo");
await boton("tamano");
await opcion("12 puntos (normal)");
h = await guardado();
ok("Tamaño 12 (normal) quita el tamaño", !h.includes("tam-"), h.slice(0, 120));

// Subíndice, superíndice y mayúsculas
await elegir(1, "Segundo");
await boton("sup");
h = await guardado();
ok("Superíndice", h.includes("<sup>Segundo</sup>"), h);
await elegir(1, "Segundo");
await boton("sup");
await elegir(1, "párrafo");
await boton("bold");
const todoElParrafo = (n) => page.evaluate((n) => {
  const p = document.querySelectorAll("#editor p")[n];
  const r = document.createRange(); r.selectNodeContents(p);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  document.dispatchEvent(new Event("selectionchange"));
}, n);
await todoElParrafo(1);
await boton("mayus");
await opcion("MAYÚSCULAS");
h = await guardado();
ok("MAYÚSCULAS sin perder la negrita", h.includes("SEGUNDO <strong>PÁRRAFO</strong>"), h);
await todoElParrafo(1);
await boton("mayus");
await opcion("Tipo oración.");
h = await guardado();
ok("Tipo oración", h.includes("Segundo <strong>párrafo</strong>"), h);

// Copiar formato: de «párrafo» (negrita) a «Tercero»
await elegir(1, "párrafo", { cursor: true });
await boton("brocha");
ok("«Copiar formato» queda marcado", (await page.getAttribute('#view-editor [data-cmd="brocha"]', "aria-pressed")) === "true");
await elegir(2, "Tercero");
await page.waitForTimeout(1000);
h = await guardado();
ok("Copiar formato: «Tercero» pasa a negrita", h.includes("<strong>Tercero</strong>"), h);

// Estilo Cita y desplegable de estilos
await elegir(2, "Tercero", { cursor: true });
await page.click('.estilos [data-cmd="cita"]');
h = await guardado();
ok("Estilo «Cita»", /<blockquote>(<p>)?<strong>Tercero/.test(h), h);
await page.click('.estilos [data-cmd="p"]');

// Insertar: tabla, línea, salto de página, fecha y símbolo
await page.click('[data-rtab="insertar"]');
await elegir(1, "Segundo", { cursor: true });
await boton("tabla");
await opcion("3 columnas y 3 filas");
h = await guardado();
ok("Tabla de 3 × 3", (h.match(/<tr>/g) || []).length === 3 && (h.match(/<td>/g) || []).length === 9, h);
await page.evaluate(() => { const td = document.querySelector("#editor td"); const r = document.createRange(); r.setStart(td, 0); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.querySelector("#editor").focus(); });
await boton("tabla");
await opcion("Fila debajo");
await boton("tabla");
await opcion("Columna a la derecha");
h = await guardado();
ok("Dentro de la tabla: fila y columna nuevas", (h.match(/<tr>/g) || []).length === 4 && (h.match(/<td>/g) || []).length === 16, `${(h.match(/<tr>/g) || []).length} filas`);
await elegir(0, "Hola", { cursor: true });
await boton("linea");
await boton("salto");
await boton("fecha");
await boton("simbolo");
await opcion("«");
h = await guardado();
ok("Línea, salto de página, fecha y símbolo", h.includes("<hr>") && h.includes('<hr class="salto">') && /\d{4}/.test(h) && h.includes("«"), h.slice(0, 200));

// Pegar con formato (lo que llega se limpia) y solo texto
await page.click('[data-rtab="inicio"]');
await elegir(2, "Tercero", { cursor: true });
await page.evaluate(() => {
  const dt = new DataTransfer();
  dt.setData("text/html", '<span style="font-size:18pt;font-weight:bold;font-family:Georgia">Pegado</span><script>alert(1)</script>');
  dt.setData("text/plain", "Pegado");
  document.querySelector("#editor").dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
});
h = await guardado();
ok("Pegar conserva el formato (limpio)", /<strong><span class="f-georgia"><span class="tam-18">Pegado<\/span><\/span><\/strong>/.test(h), h.slice(0, 200));
ok("…y sin nada peligroso", !h.includes("script") && !h.includes("style="));
await page.evaluate(() => navigator.clipboard.writeText("Texto copiado"));
await elegir(2, "Tercero", { cursor: true });
await boton("pegarTexto");
await page.waitForTimeout(200);
h = await guardado();
ok("«Solo texto» pega el texto del portapapeles", h.includes("Texto copiado"), h.slice(-200));
await elegir(0, "Hola");
await boton("copiar");
ok("Copiar dice que se ha copiado", (await page.textContent("#toast")).includes("Copiado"));

// Revisar: ortografía
await page.click('[data-rtab="revisar"]');
await boton("ortografia");
ok("Ortografía se puede apagar", (await page.getAttribute("#editor", "spellcheck")) === "false" && (await page.getAttribute('#view-editor [data-cmd="ortografia"]', "aria-pressed")) === "false");
await boton("ortografia");
ok("…y volver a encender", (await page.getAttribute("#editor", "spellcheck")) === "true");

// Se ve igual en el lector
await page.evaluate(async () => {
  await window.__atril.store.put("docs", { id: "w2", title: "Lector", html: window.__atril.sanitize('<p class="al-centro sang-1">Centrado <span class="tam-24">grande</span></p>'), created: Date.now(), updated: Date.now() });
  location.hash = "#/leer/docs/w2";
});
await page.waitForSelector("#view-reader:not([hidden])");
await page.waitForTimeout(300);
const estilo = await page.evaluate(() => { const p = document.querySelector("#reader-content p"); const g = document.querySelector("#reader-content .tam-24"); return { al: getComputedStyle(p).textAlign, ml: parseFloat(getComputedStyle(p).marginLeft), fs: parseFloat(getComputedStyle(g).fontSize) / parseFloat(getComputedStyle(p).fontSize) }; });
ok("En el lector: centrado, con sangría y el doble de grande", estilo.al === "center" && estilo.ml > 10 && Math.abs(estilo.fs - 2) < 0.05, JSON.stringify(estilo));

// Abrir un Word con alineación y sangría
await page.evaluate(async (b64) => {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  await window.__atril.importFiles([new File([bytes], "Formato.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })]);
}, docxBase64);
await page.waitForTimeout(800);
const abierto = await page.evaluate(async () => (await window.__atril.store.all("docs")).find((d) => d.title === "Formato" || d.source === "Formato.docx"));
ok("Al abrir un Word se conservan la alineación y la sangría", abierto && abierto.html.includes('<h1 class="al-centro">') && abierto.html.includes('class="al-derecha sang-2"') && abierto.html.includes('class="al-justificar"'), abierto && abierto.html.slice(0, 200));
ok("…sin marcas raras en el texto", abierto && !/[-]/.test(abierto.html));

// El PDF: centrado, a la derecha, letra más grande, línea y salto de página
{
  const c2 = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true, locale: "es-ES" });
  await c2.addInitScript(() => {
    window.__compartido = [];
    Object.defineProperty(navigator, "share", { configurable: true, value: async (d) => { window.__compartido.push(d); } });
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
  });
  const p2 = await c2.newPage();
  p2.on("pageerror", (e) => errores.push(String(e)));
  await p2.goto(URL);
  await p2.waitForSelector("#view-home:not([hidden])");
  const html = '<p class="al-centro">Centrado</p><p class="al-derecha">Derecha</p><p>Normal <span class="tam-36">ENORME</span></p><hr><p>Primera página</p><hr class="salto"><p>Segunda página</p>';
  await p2.evaluate((h) => window.__atril.crearPdf("docs", { title: "Formato", html: h }), html);
  await p2.waitForSelector(".sheet .action.primary");
  await p2.click(".sheet .action.primary");
  await p2.waitForTimeout(300);
  const bytes = await p2.evaluate(async () => Array.from(new Uint8Array(await window.__compartido.at(-1).files[0].arrayBuffer())));
  const ruta = path.join(os.tmpdir(), "atril-formato.pdf");
  fs.writeFileSync(ruta, Buffer.from(bytes));
  const paginas = Number((execFileSync("pdfinfo", [ruta]).toString().match(/Pages:\s+(\d+)/) || [])[1]);
  const texto = execFileSync("pdftotext", ["-layout", ruta, "-"]).toString().split("\n");
  const sangria = (palabra) => { const l = texto.find((x) => x.includes(palabra)) || ""; return l.indexOf(palabra); };
  ok("PDF: el salto de página empieza una página nueva", paginas === 2, `${paginas} páginas`);
  ok("PDF: centrado y a la derecha", sangria("Centrado") > 15 && sangria("Derecha") > sangria("Centrado") && sangria("Normal") < 5, `${sangria("Centrado")} / ${sangria("Derecha")} / ${sangria("Normal")}`);
  await c2.close();
}

ok("Sin errores en la página", !errores.length, errores.join(" | "));
await browser.close();
const fallos = results.filter((r) => !r.pass);
console.log(`\n${results.length - fallos.length}/${results.length} pruebas superadas`);
process.exit(fallos.length ? 1 : 0);
