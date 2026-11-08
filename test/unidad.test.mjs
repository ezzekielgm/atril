// Pruebas sin navegador: plantilla, tarjetas, partes de los ensayos y colores. Uso: node test/unidad.test.mjs
import { repartirMinutos, crearPlantilla } from "../src/plantilla.js";
import { dividirEnTarjetas, partesDelDiscurso, parteDeBloque } from "../src/tarjetas.js";
import { claseDeFondo, claseValida } from "../src/colores.js";
import { crearPlan, minutosDeTitulo } from "../src/tiempo.js";

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

// --- Colores
ok("Fondos del editor y de Word a su color", [
  ["#fff176", ""], ["#b9f6ca", "c-verde"], ["#b3e5fc", "c-azul"], ["#f8bbd0", "c-rosa"],
  ["rgb(0, 255, 0)", "c-verde"], ["yellow", ""], ["#FF00FF", "c-rosa"], ["rgb(0, 255, 255)", "c-azul"], ["orange", ""], ["#ccc", ""],
].every(([c, esperado]) => claseDeFondo(c) === esperado));
ok("Solo se aceptan las clases de color conocidas", claseValida("x c-azul y") === "c-azul" && claseValida("c-rojo") === "" && claseValida(null) === "");

console.log(`\n${total - fallos}/${total} pruebas superadas`);
process.exit(fallos ? 1 : 0);
