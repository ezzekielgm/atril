// División del discurso en tarjetas (modo tarjetas) y en partes (ensayos), y tiempo estimado por parte.
import { crearPlan, contarPalabras, tituloSinMinutos } from "./tiempo.js";

const NIVEL = { H1: 1, H2: 2, H3: 3, H4: 4 };

/** Nivel de título que separa las partes: el primero (H2, H1, H3) que aparece al menos dos veces. */
export function nivelDeCorte(bloques) {
  for (const t of ["H2", "H1", "H3"]) if (bloques.filter((b) => b.tag === t).length >= 2) return NIVEL[t];
  return 0;
}

/**
 * Tarjetas: una por parte del discurso (según los títulos). Si no hay títulos, grupos de párrafos
 * de unas `maxPalabras` palabras. bloques: [{tag, palabras}]. Devuelve [{inicio, fin, palabras}] (fin excluido).
 */
export function dividirEnTarjetas(bloques, maxPalabras = 150) {
  const corte = nivelDeCorte(bloques);
  const tarjetas = [];
  let cur = null;
  const nueva = (i) => { cur = { inicio: i, fin: i, palabras: 0, soloTitulos: true }; tarjetas.push(cur); };
  bloques.forEach((b, i) => {
    const nivel = NIVEL[b.tag] || 0;
    const esTitulo = nivel > 0;
    if (!cur) nueva(i);
    else if (corte) {
      // Un título de la parte abre tarjeta nueva, salvo que la actual solo tenga títulos (p. ej. el título del discurso)
      if (esTitulo && nivel <= corte && !cur.soloTitulos) nueva(i);
    } else if (cur.palabras > 0 && cur.palabras + b.palabras > maxPalabras && !cur.soloTitulos) {
      nueva(i);
    }
    cur.fin = i + 1;
    cur.palabras += b.palabras;
    if (!esTitulo && b.palabras > 0) cur.soloTitulos = false;
  });
  return tarjetas.map(({ inicio, fin, palabras }) => ({ inicio, fin, palabras }));
}

/**
 * Partes del discurso para los ensayos.
 * Si el plan de tiempo va por partes, se usan esas (con su objetivo); si no, los títulos del nivel de corte.
 * bloques: [{tag, texto}]. Devuelve [{bloque, titulo, objetivoSeg|null}].
 */
export function partesDelDiscurso(bloques, plan, limpiarTitulo = (t) => t) {
  if (plan && plan.porPartes) {
    return plan.secciones.map((s, k) => ({ bloque: k === 0 ? 0 : s.bloque, titulo: limpiarTitulo(s.titulo), objetivoSeg: Math.round(s.minutos * 60) }));
  }
  const corte = nivelDeCorte(bloques);
  const partes = [];
  if (corte) {
    bloques.forEach((b, i) => { if (NIVEL[b.tag] === corte) partes.push({ bloque: i, titulo: limpiarTitulo(b.texto.trim()), objetivoSeg: null }); });
    if (partes.length) partes[0].bloque = 0;
  }
  if (!partes.length) partes.push({ bloque: 0, titulo: "Todo el discurso", objetivoSeg: plan ? Math.round(plan.objetivoSeg) : null });
  return partes;
}

/**
 * Tiempo estimado de lectura, total y por parte, a `ppm` palabras por minuto.
 * bloques: elementos (o {tagName, textContent}). Devuelve {palabras, seg, objetivoSeg, partes[{titulo, palabras, seg, objetivoSeg}]}.
 */
export function estimarPartes(bloques, objetivoMin, ppm) {
  const lista = [...bloques];
  const palabrasBloque = lista.map((b) => contarPalabras(b.textContent || ""));
  const total = palabrasBloque.reduce((a, b) => a + b, 0);
  const plan = crearPlan(lista, Number(objetivoMin) || 0);
  const partes = partesDelDiscurso(lista.map((b) => ({ tag: b.tagName, texto: b.textContent || "" })), plan, tituloSinMinutos);
  const seg = (p) => Math.round((p / ppm) * 60);
  return {
    palabras: total,
    seg: seg(total),
    objetivoSeg: plan ? Math.round(plan.objetivoSeg) : null,
    partes: partes.map((p, k) => {
      const fin = k + 1 < partes.length ? partes[k + 1].bloque : lista.length;
      const palabras = palabrasBloque.slice(p.bloque, fin).reduce((a, b) => a + b, 0);
      return { titulo: p.titulo, palabras, seg: seg(palabras), objetivoSeg: p.objetivoSeg };
    }),
  };
}

/** Índice de la parte en la que está un bloque. */
export function parteDeBloque(partes, bloque) {
  let k = 0;
  for (let i = 0; i < partes.length; i++) if (partes[i].bloque <= bloque) k = i;
  return k;
}
