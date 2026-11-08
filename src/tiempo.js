// Tiempo del discurso: duración estimada, plan por partes y ritmo (adelantado / retrasado).

export const PALABRAS_POR_MINUTO = 130; // ritmo habitual hablando en público en español

export const contarPalabras = (texto) => (texto.match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu) || []).length;

export const minutosEstimados = (palabras, ppm = PALABRAS_POR_MINUTO) => (palabras ? Math.max(1, Math.round(palabras / ppm)) : 0);

/**
 * Ritmo real al hablar (palabras por minuto) según los últimos ensayos de un discurso de `palabras` palabras.
 * Solo cuenta ensayos de al menos un minuto. Devuelve null si no hay datos razonables.
 */
export function ritmoDeEnsayos(ensayos, palabras) {
  const validos = (ensayos || []).filter((e) => e && e.seg >= 60).slice(0, 5);
  if (!validos.length || !palabras) return null;
  const media = validos.reduce((a, e) => a + e.seg, 0) / validos.length;
  const ppm = Math.round(palabras / (media / 60));
  return ppm >= 70 && ppm <= 220 ? ppm : null;
}

/** Minutos indicados en un título: «Introducción (3 min)», «Punto 1 — 5 minutos», «(2,5 min.)» */
export function minutosDeTitulo(texto) {
  const t = String(texto || "").trim();
  const m = t.match(/\(\s*(\d{1,3}(?:[.,]\d)?)\s*(?:min|mins|minutos?)\.?\s*\)\s*$/i) ||
    t.match(/(?:^|[\s—–-])(\d{1,3}(?:[.,]\d)?)\s*(?:min|mins|minutos?)\.?\s*$/i);
  if (!m) return null;
  const n = parseFloat(m[1].replace(",", "."));
  return n > 0 && n <= 240 ? n : null;
}

/** Título sin la indicación de minutos (para el esquema, donde va en una etiqueta aparte). */
export function tituloSinMinutos(texto) {
  return String(texto || "")
    .replace(/\s*\(\s*\d{1,3}(?:[.,]\d)?\s*(?:min|mins|minutos?)\.?\s*\)\s*$/i, "")
    .replace(/\s*[—–-]?\s*\d{1,3}(?:[.,]\d)?\s*(?:min|mins|minutos?)\.?\s*$/i, "")
    .trim();
}

const ES_TITULO = /^H[1-4]$/;

/**
 * Prepara el plan del discurso a partir de los bloques del texto.
 * Si algún título lleva minutos, se va por partes; si no, se reparte el objetivo según las palabras.
 * Devuelve null si no hay objetivo ni minutos en los títulos.
 */
export function crearPlan(bloques, objetivoMin) {
  const palabras = bloques.map((b) => contarPalabras(b.textContent || ""));
  const total = palabras.reduce((a, b) => a + b, 0);
  const inicio = [];
  let acc = 0;
  for (const p of palabras) { inicio.push(acc); acc += p; }

  const partes = [];
  bloques.forEach((b, i) => {
    if (ES_TITULO.test(b.tagName)) {
      const min = minutosDeTitulo(b.textContent);
      if (min) partes.push({ bloque: i, palabraInicio: inicio[i], minutos: min, titulo: b.textContent.trim() });
    }
  });

  let secciones;
  if (partes.length) {
    // Lo que va antes del primer título con minutos cuenta como parte de la primera sección
    partes[0].palabraInicio = 0;
    secciones = partes.map((p, k) => ({ ...p, palabraFin: k + 1 < partes.length ? partes[k + 1].palabraInicio : total }));
  } else if (objetivoMin > 0) {
    secciones = [{ bloque: 0, palabraInicio: 0, palabraFin: total, minutos: objetivoMin, titulo: "" }];
  } else {
    return null;
  }
  let t = 0;
  for (const s of secciones) { s.tInicio = t; t += s.minutos * 60; s.tFin = t; }
  const objetivoSeg = objetivoMin > 0 ? objetivoMin * 60 : t;
  return { secciones, totalPalabras: total, inicioBloque: inicio, palabrasBloque: palabras, porPartes: partes.length > 0, objetivoSeg, sumaPartesSeg: t };
}

/** Segundos en los que, según el plan, deberías ir por esta palabra. */
export function tiempoPrevisto(plan, palabra) {
  if (!plan || !plan.totalPalabras) return 0;
  const s = plan.secciones.find((x) => palabra < x.palabraFin) || plan.secciones[plan.secciones.length - 1];
  const largo = Math.max(1, s.palabraFin - s.palabraInicio);
  const frac = Math.min(1, Math.max(0, (palabra - s.palabraInicio) / largo));
  return s.tInicio + frac * (s.tFin - s.tInicio);
}

/** Palabra por la que vas leyendo según lo que se ve en pantalla (línea a un tercio de la altura). */
export function palabraActual(plan, scrollEl, contenido) {
  if (!plan) return 0;
  const r = scrollEl.getBoundingClientRect();
  const y = r.top + r.height * 0.33;
  const hijos = contenido.children;
  // Búsqueda del bloque que cruza la línea
  let elegido = 0;
  for (let i = 0; i < hijos.length; i++) {
    const br = hijos[i].getBoundingClientRect();
    if (br.top <= y) elegido = i; else break;
  }
  const br = hijos[elegido] ? hijos[elegido].getBoundingClientRect() : null;
  const frac = br && br.height ? Math.min(1, Math.max(0, (y - br.top) / br.height)) : 0;
  return (plan.inicioBloque[elegido] || 0) + frac * (plan.palabrasBloque[elegido] || 0);
}

export const mmss = (seg) => {
  const s = Math.max(0, Math.round(seg));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return (h ? h + ":" + String(m).padStart(2, "0") : String(m)) + ":" + String(x).padStart(2, "0");
};
