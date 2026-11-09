// Pruebas de compartir (WhatsApp, otra app, copiar, Word y PDF), de salir de Presentar
// (la burbuja solo aparece al hacer «atrás» o tocar el centro) y de la Guía de Atril.
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
const errors = [];
const pulsar = async (page, sel, ms) => { await page.hover(sel); await page.mouse.down(); await page.waitForTimeout(ms); await page.mouse.up(); };

const UA_IPAD = "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const UA_ANDROID = "Mozilla/5.0 (Linux; Android 14; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const browser = await pw.chromium.launch();
async function nuevo({ width = 1080, height = 810, ua, limpio = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true, deviceScaleFactor: 1, locale: "es-ES", acceptDownloads: true, ...(ua ? { userAgent: ua } : {}) });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new globalThis.URL(URL).origin });
  // El menú «Compartir» del sistema no existe en Chromium: se simula para ver qué se le pasa
  await ctx.addInitScript(() => {
    window.__compartido = [];
    Object.defineProperty(navigator, "share", { configurable: true, value: async (d) => { window.__compartido.push({ title: d.title, text: d.text, files: (d.files || []).map((f) => f.name) }); } });
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" && !/whatsapp:|scheme does not have a registered handler/i.test(m.text())) errors.push(m.text()); });
  await page.goto(URL);
  await page.waitForSelector("#view-home:not([hidden])");
  if (limpio) await page.evaluate(() => { localStorage.setItem("atril.hideInstall", "1"); localStorage.setItem("atril.copia", String(Date.now())); localStorage.setItem("atril.consejoAcceso", "1"); localStorage.setItem("atril.consejoToque", "1"); });
  return { ctx, page };
}
const ir = async (page, hash, vista) => { await page.goto(URL + hash); await page.waitForSelector(`#view-${vista}:not([hidden])`); await page.waitForTimeout(250); };
const crear = (page, kind, item) => page.evaluate(async ([k, it]) => { const now = Date.now(); const x = { id: "t" + Math.random().toString(36).slice(2), created: now, updated: now, ...it, html: window.__atril.sanitize(it.html) }; await window.__atril.store.put(k, x); return x; }, [kind, item]);

const HTML = `<h2>Introducción (2 min)</h2><p>Hola <strong>a todos </strong>y <em>bienvenidos</em>. ‖ Empezamos.</p>
<ul><li>Uno</li><li>Dos<ul><li>Dos y medio</li></ul></li></ul><ol><li>Primero</li><li>Segundo</li></ol>
<p><s>Esto no</s> y <strong><em>esto sí</em></strong>.</p><blockquote><p>Una cita</p></blockquote>`;

// =================== Compartir ===================
{
  const { ctx, page } = await nuevo();
  const nota = await crear(page, "notes", { title: "Ideas para el domingo", html: HTML });
  const doc = await crear(page, "docs", { title: "Mi discurso", html: "<h1>Mi discurso</h1><p>Texto con <strong>negrita</strong>.</p>", source: "Mi discurso.docx", alPC: Date.now() + 5000 });
  const wa = await page.evaluate((n) => window.__atril.textoParaCompartir("notes", n, { formato: true }), nota);
  ok("Con formato de WhatsApp: el título de la nota va arriba en negrita", wa.startsWith("*Ideas para el domingo*\n\n*Introducción (2 min)*"), JSON.stringify(wa.slice(0, 60)));
  ok("Negrita y cursiva con *…* y _…_, con los espacios por fuera", wa.includes("Hola *a todos* y _bienvenidos_."), JSON.stringify(wa));
  ok("Las pausas «‖» no se mandan", !wa.includes("‖") && wa.includes("_bienvenidos_. Empezamos."));
  ok("Listas con viñetas, números y sangría", wa.includes("• Uno\n• Dos\n   • Dos y medio") && wa.includes("1. Primero\n2. Segundo"), JSON.stringify(wa));
  ok("Tachado con ~…~ y negrita cursiva juntas", wa.includes("~Esto no~ y *_esto sí_*."));
  ok("Las citas van con «>»", wa.includes("> Una cita"));
  const plano = await page.evaluate((n) => window.__atril.textoParaCompartir("notes", n, { formato: false }), nota);
  ok("Sin formato: ni asteriscos ni guiones bajos", !/[*_~]/.test(plano) && plano.startsWith("Ideas para el domingo\n\nIntroducción (2 min)\n\nHola a todos y bienvenidos. Empezamos.\n\n• Uno"), JSON.stringify(plano.slice(0, 80)));
  const conDibujo = await page.evaluate(() => window.__atril.textoParaCompartir("docs", { title: "X", html: window.__atril.sanitize(`<p>Antes</p><figure class="dibujo" data-dibujo='{"w":1000,"h":300,"t":[{"c":"negro","h":"b","s":4,"p":[10,10,0.5,200,200,0.5]}]}'></figure><p>Después</p>`) }));
  ok("Un dibujo sale como «[Dibujo]»", conDibujo === "Antes\n\n[Dibujo]\n\nDespués", JSON.stringify(conDibujo));
  const docTxt = await page.evaluate((d) => window.__atril.textoParaCompartir("docs", d), doc);
  ok("Un discurso no repite el título", docTxt === "*Mi discurso*\n\nTexto con *negrita*.", JSON.stringify(docTxt));

  // Desde el ⋯ de la tarjeta
  await ir(page, "#/", "home");
  await page.click(".segmented button[data-tab='notes']");
  await page.click(".card:has-text('Ideas para el domingo') .card-more");
  ok("El ⋯ de la tarjeta tiene «Compartir (WhatsApp, correo…)»", await page.isVisible(".sheet >> text=Compartir (WhatsApp, correo…)"));
  ok("…y ya no repite «Copiar el texto» y «Compartir el texto» sueltos", !(await page.isVisible(".sheet .action >> text=Compartir el texto")));
  await page.click(".sheet >> text=Compartir (WhatsApp, correo…)");
  await page.waitForSelector(".sheet .co-wa");
  const ops = await page.$$eval(".sheet .co-n", (xs) => xs.map((x) => x.textContent));
  ok("La hoja ofrece WhatsApp, otra app, copiar, Word y PDF", ops.join(",") === "WhatsApp,Otra app,Copiar el texto,Word,PDF", ops.join(","));
  const altos = await page.$$eval(".sheet .co-op", (bs) => Math.min(...bs.map((b) => b.getBoundingClientRect().height)));
  ok("Botones grandes para el dedo", altos >= 44, `${altos}px`);
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${OUTDIR}/120-compartir.png` });
  await page.click(".sheet .co-copiar");
  await page.waitForTimeout(250);
  let clip = await page.evaluate(() => navigator.clipboard.readText());
  ok("«Copiar el texto» copia con formato de WhatsApp", clip === wa);
  // Sin formato
  await page.click(".card:has-text('Ideas para el domingo') .card-more");
  await page.click(".sheet >> text=Compartir (WhatsApp, correo…)");
  await page.click(".sheet label:has(#compartir-formato)");
  ok("El interruptor del formato se recuerda", (await page.evaluate(() => window.__atril.settings().formatoWA)) === false);
  await page.click(".sheet .co-copiar");
  await page.waitForTimeout(250);
  clip = await page.evaluate(() => navigator.clipboard.readText());
  ok("Sin formato copia el texto limpio", clip === plano);
  await page.evaluate(() => { const s = window.__atril.settings(); s.formatoWA = true; });

  // Otra app
  await page.click(".card:has-text('Ideas para el domingo') .card-more");
  await page.click(".sheet >> text=Compartir (WhatsApp, correo…)");
  await page.click(".sheet .co-otra");
  await page.waitForTimeout(200);
  let comp = await page.evaluate(() => window.__compartido.at(-1));
  ok("«Otra app» abre el menú del sistema con el texto", comp && comp.title === "Ideas para el domingo" && comp.text === wa);

  // WhatsApp en un ordenador: wa.me en otra pestaña
  await page.evaluate(() => { window.__abierto = null; window.open = (u) => { window.__abierto = u; return null; }; });
  await page.click(".card:has-text('Ideas para el domingo') .card-more");
  await page.click(".sheet >> text=Compartir (WhatsApp, correo…)");
  await page.click(".sheet .co-wa");
  const abierto = await page.evaluate(() => window.__abierto);
  ok("WhatsApp en el ordenador abre wa.me con el texto", abierto && abierto.startsWith("https://wa.me/?text=") && decodeURIComponent(abierto.split("text=")[1]) === wa);

  // Word para compartir: no toca el «al día» con el PC
  await page.click(".segmented button[data-tab='docs']");
  await page.click(".card:has-text('Mi discurso') .card-more");
  await page.click(".sheet >> text=Compartir (WhatsApp, correo…)");
  await page.click(".sheet .co-word");
  await page.waitForSelector(".sheet >> text=Word listo para compartir");
  ok("El Word para compartir lleva su propio botón y explicación", (await page.textContent(".sheet .action.primary")).includes("Compartir") && (await page.textContent(".sheet .nota-pc")).includes("WhatsApp"));
  const alPCantes = (await page.evaluate((id) => window.__atril.store.get("docs", id), doc.id)).alPC;
  await page.click(".sheet .action.primary");
  await page.waitForTimeout(300);
  comp = await page.evaluate(() => window.__compartido.at(-1));
  const alPCdespues = (await page.evaluate((id) => window.__atril.store.get("docs", id), doc.id)).alPC;
  ok("Se comparte como archivo .docx", comp && comp.files && comp.files[0] === "Mi discurso.docx", JSON.stringify(comp));
  ok("Compartirlo no lo marca como pasado al PC", alPCantes === alPCdespues);
  // PDF
  await page.click(".card:has-text('Mi discurso') .card-more");
  await page.click(".sheet >> text=Compartir (WhatsApp, correo…)");
  await page.click(".sheet .co-pdf");
  ok("PDF abre las opciones del PDF", await page.isVisible(".sheet >> text=Crear el PDF"));
  await page.click(".sheet >> text=Cancelar");

  // Nota vacía
  await page.evaluate(() => window.__atril.abrirCompartir("notes", { title: "Vacía", html: "<p><br></p>" }));
  ok("Sin texto, avisa en vez de abrir la hoja", (await page.textContent("#toast")).includes("Todavía no hay texto"));

  // Lector: «Compartir» está en «Más», en su grupo
  await ir(page, `#/leer/docs/${doc.id}`, "reader");
  const cabe = await page.evaluate(() => { const b = document.querySelector(".reader-bar"); return b.scrollWidth <= b.clientWidth + 1; });
  ok("La barra del lector sigue cabiendo", cabe);
  await page.click("#reader-more");
  ok("En «Más» del lector, «Compartir» abre el grupo «Compartir y guardar»", await page.evaluate(() => { const h = [...document.querySelectorAll(".sheet .menu-grupo")].find((x) => x.textContent === "Compartir y guardar"); return !!h && h.nextElementSibling.querySelector(".action").textContent.includes("Compartir"); }));
  await page.click(".sheet .action:has-text('Compartir (WhatsApp')");
  ok("…y abre la hoja de compartir", await page.isVisible(".sheet .co-wa"));
  await page.click(".sheet >> text=Cerrar");
  // Editor: botón arriba
  await ir(page, `#/editar/docs/${doc.id}`, "editor");
  ok("El editor tiene el botón de compartir arriba", await page.isVisible("#editor-share"));
  await page.click("#editor-share");
  await page.waitForSelector(".sheet .co-wa");
  ok("…que abre la hoja de compartir", await page.isVisible(".sheet .co-word"));
  await page.click(".sheet >> text=Cerrar");
  await page.click("#editor-more");
  ok("El ⋯ del editor tiene «Compartir» y «Guía de Atril»", (await page.isVisible(".sheet >> text=Compartir (WhatsApp, correo…)")) && (await page.isVisible(".sheet >> text=Guía de Atril")));
  await page.click(".sheet >> text=Cancelar");
  await ctx.close();
}

// iPad en vertical: la barra del lector cabe con sus nombres
{
  const { ctx, page } = await nuevo({ width: 810, height: 1080 });
  const doc = await crear(page, "docs", { title: "Vertical", html: "<h2>Uno</h2><p>Texto.</p>" });
  await ir(page, `#/leer/docs/${doc.id}`, "reader");
  ok("iPad en vertical: la barra cabe con los nombres", await page.evaluate(() => { const b = document.querySelector(".reader-bar"); return b.scrollWidth <= b.clientWidth + 1 && [...document.querySelectorAll(".reader-tools .lbl")].every((l) => l.offsetWidth > 0); }));
  await page.screenshot({ path: `${OUTDIR}/122-lector-vertical.png` });
  await ctx.close();
}

// WhatsApp en el iPad: abre la app; si no se abre, ofrece otra
{
  const { ctx, page } = await nuevo({ ua: UA_IPAD });
  const doc = await crear(page, "docs", { title: "Corto", html: "<p>Hola <strong>grupo</strong></p>" });
  await page.evaluate((d) => window.__atril.abrirCompartir("docs", d), doc);
  await page.waitForSelector(".sheet .co-wa");
  await page.click(".sheet .co-wa");
  await page.waitForFunction(() => !document.querySelector("#toast").hidden && document.querySelector("#toast").textContent.includes("WhatsApp"), null, { timeout: 5000 }).catch(() => {});
  ok("iPad sin WhatsApp: avisa y ofrece «Otra app»", (await page.textContent("#toast")).includes("No se ha abierto WhatsApp") && (await page.isVisible("#toast >> text=Otra app")));
  await page.click("#toast >> text=Otra app");
  await page.waitForTimeout(200);
  const comp = await page.evaluate(() => window.__compartido.at(-1));
  ok("«Otra app» del aviso manda el mismo texto", comp && comp.text === "Hola *grupo*");
  await ctx.close();
}

// =================== Presentar: salir ===================
{
  const { ctx, page } = await nuevo();
  const doc = await crear(page, "docs", { title: "Presentar", html: Array.from({ length: 12 }, (_, i) => `<h2>Parte ${i + 1} (1 min)</h2><p>${"Texto de la parte para llenar la pantalla. ".repeat(14)}</p>`).join("") });
  await ir(page, "#/", "home");
  await ir(page, `#/leer/docs/${doc.id}`, "reader");
  await page.click("#reader-presentar"); await page.click("#pc-ya");
  await page.waitForSelector("#pres-bar:not([hidden])");
  ok("Al presentar, la burbuja de salir no está", await page.isHidden("#pres-salir"));
  ok("Se pone un paso en el historial para que «atrás» no salga", await page.evaluate(() => history.state && history.state.atril === "presentar"));
  const hash = await page.evaluate(() => location.hash);
  await page.goBack();
  await page.waitForTimeout(300);
  ok("El gesto o botón de «atrás» no sale de Presentar", (await page.evaluate(() => window.__atril.presentar.activo)) && (await page.isVisible("#pres-bar")) && (await page.evaluate(() => location.hash)) === hash);
  ok("…y enseña «Mantén pulsado para salir»", await page.isVisible("#pres-salir"));
  await page.screenshot({ path: `${OUTDIR}/123-presentar-salir.png` });
  ok("…y vuelve a poner el paso", await page.evaluate(() => history.state && history.state.atril === "presentar"));
  await page.goBack();
  await page.waitForTimeout(300);
  ok("Un segundo «atrás» tampoco sale", await page.evaluate(() => window.__atril.presentar.activo));
  await page.waitForTimeout(5300);
  ok("La burbuja se va sola a los pocos segundos", await page.isHidden("#pres-salir"));
  // Toque en el centro
  const pos = async (f) => page.$eval("#reader-scroll", (s, f) => { const b = s.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height * f }; }, f);
  const top0 = await page.$eval("#reader-scroll", (s) => s.scrollTop);
  let p = await pos(0.42);
  await page.touchscreen.tap(p.x, p.y);
  await page.waitForTimeout(400);
  ok("Un toque en el centro enseña la burbuja sin mover el texto", (await page.isVisible("#pres-salir")) && (await page.$eval("#reader-scroll", (s) => s.scrollTop)) === top0);
  await page.evaluate(() => { document.querySelector("#pres-salir").hidden = true; });
  p = await pos(0.8);
  await page.touchscreen.tap(p.x, p.y);
  await page.waitForTimeout(700);
  ok("Un toque abajo pasa página y no enseña la burbuja", (await page.isHidden("#pres-salir")) && (await page.$eval("#reader-scroll", (s) => s.scrollTop)) > top0);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(100);
  ok("Escape tampoco sale: enseña la burbuja", (await page.evaluate(() => window.__atril.presentar.activo)) && (await page.isVisible("#pres-salir")));
  // Sin «tocar para pasar página», cualquier toque la enseña
  await page.evaluate(() => { window.__atril.settings().presToque = false; document.querySelector("#pres-salir").hidden = true; });
  p = await pos(0.85);
  await page.touchscreen.tap(p.x, p.y);
  await page.waitForTimeout(300);
  ok("Con los toques de pasar página quitados, cualquier toque la enseña", await page.isVisible("#pres-salir"));
  await page.evaluate(() => { window.__atril.settings().presToque = true; });
  // Salir de verdad
  await pulsar(page, "#pres-salir", 1100);
  await page.waitForTimeout(400);
  ok("Mantener pulsado «Salir» sale", !(await page.evaluate(() => window.__atril.presentar.activo)) && (await page.isHidden("#pres-bar")));
  ok("Al salir se quita el paso del historial", await page.evaluate(() => !(history.state && history.state.atril === "presentar")));
  await page.goBack();
  await page.waitForSelector("#view-home:not([hidden])", { timeout: 3000 }).catch(() => {});
  ok("Después, «atrás» vuelve al inicio como siempre", await page.isVisible("#view-home"));
  await ctx.close();
}

// Consejo la primera vez: iPad (Acceso guiado) y Android (Fijar aplicaciones), con cómo salir
for (const [nombre, ua, clave] of [["iPad", UA_IPAD, "Acceso guiado"], ["Android", UA_ANDROID, "Fijar aplicaciones"]]) {
  const { ctx, page } = await nuevo({ ua });
  await page.evaluate(() => localStorage.removeItem("atril.consejoAcceso"));
  const doc = await crear(page, "docs", { title: "Consejo", html: "<h2>Uno</h2><p>Texto.</p>" });
  await ir(page, `#/leer/docs/${doc.id}`, "reader");
  await page.click("#reader-presentar");
  await page.waitForSelector("#pc-ya");
  const antes = await page.textContent(".sheet");
  ok(`${nombre}: la comprobación previa recuerda ${clave} y cómo salir`, antes.includes(clave) && antes.includes("toca el centro"));
  await page.click(".sheet >> text=¿Cómo se activa?");
  await page.waitForSelector(".sheet >> text=Para no salirte del discurso", { timeout: 3000 }).catch(() => {});
  const txt = await page.textContent(".sheet").catch(() => "");
  ok(`${nombre}: «¿Cómo se activa?» explica ${clave} paso a paso`, txt.includes(clave));
  ok(`${nombre}: y cómo salir (tocar el centro y mantener pulsado)`, txt.includes("toca el centro de la pantalla"));
  if (nombre === "Android") await page.screenshot({ path: `${OUTDIR}/124-consejo-android.png` });
  await ctx.close();
}

// =================== Guía ===================
{
  const { ctx, page } = await nuevo({ limpio: true });
  // Sin discursos: la bienvenida enlaza la guía
  await ir(page, "#/", "home");
  ok("La bienvenida tiene «Ver la guía»", await page.isVisible("#bv-guia"));
  ok("Sin discursos no sale el aviso de la guía (ya está la bienvenida)", await page.isHidden("#guia-hint"));
  ok("Botón «Guía» en el inicio, al lado de Ajustes", await page.isVisible("#btn-guia"));
  await page.click("#btn-guia");
  await page.waitForSelector("#guia");
  const chips = await page.$$eval(".guia-chips button", (bs) => bs.map((b) => b.textContent));
  ok("La guía tiene sus apartados", chips.join(",") === "Empezar,Leer,Presentar,Ensayar,Editar,Lápiz y voz,Notas,Compartir y guardar", chips.join(","));
  const n = await page.$$eval(".guia-items li", (xs) => xs.length);
  ok("Explica cada función (con «Dónde» está)", n >= 35 && (await page.$$eval(".guia-donde", (xs) => xs.length)) >= 25, `${n} funciones`);
  ok("La guía no se queda fuera de la pantalla", await page.evaluate(() => { const g = document.querySelector("#guia"); return g.scrollWidth <= innerWidth && document.querySelector(".guia-body").scrollHeight > document.querySelector(".guia-body").clientHeight; }));
  await page.screenshot({ path: `${OUTDIR}/125-guia.png` });
  await page.click(".guia-chips button:has-text('Presentar')");
  await page.waitForTimeout(800);
  const sec = await page.evaluate(() => { const b = document.querySelector(".guia-body"), s = document.querySelector("#guia-presentar"); return Math.abs(s.getBoundingClientRect().top - b.getBoundingClientRect().top); });
  ok("Tocar un apartado lleva a él", sec < 30 && (await page.getAttribute(".guia-chips button:has-text('Presentar')", "aria-pressed")) === "true", `${sec}px`);
  ok("La guía explica cómo salir de Presentar", (await page.textContent("#guia-presentar")).includes("Mantén pulsado para salir"));
  await page.screenshot({ path: `${OUTDIR}/126-guia-presentar.png` });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  ok("Escape cierra la guía", !(await page.$("#guia")));
  // «Atrás» la cierra sin cambiar de pantalla
  await page.click("#btn-guia");
  await page.waitForSelector("#guia");
  await page.goBack();
  await page.waitForTimeout(400);
  ok("«Atrás» cierra la guía y te deja en el inicio", !(await page.$("#guia")) && (await page.isVisible("#view-home")) && (await page.evaluate(() => location.hash)) === "#/");
  // Probar con un ejemplo desde la guía
  await page.click("#btn-guia");
  await page.click("#guia-probar");
  await page.waitForSelector("#view-reader:not([hidden])");
  await page.waitForTimeout(300);
  ok("«Probar con un ejemplo» cierra la guía y abre el ejemplo", !(await page.$("#guia")) && (await page.evaluate(() => window.__atril.reader.item.title)) === "Ejemplo: la paciencia");
  // Más → Guía de Atril
  await page.click("#reader-more");
  await page.click(".sheet >> text=Guía de Atril");
  await page.waitForSelector("#guia");
  await page.waitForTimeout(300);
  ok("Desde el lector, la guía se abre en «Leer»", (await page.getAttribute(".guia-chips button:has-text('Leer')", "aria-pressed")) === "true");
  await page.click("#guia-cerrar");
  await page.waitForTimeout(400);
  ok("«Cerrar» la cierra y sigues en el lector", !(await page.$("#guia")) && (await page.isVisible("#view-reader")));
  // El ejemplo no se duplica
  await page.evaluate(() => window.__atril.abrirGuia());
  await page.waitForSelector("#guia");
  await page.click("#guia-probar");
  await page.waitForSelector("#view-reader:not([hidden])");
  await page.waitForTimeout(300);
  const ejemplos = await page.evaluate(async () => (await window.__atril.store.all("docs")).filter((d) => d.title === "Ejemplo: la paciencia").length);
  ok("Probar el ejemplo otra vez no lo duplica", ejemplos === 1, `${ejemplos}`);
  // Aviso de la primera vez: con discursos y sin haber visto la guía
  await page.evaluate(() => localStorage.removeItem("atril.guiaVista"));
  await ir(page, "#/", "home");
  ok("Con discursos, sale «¿Es la primera vez?» con «Ver la guía»", await page.isVisible("#guia-hint"));
  await page.screenshot({ path: `${OUTDIR}/127-aviso-guia.png` });
  await page.click("#guia-hint-no");
  await page.reload();
  await page.waitForSelector("#view-home:not([hidden])");
  ok("«Ahora no» lo quita para siempre", await page.isHidden("#guia-hint"));
  // Ajustes → Guía
  await page.click("#btn-settings");
  await page.click("#ajustes-guia");
  await page.waitForSelector("#guia");
  ok("Ajustes tiene la guía", await page.isVisible("#guia"));
  await page.click("#guia-cerrar");
  await page.waitForTimeout(300);
  // Móvil
  await page.setViewportSize({ width: 390, height: 844 });
  await page.click("#btn-guia");
  await page.waitForSelector("#guia");
  const movil = await page.evaluate(() => ({ ancho: document.querySelector("#guia").scrollWidth <= innerWidth, chip: Math.min(...[...document.querySelectorAll(".guia-chips button")].map((b) => b.getBoundingClientRect().height)), cerrar: document.querySelector("#guia-cerrar").getBoundingClientRect().height }));
  ok("Móvil: la guía cabe y los botones miden ≥ 44 px", movil.ancho && movil.chip >= 44 && movil.cerrar >= 44, JSON.stringify(movil));
  await page.screenshot({ path: `${OUTDIR}/128-guia-movil.png` });
  ok("Móvil: el inicio con «Guía» y «Ajustes» cabe", await page.evaluate(() => { document.querySelector("#guia-cerrar").click(); const r = document.querySelector(".tabs-row"); return r.scrollWidth <= r.clientWidth + 1; }));
  await ctx.close();
}

ok("Sin errores en la consola", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const fallos = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - fallos}/${results.length} pruebas superadas`);
process.exit(fallos ? 1 : 0);
