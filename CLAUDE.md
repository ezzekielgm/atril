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
  colores.js          colores del resaltador (<mark> amarillo o class c-verde/c-azul/c-rosa) y clasificación de fondos
  tarjetas.js         división en tarjetas y en partes para los ensayos
  buscar.js           buscar en el texto (sin acentos ni mayúsculas, aunque cruce etiquetas)
  plantilla.js        plantilla de discurso nuevo y reparto de minutos
  grabadora.js        grabación de audio de los ensayos (MediaRecorder)
  pdf-export.js       HTML -> PDF con pdf-lib y letras estándar (se carga solo al exportar)
  docx-export.js      HTML -> .docx (se carga solo al exportar; usa docx + docx/html)
  sw.js               service worker (plantilla: el build mete versión y lista de archivos)
  manifest.webmanifest
  icons/              iconos PNG (se generan con scripts/make-icons.mjs desde scripts/icon.svg)
build.mjs             construye dist/ con esbuild
test/e2e.mjs          prueba de punta a punta con Playwright (Chromium emulando iPad táctil)
test/e2e-funciones.mjs  pruebas de citas, esquema, tiempo objetivo y vista de móvil
test/e2e-presentar.mjs  pruebas de Presentar, volver tras cerrarse la app, sustituir un Word, bienvenida y barra del móvil
test/e2e-word.mjs     pruebas del editor al estilo Word: cinta, estilos, tachado, buscar y reemplazar, zoom
test/e2e-mejoras2.mjs pruebas del tiempo en el editor, «dónde lo he dado» y el aviso de copia de seguridad
test/e2e-mejoras.mjs  pruebas de colores, búsqueda, «voy por aquí», tarjetas, teleprompter, ensayos, grabación, PDF y plantilla
test/biblia.test.mjs  pruebas del detector de citas (sin navegador)
test/unidad.test.mjs  plantilla, tarjetas, partes y colores (sin navegador)
test/docx-colores.test.mjs  los colores del resaltado salen bien en el Word
dist/                 lo que se sube a internet (se genera; no editar a mano)
```

## Comandos

- `npm install` — dependencias (mammoth, docx, pdf-lib, esbuild).
- `npm run build` — genera `dist/`. La versión se calcula sola con la huella del contenido, así el service worker detecta cada cambio.
- `npm run serve` — sirve `dist/` en http://localhost:8080 para probar.
- `npm test` — todas las pruebas (con `dist/` servido en el puerto 8080).
- `node test/e2e.mjs` — pruebas (con `dist/` servido en el puerto 8080). Requiere Playwright con Chromium (`npx playwright install chromium`). La ruta del .docx de prueba se pasa con `ATRIL_DOCX=...`.
- `npm run icons` — regenera los iconos.

## Cómo funciona por dentro

- **Datos**: IndexedDB `atril` (versión 2), almacenes `docs` (discursos), `notes` (notas) y `grabaciones` (audio de los ensayos: `{id = id del ensayo, kind, docId, fecha, mime, blob, marcas[{i, s}], partes[]}`). Cada documento: `{id, title, html, created, updated, source?, target?, ensayos?, dado?}`; `dado` = `[{id, fecha "AAAA-MM-DD", lugar, notas}]` (dónde y cuándo se dio, del más reciente al más antiguo); `ensayos` = `[{id, fecha, seg, objetivoSeg, partes[{t, s, o}], audio}]`, máximo 30, y solo las 5 más recientes conservan audio. Ajustes en `localStorage` bajo `atril.settings` (`ppm` = palabras por minuto al hablar, 130 por defecto, para todas las estimaciones); copia de seguridad: `atril.copia` (última), `atril.cambio` (último cambio en docs/notes, lo apunta `store.put/del`) y `atril.copiaLuego` (aviso aplazado); posición de lectura en `atril.pos.<tipo>.<id>`; «voy por aquí» en `atril.aqui.<tipo>.<id>` (`{i, t}`: índice del bloque y su principio, para encontrarlo si se edita el texto).
- **HTML siempre limpio**: todo lo que entra (Word importado, copia restaurada, lo que guarda el editor) pasa por `sanitize()`, una lista blanca de etiquetas. Convierte `<b>/<i>` en `<strong>/<em>`, los fondos de color en `<mark>` del color más parecido (clase `c-verde`, `c-azul` o `c-rosa`; sin clase = amarillo), parte los resaltados anidados y pasa los `<div>` a `<p>`. No metas HTML sin pasar por ahí.
- **Importar .docx**: mammoth (`vendor/mammoth.browser.min.js`, cargado bajo demanda) con un `STYLE_MAP` para títulos, subrayado, tachado y resaltado (los colores de Word van a `mark.c-*`).
- **Exportar .docx**: `docx-export.js` usa `htmlToContent` de `docx/html`. Los `<mark>` salen como resaltado de Word: amarillo, verde brillante, turquesa o rosa.
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
- **Aviso de copia**: `pintarAvisoCopia()` en el inicio si hay cambios y la última copia tiene ≥ 14 días (o nunca se hizo y hay datos de hace ≥ 7 días). «Más tarde» lo aplaza 3 días. `offerFile(..., {onDone})` marca la copia como hecha.
- **Presentar** (`presentar`): botón principal del lector. Oculta las barras y muestra `#pres-bar` (cronómetro grande, ritmo, «Parte X de N», la siguiente y rayas de progreso). Los toques sobre el texto no hacen nada y las citas no se pueden tocar (no se sale a JW Library). El cronómetro arranca con un toque y se pausa manteniéndolo pulsado; para salir hay que mantener pulsado `#pres-salir`. La primera vez en iPad/iPhone explica «Acceso guiado» (impide salir de la app a nivel del sistema).
- **Volver donde estabas** (`sesion`): mientras se presenta o corre el cronómetro en el lector se guarda `atril.sesion` ({kind, id, enLector, presentando, timer{running, startedAt, elapsed}, t}) al hacer scroll, cada 5 s, al ocultarse la app y al cerrar. Al abrir Atril (inicio o el mismo discurso) con una sesión de menos de 4 h que estaba presentando o con el cronómetro en marcha en el lector, vuelve a ese discurso, restaura el cronómetro (sigue contando con la hora real) y Presentar. Si el usuario sale al inicio él mismo, no se restaura.
- **Botones con nombre** (a petición de Ezequiel): en el lector, `.reader-tools` (Esquema, Letra, Presentar, Editar, Más) va en la barra de arriba en el iPad y fija abajo en el móvil (≤ 700 px). En el iPad en vertical se oculta el título de la barra para que quepan los nombres. El modo atril ya no usa `transform` en la barra (rompería la barra fija de abajo).
- **Bienvenida**: si no hay discursos, el inicio explica qué es Atril (3 pasos), con «Abrir un Word», «Probar con un ejemplo» (`crearEjemplo()`) y «¿Cómo paso el Word del PC al iPad?» (`ayudaWord()`).
- **Versiones de un Word**: al abrir un .docx con el mismo nombre de archivo o título que uno guardado, pregunta si sustituirlo (conserva ensayos, objetivo, «dónde lo he dado») o añadirlo como otro.
- **Vista previa del enlace**: metas Open Graph en `index.html` con `icons/og.png` (1200×630). La URL de la imagen es absoluta (GitHub Pages); si cambia la dirección, cámbiala.
- **Navegación**: rutas en el hash (`#/`, `#/leer/docs/<id>`, `#/editar/notes/<id>`). `route()` ignora navegaciones viejas (`routeSeq`) para que siempre gane la última.
- **Sin conexión**: `sw.js` precachea todos los archivos de `dist/` y sirve `index.html` en cualquier navegación. `_headers` (Netlify) evita que `sw.js` e `index.html` se queden en la caché del navegador.

## Diseño (como Word, a petición de Ezequiel)

- Barra azul (`--bar`, #185abd en el tema claro) en el inicio y en el editor; el lector conserva una barra blanca (modo lectura). No uses el logo ni el nombre de Word: la app es Atril.
- Editor: cinta con pestañas **Inicio** (deshacer, galería de estilos Normal / Título 1 / Título 2 / Título 3, N K S abc, resaltador, listas, borrar formato, buscar), **Revisar** (buscar y reemplazar, palabras y tiempo) y **Vista** (modo lectura, letra más grande o pequeña, letra y tema). El texto se edita como una hoja blanca sobre fondo gris (`--canvas`). Abajo, barra de estado con palabras, tiempo estimado y zoom.
- Buscar y reemplazar (`reemplazo`): no toca el documento para resaltar; usa la CSS Custom Highlight API (`::highlight(rep)` y `rep-actual`) y rangos de `rangosCoincidencias()`. Reemplazar cambia el DOM directamente y ofrece «Deshacer» en el aviso (restaura el HTML anterior).
- Títulos de los documentos en azul (`--heading`), como los estilos de Word. «(N min)» de los títulos se ve como etiqueta al margen en el lector (`decorarMinutos()`, solo en pantalla).
- Letras incluidas (sin conexión): Carlito, con las mismas medidas que Calibri («Como Word», la de por defecto) y Literata («Clásica»). La interfaz usa la letra del sistema, como las apps de Office. `settings.estiloWord` marca que ya se cambió la letra a «Como Word» una vez.
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
