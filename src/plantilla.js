// Plantilla de discurso nuevo: introducción, puntos y conclusión con los minutos repartidos.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Reparte los minutos: 10 % introducción, 10 % conclusión (mínimo 1 cada una) y el resto entre los puntos. */
export function repartirMinutos(minutos, puntos) {
  const total = Math.max(2 + puntos, Math.round(minutos));
  const intro = Math.max(1, Math.round(total * 0.1));
  const conclusion = Math.max(1, Math.round(total * 0.1));
  const resto = total - intro - conclusion;
  const base = Math.floor(resto / puntos);
  const sobra = resto - base * puntos;
  const porPunto = Array.from({ length: puntos }, (_, i) => base + (i < sobra ? 1 : 0));
  return { total, intro, conclusion, puntos: porPunto };
}

/** HTML del discurso nuevo. */
export function crearPlantilla({ titulo = "", minutos = 10, puntos = 3 } = {}) {
  puntos = Math.min(6, Math.max(1, Math.round(puntos) || 3));
  const r = repartirMinutos(minutos, puntos);
  const partes = [];
  if (titulo) partes.push(`<h1>${esc(titulo)}</h1>`);
  partes.push(`<h2>Introducción (${r.intro} min)</h2>`, "<p>Despierta el interés: una pregunta, una experiencia breve o un dato que sorprenda.</p>");
  r.puntos.forEach((m, i) => {
    partes.push(
      `<h2>Punto ${i + 1} (${m} min)</h2>`,
      "<p>Idea principal en una frase.</p>",
      "<ul><li>Texto bíblico: </li><li>Explicación: </li><li>Ilustración: </li><li>Aplicación: </li></ul>"
    );
  });
  partes.push(`<h2>Conclusión (${r.conclusion} min)</h2>`, "<p>Repasa los puntos principales y di qué hacer con lo aprendido.</p>");
  return { html: partes.join(""), reparto: r };
}
