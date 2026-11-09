// Pruebas sin navegador: plantilla, tarjetas, partes de los ensayos y colores. Uso: node test/unidad.test.mjs
import { repartirMinutos, crearPlantilla } from "../src/plantilla.js";
import { dividirEnTarjetas, partesDelDiscurso, parteDeBloque, estimarPartes } from "../src/tarjetas.js";
import { claseDeFondo, claseValida } from "../src/colores.js";
import { crearPlan, minutosDeTitulo, ritmoDeEnsayos, minutosEstimados, analizarEnsayos } from "../src/tiempo.js";

let fallos = 0, total = 0;
const ok = (nombre, cond, extra = "") => { total++; if (!cond) fallos++; console.log(`${cond ? "✔" : "✘"} ${nombre}${extra ? " — " + extra : ""}`); };
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// --- Plantilla
let r = repartirMinutos(12, 3);
ok("Reparto de 12 min en 3 puntos", r.intro === 1 && r.conclusion === 1 && igual(r.puntos, [4, 3, 3]) && r.total === 12, JSON.stringify(r));
r = repartirMinutos(30, 4);
ok("Reparto de 30 min en 4 puntos", r.intro === 3 && r.conclusion === 3 && igual(r.puntos, [6, 6, 6, 6]), JSON.stringify(r));
r = repartirMinutos(3, 3);
ok("Duración mínima: 1 min por parte", r.total === 5 && igual(r.puntos, [1, 1, 1]), JSON.stringify(r));
const p = crearPlantilla({ titulo: "La <fe>", minutos: 10, puntos: 2 });
ok("La plantilla escapa el título", p.html.startsWith("<h1>La &lt;fe&gt;</h1>"));
const mins = [...p.html.matchAll(/<h2>([^<]*)<\/h2>/g)].map((m) => minutosDeTitulo(m[1]));
ok("Los títulos de la plantilla llevan sus minutos y suman la duración", mins.reduce((a, b) => a + b, 0) === 10, mins.join("+"));

// --- Tarjetas
const B = (tag, palabras) => ({ tag, palabras });
let t = dividirEnTarjetas([B("H1", 4), B("H2", 2), B("P", 50), B("H2", 2), B("P", 80), B("UL", 20), B("H2", 1), B("P", 30)]);
ok("Una tarjeta por parte (el título del discurso va con la primera)", igual(t.map((x) => [x.inicio, x.fin]), [[0, 3], [3, 6], [6, 8]]), JSON.stringify(t));
t = dividirEnTarjetas([B("P", 60), B("P", 60), B("P", 60), B("P", 200), B("P", 10)], 150);
ok("Sin títulos, grupos de unas 150 palabras", igual(t.map((x) => [x.inicio, x.fin]), [[0, 2], [2, 3], [3, 4], [4, 5]]), JSON.stringify(t));
t = dividirEnTarjetas([B("P", 30), B("H2", 2), B("P", 40), B("H2", 2), B("P", 40)]);
ok("El texto antes del primer título es su propia tarjeta", igual(t.map((x) => [x.inicio, x.fin]), [[0, 1], [1, 3], [3, 5]]));

// --- Partes de los ensayos
const bloques = [
  { tag: "H1", texto: "Título", textContent: "Título", tagName: "H1" },
  { tag: "H2", texto: "Introducción (2 min)", textContent: "Introducción (2 min)", tagName: "H2" },
  { tag: "P", texto: "uno dos tres", textContent: "uno dos tres", tagName: "P" },
  { tag: "H2", texto: "Punto (5 min)", textContent: "Punto (5 min)", tagName: "H2" },
  { tag: "P", texto: "cuatro cinco", textContent: "cuatro cinco", tagName: "P" },
];
const plan = crearPlan(bloques, 0);
const partes = partesDelDiscurso(bloques, plan, (s) => s.replace(/\s*\(.*\)$/, ""));
ok("Partes con minutos del plan", igual(partes, [{ bloque: 0, titulo: "Introducción", objetivoSeg: 120 }, { bloque: 3, titulo: "Punto", objetivoSeg: 300 }]), JSON.stringify(partes));
ok("Parte de cada bloque", parteDeBloque(partes, 0) === 0 && parteDeBloque(partes, 2) === 0 && parteDeBloque(partes, 4) === 1);
const sinPlan = partesDelDiscurso([{ tag: "P", texto: "hola" }], null);
ok("Sin títulos: una sola parte", sinPlan.length === 1 && sinPlan[0].titulo === "Todo el discurso");

// --- Tiempo estimado por partes
const palabras = (n) => Array.from({ length: n }, () => "palabra").join(" ");
const doc = [
  { tagName: "H1", textContent: "Título" },
  { tagName: "H2", textContent: "Introducción (1 min)" },
  { tagName: "P", textContent: palabras(129) },
  { tagName: "H2", textContent: "Punto (4 min)" },
  { tagName: "P", textContent: palabras(649) },
];
const est = estimarPartes(doc, 0, 130);
ok("Estimación total y objetivo por los títulos", est.palabras === 785 && est.seg === Math.round(785 / 130 * 60) && est.objetivoSeg === 300, `${est.seg} s de ${est.objetivoSeg} s`);
ok("Estimación por parte (con el título del discurso en la primera)", est.partes.length === 2 && est.partes[0].palabras === 133 && est.partes[1].palabras === 652 && est.partes[1].objetivoSeg === 240,
  est.partes.map((p) => `${p.titulo}: ${p.palabras} pal, ${p.seg} s`).join(" | "));
ok("Con otro ritmo cambia la estimación", estimarPartes(doc, 0, 110).seg > est.seg && minutosEstimados(1100, 110) === 10);
ok("Ritmo real según los ensayos", ritmoDeEnsayos([{ seg: 300 }, { seg: 330 }, { seg: 20 }], 600) === 114 && ritmoDeEnsayos([{ seg: 20 }], 600) === null && ritmoDeEnsayos([], 600) === null);

// --- Colores
ok("Fondos del editor y de Word a su color", [
  ["#fff176", ""], ["#b9f6ca", "c-verde"], ["#b3e5fc", "c-azul"], ["#f8bbd0", "c-rosa"],
  ["rgb(0, 255, 0)", "c-verde"], ["yellow", ""], ["#FF00FF", "c-rosa"], ["rgb(0, 255, 255)", "c-azul"], ["orange", ""], ["#ccc", ""],
].every(([c, esperado]) => claseDeFondo(c) === esperado));
ok("Solo se aceptan las clases de color conocidas", claseValida("x c-azul y") === "c-azul" && claseValida("c-rojo") === "" && claseValida(null) === "");

// --- Ensayo inteligente
const ens = (seg, partes) => ({ seg, objetivoSeg: 600, partes: partes.map(([t, s, o]) => ({ t, s, o })) });
let an = analizarEnsayos([
  ens(640, [["Introducción", 160, 120], ["Punto 1", 240, 240], ["Conclusión", 240, 240]]),
  ens(650, [["Introducción", 170, 120], ["Punto 1", 240, 240], ["Conclusión", 240, 240]]),
  ens(630, [["Introducción", 150, 120], ["Punto 1", 240, 240], ["Conclusión", 240, 240]]),
], 600);
ok("Análisis: mediana de los ensayos y diferencia con el objetivo", an.n === 3 && an.mediana === 640 && an.dif === 40 && an.rango === 20, JSON.stringify([an.mediana, an.dif, an.rango]));
ok("Análisis: encuentra la parte que más se pasa", an.peor && an.peor.t === "Introducción" && an.peor.dif === 40 && an.consejo.startsWith("Practica «Introducción»"), an.consejo);
an = analizarEnsayos([ens(500, [["A", 280, 300], ["B", 120, 300]]), ens(510, [["A", 290, 300], ["B", 120, 300]])], 600);
ok("Análisis: avisa de una parte que se queda corta", !an.peor && an.corta && an.corta.t === "B" && an.consejo.includes("se queda corta"), an.consejo);
an = analizarEnsayos([ens(600, [["A", 300, 300], ["B", 300, 300]])], 600);
ok("Análisis: en tiempo", an.dif === 0 && !an.peor && !an.corta && an.consejo.startsWith("Vas en tiempo"), an.consejo);
an = analizarEnsayos([{ seg: 400, partes: [{ t: "A", s: 250, o: null }, { t: "B", s: 150, o: null }] }], 400, { previstos: new Map([["A", 200], ["B", 200]]) });
ok("Análisis: sin «(N min)», usa lo previsto por palabras", an.peor && an.peor.t === "A" && an.peor.o === 200, JSON.stringify(an.peor));
an = analizarEnsayos([ens(560, []), ens(570, []), ens(640, []), ens(650, [])], 600);
ok("Análisis: tendencia de los 2 últimos (más rápidos)", an.tendencia === -80, String(an.tendencia));
ok("Análisis: sin ensayos válidos no hay análisis", analizarEnsayos([{ seg: 10 }]) === null && analizarEnsayos(null) === null);

console.log(`\n${total - fallos}/${total} pruebas superadas`);
process.exit(fallos ? 1 : 0);
