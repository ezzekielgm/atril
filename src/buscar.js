// Buscar dentro del texto: sin distinguir mayúsculas ni acentos, aunque la frase cruce negritas o enlaces.

const BLOQUE = /^(P|H[1-6]|LI|TD|TH|BLOCKQUOTE|DIV|ARTICLE|UL|OL|TABLE|TR|SECTION)$/;

/** Cada carácter se pliega a exactamente un carácter (así las posiciones coinciden con el texto real). */
function plegar(c) {
  if (/\s/.test(c)) return " ";
  const f = c.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return f.length ? f[0] : c;
}

/** Texto sin acentos y en minúsculas, para comparar («Congregación» = «congregacion»). */
export const plegarTexto = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Envuelve cada coincidencia en <span class="hit">. Devuelve una lista con los spans de cada coincidencia
 * (una coincidencia puede tener varios si cruza etiquetas).
 */
export function marcarCoincidencias(root, consulta, clase = "hit") {
  const q = [...String(consulta || "").trim().replace(/\s+/g, " ")].map(plegar).join("");
  if (q.length < 2) return [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let texto = "";
  const mapa = []; // por cada carácter: [nodo, posición] o null (separación entre bloques)
  let anterior = null;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    let b = n.parentElement;
    while (b && b !== root && !BLOQUE.test(b.tagName)) b = b.parentElement;
    if (anterior && b !== anterior) { texto += "\n"; mapa.push(null); }
    anterior = b;
    const t = n.textContent;
    for (let k = 0; k < t.length; k++) { texto += plegar(t[k]); mapa.push([n, k]); }
  }

  const coincidencias = [];
  for (let desde = texto.indexOf(q); desde !== -1; desde = texto.indexOf(q, desde + q.length)) {
    const trozos = [];
    for (let k = desde; k < desde + q.length; k++) {
      const m = mapa[k];
      if (!m) continue;
      const ult = trozos[trozos.length - 1];
      if (ult && ult.nodo === m[0] && ult.fin === m[1]) ult.fin++;
      else trozos.push({ nodo: m[0], ini: m[1], fin: m[1] + 1 });
    }
    coincidencias.push(trozos);
  }

  // Envolver: por nodo y de atrás hacia delante, para que las posiciones sigan valiendo
  const porNodo = new Map();
  coincidencias.forEach((trozos, idx) => trozos.forEach((t, pos) => {
    if (!porNodo.has(t.nodo)) porNodo.set(t.nodo, []);
    porNodo.get(t.nodo).push({ ...t, idx, pos });
  }));
  const spans = coincidencias.map((t) => new Array(t.length));
  for (const [nodo, lista] of porNodo) {
    lista.sort((a, b) => b.ini - a.ini);
    for (const t of lista) {
      const r = document.createRange();
      r.setStart(nodo, t.ini);
      r.setEnd(nodo, t.fin);
      const s = document.createElement("span");
      s.className = clase;
      r.surroundContents(s);
      spans[t.idx][t.pos] = s;
    }
  }
  return spans;
}

export function limpiarCoincidencias(root, clase = "hit") {
  root.querySelectorAll(`span.${clase}`).forEach((s) => s.replaceWith(...s.childNodes));
  root.normalize();
}
