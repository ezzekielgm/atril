// Lienzo para dibujar o escribir a mano con el Apple Pencil (o con el dedo). Se carga solo al abrirlo.
// Con el lápiz: el bolígrafo engorda al apretar y el dedo sirve para mover la hoja (la mano puede apoyarse).
// Sin lápiz: se dibuja con el dedo.
import { ANCHO, TINTAS, limpiarDibujo, pathDe, claseDe } from "./dibujo-svg.js";

const NOMBRES = { negro: "Negro", azul: "Azul", rojo: "Rojo", verde: "Verde", amarillo: "Amarillo", rosa: "Rosa" };
const GROSORES = { b: [2.5, 4, 7], r: [16, 24, 36] };
const RADIO_GOMA = 14;
const PAUTA = 64; // separación de las líneas de la hoja

function h(tag, attrs = {}, ...hijos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "text") e.textContent = v;
    else if (k === "html") e.innerHTML = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const x of hijos.flat()) if (x != null) e.append(x);
  return e;
}

/**
 * Abre el lienzo a pantalla completa.
 * @param {object} o
 * @param {object} [o.datos] dibujo que se edita (limpio)
 * @param {(d: object) => void} o.alGuardar se llama con el dibujo limpio y recortado
 * @param {() => void} [o.alQuitar] si se edita uno que ya existe: quitarlo del documento
 * @param {(o: object) => Promise<boolean>} o.confirmar diálogo de confirmación de la app
 * @param {(n: string) => string} o.icono iconos de la app
 */
export function abrirLienzo({ datos = null, alGuardar, alQuitar = null, confirmar, icono, titulo = "Dibujo" }) {
  let trazos = datos ? datos.t.map((t) => ({ ...t, p: t.p.slice() })) : [];
  let H = datos ? datos.h : 0;
  const hechos = [], deshechos = [];
  let herramienta = "b";
  const color = { b: "negro", r: "amarillo" };
  const grosor = { b: GROSORES.b[1], r: GROSORES.r[1] };
  let lapizVisto = false;
  let cambios = false;

  // ---------- Interfaz ----------
  const btn = (attrs, contenido) => h("button", { type: "button", ...attrs, html: contenido });
  const raiz = h("div", { class: "lienzo", role: "dialog", "aria-modal": "true", "aria-label": titulo });
  const bDeshacer = btn({ "aria-label": "Deshacer", class: "lz-ico" }, icono("undo"));
  const bRehacer = btn({ "aria-label": "Rehacer", class: "lz-ico" }, icono("redo"));
  const barra = h("header", { class: "lz-barra" },
    btn({ class: "lz-txt", onclick: () => cancelar() }, "Cancelar"),
    h("span", { class: "lz-titulo", text: titulo }),
    h("span", { class: "lz-hueco" }),
    bDeshacer, bRehacer,
    btn({ class: "lz-hecho", onclick: () => terminar() }, "Hecho"));
  bDeshacer.addEventListener("click", () => deshacer());
  bRehacer.addEventListener("click", () => rehacer());

  const herramientas = h("div", { class: "lz-grupo", role: "group", "aria-label": "Herramienta" },
    btn({ "data-h": "b", title: "Bolígrafo" }, icono("pluma") + "<span>Bolígrafo</span>"),
    btn({ "data-h": "r", title: "Rotulador" }, icono("rotulador") + "<span>Rotulador</span>"),
    btn({ "data-h": "g", title: "Goma" }, icono("goma") + "<span>Goma</span>"));
  const colores = h("div", { class: "lz-grupo lz-colores", role: "group", "aria-label": "Color" });
  const grosores = h("div", { class: "lz-grupo lz-grosores", role: "group", "aria-label": "Grosor" });
  const acciones = h("div", { class: "lz-grupo" },
    btn({ class: "lz-txt", onclick: () => masEspacio() }, "Más espacio"),
    btn({ class: "lz-txt", onclick: () => limpiar() }, "Borrar todo"),
    alQuitar ? btn({ class: "lz-txt lz-peligro", onclick: () => quitar() }, "Quitar dibujo") : null);
  const caja = h("div", { class: "lz-herramientas", role: "toolbar" }, herramientas, colores, grosores, acciones);

  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "lz-svg");
  const gPauta = document.createElementNS(NS, "g");
  gPauta.setAttribute("class", "lz-pauta");
  const gTrazos = document.createElementNS(NS, "g");
  const vivo = document.createElementNS(NS, "path");
  svg.append(gPauta, gTrazos, vivo);
  const hoja = h("div", { class: "lz-hoja" }, h("div", { class: "lz-papel" }, svg));
  const ayuda = h("p", { class: "lz-ayuda", text: "Escribe o dibuja con el Apple Pencil o con el dedo. Con el lápiz, el dedo mueve la hoja y puedes apoyar la mano." });
  raiz.append(barra, caja, hoja, ayuda);

  // ---------- Pintar ----------
  const orden = (lista) => [...lista.filter((t) => t.h === "r"), ...lista.filter((t) => t.h !== "r")];
  function pintarTrazos() {
    gTrazos.innerHTML = orden(trazos).map((t) => `<path class="${claseDe(t)}" d="${pathDe(t)}"/>`).join("");
    bDeshacer.disabled = !hechos.length;
    bRehacer.disabled = !deshechos.length;
  }
  function pintarPauta() {
    let lineas = "";
    for (let y = PAUTA; y < H; y += PAUTA) lineas += `<line x1="0" x2="${ANCHO}" y1="${y}" y2="${y}"/>`;
    gPauta.innerHTML = lineas;
  }
  function ajustarAlto() {
    svg.setAttribute("viewBox", `0 0 ${ANCHO} ${H}`);
    const w = svg.clientWidth || svg.getBoundingClientRect().width;
    if (w) svg.style.height = `${(w * H) / ANCHO}px`;
    pintarPauta();
  }
  function pintarHerramientas() {
    herramientas.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.h === herramienta)));
    const tipo = herramienta === "g" ? null : herramienta;
    colores.replaceChildren(...(tipo ? TINTAS[tipo].map((c) => btn({
      class: `lz-color k-${c}${tipo === "r" ? " rotu" : ""}`, "aria-label": NOMBRES[c], "aria-pressed": String(color[tipo] === c),
      onclick: () => { color[tipo] = c; pintarHerramientas(); },
    }, "<i></i>")) : []));
    grosores.replaceChildren(...(tipo ? GROSORES[tipo].map((g, k) => btn({
      class: "lz-grosor", "aria-label": ["Fino", "Medio", "Grueso"][k], "aria-pressed": String(grosor[tipo] === g),
      onclick: () => { grosor[tipo] = g; pintarHerramientas(); },
    }, `<i style="width:${6 + k * 6}px;height:${6 + k * 6}px"></i>`)) : []));
    hoja.classList.toggle("con-goma", herramienta === "g");
  }
  herramientas.addEventListener("click", (e) => { const b = e.target.closest("[data-h]"); if (b) { herramienta = b.dataset.h; pintarHerramientas(); } });

  // ---------- Dibujar ----------
  let activo = null, actual = null, borrados = null, raf = 0;
  const punto = (e) => {
    const r = svg.getBoundingClientRect();
    return [((e.clientX - r.left) * ANCHO) / r.width, ((e.clientY - r.top) * H) / r.height];
  };
  function anadir(e) {
    const [x, y] = punto(e);
    const p = actual.p, n = p.length;
    if (n >= 3 && Math.hypot(p[n - 3] - x, p[n - 2] - y) < 0.8) return;
    const pr = actual.q ? Math.round((e.pressure || 0.5) * 100) : 50;
    p.push(Math.round(Math.min(ANCHO, Math.max(0, x)) * 10) / 10, Math.round(Math.min(H, Math.max(0, y)) * 10) / 10, pr);
  }
  function pintarVivo() {
    raf = 0;
    if (!actual) { vivo.setAttribute("d", ""); return; }
    vivo.setAttribute("class", claseDe(actual));
    vivo.setAttribute("d", pathDe(actual, { ultimo: false }));
  }
  function borrarEn(e) {
    const [x, y] = punto(e);
    for (let i = trazos.length - 1; i >= 0; i--) {
      const t = trazos[i], r = RADIO_GOMA + t.s / 2;
      for (let k = 0; k + 2 < t.p.length; k += 3) {
        if (Math.hypot(t.p[k] - x, t.p[k + 1] - y) <= r) { borrados.push({ i, t }); trazos.splice(i, 1); break; }
      }
    }
    pintarTrazos();
  }
  svg.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "pen" && !lapizVisto) { lapizVisto = true; hoja.classList.add("con-lapiz"); }
    if (e.pointerType === "touch" && lapizVisto) return; // con lápiz, el dedo mueve la hoja
    if (activo || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    try { svg.setPointerCapture(e.pointerId); } catch {}
    activo = e.pointerId;
    if (herramienta === "g") { borrados = []; borrarEn(e); return; }
    actual = { c: color[herramienta], h: herramienta, s: grosor[herramienta], q: e.pointerType === "pen" ? 1 : 0, p: [] };
    anadir(e);
    pintarVivo();
  });
  svg.addEventListener("pointermove", (e) => {
    if (e.pointerId !== activo) return;
    e.preventDefault();
    const evs = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [];
    const lista = evs.length ? evs : [e];
    if (herramienta === "g") { for (const x of lista) borrarEn(x); return; }
    for (const x of lista) anadir(x);
    if (!raf) raf = requestAnimationFrame(pintarVivo);
  });
  const fin = (e) => {
    if (e.pointerId !== activo) return;
    activo = null;
    if (herramienta === "g") {
      if (borrados && borrados.length) { hechos.push({ t: "-", lista: borrados }); deshechos.length = 0; cambios = true; }
      borrados = null;
      pintarTrazos();
      return;
    }
    if (actual && actual.p.length >= 3) {
      trazos.push(actual);
      hechos.push({ t: "+", tr: actual });
      deshechos.length = 0;
      cambios = true;
    }
    actual = null;
    cancelAnimationFrame(raf); raf = 0;
    vivo.setAttribute("d", "");
    pintarTrazos();
  };
  svg.addEventListener("pointerup", fin);
  svg.addEventListener("pointercancel", fin);
  // El lápiz no desplaza la hoja ni activa «Escribir a mano» del iPad; el dedo sí desplaza si hay lápiz
  svg.addEventListener("touchstart", (e) => {
    if ([...e.changedTouches].some((t) => t.touchType === "stylus") || !lapizVisto) e.preventDefault();
  }, { passive: false });
  svg.addEventListener("touchmove", (e) => {
    if ([...e.changedTouches].some((t) => t.touchType === "stylus") || !lapizVisto) e.preventDefault();
  }, { passive: false });

  // ---------- Deshacer, rehacer y demás ----------
  function deshacer() {
    const a = hechos.pop();
    if (!a) return;
    if (a.t === "+") trazos.splice(trazos.lastIndexOf(a.tr), 1);
    else if (a.t === "-") for (const { i, t } of [...a.lista].reverse()) trazos.splice(i, 0, t);
    else if (a.t === "x") trazos = a.antes.slice();
    deshechos.push(a);
    cambios = true;
    pintarTrazos();
  }
  function rehacer() {
    const a = deshechos.pop();
    if (!a) return;
    if (a.t === "+") trazos.push(a.tr);
    else if (a.t === "-") for (const { t } of a.lista) { const k = trazos.indexOf(t); if (k >= 0) trazos.splice(k, 1); }
    else if (a.t === "x") trazos = [];
    hechos.push(a);
    cambios = true;
    pintarTrazos();
  }
  function limpiar() {
    if (!trazos.length) return;
    hechos.push({ t: "x", antes: trazos.slice() });
    deshechos.length = 0;
    trazos = [];
    cambios = true;
    pintarTrazos();
  }
  function masEspacio() {
    H = Math.min(4000, H + 400);
    ajustarAlto();
    hoja.scrollTo({ top: hoja.scrollHeight, behavior: "smooth" });
  }

  // ---------- Cerrar ----------
  const alTeclado = (e) => {
    if (e.key === "Escape") { e.preventDefault(); cancelar(); }
    else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) rehacer(); else deshacer(); }
  };
  const ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => ajustarAlto()) : null;
  function cerrar() {
    document.removeEventListener("keydown", alTeclado, true);
    if (ro) ro.disconnect();
    raiz.remove();
    document.documentElement.classList.remove("con-lienzo");
  }
  async function cancelar() {
    if (cambios && !(await confirmar({ title: "¿Salir sin guardar el dibujo?", message: "Se perderá lo que has dibujado ahora.", ok: "Salir sin guardar", cancel: "Seguir dibujando", danger: true }))) return;
    cerrar();
  }
  async function quitar() {
    if (!(await confirmar({ title: "¿Quitar este dibujo?", message: "Se quitará del documento.", ok: "Quitar", cancel: "Cancelar", danger: true }))) return;
    cerrar();
    alQuitar();
  }
  function terminar() {
    if (!trazos.length) { cerrar(); if (alQuitar) alQuitar(); return; }
    // Se recorta el espacio vacío de arriba y de abajo
    let min = Infinity, max = -Infinity;
    for (const t of trazos) for (let k = 1; k < t.p.length; k += 3) { min = Math.min(min, t.p[k] - t.s); max = Math.max(max, t.p[k] + t.s); }
    const desde = Math.max(0, Math.floor(min - 30));
    const alto = Math.max(120, Math.ceil(max + 30) - desde);
    const t = trazos.map((x) => ({ ...x, p: x.p.map((v, k) => (k % 3 === 1 ? Math.round((v - desde) * 10) / 10 : v)) }));
    const d = limpiarDibujo({ w: ANCHO, h: alto, t });
    cerrar();
    if (d && d.t.length) alGuardar(d);
  }

  // ---------- Abrir ----------
  document.documentElement.classList.add("con-lienzo");
  document.body.append(raiz);
  document.addEventListener("keydown", alTeclado, true);
  if (!H) {
    // Hoja nueva: tan alta como la pantalla (y nunca menos de 400)
    const w = svg.getBoundingClientRect().width || 1000;
    H = Math.max(400, Math.round((hoja.clientHeight * ANCHO) / w) - 20);
  }
  ajustarAlto();
  if (ro) ro.observe(hoja);
  pintarHerramientas();
  pintarTrazos();
  return { cerrar };
}
