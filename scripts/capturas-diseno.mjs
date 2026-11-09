// Capturas de todas las pantallas de Atril con un discurso de ejemplo realista,
// para enseñárselas a otra IA (rediseño) o comparar antes y después de un cambio.
// Uso: con dist/ servido en el puerto 8080 →  node scripts/capturas-diseno.mjs  (salen en capturas/)
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { pw = require("/opt/npm-tools/node_modules/playwright"); }
const URL = process.env.ATRIL_URL || "http://localhost:8080/";
const OUT = fileURLToPath(new globalThis.URL("../capturas", import.meta.url));
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- Datos de ejemplo ---------- */
const P = (t) => `<p>${t}</p>`;
const DISCURSO = [
  "<h1>La alegría que no depende de las circunstancias</h1>",
  "<h2>Introducción (2 min)</h2>",
  P("¿Ha conocido a alguien que sonríe aunque todo le vaya mal? A todos nos llama la atención. No es que no tenga problemas: es que su alegría no depende de ellos. Hoy vamos a ver de dónde sale esa alegría, cómo protegerla en los días malos y cómo contagiarla a los demás."),
  P("Filipenses 4:4 nos anima a estar <mark>siempre alegres</mark>. ‖ Fíjense en la palabra «siempre». No dice «cuando todo vaya bien»."),
  "<h2>1. De dónde viene la alegría verdadera (4 min)</h2>",
  P("La alegría que da la Biblia no es lo mismo que pasarlo bien. Pasarlo bien depende de lo que ocurre fuera; la alegría verdadera nace dentro, de lo que sabemos y de lo que esperamos. Por eso Nehemías 8:10 dice que <mark>la alegría puede ser nuestra fortaleza</mark>: nos sostiene cuando las fuerzas fallan."),
  P("Pensemos en tres fuentes de esa alegría:"),
  "<ul><li>Saber que Dios nos conoce y se interesa por nosotros.</li><li>Tener una esperanza segura para el futuro.</li><li>Formar parte de una familia de hermanos que nos quiere.</li></ul>",
  P("<span class=\"t-rojo\">No saltar:</span> pregunta al público cuál de las tres le ha ayudado más este año. ‖ Deja unos segundos de silencio antes de seguir."),
  "<h2>2. Cómo la protegemos en los días malos (4 min)</h2>",
  P("Santiago 1:2, 3 dice algo sorprendente: que veamos las pruebas como motivo de alegría. No porque el sufrimiento sea bueno, sino porque <mark class=\"c-verde\">las pruebas sacan lo mejor de nuestra fe</mark>, igual que el fuego limpia el oro."),
  P("Hay tres cosas que nos ayudan a no perder la alegría cuando llegan los problemas. La primera, hablarlo con Dios en oración, con detalles. La segunda, no aislarnos: buscar a un amigo maduro. La tercera, recordar lo que ya hemos superado antes."),
  P("Una hermana mayor me contó que, tras perder el trabajo de toda una vida, cada noche apuntaba en una libreta una cosa buena del día. «Al principio me costaba encontrar una», decía. «Al mes, me faltaba espacio en la página»."),
  "<h2>3. Cómo la contagiamos a otros (3 min)</h2>",
  P("Hechos 20:35 recuerda que <mark>hay más felicidad en dar que en recibir</mark>. La alegría crece cuando se comparte: una visita, una llamada, una nota escrita a mano. Proverbios 17:22 compara el corazón alegre con una buena medicina."),
  P("<span class=\"t-azul\">Ilustración:</span> una vela no pierde nada por encender otra. Al contrario: la habitación se ilumina más."),
  "<h2>Conclusión (2 min)</h2>",
  P("La alegría verdadera no depende de las circunstancias porque nace de lo que sabemos, se protege en la oración y crece al darla. <mark class=\"c-rosa\">Esta semana, elijamos a una persona a la que alegrarle el día.</mark>"),
  P("Volvamos a la pregunta del principio: ¿ha conocido a alguien que sonríe aunque todo le vaya mal? Con la ayuda de Dios, esa persona puede ser usted."),
].join("");

// Un dibujo hecho a mano: una flecha y un círculo con algo de temblor, como con el lápiz
const temblor = (i) => Math.round(Math.sin(i * 1.7) * 3);
const circulo = [];
for (let i = 0; i <= 40; i++) { const a = (i / 40) * Math.PI * 2.1; circulo.push(Math.round(760 + Math.cos(a) * 110 + temblor(i)), Math.round(150 + Math.sin(a) * 85 + temblor(i + 3)), 0.4 + 0.3 * Math.sin(i / 6)); }
const flecha = [];
for (let i = 0; i <= 30; i++) flecha.push(Math.round(120 + i * 16), Math.round(190 - i * 1.2 + temblor(i)), 0.35 + i / 80);
const punta = [560, 140, 0.6, 610, 155, 0.7, 565, 190, 0.6];
const subrayado = [];
for (let i = 0; i <= 25; i++) subrayado.push(Math.round(80 + i * 16), Math.round(250 + temblor(i)), 0.5);
const DIBUJO = { w: 1000, h: 300, t: [
  { c: "amarillo", h: "r", s: 22, q: 0, p: subrayado },
  { c: "azul", h: "b", s: 6, q: 1, p: flecha },
  { c: "azul", h: "b", s: 6, q: 1, p: punta },
  { c: "rojo", h: "b", s: 5, q: 1, p: circulo },
] };
const figura = `<figure class="dibujo" data-dibujo='${JSON.stringify(DIBUJO)}'></figure>`;

const dia = 86400000;
const ahora = Date.now();
const DOCS = [
  { id: "alegria", title: "La alegría que no depende de las circunstancias", html: DISCURSO.replace("<h2>3.", figura + "<h2>3."), target: 15, created: ahora - 9 * dia, updated: ahora - 2 * 3600000, fijado: true,
    dado: [{ id: "d1", fecha: "2026-10-12", lugar: "Congregación Norte", notas: "Bien de tiempo" }],
    ensayos: [[905, 160, 245, 235, 150, 115], [930, 170, 250, 240, 155, 115], [890, 155, 240, 230, 150, 115]].map(([seg, ...p], k) => ({
      id: "e" + k, fecha: ahora - (k + 1) * dia, seg, objetivoSeg: 900, audio: false,
      partes: ["Introducción", "1. De dónde viene la alegría verdadera", "2. Cómo la protegemos en los días malos", "3. Cómo la contagiamos a otros", "Conclusión"]
        .map((t, i) => ({ t, s: p[i], o: [120, 240, 240, 180, 120][i] })) })) },
  { id: "paciencia", title: "La paciencia", html: "<h1>La paciencia</h1><h2>Introducción (1 min)</h2><p>¿Le ha tocado alguna vez esperar en una cola que no avanza? A todos nos cuesta esperar.</p><h2>Por qué vale la pena (2 min)</h2><p><mark>La paciencia nos ayuda a mantener la calma</mark> cuando las cosas no salen como queremos.</p>", target: 5, created: ahora - 20 * dia, updated: ahora - 6 * dia },
  { id: "boda", title: "Boda de Ana y Pablo", source: "Boda de Ana y Pablo.docx", alPC: ahora - 4 * dia, html: "<h1>Boda de Ana y Pablo</h1><h2>El matrimonio, un regalo (5 min)</h2><p>Queridos Ana y Pablo, hoy empezáis una etapa preciosa.</p><h2>El cordón triple (5 min)</h2><p>Eclesiastés 4:12 habla de un cordón de tres hilos que no se rompe fácilmente.</p>", target: 20, created: ahora - 15 * dia, updated: ahora - 1 * dia },
  { id: "vecinos", title: "Cómo ser buenos vecinos", html: "<h1>Cómo ser buenos vecinos</h1><h2>Introducción (2 min)</h2><p>El vecino de al lado es la persona a la que más fácil nos resulta ayudar… o ignorar.</p>", target: 10, created: ahora - 30 * dia, updated: ahora - 12 * dia },
  { id: "pajaros", title: "Lo que aprendemos de los pájaros", html: "<h1>Lo que aprendemos de los pájaros</h1><p>Mateo 6:26 nos invita a observar las aves del cielo.</p>", created: ahora - 40 * dia, updated: ahora - 25 * dia },
];
const NOTAS = [
  { id: "n1", title: "Ideas para el discurso del domingo", html: "<p>Empezar con una pregunta al público.</p><ul><li>Contar la experiencia del viaje.</li><li>Buscar un texto sobre la gratitud.</li></ul>", created: ahora - 2 * dia, updated: ahora - 3 * 3600000 },
  { id: "n2", title: "Ilustraciones: el agricultor", html: "<p>El agricultor no tira de la planta para que crezca más deprisa: la riega y espera. <strong>Paciencia activa.</strong></p>", created: ahora - 5 * dia, updated: ahora - 5 * dia },
  { id: "n3", title: "Nota a mano · 3 nov", html: figura + "<p><br></p>", created: ahora - 6 * dia, updated: ahora - 6 * dia },
];

/* ---------- Navegador ---------- */
const browser = await pw.chromium.launch();
const lista = [];
async function contexto(width, height, { datos = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, locale: "es-ES" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.error("Error en la página:", String(e)));
  await page.goto(URL);
  await page.waitForSelector("#view-home:not([hidden])");
  await page.evaluate(([docs, notas, datos]) => {
    for (const [k, v] of Object.entries({ "atril.hideInstall": "1", "atril.copia": String(Date.now()), "atril.consejoAcceso": "1", "atril.consejoToque": "1", "atril.guiaVista": "1" })) localStorage.setItem(k, v);
    if (!datos) return;
    localStorage.setItem("atril.ultimo", JSON.stringify({ kind: "docs", id: "alegria", t: Date.now() - 40 * 60000 }));
    localStorage.setItem("atril.prog.docs.alegria", "35");
    localStorage.setItem("atril.prog.docs.paciencia", "100");
    localStorage.setItem("atril.pos.docs.alegria", "0.22");
    localStorage.setItem("atril.copia", String(Date.now() - 3 * 86400000));
    return Promise.all([...docs.map((d) => window.__atril.store.put("docs", { ...d, html: window.__atril.sanitize(d.html) })), ...notas.map((n) => window.__atril.store.put("notes", { ...n, html: window.__atril.sanitize(n.html) }))]);
  }, [DOCS, NOTAS, datos]);
  return { ctx, page };
}
let n = 0;
async function captura(page, nombre, titulo) {
  n++;
  const archivo = `${String(n).padStart(2, "0")}-${nombre}.png`;
  await espera(450);
  await page.evaluate(() => { const t = document.querySelector("#toast"); if (t) t.hidden = true; }); // los avisos sueltos no son parte del diseño
  await page.screenshot({ path: `${OUT}/${archivo}` });
  lista.push({ n, archivo, titulo });
  console.log("✔", archivo);
}
const ir = async (page, hash, vista) => {
  await page.goto(URL + hash);
  await page.waitForSelector(`#view-${vista}:not([hidden])`);
  await espera(500);
};
const cerrarHoja = (page) => page.evaluate(() => { const b = [...document.querySelectorAll(".sheet .action.plain")].pop(); if (b) b.click(); });
const tema = (page, t) => page.evaluate((t) => { const s = JSON.parse(localStorage.getItem("atril.settings") || "{}"); s.theme = t; localStorage.setItem("atril.settings", JSON.stringify(s)); }, t);

/* ---------- iPad en horizontal ---------- */
{
  const { ctx, page } = await contexto(1080, 810);
  await ir(page, "#/", "home");
  await page.reload(); await page.waitForSelector("#view-home:not([hidden])");
  await captura(page, "inicio", "Inicio: «Seguir donde lo dejaste», lista y protección (copia) al final");
  await page.click(".segmented button[data-tab='notes']");
  await captura(page, "notas", "Inicio, pestaña Notas (nueva, a mano, dictar)");
  await page.click(".segmented button[data-tab='docs']");

  await ir(page, "#/leer/docs/alegria", "reader");
  await page.evaluate(() => { const s = document.querySelector("#reader-scroll"); s.scrollTop = s.scrollHeight * 0.18; });
  await captura(page, "lector", "Lector con el esquema al lado y la barra de estado");
  await page.click("#reader-aa");
  await captura(page, "lector-letra", "Lector → Letra: tamaño, tema, tipo de letra, interlineado y duración");
  await cerrarHoja(page);
  await page.click("#reader-more");
  await captura(page, "lector-mas", "Lector → Más, por grupos: Practicar, Documento, Compartir y guardar, Ayuda");
  await cerrarHoja(page);

  // Presentar: primero la comprobación
  await page.click("#reader-presentar");
  await page.waitForSelector("#pc-ya");
  await captura(page, "antes-de-presentar", "Antes de presentar: tiempo, letra, desde dónde y pantalla");
  await page.click("#pc-ya");
  await page.waitForSelector("#pres-bar:not([hidden])");
  await page.click("#pres-timer");
  await page.evaluate(() => { const t = window.__atril.timer; t.startedAt -= 6 * 60000 + 20000; t.paint(); window.__atril.reader.paintPace(); });
  await espera(1200);
  await captura(page, "presentar", "Presentar: cronómetro en marcha (verde), cuánto queda, la hora y la parte");
  await page.evaluate(() => { const t = window.__atril.timer; t.startedAt -= 9 * 60000 + 30000; t.paint(); window.__atril.reader.paintPace(); window.__atril.presentar.mostrarSalir(); });
  await espera(1500);
  await captura(page, "presentar-pasado", "Presentar: pasado de tiempo (rojo) y la burbuja para salir");
  // A cero sin guardar este «ensayo» de mentira
  await page.evaluate(() => { window.__atril.presentar.salir({ quitarPaso: true }); window.__atril.ensayo.activo = false; window.__atril.timer.reset(); });
  await espera(400);

  await page.click("#reader-more");
  await page.click(".sheet >> text=Ensayos (3)");
  await page.waitForSelector(".ens-analisis");
  await captura(page, "ensayos", "Ensayos → Cómo vas: mediana, qué parte se pasa y practicar una parte");
  await cerrarHoja(page);
  await page.evaluate(() => window.__atril.tarjetas.abrir());
  await captura(page, "tarjetas", "Tarjetas: una parte del discurso por pantalla");
  await page.evaluate(() => window.__atril.tarjetas.cerrar());
  await page.evaluate(() => window.__atril.prompter.abrir());
  await espera(1500);
  await captura(page, "desplazamiento", "Desplazamiento automático (teleprompter)");
  await page.evaluate(() => window.__atril.prompter.cerrar());

  // Editor
  await ir(page, "#/editar/docs/alegria", "editor");
  await page.evaluate(() => {
    document.querySelector("#editor").focus();
    const p = [...document.querySelectorAll("#editor p")][0];
    const r = document.createRange(); r.selectNodeContents(p);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    document.dispatchEvent(new Event("selectionchange"));
  });
  await captura(page, "editor", "Editor: cinta Inicio, panel de navegación con tiempos y texto seleccionado");
  await page.click(".ribbon-tabs button[data-rtab='insertar']");
  await captura(page, "editor-insertar", "Editor → Insertar: parte, minutos, pausa, dibujo, dictar");
  await page.click(".ribbon-tabs button[data-rtab='inicio']");
  await page.evaluate(() => window.__atril.editor.nuevoDibujo());
  await page.waitForSelector(".lienzo .lz-svg");
  await espera(400);
  await page.evaluate((trazos) => {
    const svg = document.querySelector(".lz-svg");
    const r = svg.getBoundingClientRect();
    for (const pts of trazos) {
      const ev = (nombre, [fx, fy], i) => svg.dispatchEvent(new PointerEvent(nombre, { bubbles: true, cancelable: true, pointerId: 7, pointerType: "pen", isPrimary: true, clientX: r.left + fx * r.width, clientY: r.top + fy * r.height, pressure: 0.3 + 0.4 * Math.abs(Math.sin(i / 4)), button: 0, buttons: 1 }));
      ev("pointerdown", pts[0], 0);
      pts.slice(1).forEach((p, i) => ev("pointermove", p, i + 1));
      ev("pointerup", pts[pts.length - 1], pts.length);
    }
  }, [
    Array.from({ length: 50 }, (_, i) => [0.12 + i * 0.006, 0.12 + Math.sin(i / 3) * 0.03]),
    Array.from({ length: 50 }, (_, i) => [0.5 + Math.cos((i / 49) * 6.6) * 0.12, 0.2 + Math.sin((i / 49) * 6.6) * 0.1]),
    Array.from({ length: 30 }, (_, i) => [0.12 + i * 0.02, 0.32 + Math.sin(i) * 0.004]),
  ]);
  await captura(page, "dibujo", "Dibujar o escribir a mano con el Apple Pencil");
  await page.evaluate(() => { const b = document.querySelector(".lz-barra .lz-txt"); b.click(); });
  await espera(300);
  await page.evaluate(() => { const b = document.querySelector(".sheet .action.danger, .sheet .action.primary"); if (b) b.click(); });
  await espera(300);

  await page.evaluate(async () => window.__atril.abrirCompartir("docs", await window.__atril.store.get("docs", "alegria")));
  await captura(page, "compartir", "Compartir: WhatsApp, otra app, copiar, Word o PDF");
  await cerrarHoja(page);

  await ir(page, "#/", "home");
  await page.click("#btn-settings");
  await captura(page, "ajustes", "Ajustes");
  await cerrarHoja(page);
  await page.evaluate(() => window.__atril.abrirGuia());
  await page.waitForSelector("#guia");
  await captura(page, "guia", "Guía de Atril");
  await page.click("#guia-cerrar");

  await tema(page, "sepia");
  await ir(page, "#/leer/docs/alegria", "reader");
  await page.reload(); await page.waitForSelector("#view-reader:not([hidden])"); await espera(500);
  await captura(page, "lector-sepia", "Lector, tema sepia");
  await tema(page, "oscuro");
  await page.reload(); await page.waitForSelector("#view-reader:not([hidden])"); await espera(500);
  await captura(page, "lector-oscuro", "Lector, tema oscuro");
  await tema(page, "claro");
  await ctx.close();
}
{
  const { ctx, page } = await contexto(1080, 810, { datos: false });
  await ir(page, "#/", "home");
  await captura(page, "bienvenida", "Bienvenida (sin discursos todavía)");
  await ctx.close();
}

/* ---------- iPad en vertical ---------- */
{
  const { ctx, page } = await contexto(810, 1080);
  await ir(page, "#/", "home");
  await page.reload(); await page.waitForSelector("#view-home:not([hidden])");
  await captura(page, "vertical-inicio", "iPad en vertical: inicio");
  await ir(page, "#/leer/docs/alegria", "reader");
  await captura(page, "vertical-lector", "iPad en vertical: lector");
  await ir(page, "#/editar/docs/alegria", "editor");
  await captura(page, "vertical-editor", "iPad en vertical: editor");
  await ctx.close();
}

/* ---------- Móvil ---------- */
{
  const { ctx, page } = await contexto(390, 844);
  await ir(page, "#/", "home");
  await page.reload(); await page.waitForSelector("#view-home:not([hidden])");
  await captura(page, "movil-inicio", "Móvil: inicio");
  await ir(page, "#/leer/docs/alegria", "reader");
  await captura(page, "movil-lector", "Móvil: lector con los botones abajo");
  await page.click("#reader-presentar");
  await page.click("#pc-ya");
  await page.waitForSelector("#pres-bar:not([hidden])");
  await page.click("#pres-timer");
  await espera(1200);
  await captura(page, "movil-presentar", "Móvil: presentar");
  await ctx.close();
}

await browser.close();
fs.writeFileSync(`${OUT}/lista.json`, JSON.stringify(lista, null, 2));
console.log(`\n${lista.length} capturas en capturas/`);
