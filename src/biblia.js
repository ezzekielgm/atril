// Detecta citas bíblicas en español y las convierte en enlaces que abren JW Library.
// Ejemplos: «Sal 37:4», «Sal. 84:4, 10», «1 Cor. 13:4-7», «Juan 3:16», «Judas 9», «Revelación 21:4».

const LIBROS = [
  [1, ["Génesis", "Gén", "Gn", "Ge"]],
  [2, ["Éxodo", "Éx", "Ex"]],
  [3, ["Levítico", "Lev", "Lv"]],
  [4, ["Números", "Núm", "Nm"]],
  [5, ["Deuteronomio", "Deut", "Dt"]],
  [6, ["Josué", "Jos"]],
  [7, ["Jueces", "Juec", "Jue"]],
  [8, ["Rut"]],
  [9, ["1 Samuel", "1 Sam", "1 Sa"]],
  [10, ["2 Samuel", "2 Sam", "2 Sa"]],
  [11, ["1 Reyes", "1 Rey", "1 Re"]],
  [12, ["2 Reyes", "2 Rey", "2 Re"]],
  [13, ["1 Crónicas", "1 Crón", "1 Cr"]],
  [14, ["2 Crónicas", "2 Crón", "2 Cr"]],
  [15, ["Esdras", "Esd"]],
  [16, ["Nehemías", "Neh"]],
  [17, ["Ester", "Est"]],
  [18, ["Job"]],
  [19, ["Salmos", "Salmo", "Sal"]],
  [20, ["Proverbios", "Prov", "Pr"]],
  [21, ["Eclesiastés", "Ecl", "Ec"]],
  [22, ["El Cantar de los Cantares", "Cantar de los Cantares", "Cantares", "Cant"]],
  [23, ["Isaías", "Is"]],
  [24, ["Jeremías", "Jer"]],
  [25, ["Lamentaciones", "Lam"]],
  [26, ["Ezequiel", "Ezeq", "Ez"]],
  [27, ["Daniel", "Dan", "Dn"]],
  [28, ["Oseas", "Os"]],
  [29, ["Joel", "Jl"]],
  [30, ["Amós", "Am"]],
  [31, ["Abdías", "Abd"]],
  [32, ["Jonás", "Jon"]],
  [33, ["Miqueas", "Miq"]],
  [34, ["Nahúm", "Nah"]],
  [35, ["Habacuc", "Hab"]],
  [36, ["Sofonías", "Sof"]],
  [37, ["Ageo", "Ag"]],
  [38, ["Zacarías", "Zac"]],
  [39, ["Malaquías", "Mal"]],
  [40, ["Mateo", "Mat", "Mt"]],
  [41, ["Marcos", "Mar", "Mr", "Mc"]],
  [42, ["Lucas", "Luc", "Lc"]],
  [43, ["Juan", "Jn"]],
  [44, ["Hechos", "Hech", "Hch"]],
  [45, ["Romanos", "Rom", "Ro"]],
  [46, ["1 Corintios", "1 Cor", "1 Co"]],
  [47, ["2 Corintios", "2 Cor", "2 Co"]],
  [48, ["Gálatas", "Gál", "Gá"]],
  [49, ["Efesios", "Efes", "Ef"]],
  [50, ["Filipenses", "Filip", "Flp", "Fil"]],
  [51, ["Colosenses", "Col"]],
  [52, ["1 Tesalonicenses", "1 Tes", "1 Ts"]],
  [53, ["2 Tesalonicenses", "2 Tes", "2 Ts"]],
  [54, ["1 Timoteo", "1 Tim", "1 Ti"]],
  [55, ["2 Timoteo", "2 Tim", "2 Ti"]],
  [56, ["Tito", "Tit"]],
  [57, ["Filemón", "Filem", "Flm"]],
  [58, ["Hebreos", "Heb"]],
  [59, ["Santiago", "Sant", "Stg"]],
  [60, ["1 Pedro", "1 Ped", "1 Pe"]],
  [61, ["2 Pedro", "2 Ped", "2 Pe"]],
  [62, ["1 Juan", "1 Jn"]],
  [63, ["2 Juan", "2 Jn"]],
  [64, ["3 Juan", "3 Jn"]],
  [65, ["Judas", "Jud"]],
  [66, ["Revelación", "Apocalipsis", "Apoc", "Rev", "Ap"]],
];

// Libros de un solo capítulo: «Judas 9» es el versículo 9
const UN_CAPITULO = new Set([31, 57, 63, 64, 65]);

const quitarAcentos = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const clave = (s) => quitarAcentos(s).toLowerCase().replace(/\s+/g, " ").trim().replace(/^(\d)\s*/, "$1 ");

// Nombre normalizado -> número de libro
const INDICE = new Map();
for (const [num, nombres] of LIBROS) for (const n of nombres) INDICE.set(clave(n), num);

// Patrón de un nombre: acentos opcionales, el número inicial puede ir pegado («1Cor») y espacios flexibles
const ACENTOS = { a: "[aáàä]", e: "[eéèë]", i: "[iíìï]", o: "[oóòö]", u: "[uúùü]", n: "[nñ]" };
function patronNombre(nombre) {
  return quitarAcentos(nombre)
    .split("")
    .map((c) => {
      const l = c.toLowerCase();
      if (c === " ") return "\\s*";
      if (ACENTOS[l]) return ACENTOS[l];
      return c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("");
}

const NOMBRES = [...new Set(LIBROS.flatMap(([, n]) => n))].sort((a, b) => b.length - a.length);
const PATRON_LIBRO = NOMBRES.map(patronNombre).join("|");

// grupo 1: lo que va antes (inicio o un carácter que no sea letra/dígito)
// grupo 2: libro · 3: capítulo · 4: versículo · 5: versículo final del rango
// Sin «lookbehind» para que funcione en iPadOS antiguos.
const RE_CITA = new RegExp(
  `(^|[^\\p{L}\\p{N}])(${PATRON_LIBRO})\\.?\\s*(\\d{1,3})(?:\\s*:\\s*(\\d{1,3})(?:\\s*[-–]\\s*(\\d{1,3}))?)?(?![\\p{L}\\d:])`,
  "giu"
);

const pad3 = (n) => String(n).padStart(3, "0");
const codigo = (libro, cap, vers) => `${libro}${pad3(cap)}${pad3(vers)}`;

/** Busca citas en un texto. Devuelve [{start, end, texto, libro, cap, vers, versFin, bible}] */
export function buscarCitas(texto) {
  const res = [];
  RE_CITA.lastIndex = 0;
  let m;
  while ((m = RE_CITA.exec(texto))) {
    const [todo, antes, nombre, n1, n2, n3] = m;
    const libro = INDICE.get(clave(nombre));
    if (!libro) continue;
    let cap, vers, versFin;
    if (n2) { cap = +n1; vers = +n2; versFin = n3 ? +n3 : null; }
    else if (UN_CAPITULO.has(libro)) { cap = 1; vers = +n1; versFin = null; }
    else continue; // «Mat 24» sin versículo: no se enlaza (evita falsos positivos)
    if (!cap || !vers || cap > 150 || vers > 176) continue;
    if (versFin && versFin <= vers) versFin = null;
    const start = m.index + antes.length;
    const end = m.index + todo.length;
    const bible = codigo(libro, cap, vers) + (versFin ? "-" + codigo(libro, cap, versFin) : "");
    res.push({ start, end, texto: texto.slice(start, end), libro, cap, vers, versFin, bible });
    // Si el carácter previo era parte de la cita siguiente, sigue buscando desde el final
    RE_CITA.lastIndex = end;
  }
  return res;
}

/** «Filipenses 4:4», «Salmo 37:4-7», «Judas 9»: la cita con el nombre entero del libro. */
export function citaCompleta(c) {
  if (!c) return "";
  let nombre = LIBROS[c.libro - 1][1][0];
  if (c.libro === 19) nombre = "Salmo";
  const v = c.vers + (c.versFin ? "-" + c.versFin : "");
  return UN_CAPITULO.has(c.libro) && c.cap === 1 ? `${nombre} ${v}` : `${nombre} ${c.cap}:${v}`;
}

/** ¿El texto (un versículo pegado) es de esta cita? Mismo libro y capítulo, y el versículo dentro del rango. */
export function esDeLaCita(texto, c) {
  return buscarCitas(texto || "").some((x) => x.libro === c.libro && x.cap === c.cap &&
    x.vers <= (c.versFin || c.vers) && (x.versFin || x.vers) >= c.vers);
}

/** Limpia un versículo copiado de JW Library o de jw.org: sin las marcas de notas (*) y referencias (+), sin espacios de más. */
export function limpiarVersiculo(t) {
  return String(t || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[+*†‡]/g, "")
    .replace(/[ \t   ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/ ([,.;:!?»”])/g, "$1")
    .trim()
    .slice(0, 6000);
}

/** Enlace para una cita. modo: "app" (JW Library) o "web" (jw.org) */
export function enlaceCita(bible, modo = "app") {
  const q = `srcid=jwlshare&wtlocale=S&prefer=lang&pub=nwtsty&bible=${bible}`;
  return modo === "web" ? `https://www.jw.org/finder?${q}` : `jwlibrary:///finder?${q}`;
}

/** Convierte las citas del texto de un elemento en enlaces (no toca enlaces existentes ni campos editables). */
export function enlazarCitas(raiz, modo = "app") {
  if (!raiz || modo === "off") return 0;
  const walker = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const p = n.parentElement;
      if (!p || p.closest("a, [contenteditable], .bref")) return NodeFilter.FILTER_REJECT;
      return /\d/.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  });
  const nodos = [];
  while (walker.nextNode()) nodos.push(walker.currentNode);
  let total = 0;
  for (const nodo of nodos) {
    const texto = nodo.nodeValue;
    const citas = buscarCitas(texto);
    if (!citas.length) continue;
    const frag = document.createDocumentFragment();
    let pos = 0;
    for (const c of citas) {
      if (c.start > pos) frag.append(texto.slice(pos, c.start));
      const a = document.createElement("a");
      a.className = "bref";
      a.href = enlaceCita(c.bible, modo);
      if (modo === "web") { a.target = "_blank"; a.rel = "noopener"; }
      a.textContent = c.texto;
      a.title = "Abrir en " + (modo === "web" ? "jw.org" : "JW Library");
      frag.append(a);
      pos = c.end;
      total++;
    }
    if (pos < texto.length) frag.append(texto.slice(pos));
    nodo.replaceWith(frag);
  }
  return total;
}
