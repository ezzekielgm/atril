// Genera un PDF a partir del HTML del documento (se carga solo al exportar).
// Incrusta las mismas letras de Atril (Carlito o Literata, con latín, latín ampliado y griego, en fonts/pdf/),
// recortadas a lo que se usa. Si no se pueden cargar, usa las estándar del PDF (Times o Helvetica).
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

const A4 = [595.28, 841.89];
const MARGEN = 56; // ≈ 2 cm
const COLOR_MARK = {
  amarillo: rgb(1, 0.945, 0.463), verde: rgb(0.725, 0.965, 0.792),
  azul: rgb(0.702, 0.898, 0.988), rosa: rgb(0.973, 0.733, 0.816),
};
const NEGRO = rgb(0.1, 0.1, 0.1), GRIS = rgb(0.45, 0.45, 0.45);
// Color de la letra (los mismos que en Word)
const hexA = (h) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const COLOR_LETRA = { rojo: hexA("#C00000"), azul: hexA("#0070C0"), verde: hexA("#00873C"), naranja: hexA("#D86400") };
// Solo para lo que la letra no tiene
const EQUIVALENCIAS = { "‖": "||", "≈": "~", "→": "->", "←": "<-", "✓": "v", "✔": "v", "‐": "-", "‑": "-", "−": "-", " ": " ", " ": " ", " ": " ", "\t": " " };
const NIVEL = { H1: 1.6, H2: 1.3, H3: 1.12, H4: 1.12 };

const colorDe = (m) => {
  const c = (m.getAttribute("class") || "").match(/c-(verde|azul|rosa)/);
  return c ? c[1] : "amarillo";
};

/** Recorre el HTML y lo convierte en bloques: {tipo, runs, sangria, vineta, cita, img} */
function bloquesDe(html) {
  const doc = new DOMParser().parseFromString(`<!DOCTYPE html><body>${html}</body>`, "text/html");
  const bloques = [];
  const nuevo = (tipo, extra = {}) => { const b = { tipo, runs: [], sangria: 0, ...extra }; bloques.push(b); return b; };

  // Contenido en línea de un nodo (sin listas anidadas), con su estilo
  function enLinea(nodo, estilo, b, saltarListas = false) {
    for (const n of nodo.childNodes) {
      if (n.nodeType === 3) { b.runs.push({ texto: n.textContent, estilo }); continue; }
      if (n.nodeType !== 1) continue;
      const t = n.tagName;
      if (saltarListas && (t === "UL" || t === "OL")) continue;
      if (t === "BR") { b.runs.push({ salto: true }); continue; }
      if (t === "IMG") { bloques.push({ tipo: "img", src: n.getAttribute("src") || "" }); continue; }
      const e = { ...estilo };
      if (t === "STRONG" || t === "B") e.b = true;
      if (t === "EM" || t === "I") e.i = true;
      if (t === "U") e.u = true;
      if (t === "S" || t === "DEL" || t === "STRIKE") e.s = true;
      if (t === "MARK") e.mark = colorDe(n);
      if (t === "SPAN") { const c = (n.getAttribute("class") || "").match(/\bt-(rojo|azul|verde|naranja)\b/); if (c) e.letra = c[1]; }
      if (/^(P|H[1-4]|LI|BLOCKQUOTE|DIV)$/.test(t)) { b.runs.push({ texto: " ", estilo }); }
      enLinea(n, e, b, saltarListas);
    }
  }

  function lista(ul, nivel, cita) {
    let k = 0;
    for (const li of ul.children) {
      if (li.tagName !== "LI") continue;
      k++;
      const b = nuevo("li", { sangria: nivel, vineta: ul.tagName === "OL" ? `${k}.` : "•", cita });
      enLinea(li, {}, b, true);
      for (const sub of li.children) if (sub.tagName === "UL" || sub.tagName === "OL") lista(sub, nivel + 1, cita);
    }
  }

  function recorrer(cont, cita = false) {
    for (const n of cont.childNodes) {
      if (n.nodeType === 3) { if (n.textContent.trim()) { const b = nuevo("p", { cita }); b.runs.push({ texto: n.textContent, estilo: {} }); } continue; }
      if (n.nodeType !== 1) continue;
      const t = n.tagName;
      if (/^H[1-4]$/.test(t)) enLinea(n, { b: true }, nuevo(t.toLowerCase(), { cita }));
      else if (t === "P" || t === "DIV") enLinea(n, {}, nuevo("p", { cita }));
      else if (t === "UL" || t === "OL") lista(n, 1, cita);
      else if (t === "BLOCKQUOTE") {
        if ([...n.children].some((c) => /^(P|UL|OL|H[1-4])$/.test(c.tagName))) recorrer(n, true);
        else enLinea(n, {}, nuevo("p", { cita: true }));
      } else if (t === "TABLE") {
        for (const tr of n.querySelectorAll("tr")) {
          const b = nuevo("p", { cita, fila: true });
          [...tr.children].forEach((td, i) => {
            if (i) b.runs.push({ texto: "   ·   ", estilo: {} });
            enLinea(td, td.tagName === "TH" ? { b: true } : {}, b);
          });
        }
      } else if (t === "IMG") bloques.push({ tipo: "img", src: n.getAttribute("src") || "" });
      else enLinea(n, {}, nuevo("p", { cita }));
    }
  }
  recorrer(doc.body);
  return bloques;
}

/** Las cuatro letras (normal, negrita, cursiva, negrita cursiva) de Carlito o Literata, o null si no se pueden cargar. */
async function letrasPropias(pdf, family, base) {
  try {
    const nombre = family === "sans" ? "carlito" : "literata";
    const archivos = ["400-normal", "700-normal", "400-italic", "700-italic"].map((v) => new URL(`fonts/pdf/${nombre}-${v}.woff`, base).href);
    const datos = await Promise.all(archivos.map(async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(u); return r.arrayBuffer(); }));
    pdf.registerFontkit(fontkit);
    return await Promise.all(datos.map((d) => pdf.embedFont(d, { subset: true })));
  } catch (e) {
    console.warn("PDF: sin letras propias, uso las estándar", e);
    return null;
  }
}

export async function buildPdf({ title = "Documento", html = "", size = 12, family = "serif", highlights = true, base = globalThis.document ? document.baseURI : undefined } = {}) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setCreator("Atril");
  pdf.setProducer("Atril");
  pdf.setLanguage("es-ES");
  const S = StandardFonts;
  const nombres = family === "sans"
    ? [S.Helvetica, S.HelveticaBold, S.HelveticaOblique, S.HelveticaBoldOblique]
    : [S.TimesRoman, S.TimesRomanBold, S.TimesRomanItalic, S.TimesRomanBoldItalic];
  const [r, b, i, bi] = (base && (await letrasPropias(pdf, family, base))) || (await Promise.all(nombres.map((n) => pdf.embedFont(n))));
  const fuente = (e) => (e.b && e.i ? bi : e.b ? b : e.i ? i : r);
  // Lo que tienen las cuatro letras (así ninguna pinta un cuadrado)
  const juegos = [r, b, i, bi].map((f) => new Set(f.getCharacterSet()));
  const admitidos = new Set([...juegos[0]].filter((c) => juegos.every((j) => j.has(c))));
  const limpiar = (s) => [...s].map((ch) => {
    if (admitidos.has(ch.codePointAt(0))) return ch;
    if (EQUIVALENCIAS[ch] != null) return EQUIVALENCIAS[ch];
    const base = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
    return base && [...base].every((c) => admitidos.has(c.codePointAt(0))) ? base : "";
  }).join("");

  const [W, H] = A4;
  const ancho = W - 2 * MARGEN;
  let pagina = null, y = 0;
  const paginas = [];
  const nuevaPagina = () => { pagina = pdf.addPage(A4); paginas.push(pagina); y = H - MARGEN; };
  nuevaPagina();
  const cabe = (alto) => y - alto >= MARGEN;

  /** Parte los runs en líneas que caben en `max` puntos. Cada línea: [{texto, estilo, x, w}] */
  function lineas(runs, tam, max, estiloBase) {
    // Palabras = trozos sin espacios (pueden tener varios estilos); los espacios van aparte
    const piezas = [];
    for (const run of runs) {
      if (run.salto) { piezas.push({ salto: true }); continue; }
      const texto = limpiar(run.texto.replace(/\s+/g, " "));
      for (const parte of texto.split(/( )/)) if (parte) piezas.push({ texto: parte, estilo: { ...estiloBase, ...run.estilo }, espacio: parte === " " });
    }
    const medir = (p) => fuente(p.estilo).widthOfTextAtSize(p.texto, tam);
    const res = [];
    let linea = [], x = 0, palabra = [], espacio = null;
    const cerrarLinea = () => { while (linea.length && linea[linea.length - 1].espacio) linea.pop(); res.push(linea); linea = []; x = 0; };
    const colocar = () => {
      if (!palabra.length) return;
      let w = palabra.reduce((a, p) => a + medir(p), 0);
      const wEsp = espacio && linea.length ? medir(espacio) : 0;
      if (linea.length && x + wEsp + w > max) cerrarLinea();
      else if (espacio && linea.length) { linea.push({ ...espacio, x, w: wEsp }); x += wEsp; }
      for (const p of palabra) {
        let pw = medir(p);
        if (pw > max) {
          // Palabra más larga que la línea: se corta por letras
          let trozo = "";
          for (const ch of p.texto) {
            const prueba = trozo + ch;
            if (x + fuente(p.estilo).widthOfTextAtSize(prueba, tam) > max && trozo) {
              linea.push({ texto: trozo, estilo: p.estilo, x, w: fuente(p.estilo).widthOfTextAtSize(trozo, tam) });
              cerrarLinea(); trozo = ch;
            } else trozo = prueba;
          }
          pw = fuente(p.estilo).widthOfTextAtSize(trozo, tam);
          linea.push({ texto: trozo, estilo: p.estilo, x, w: pw }); x += pw;
          continue;
        }
        linea.push({ ...p, x, w: pw }); x += pw;
      }
      palabra = []; espacio = null;
    };
    for (const p of piezas) {
      if (p.salto) { colocar(); cerrarLinea(); espacio = null; continue; }
      if (p.espacio) { colocar(); espacio = p; continue; }
      palabra.push(p);
    }
    colocar();
    if (linea.length || !res.length) cerrarLinea();
    return res.filter((l, k) => l.length || k < res.length - 1);
  }

  function pintarLinea(linea, x0, tam, alto, color) {
    const base = y - (alto + tam * 0.62) / 2;
    for (const it of linea) {
      if (highlights && it.estilo.mark) {
        pagina.drawRectangle({ x: x0 + it.x - 0.5, y: base - tam * 0.24, width: it.w + 1, height: tam * 1.12, color: COLOR_MARK[it.estilo.mark] || COLOR_MARK.amarillo });
      }
    }
    for (const it of linea) {
      if (!it.texto.trim()) continue;
      pagina.drawText(it.texto, { x: x0 + it.x, y: base, size: tam, font: fuente(it.estilo), color: COLOR_LETRA[it.estilo.letra] || color });
    }
    for (const it of linea) {
      if (it.estilo.u) pagina.drawLine({ start: { x: x0 + it.x, y: base - tam * 0.12 }, end: { x: x0 + it.x + it.w, y: base - tam * 0.12 }, thickness: Math.max(0.5, tam / 18), color: COLOR_LETRA[it.estilo.letra] || color });
      if (it.estilo.s) pagina.drawLine({ start: { x: x0 + it.x, y: base + tam * 0.3 }, end: { x: x0 + it.x + it.w, y: base + tam * 0.3 }, thickness: Math.max(0.5, tam / 18), color: COLOR_LETRA[it.estilo.letra] || color });
    }
  }

  const bloques = bloquesDe(html);
  for (let k = 0; k < bloques.length; k++) {
    const bl = bloques[k];
    if (bl.tipo === "img") {
      try {
        const m = bl.src.match(/^data:image\/(png|jpe?g);base64,/i);
        if (!m) continue;
        const bytes = Uint8Array.from(atob(bl.src.slice(m[0].length)), (c) => c.charCodeAt(0));
        const img = /png/i.test(m[1]) ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
        const esc = Math.min(1, ancho / img.width, (H - 2 * MARGEN) * 0.45 / img.height);
        const w = img.width * esc, h = img.height * esc;
        if (!cabe(h)) nuevaPagina();
        pagina.drawImage(img, { x: MARGEN, y: y - h, width: w, height: h });
        y -= h + size * 0.6;
      } catch { /* imagen que no se puede incluir */ }
      continue;
    }
    const factor = NIVEL[bl.tipo.toUpperCase()] || 1;
    const tam = size * factor;
    const esTitulo = factor > 1 || bl.tipo === "h4";
    const alto = tam * (esTitulo ? 1.22 : 1.38);
    const sangria = (bl.sangria ? bl.sangria * size * 1.5 : 0) + (bl.cita ? size * 1.2 : 0);
    const ls = lineas(bl.runs, tam, ancho - sangria, esTitulo ? { b: true } : {});
    if (!ls.length || (ls.length === 1 && !ls[0].length && bl.tipo !== "p")) continue;
    if (ls.length === 1 && !ls[0].length) { y -= size * 0.7; continue; } // párrafo vacío
    if (esTitulo && y < H - MARGEN - 1) y -= tam * 0.55;
    // Un título no se queda solo al final de la página
    const necesita = esTitulo ? alto * ls.length + size * 1.38 * 2 : alto * Math.min(2, ls.length);
    if (!cabe(necesita)) nuevaPagina();
    const color = bl.cita ? GRIS : NEGRO;
    ls.forEach((linea, n) => {
      if (!cabe(alto)) nuevaPagina();
      if (n === 0 && bl.vineta) {
        const f = fuente({});
        const vw = f.widthOfTextAtSize(bl.vineta, size);
        pagina.drawText(bl.vineta, { x: MARGEN + sangria - vw - size * 0.45, y: y - (alto + tam * 0.62) / 2, size, font: f, color });
      }
      if (bl.cita) pagina.drawRectangle({ x: MARGEN + size * 0.3, y: y - alto, width: 2, height: alto, color: rgb(0.8, 0.8, 0.8) });
      pintarLinea(linea, MARGEN + sangria, tam, alto, color);
      y -= alto;
    });
    y -= bl.tipo === "li" || bl.fila ? size * 0.2 : esTitulo ? tam * 0.25 : size * 0.6;
  }

  // Título arriba (desde la página 2) y número de página abajo
  const total = paginas.length;
  const tituloCorto = limpiar(title).slice(0, 90);
  paginas.forEach((p, n) => {
    const pie = `${n + 1} / ${total}`;
    p.drawText(pie, { x: (W - r.widthOfTextAtSize(pie, 9)) / 2, y: MARGEN / 2 - 3, size: 9, font: r, color: GRIS });
    if (n > 0 && tituloCorto) p.drawText(tituloCorto, { x: MARGEN, y: H - MARGEN / 2, size: 9, font: i, color: GRIS });
  });

  const bytes = await pdf.save();
  return new Blob([bytes], { type: "application/pdf" });
}
