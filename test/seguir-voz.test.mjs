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


// Saltarse un trozo largo (más de un párrafo): está fuera de la zona cercana, se busca en todo el texto
const parrafos = [
  "Empezamos hablando de la paciencia y de por qué cuesta tanto esperar cuando queremos algo enseguida.",
  "Muchas veces nos impacientamos con los demás porque no hacen las cosas a nuestro ritmo ni de nuestra manera.",
  "También nos impacientamos con nosotros mismos cuando no mejoramos tan rápido como quisiéramos en algún aspecto.",
  "Un ejemplo sencillo es el del niño que planta una semilla y cada mañana la desentierra para ver si ha crecido.",
  "Así nunca crece, porque la planta necesita tiempo, tierra tranquila y agua, no que la miremos cada cinco minutos.",
  "Pasemos ahora a la segunda idea: cómo podemos cultivar la paciencia en el día a día con pequeños hábitos.",
  "El primero es respirar hondo antes de contestar cuando algo nos molesta, contando despacio hasta diez.",
  "El segundo es recordar las veces que otros tuvieron paciencia con nosotros cuando éramos jóvenes y torpes.",
  "Para terminar, pensemos en el agricultor que espera la lluvia temprana y la tardía sin desanimarse nunca.",
];
const wl = palabrasDe(parrafos.join(" "));
const il = (p, desde = 0) => wl.indexOf(p, desde);
const s6 = crearSeguidor(wl, { desde: il("esperar") });
s6.oir("pensemos en el agricultor que espera");
ok("Saltarse varios párrafos: encuentra el sitio en el último", s6.pos === il("espera", il("agricultor")), `${s6.pos} -> ${wl[s6.pos]}`);
const s7 = crearSeguidor(wl, { desde: il("esperar") });
s7.oir("respirar hondo antes", { final: true });
const r7a = s7.pos;
s7.oir("de contestar cuando algo");
ok("Salto lejano: gana el sitio que encaja mejor, no una palabra suelta cercana («algo»)", s7.pos === il("algo", il("contestar")), `${r7a} -> ${s7.pos} ${wl[s7.pos]}`);
const s10 = crearSeguidor(wl, { desde: il("esperar") });
s10.oir("contando despacio hasta");
const r10 = s10.pos;
s10.oir("contando despacio hasta diez el segundo");
ok("Con pocas pruebas lejos, espera a confirmarlo y luego salta", r10 === il("esperar") && s10.pos === il("segundo"), `${r10} -> ${s10.pos} ${wl[s10.pos]}`);
const s8 = crearSeguidor(wl, { desde: il("esperar") });
s8.oir("y que de la y que de la en el");
ok("Palabras cortas y comunes no hacen saltar lejos", s8.pos === il("esperar"), `${s8.pos} -> ${wl[s8.pos]}`);
const s9 = crearSeguidor(wl, { desde: il("lluvia") });
s9.oir("el niño que planta una semilla");
ok("Volver muy atrás (otro párrafo) también lo encuentra", s9.pos === il("semilla"), `${s9.pos} -> ${wl[s9.pos]}`);

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
