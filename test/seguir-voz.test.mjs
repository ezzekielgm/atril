// Pruebas de seguir la voz (sin navegador): casar lo que oye el reconocedor con el texto.
import { normalizar, palabrasDe, parecidas, crearSeguidor } from "../src/seguir-voz.js";

const results = [];
const ok = (name, cond, extra = "") => { results.push({ name, pass: !!cond }); console.log(`${cond ? "✔" : "✘"} ${name}${extra ? " — " + extra : ""}`); };

ok("Normaliza tildes y signos, y deja la ñ", normalizar("¡Esperábamos,") === "esperabamos" && normalizar("Año") === "año");
ok("Palabras parecidas (lo que oye mal el reconocedor)", parecidas("esperamos", "esperabamos") && parecidas("semilla", "semillas") && !parecidas("sevilla", "lluvia") && !parecidas("la", "las"));

const texto = "La paciencia es una cualidad que todos necesitamos. Cuando las cosas no salen como esperamos, la paciencia nos ayuda a mantener la calma. Pensemos en un agricultor que siembra la semilla y espera la lluvia.";
const w = palabrasDe(texto);
const i = (p, desde = 0) => w.indexOf(p, desde);

// Lo que reconoció de verdad el modelo pequeño en español con una voz sintética (con fallos: «sevilla»)
const s = crearSeguidor(w);
let r = s.oir("la paciencia");
ok("Empieza: «la paciencia» -> segunda palabra", s.pos === 1, String(r));
const parciales = ["todos", "todos necesitamos", "todos necesitamos cuando las", "todos necesitamos cuando las cosas salen", "todos necesitamos cuando las cosas salen como esperábamos"];
for (const p of parciales) s.oir(p);
ok("Sigue con los parciales aunque falten palabras («no») y otras estén mal («esperábamos»)", s.pos === i("esperamos"), `${s.pos} -> ${w[s.pos]}`);
s.oir("todos necesitamos cuando las cosas salen como esperábamos la paciencia", { final: true });
ok("«la paciencia» repetida: elige la de más adelante, no vuelve al principio", s.pos === i("paciencia", 5), `${s.pos}`);
s.oir("mantener");
s.oir("mantener la calma pensemos en un agricultor");
ok("Salta «nos ayuda a» si no las oye", s.pos === i("agricultor"), `${s.pos} -> ${w[s.pos]}`);
s.oir("mantener la calma pensemos en un agricultor sevilla", { final: true });
ok("Una palabra mal oída pero parecida («sevilla» por «semilla») cuenta", s.pos === i("semilla"), `${s.pos} -> ${w[s.pos]}`);
s.oir("lluvia", { final: true });
ok("«lluvia» sola, cerca: avanza al final", s.pos === i("lluvia"), `${s.pos}`);

// Improvisar: palabras que no están en el texto no mueven nada
const s2 = crearSeguidor(w, { desde: i("calma") });
ok("Improvisando (nada del texto) no se mueve", s2.oir("y esto lo digo yo porque me acuerdo de mi abuelo") === null && s2.pos === i("calma"));
// Una sola palabra corta y común no basta para saltar lejos
ok("«la» sola no lo mueve", s2.oir("la") === null);
// Volver atrás a releer: hacen falta 3 palabras
const s3 = crearSeguidor(w, { desde: i("lluvia") });
s3.oir("cuando las");
ok("Hacia atrás no salta con dos palabras", s3.pos === i("lluvia"));
s3.oir("cuando las cosas no salen");
ok("…con varias sí (vuelve a leer una frase)", s3.pos === i("salen"), `${s3.pos} -> ${w[s3.pos]}`);
// Saltarse un trozo (adelantarse varias frases)
const s4 = crearSeguidor(w, { desde: 1 });
s4.oir("pensemos en un agricultor que siembra");
ok("Si se salta un trozo, lo encuentra más adelante", s4.pos === i("siembra"), `${s4.pos}`);

// Texto largo: rendimiento
const largo = palabrasDe(Array.from({ length: 300 }, (_, k) => `Frase número ${k} del discurso con algunas palabras distintas ${k % 7 === 0 ? "paciencia" : "alegría"}.`).join(" "));
const s5 = crearSeguidor(largo, { desde: 0 });
const t0 = performance.now();
for (let k = 0; k < 200; k++) s5.oir(`frase numero ${Math.floor(k / 2)} del discurso con algunas`);
const ms = performance.now() - t0;
ok("Rápido con un discurso largo (200 actualizaciones)", ms < 1500, `${Math.round(ms)} ms, va por ${s5.pos} de ${largo.length}`);

const fallos = results.filter((r) => !r.pass);
console.log(`\n${results.length - fallos.length}/${results.length} pruebas superadas`);
process.exit(fallos.length ? 1 : 0);
