// «‹» dentro de un documento (a petición de Ezequiel: «cuando quiero salir del modo lectura me saca del documento»).
// Del editor al modo lectura y «‹» vuelve al editor; si se empezó leyendo, «‹» va a la lista.
// Uso: igual que e2e.mjs (con dist/ servido en el puerto 8080).
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { pw = require("/opt/npm-tools/node_modules/playwright"); }
const URL = process.env.ATRIL_URL || "http://localhost:8080/";
const results = [];
const ok = (name, cond, extra = "") => { results.push({ name, pass: !!cond }); console.log(`${cond ? "✔" : "✘"} ${name}${extra ? " — " + extra : ""}`); };

const browser = await pw.chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true, locale: "es-ES" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await page.goto(URL);
await page.waitForSelector("#view-home:not([hidden])");
const hash = () => page.evaluate(() => location.hash);
const vista = (v) => page.waitForSelector(`#view-${v}:not([hidden])`);
const lbl = () => page.textContent("#reader-back .lbl");

// 1. Discurso nuevo: editor → modo lectura → «‹» vuelve al editor
await page.click("text=Escribir uno nuevo");
await page.click(".sheet >> text=En blanco");
await vista("editor");
const id = (await hash()).split("/").pop();
await page.fill("#editor-title", "Mi discurso");
await page.click("#editor");
await page.keyboard.type("Primer párrafo del discurso.");
await page.click("#editor-read");
await vista("reader");
ok("Desde el editor, el modo lectura dice «‹ Editar»", (await lbl()) === "Editar" && (await page.getAttribute("#reader-back", "aria-label")).includes("volver a editar"), await lbl());
await page.click("#reader-back");
await vista("editor");
ok("«‹» en el modo lectura vuelve al editor del mismo documento", (await hash()) === `#/editar/docs/${id}` && (await page.textContent("#editor")).includes("Primer párrafo"), await hash());
// Otra vez, para ver que no se queda dando vueltas
await page.click("#editor-read");
await vista("reader");
await page.click("#reader-back");
await vista("editor");
ok("…también la segunda vez", (await hash()) === `#/editar/docs/${id}`);
await page.click("#editor-back");
await vista("reader");
ok("«‹» del editor lleva al lector (como antes)…", (await hash()) === `#/leer/docs/${id}` && (await lbl()) === "Discursos", await lbl());
await page.click("#reader-back");
await vista("home");
ok("…y desde ahí «‹ Discursos» va a la lista", (await hash()) === "#/" || (await hash()) === "");

// 2. Empezando a leer: lector → Editar → modo lectura → «‹» va a la lista (no al editor)
await page.evaluate((x) => { location.hash = `#/leer/docs/${x}`; }, id);
await vista("reader");
ok("Al abrir un discurso para leer, «‹ Discursos»", (await lbl()) === "Discursos");
await page.click("#reader-edit");
await vista("editor");
await page.click("#editor-read");
await vista("reader");
ok("Lector → Editar → modo lectura: «‹ Discursos» (se empezó leyendo)", (await lbl()) === "Discursos", await lbl());
await page.click("#reader-edit");
await vista("editor");
await page.click("#editor-back");
await vista("reader");
await page.click("#reader-back");
await vista("home");
ok("Lector → Editar → «‹» → lector → «‹» → lista", true);

// 3. «Atrás» del sistema (Android o deslizar) también vuelve al editor
await page.evaluate((x) => { location.hash = `#/editar/docs/${x}`; }, id);
await vista("editor");
await page.click("#editor-read");
await vista("reader");
await page.goBack();
await vista("editor");
ok("«Atrás» del sistema desde el modo lectura vuelve al editor", (await hash()) === `#/editar/docs/${id}`);
await page.click("#editor-back");
await vista("reader");
await page.click("#reader-back");
await vista("home");
ok("…y luego se llega a la lista sin dar vueltas", true);

// 4. Otro documento: el recorrido empieza de nuevo
await page.evaluate((x) => { location.hash = `#/leer/docs/${x}`; }, id);
await vista("reader");
await page.click("#reader-nuevo");
await page.click('.sheet button:has-text("Nota")');
await page.waitForFunction(() => location.hash.startsWith("#/editar/notes/"));
await vista("editor");
await page.click("#editor-back");
await vista("home");
ok("Una nota nueva abierta desde otro discurso: «‹» va a la lista", true);

// Ajustes: junto a la versión, quién la ha hecho (a petición de Ezequiel)
await page.click('button:has-text("Ajustes")');
await page.waitForSelector("#autor-txt");
ok("Ajustes dice «Creado por Ezequiel» junto a la versión", (await page.textContent("#autor-txt")) === "Creado por Ezequiel" && await page.evaluate(() => document.querySelector("#version-txt").nextElementSibling.id === "autor-txt"));

await browser.close();
ok("Sin errores en la consola", errors.length === 0, errors.slice(0, 3).join(" | "));
const fallos = results.filter((r) => !r.pass);
console.log(`\n${results.length - fallos.length}/${results.length} pruebas superadas`);
process.exit(fallos.length ? 1 : 0);
