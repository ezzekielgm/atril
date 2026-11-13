// Seguir la voz: casa lo que reconoce el micrófono con el texto del discurso (sin DOM, con pruebas en
// test/seguir-voz.test.mjs). El reconocedor se equivoca y el orador se salta o improvisa palabras, así que
// no se busca la frase exacta: se busca, cerca de donde íbamos, el trozo del texto que más se parece a
// las últimas palabras oídas, y solo se avanza si hay pruebas suficientes.

/** Minúsculas, sin tildes ni signos («Esperábamos,» -> «esperabamos»). La ñ se queda. */
export function normalizar(p) {
  return String(p)
    .toLowerCase()
    .replace(/ñ/g, "\u0001")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\u0001/g, "ñ")
    .replace(/[^a-zñ0-9]/g, "");
}

/** Las palabras de un texto, normalizadas (sin las vacías). */
export function palabrasDe(texto) {
  return String(texto).split(/\s+/).map(normalizar).filter(Boolean);
}

function distancia(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const fila = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = fila[0];
    fila[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const t = fila[j];
      fila[j] = Math.min(fila[j] + 1, fila[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = t;
    }
  }
  return fila[b.length];
}

/** ¿Son la misma palabra, aunque el reconocedor la haya oído un poco mal? («esperamos» ~ «esperabamos») */
export function parecidas(a, b) {
  if (a === b) return true;
  if (a.length < 4 || b.length < 4) return false;
  if (a.length >= 6 && b.length >= 6 && a.slice(0, 5) === b.slice(0, 5)) return true;
  return distancia(a, b) <= (Math.max(a.length, b.length) >= 7 ? 2 : 1);
}

const VENTANA = 12;    // palabras del texto que se miran hacia atrás desde cada candidato
const OIDAS = 8;       // últimas palabras oídas que se tienen en cuenta
const ADELANTO = 45;   // hasta dónde se busca por delante de la posición actual
const ATRAS = 25;      // y por detrás (si vuelve a leer algo)

/**
 * Coincidencias en orden entre las palabras oídas `h` y el texto `w[ini..fin]`, con la condición de que
 * la última del texto (w[fin]) case con una de las 3 últimas oídas (para que el final sea lo que se dice ahora).
 * Cada palabra oída que quede después de esa (sin explicar) resta: así gana el sitio que explica lo último dicho.
 */
function coincidencias(h, w, ini, fin) {
  const n = h.length, m = fin - ini + 1;
  // dp[i][j] = mayor nº de coincidencias en orden entre h[0..i) y w[ini..ini+j)
  const dp = Array.from({ length: n + 1 }, () => new Int16Array(m + 1));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = parecidas(h[i - 1], w[ini + j - 1]) ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  let mejor = 0;
  for (let i = Math.max(1, n - 2); i <= n; i++) {
    if (parecidas(h[i - 1], w[fin])) mejor = Math.max(mejor, dp[i - 1][m - 1] + 1 - 1.2 * (n - i));
  }
  return mejor;
}

/**
 * Seguidor para un texto. `pos` = índice de la última palabra dicha (−1 antes de empezar).
 * `oir(parcial)` con lo reconocido hasta ahora en la frase en curso; `oir(final, {final: true})` al cerrarla.
 * Devuelve la nueva posición o null si no se mueve.
 */
export function crearSeguidor(palabrasTexto, { desde = -1 } = {}) {
  const w = palabrasTexto;
  let pos = desde;
  let previas = []; // palabras de las frases ya cerradas (las últimas)

  function alinear(h) {
    if (!h.length || !w.length) return null;
    let mejor = null;
    const ini = Math.max(0, pos - ATRAS), fin = Math.min(w.length - 1, pos + ADELANTO);
    for (let j = ini; j <= fin; j++) {
      if (!h.slice(-3).some((x) => parecidas(x, w[j]))) continue;
      const c = coincidencias(h, w, Math.max(0, j - VENTANA + 1), j);
      const d = j - pos;
      // Pruebas que hacen falta: hacia delante cerca, 2 palabras (o 1 larga si es la siguiente);
      // saltos grandes o hacia atrás, 3
      const necesita = d >= 1 && d <= 3 && w[j].length >= 5 ? 1 : d < -1 || d > 15 ? 3 : 2;
      if (c < necesita) continue;
      const nota = c - 0.03 * Math.abs(d - 1) - (d < 0 ? 0.6 : 0);
      if (!mejor || nota > mejor.nota) mejor = { j, nota };
    }
    if (!mejor || mejor.j === pos) return null;
    pos = mejor.j;
    return pos;
  }

  return {
    get pos() { return pos; },
    set pos(p) { pos = p; previas = []; },
    oir(texto, { final = false } = {}) {
      const nuevas = palabrasDe(texto);
      const h = previas.concat(nuevas).slice(-OIDAS);
      const r = alinear(h);
      if (final) previas = h;
      return r;
    },
  };
}
