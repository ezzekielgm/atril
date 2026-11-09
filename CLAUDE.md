# Atril — lector y editor de discursos (PWA)

App web instalable (PWA) para el iPad de Ezequiel. Sirve para:

1. **Leer discursos** importados de Word (.docx) en modo lectura: el texto se reajusta al ancho y el tamaño de letra cambia con el gesto de dos dedos (separar = más grande, pellizcar = más pequeña), sin ampliar la página.
2. **Retocar** el texto (cambiar letras o palabras, negrita, cursiva, subrayado, resaltado, títulos y listas) y **guardarlo como Word**.
3. **Tomar notas** rápidas, que luego copia o comparte para pasárselas a Claude o guardarlas como Word.

Se instala desde Safari con *Compartir → Añadir a pantalla de inicio*, funciona sin conexión y guarda todo en el propio dispositivo (IndexedDB). No hay servidor ni cuentas.

Responde en español. Interfaz y textos de la app, en español de España.

## Estructura

```
src/
  index.html          vistas: inicio, lector, editor (se muestran/ocultan)
  styles.css          temas (claro, sepia, oscuro), tipografía y diseño táctil (ver «Diseño»)
  fonts/              Carlito (como Calibri) y Literata (woff2, solo latín, licencia OFL)
  main.js             la app (sin frameworks): vistas, almacenamiento, lector, editor, notas
  biblia.js           detecta citas bíblicas en español y las enlaza a JW Library (jwlibrary:///finder) o jw.org
  tiempo.js           duración estimada, plan por partes (títulos con «(N min)») y ritmo adelantado/retrasado
  colores.js          colores del resaltador (<mark> amarillo o class c-verde/c-azul/c-rosa) y de la letra (span.t-rojo/t-azul/t-verde/t-naranja)
  word-colores.js     al abrir un Word, recupera el color de la letra (mammoth no lo lee; se carga solo al importar, usa jszip)
  tarjetas.js         división en tarjetas y en partes para los ensayos
  buscar.js           buscar en el texto (sin acentos ni mayúsculas, aunque cruce etiquetas)
  plantilla.js        plantilla de discurso nuevo y reparto de minutos
  grabadora.js        grabación de audio de los ensayos (MediaRecorder)
  pdf-export.js       HTML -> PDF con pdf-lib y letras estándar (se carga solo al exportar)
  docx-export.js      HTML -> .docx (se carga solo al exportar; usa docx + docx/html)
  sw.js               service worker (plantilla: el build mete versión y lista de archivos)
  manifest.webmanifest
  icons/              iconos, banner del inicio y og.jpg (se generan con scripts/iconos.py desde scripts/arte/)
build.mjs             construye dist/ con esbuild
test/e2e.mjs          prueba de punta a punta con Playwright (Chromium emulando iPad táctil)
test/e2e-funciones.mjs  pruebas de citas, esquema, tiempo objetivo y vista de móvil
test/e2e-presentar.mjs  pruebas de Presentar, volver tras cerrarse la app, sustituir un Word, bienvenida y barra del móvil
test/e2e-estructura.mjs pruebas de «Seguir donde lo dejaste», fijar, panel lateral, barra de estado, semáforo y pasar página al presentar, atajos
test/e2e-pc.mjs       pruebas del Word del PC al día, qué significa cada color, aviso de copia y buscar actualizaciones
test/e2e-edicion.mjs  pruebas de color de letra (también de ida y vuelta con Word), tipos de letra, Insertar, selección, navegación con tiempo y mover partes, versiones
test/e2e-word.mjs     pruebas del editor al estilo Word: cinta, estilos, tachado, buscar y reemplazar, zoom
test/e2e-mejoras2.mjs pruebas del tiempo en el editor, «dónde lo he dado» y el aviso de copia de seguridad
test/e2e-mejoras.mjs  pruebas de colores, búsqueda, «voy por aquí», tarjetas, teleprompter, ensayos, grabación, PDF y plantilla
test/biblia.test.mjs  pruebas del detector de citas (sin navegador)
test/unidad.test.mjs  plantilla, tarjetas, partes y colores (sin navegador)
test/docx-colores.test.mjs  los colores del resaltado y de la letra salen bien en el Word
dist/                 lo que se sube a internet (se genera; no editar a mano)
```

## Comandos

- `npm install` — dependencias (mammoth, docx, pdf-lib, esbuild).
- `npm run build` — genera `dist/`. La versión se calcula sola con la huella del contenido, así el service worker detecta cada cambio.
- `npm run serve` — sirve `dist/` en http://localhost:8080 para probar.
- `npm test` — todas las pruebas (con `dist/` servido en el puerto 8080).
- `node test/e2e.mjs` — pruebas (con `dist/` servido en el puerto 8080). Requiere Playwright con Chromium (`npx playwright install chromium`). La ruta del .docx de prueba se pasa con `ATRIL_DOCX=...`.
- `npm run icons` — regenera iconos, banner y vista previa del enlace desde `scripts/arte/icono-original.jpg` y `banner-original.jpg` (imágenes que hizo Ezequiel con IA). Necesita Python con Pillow, numpy y fontTools. El script quita el marco blanco del icono, recorta el atril y lo centra sobre el mismo degradado; la versión maskable de Android lleva más margen.

## Cómo funciona por dentro

- **Datos**: IndexedDB `atril` (versión 3), almacenes `docs` (discursos), `notes` (notas), `versiones` (copias anteriores: `{id, kind, docId, fecha, title, html, motivo}`, las 10 últimas de cada documento; no van en la copia de seguridad) y `grabaciones` (audio de los ensayos: `{id = id del ensayo, kind, docId, fecha, mime, blob, marcas[{i, s}], partes[]}`). Cada documento: `{id, title, html, created, updated, source?, alPC?, fijado?, target?, ensayos?, dado?}`; `source` = nombre del Word del PC y `alPC` = cuándo quedó igual que ese Word (al abrirlo o al guardarlo como Word); `dado` = `[{id, fecha "AAAA-MM-DD", lugar, notas}]` (dónde y cuándo se dio, del más reciente al más antiguo); `ensayos` = `[{id, fecha, seg, objetivoSeg, partes[{t, s, o}], audio}]`, máximo 30, y solo las 5 más recientes conservan audio. Ajustes en `localStorage` bajo `atril.settings` (`ppm` = palabras por minuto al hablar, 130 por defecto, para todas las estimaciones); copia de seguridad: `atril.copia` (última), `atril.cambio` (último cambio en docs/notes, lo apunta `store.put/del`) y `atril.copiaLuego` (aviso aplazado); posición de lectura en `atril.pos.<tipo>.<id>`; «voy por aquí» en `atril.aqui.<tipo>.<id>` (`{i, t}`: índice del bloque y su principio, para encontrarlo si se edita el texto).
- **HTML siempre limpio**: todo lo que entra (Word importado, copia restaurada, lo que guarda el editor) pasa por `sanitize()`, una lista blanca de etiquetas. Convierte `<b>/<i>` en `<strong>/<em>`, los fondos de color en `<mark>` del color más parecido (clase `c-verde`, `c-azul` o `c-rosa`; sin clase = amarillo), parte los resaltados anidados y pasa los `<div>` a `<p>`. El color de la letra (estilo `color`, `<font color>` o de un párrafo) pasa a `<span class="t-rojo|t-azul|t-verde|t-naranja">` según el tono (`claseDeLetra`; negro, gris o blanco = sin color). Prioridad: color en línea > `<font color>` > clase. Un color neutro explícito dentro de un trozo de color (lo que deja «Automático») es `t-auto`: parte el `span` de fuera (`partirAlrededor`) y desaparece. No metas HTML sin pasar por ahí.
- **Importar .docx**: mammoth (`vendor/mammoth.browser.min.js`, cargado bajo demanda) con un `STYLE_MAP` para títulos, subrayado, tachado y resaltado (los colores de Word van a `mark.c-*`). mammoth no lee el color de la letra: `word-colores.js` abre el .docx con jszip, rodea el texto de cada `w:r` con `w:color` de caracteres privados (U+E101–E104 … U+E1FF) y, tras mammoth, `ponerColores()` los cambia por `span.t-*`. Solo el formato directo de cada trozo (no los colores de los estilos de Word).
- **Exportar .docx**: `docx-export.js` usa `htmlToContent` de `docx/html`. Los `<mark>` salen como resaltado de Word: amarillo, verde brillante, turquesa o rosa; los `span.t-*`, con su color de letra (`LETRAS[].hex`, también en el PDF).
- **Exportar PDF**: `pdf-export.js` maqueta el texto con pdf-lib (A4, Times o Helvetica según el ajuste de letra, solo caracteres WinAnsi: lo demás se cambia o se quita). Tamaño 12/16/20 pt y resaltados opcionales. Se entrega con `offerFile` (en una PWA de iOS `window.print()` no es fiable).
- **Guardar archivos en iPad**: se genera el archivo y luego un botón llama a `navigator.share({files})`. Tiene que ir en dos pasos porque Safari solo permite compartir dentro de un toque del usuario. Si no se puede compartir, se descarga.
- **Zoom de letra**: `attachPinch()`. En Safari usa los eventos `gesturestart/gesturechange/gestureend` (con `preventDefault` para que no se amplíe la página). En los demás navegadores usa dos toques con `touchmove`. Ctrl+rueda en ordenador. `captureAnchor/restoreAnchor` mantienen a la vista el párrafo que se estaba leyendo.
- **Citas bíblicas**: `enlazarCitas()` envuelve las citas en `<a class="bref">` solo al mostrar el lector; nunca se guardan en el documento. Exige «capítulo:versículo», salvo en libros de un capítulo («Judas 9»). Código del enlace: libro+capítulo(3)+versículo(3), p. ej. `19037004`; los rangos van con guion. Ajuste `settings.refLinks`: `app` | `web` | `off`.
- **Tiempo**: `item.target` = minutos de objetivo de cada discurso. Si algún título termina en «(N min)», el ritmo se calcula por partes; si no, se reparte el objetivo según las palabras. `palabraActual()` mira qué bloque cruza la línea a un tercio de la pantalla. Avisos: naranja cuando queda ≤ max(1 min, 10 %), rojo al pasarse. En modo atril (barra oculta) aparece un cronómetro flotante que pausa al tocarlo. Lectura estimada a `ppm()` palabras/min (130 por defecto).
- **Esquema**: botón del lector; muestra títulos y frases con `<mark>`, con filtro por color, y «Voy por aquí». Tocar un punto vuelve al texto y lo resalta un momento.
- **Lector, menú ⋯**: buscar (`buscador`, envuelve coincidencias en `span.hit` solo en pantalla), tarjetas (`tarjetas`, capa `#cards`; una por parte según `nivelDeCorte`; deslizar, tocar los lados o teclado/pedal), desplazamiento automático (`prompter`: px/s = alto del texto / palabras × palabras por minuto / 60; el objetivo de tiempo marca la velocidad), ensayos y Word/PDF.
- **Toques en el lector**: uno oculta la barra (con 300 ms de espera), dos seguidos marcan «voy por aquí». Con el desplazamiento automático, un toque pausa.
- **Ensayos**: `ensayo` se engancha al cronómetro. Al arrancar desde cero apunta las partes (`partesDelDiscurso`); en cada tic suma el tiempo a la parte que se lee (`reader.parteActual()`). Al poner a cero (o al abrir otro discurso) se guarda si dura ≥ 30 s. Con `settings.grabar`, graba audio (`grabadora.js`), pausa con el cronómetro y apunta dónde empieza cada parte. `limpiarGrabaciones()` borra al arrancar las grabaciones huérfanas.
- **Plantilla**: «Nuevo discurso → Con plantilla» usa `crearPlantilla()`; el objetivo (`target`) es la duración elegida.
- **Tiempo en el editor** (solo discursos): chip `#editor-time` (en la barra de estado) con `estimarPartes()` (tarjetas.js) al ritmo `ppm()`; naranja si alguna parte se pasa de sus minutos, rojo si el total se pasa. Al tocarlo: desglose por partes, duración objetivo y ritmo (110/130/150 o el real según los ensayos, `ritmoDeEnsayos()`).
- **Dónde lo he dado**: `abrirDado()` (menú ⋯ del lector o de la tarjeta). Avisa si ya se dio en ese lugar (comparando sin acentos con `plegarTexto`). La búsqueda del inicio también mira lugares y notas.
- **Aviso de copia**: `pintarAvisoCopia()` en el inicio si hay cambios y la última copia tiene ≥ 7 días (o nunca se hizo y hay datos de hace ≥ 2 días). «Más tarde» lo aplaza 3 días. `offerFile(..., {onDone})` marca la copia como hecha. Sin discursos ni notas no se hace copia (para no guardar una vacía encima de una buena). Una copia automática fuera del iPad no es posible sin un servicio en la nube (Safari exige un toque para guardar archivos); se pide `navigator.storage.persist()` al arrancar.
- **Word del PC al día** (a petición de Ezequiel: el original está en el PC y al guardar debe sobrescribirse): «Guardar como Word» usa el nombre del archivo original (`item.source`) para que en Archivos salga «Reemplazar», con una nota que lo explica. `sinPasarAlPC(item)` = `updated > alPC`: la tarjeta lleva «Cambiado en el iPad»; al salir del editor tras cambiar un discurso que vino del PC, un aviso ofrece «Guardar Word»; al guardarlo (`onDone` → `marcarEnPC`) se quita. Al volver a abrir el Word del PC con cambios sin pasar, el diálogo de sustituir avisa («Ojo…»), y lo del iPad queda en Versiones anteriores. Los discursos anteriores a esto no tienen `alPC` hasta que se editan (se toma el `updated` de antes de editar).
- **Qué significa cada color** (`abrirLeyenda()`, Ajustes y ⋯ del editor): `settings.leyenda` = `{"m-amarillo": "Ideas clave", "l-rojo": "No saltar", …}` (m- = resaltador, l- = color de letra). Lo elige cada uno en su dispositivo. Se ve en las paletas del editor (`editor.pintarLeyenda()`, botones en forma de píldora con el nombre) y en el filtro del esquema.
- **Actualizaciones**: Ajustes enseña la versión con su fecha (`fechaDeVersion`) y «Buscar actualizaciones» (`buscarActualizaciones()`): pide `sw.js` a internet (el service worker no lo intercepta) y compara su `VERSION` con `APP_VERSION`; si es otra, `reg.update()` y recarga al tomar el control el nuevo (o a los 15 s). Además, al volver a la app tras ≥ 6 h se llama a `reg.update()` (en el iPad la app se queda abierta días).
- **Presentar** (`presentar`): botón principal del lector. Oculta las barras y muestra `#pres-bar` (cronómetro grande, ritmo, «Quedan m:ss» u «Objetivo», la hora (`pintarReloj`, cada 15 s), «Parte X de N», la siguiente y rayas de progreso). Semáforo como los cronómetros de oratoria: verde en marcha, ámbar (`warn`) y rojo (`over`); la barra lleva una raya de ese color y destella (`.destello`) al cambiar. Un toque en el 45 % de abajo del texto avanza una pantalla menos dos líneas y en el 30 % de arriba vuelve (`presentar.toque`, ajuste `presToque`); el resto de toques no hacen nada y las citas no se pueden tocar (no se sale a JW Library). Entrar y salir usan `mantenerSitio()` para no perder el párrafo (arriba del todo se queda arriba). El cronómetro arranca con un toque y se pausa manteniéndolo pulsado; para salir hay que mantener pulsado `#pres-salir`. La primera vez en iPad/iPhone explica «Acceso guiado» (impide salir de la app a nivel del sistema).
- **Volver donde estabas** (`sesion`): mientras se presenta o corre el cronómetro en el lector se guarda `atril.sesion` ({kind, id, enLector, presentando, timer{running, startedAt, elapsed}, t}) al hacer scroll, cada 5 s, al ocultarse la app y al cerrar. Al abrir Atril (inicio o el mismo discurso) con una sesión de menos de 4 h que estaba presentando o con el cronómetro en marcha en el lector, vuelve a ese discurso, restaura el cronómetro (sigue contando con la hora real) y Presentar. Si el usuario sale al inicio él mismo, no se restaura.
- **Botones con nombre** (a petición de Ezequiel): en el lector, `.reader-tools` (Esquema, Letra, Presentar, Editar, Más) va en la barra de arriba en el iPad y fija abajo en el móvil (≤ 700 px). En el iPad en vertical se oculta el título de la barra para que quepan los nombres. El modo atril ya no usa `transform` en la barra (rompería la barra fija de abajo).
- **Inicio, estructura** (ideas de Kindle y Word): `#seguir` = «Seguir donde lo dejaste» con el último discurso abierto (`atril.ultimo` = {kind, id, t}, solo con ≥ 2 discursos y sin búsqueda), «Seguir leyendo» y «Presentar» (`presentarDesdeInicio()`: abre el lector en Presentar desde arriba). Lo leído (0–100) se guarda en `atril.prog.<tipo>.<id>` al guardar la posición y se pinta como `.card-prog`. `item.fijado` = fijado arriba (menú ⋯; los fijados van primero; no cambia `updated`).
- **Panel lateral** (`crearPanel()`, con `mqPanel` = ancho ≥ 1024 px, iPad en horizontal; el iPad de 10,2" mide 1080): en el lector, el esquema al lado del texto (`reader.lateral`, ajuste `panel`); en el editor, la navegación por títulos (`editor.lateral`, ajuste `panelEditor`, Vista → Panel de navegación; en pantallas estrechas sale una hoja «Ir a»). Marca en `.actual` la parte que cruza la línea a un tercio (`bloqueEnLinea()`). Se oculta al presentar. Al girar el iPad se abre o se cierra solo.
- **Barra de estado del lector** (`#reader-estado`, `reader.paintEstado()`): «Parte X de N · título» y «NN % · quedan ≈ M min» (con objetivo, según el plan; si no, palabras restantes a `ppm()`). Se oculta en el esquema a pantalla completa, en modo atril y al presentar.
- **Atajos de teclado**: lector ⌘F/Ctrl+F buscar. Editor (`editor.atajo`): ⌘⌥1–3 títulos, ⌘⌥0 normal, ⌘⇧X tachado, ⌘⌥H resaltar, ⌘⇧8/⌘⇧7 listas, ⌘F buscar, ⌘S guardar; hoja en ⋯ → Atajos de teclado. ⌘H no se usa (en iPad va a la pantalla de inicio).
- **Bienvenida**: si no hay discursos, el inicio explica qué es Atril (3 pasos), con «Abrir un Word», «Probar con un ejemplo» (`crearEjemplo()`) y «¿Cómo paso el Word del PC al iPad?» (`ayudaWord()`).
- **Versiones de un Word**: al abrir un .docx con el mismo nombre de archivo o título que uno guardado, pregunta si sustituirlo (conserva ensayos, objetivo, «dónde lo he dado») o añadirlo como otro.
- **Vista previa del enlace**: metas Open Graph en `index.html` con `icons/og.jpg` (1200×630, en JPEG porque WhatsApp no enseña imágenes pesadas). La URL de la imagen es absoluta (GitHub Pages); si cambia la dirección, cámbiala.
- **Navegación**: rutas en el hash (`#/`, `#/leer/docs/<id>`, `#/editar/notes/<id>`). `route()` ignora navegaciones viejas (`routeSeq`) para que siempre gane la última.
- **Sin conexión**: `sw.js` precachea todos los archivos de `dist/` y sirve `index.html` en cualquier navegación. `_headers` (Netlify) evita que `sw.js` e `index.html` se queden en la caché del navegador.

## Diseño (como Word, a petición de Ezequiel)

- Barra azul (`--bar`, #185abd en el tema claro) en el inicio y en el editor; el lector conserva una barra blanca (modo lectura). No uses el logo ni el nombre de Word: la app es Atril.
- Editor: cinta con pestañas **Inicio** (deshacer, galería de estilos Normal / Título 1 / Título 2 / Título 3, N K S abc, resaltador, **color de letra** «A», listas, borrar formato, buscar), **Insertar** (parte nueva con minutos, minutos de la parte, pausa «‖»), **Revisar** (buscar y reemplazar, palabras y tiempo, versiones anteriores) y **Vista** (modo lectura, panel de navegación, letra más grande o pequeña, letra y tema). Con ≤ 1000 px la cinta se compacta y «buscar» se quita de Inicio (`.solo-ancho`).
- Color de letra (`editor.aplicarLetra`): usa `execCommand("foreColor")` con el color del tema (`--t-rojo`…; «Automático» = `--text`) para que deshacer funcione; al guardar, `sanitize` lo pasa a clases. En pantalla cada tema tiene su tono (`--t-*`), en Word y PDF el de `LETRAS`.
- Insertar: «Parte nueva» mete un título del nivel de las partes (`nivelDeCorte`, H2 si no hay) con «(N min)» después del bloque del cursor; «Minutos de la parte» cambia el «(N min)» del título de la parte del cursor (`tituloDelCursor`); «Pausa» escribe «‖», que el lector destaca con `decorarPausas()` (solo en pantalla).
- Barra de estado del editor: con texto seleccionado, «45 de 279 palabras · ≈ 21 s» (`pintarSeleccion`, al ritmo `ppm()`).
- Panel de navegación del editor: cada título con lo que dura su parte («≈ 2:10 de 2 min», verde si va bien, rojo si se pasa) y flechas para subir o bajar la parte entera (`moverParte`, `finDeSeccion`, `hermanaDe`; con «Deshacer» en el aviso).
- Versiones anteriores (`guardarVersion`, `abrirVersiones`): copia al primer guardado de cada sesión de edición («Antes de editar»), al sustituir por un Word nuevo y al recuperar otra. En Revisar y en ⋯ del editor; se puede ver y recuperar. `limpiarVersiones()` quita las de documentos borrados al arrancar. El texto se edita como una hoja blanca sobre fondo gris (`--canvas`). Abajo, barra de estado con palabras, tiempo estimado y zoom.
- Buscar y reemplazar (`reemplazo`): no toca el documento para resaltar; usa la CSS Custom Highlight API (`::highlight(rep)` y `rep-actual`) y rangos de `rangosCoincidencias()`. Reemplazar cambia el DOM directamente y ofrece «Deshacer» en el aviso (restaura el HTML anterior).
- Títulos de los documentos en azul (`--heading`), como los estilos de Word. «(N min)» de los títulos se ve como etiqueta al margen en el lector (`decorarMinutos()`, solo en pantalla).
- Letras incluidas (sin conexión): Carlito, con las mismas medidas que Calibri («Como Word», la de por defecto) y Literata («Clásica»). Además Arial, Georgia y Verdana, que vienen en el iPad (`settings.font` = `arial` | `georgia` | `verdana`; en el PDF, Helvetica o Times según sea de palo o con remates). La interfaz usa la letra del sistema, como las apps de Office. `settings.estiloWord` marca que ya se cambió la letra a «Como Word» una vez.
- Cabecera del inicio (`.home-hero`): el banner a la derecha (`icons/banner.jpg`, `banner-movil.jpg` en el móvil) a toda la altura, con el nombre en blanco sobre la parte azul; el resto del ancho se rellena con el azul del borde del banner (#0c306d). «Ajustes» va en la fila de las pestañas, no encima del banner.
- Inicio: lista como los recientes de Office (icono de documento, título, duración a la derecha, «Dado el… en…», primera línea si el título es el nombre del archivo). Pestañas con subrayado azul.
- Hojas: en el móvil salen desde abajo; en el iPad, centradas. Menús (`actionSheet`) en lista agrupada (`.menu`). Esquinas pequeñas (4–8 px), como Office.

## Reglas

- Pensada para iPad con Safari (iPadOS 15 o posterior) instalada en la pantalla de inicio. Prueba siempre con el viewport de iPad y con eventos táctiles.
- Botones táctiles de al menos 44 px, textos grandes y sin depender de pasar el ratón por encima.
- No usar `alert/confirm/prompt`: hay diálogos propios (`confirmDialog`, `promptDialog`, `actionSheet`).
- Nada de servidores ni de enviar datos fuera: los discursos y las notas no salen del dispositivo salvo que el usuario los comparta.
- Después de cambiar algo: `npm run build` y pasa las pruebas. Para publicar, haz push a `main`: `.github/workflows/publicar.yml` construye la app y la publica en GitHub Pages (`https://<usuario>.github.io/<repo>/`). Todas las rutas son relativas, así que funciona en una subcarpeta. Alternativa sin GitHub: subir `dist/` a Netlify (ver INSTRUCCIONES.md).

## Ideas pendientes (solo si las pide)

- Sincronizar iPad y móvil (necesitaría un servicio en la nube, p. ej. Firebase con la cuenta de Google de Ezequiel; no hecho).
- Abrir .docx con "Abrir con…" desde Archivos (en iPad las PWA no lo permiten; requeriría app nativa).
