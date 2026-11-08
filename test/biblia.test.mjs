// Prueba del detector de citas: node test/biblia.test.mjs
import { buscarCitas, enlaceCita } from "../src/biblia.js";
const casos = [
  ["Lee Sal 37:4 hoy", ["19037004"]],
  ["(Sal. 84:4, 10)", ["19084004"]],
  ["1 Cor. 13:4-7 y Juan 3:16", ["46013004-46013007", "43003016"]],
  ["1Cor 13:4 sin espacio", ["46013004"]],
  ["Leer 1 Juan 4:8.", ["62004008"]],
  ["Mat. 24:14; Hech. 1:8", ["40024014", "44001008"]],
  ["Revelación 21:3, 4", ["66021003"]],
  ["Apocalipsis 21:4", ["66021004"]],
  ["Isaias 41:10 sin tilde", ["23041010"]],
  ["Génesis 1:1", ["01001001".replace(/^0/, "")]],
  ["Judas 9 y Filem. 10", ["65001009", "57001010"]],
  ["Miq 6:8", ["33006008"]],
  ["Mateo 24 sin versículo", []],
  ["Tengo 3 hijos y 2:30 de tiempo", []],
  ["el mar 3 de mayo", []],
  ["Prov. 3:5, 6", ["20003005"]],
  ["Ecl 9:11", ["21009011"]],
  ["2 Tim. 3:1-5", ["55003001-55003005"]],
  ["Sant 1:5", ["59001005"]],
  ["Ezeq. 18:4", ["26018004"]],
];
let ok = 0;
for (const [txt, esperado] of casos) {
  const got = buscarCitas(txt).map((c) => c.bible);
  const pass = JSON.stringify(got) === JSON.stringify(esperado);
  if (pass) ok++;
  console.log(`${pass ? "✔" : "✘"} ${txt}  →  ${JSON.stringify(got)}${pass ? "" : "  (esperado " + JSON.stringify(esperado) + ")"}`);
}
console.log(enlaceCita("19037004"));
console.log(`\n${ok}/${casos.length} citas correctas`);
process.exit(ok === casos.length ? 0 : 1);
