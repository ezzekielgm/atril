# Atril: cómo ponerla en tu iPad

Atril es tu app para leer discursos con letra grande, retocarlos y tomar notas. Es gratis, funciona sin internet y todo se guarda en tu iPad.

## 1. Publicarla

La app se publica sola en GitHub Pages cada vez que hay cambios en GitHub (archivo `.github/workflows/publicar.yml`). La dirección queda así: `https://TU-USUARIO.github.io/atril/`.

La dirección es pública, pero solo contiene la app vacía: tus discursos y notas nunca salen de tu iPad.

*Alternativa sin GitHub:* ejecuta `npm install` y `npm run build`, entra en https://app.netlify.com/drop, arrastra la carpeta `dist` y reclama el sitio en menos de una hora.

## 2. Instalarla en el iPad

1. Abre esa dirección en **Safari** (tiene que ser Safari).
2. Toca **Compartir** (el cuadrado con la flecha hacia arriba) → **Añadir a pantalla de inicio** → **Añadir**.
3. Ábrela desde el icono nuevo. La primera vez, con internet. A partir de ahí funciona también sin conexión.

## 3. Cómo se usa

**Discursos**
- **Abrir Word**: eliges un .docx desde Archivos, iCloud, OneDrive o el correo (guardado antes en Archivos). Lo más cómodo: prepáralo en el PC, guárdalo en OneDrive o iCloud Drive y ábrelo desde el iPad. Si lo cambias en el PC y lo abres otra vez, Atril te ofrece **sustituir la versión anterior** sin perder ensayos, duración ni dónde lo has dado.
- **Seguir donde lo dejaste**: arriba de la lista sale el último discurso que abriste, con lo que llevas leído. «Seguir leyendo» vuelve al sitio; «Presentar» lo abre ya en modo Presentar, desde el principio. Cada discurso lleva abajo una rayita con lo leído.
- **Fijar arriba** (botón ⋯ de un discurso o nota): lo deja el primero de la lista mientras lo preparas. «Quitar de arriba» lo devuelve a su sitio.
- **Presentar** (el botón azul): para dar el discurso. Cronómetro grande, cuánto **queda** para tu objetivo, la **hora**, en qué parte vas y cuál sigue. El cronómetro va como un semáforo: **verde** mientras hay tiempo, **ámbar** en el último minuto y **rojo** si te pasas (la barra parpadea al cambiar de color). Toca el cronómetro para empezar; para pausarlo, mantenlo pulsado. **Para pasar página, toca la parte de abajo de la pantalla; para volver, la de arriba** (se puede quitar en Ajustes). Los demás toques no hacen nada y el gesto o el botón de «atrás» tampoco te saca del discurso. **Para salir, toca el centro de la pantalla**: aparece «Mantén pulsado para salir»; mantén el dedo hasta que se llene. Si aun así la app se cierra, al abrirla vuelves al mismo sitio con el cronómetro en marcha.
- **Acceso guiado** (recomendado en el atril): el gesto de ir a la pantalla de inicio es del iPad y ninguna app lo puede bloquear. Para eso: Ajustes → Accesibilidad → Acceso guiado (actívalo y pon un código). En Atril, pulsa tres veces el botón de inicio (o el superior) e Iniciar. Así el iPad no puede salir de la app. Para terminar, pulsa tres veces y escribe el código. En Android: «Fijar aplicaciones».
- **Leer**: separa dos dedos sobre el texto para agrandar la letra y pellízcalo para achicarla. El texto se recoloca solo, como en una web de móvil.
- **Un toque en el texto** oculta la barra de arriba para tener toda la pantalla. Otro toque la devuelve.
- **Dos toques en un párrafo** lo marcan como «Voy por aquí» (una raya azul a la izquierda). Se recuerda al volver a abrir y sale en el esquema. Dos toques otra vez lo quitan.
- **Letra**: tamaño, tema (claro, sepia u oscuro), tipo de letra (Como Word, Clásica, Arial, Georgia o Verdana) e interlineado.
- **Cronómetro**: tócalo para empezar o pararlo. Con la flecha circular vuelve a cero.
- La pantalla no se apaga mientras lees (se puede desactivar en Ajustes).
- **Citas bíblicas**: las citas como «Sal 37:4» o «1 Cor. 13:4-7» salen subrayadas; tócalas para abrir el versículo en JW Library (en Ajustes puedes elegir jw.org o quitar los enlaces).
- **Esquema**: muestra solo los títulos y lo que hayas resaltado. Toca un punto para ir a esa parte del texto. Arriba puedes filtrar: solo títulos o solo un color. **Con el iPad en horizontal sale al lado del texto** (como el panel de navegación de Word) y marca la parte por la que vas; el botón «Esquema» o la ✕ lo cierran.
- **Barra de abajo**: en qué parte vas, cuánto has leído y cuántos minutos quedan (según tu objetivo, o a tu ritmo al hablar si no tiene).
- **Duración del discurso** (en **T**): pon los minutos que tienes. Con el cronómetro en marcha verás «Adelantado», «En tiempo» o «Retrasado»; se pone naranja cuando queda poco y rojo si te pasas. Si un título termina en «(5 min)», calcula el ritmo por partes.
- Con la barra oculta queda un cronómetro pequeño abajo a la derecha; tócalo para pausar.
- **Lápiz**: editar, como en Word: arriba las pestañas **Inicio** (estilos Normal, Título 1, 2 y 3, negrita, cursiva, subrayado, tachado, resaltador y listas), **Revisar** (buscar y reemplazar) y **Vista** (modo lectura y tamaño de letra). Abajo, las palabras y el zoom. Se guarda solo mientras escribes. Con el iPad en horizontal, a la izquierda sale el **panel de navegación** con los títulos (Vista → Panel de navegación lo quita o lo pone). Con teclado: ⌘⌥1, 2 o 3 para los títulos, ⌘⌥0 texto normal, ⌘⇧X tachado, ⌘⌥H resaltar, ⌘F buscar (la lista completa en ⋯ → Atajos de teclado). Abajo verás también **≈ 7 / 10 min**: lo que durará al ritmo al que hablas y tu objetivo. Se pone naranja si una parte se pasa de sus minutos y rojo si te pasas en total. Tócalo para ver cada parte, cambiar el objetivo o ajustar tu ritmo (incluso el real, sacado de tus ensayos). El **marcador** abre los colores (amarillo, verde, azul y rosa): selecciona el texto y toca un color. Con el cursor dentro de un resaltado, otro color lo cambia y «Quitar» lo borra. Los colores se respetan al abrir y al guardar en Word.
- **Color de letra** (la **A** con una raya de color, al lado del marcador): selecciona el texto y elige rojo, azul, verde o naranja; «Automático» lo devuelve al color normal. Si en el Word del PC pones palabras de color, en Atril salen igual, y al guardar como Word o PDF también.
- **Insertar**: **Parte nueva** (un título con sus minutos, después del párrafo donde estás), **Minutos de la parte** (pone o cambia el «(5 min)» de la parte donde tienes el cursor) y **Pausa** (escribe ‖, que al leer sale destacada en azul).
- **Seleccionar texto** dice abajo cuántas palabras son y cuánto tardas en decirlas («45 de 279 palabras · ≈ 21 s»).
- **Panel de navegación** (iPad en horizontal): cada parte dice lo que dura (en verde si cuadra con sus minutos, en rojo si se pasa) y tiene flechas para **subirla o bajarla entera**. Si te equivocas, «Deshacer» en el aviso.
- **Versiones anteriores** (Revisar, o ⋯): Atril guarda una copia cada vez que empiezas a editar un discurso, cuando lo cambias por un Word nuevo y cuando recuperas otra. Puedes verlas y recuperar la que quieras (la que tenías también se guarda). Se quedan las 10 últimas.

**El botón ⋯ del lector**
- **Buscar en el texto**: da igual mayúsculas o acentos («pasion» encuentra «pasión»). Las flechas van de una a otra.
- **Tarjetas**: una parte del discurso por pantalla, con letra grande. Desliza el dedo o toca a la derecha o a la izquierda para pasar. Funciona también con un teclado o un pedal de pasar páginas.
- **Desplazamiento automático**: el texto sube solo, al ritmo de tu objetivo de tiempo (o a 130 palabras por minuto). Abajo tienes pausa, más despacio, más deprisa y terminar. Un toque en el texto también pausa.
- **Ensayos**: cada vez que pones el cronómetro a cero después de al menos 30 segundos se guarda el ensayo, con el tiempo total y el de cada parte, comparado con tu objetivo. Si activas **Grabar audio al ensayar**, se graba tu voz mientras corre el cronómetro; luego puedes escucharla, saltar a cada parte y guardarla en Archivos. Se guardan las 5 últimas grabaciones de cada discurso, solo en el iPad.
- **Apuntar que lo he dado**: fecha, lugar y notas. Si pones un lugar donde ya lo diste, te avisa. En la lista de discursos verás «Dado 2 veces · último…», y en el buscador del inicio puedes escribir un lugar para saber qué discursos has dado allí.
- **Compartir**: ver más abajo.
- **Guardar como Word** o **como PDF** (para imprimir; puedes elegir letra normal, grande o muy grande). Después, **Guardar en Archivos** o mandarlo por correo o WhatsApp.

**Discurso nuevo con plantilla**
En **Nuevo discurso → Con plantilla** pones el título, los minutos y cuántos puntos tiene. Atril prepara la introducción, los puntos y la conclusión con los minutos repartidos (10 % para la introducción, 10 % para la conclusión y el resto entre los puntos), y cada punto con texto bíblico, explicación, ilustración y aplicación.

**Notas**
- **Nueva nota**: título y texto. Se guarda sola.
- Para pasármelas: **⋯ → Compartir → Otra app** y eliges la app de Claude, o **Copiar el texto** y lo pegas en el chat.
- También puedes guardarla como Word directamente.

**Compartir** (⋯ de cada discurso o nota, «Compartir» en el lector, o el botón de compartir del editor)
- **Como texto**: **WhatsApp** (se abre WhatsApp con el texto escrito y eliges el chat), **Otra app** (correo, Mensajes, Telegram, Notas, Claude…) o **Copiar el texto**. Sale con las negritas y cursivas de WhatsApp (\*así\*, \_así\_); el interruptor las quita.
- **Como archivo**: **Word** o **PDF**, para mandarlo tal cual se ve.

**Guía de Atril** (botón «Guía», al lado de Ajustes)
Explica cada función y dónde está, por apartados. Pensada para quien la estrena: recomiéndasela a quien se la pases.

**Copia de seguridad** (rueda dentada → Hacer copia de seguridad)
Haz una de vez en cuando y guárdala en Archivos o iCloud. **Si borras el icono de la app, se borran sus datos**, y con la copia los recuperas (Restaurar una copia). Si pasan más de 14 días sin copia y has cambiado algo, Atril te lo recuerda al abrirla. La copia lleva los discursos, las notas, los objetivos de tiempo, el historial de ensayos y dónde los has dado; las grabaciones de audio no (guárdalas aparte si quieres conservarlas).

## 4. Cuando haya una versión nueva

Cada cambio que se sube a GitHub se publica solo en unos minutos. Al abrir Atril en el iPad saldrá «Hay una versión nueva» → **Actualizar**. Tus datos no se tocan.

## 5. Seguir mejorándola con Claude Code en tu PC

1. El proyecto está en `C:\Users\ermak\Proyectos\Atril`.
2. En PowerShell, dentro de esa carpeta: `npm install` y luego `claude`.
3. Pídele lo que quieras. El archivo CLAUDE.md le explica cómo está hecha.
4. Cuando funcione, que lo suba a GitHub (`git push`) y se publica solo.

## El Word del PC, la copia de seguridad y las actualizaciones

- **El original está en el PC.** Cuando retocas en el iPad un discurso que vino de un Word, la tarjeta dice **«Cambiado en el iPad»** y, al salir del editor, Atril te ofrece **«Guardar Word»**. El Word sale **con el mismo nombre** que el del PC: en *Guardar en Archivos* elige la misma carpeta de OneDrive (o iCloud) y toca **«Reemplazar»**. Si lo tienes abierto en el PC, ciérralo antes. Si vuelves a abrir el Word del PC sin haber pasado los cambios, Atril te avisa, y lo del iPad queda en *Versiones anteriores*.
- **Qué significa cada color** (Ajustes): ponle a cada color lo que significa para ti (p. ej. amarillo = ideas clave, rojo = no saltar). Sale en los colores del editor y en el filtro del esquema. Cada persona lo elige en su propio iPad.
- **Copia de seguridad**: Atril guarda solo cada cambio en el iPad, pero si se borra la app se pierde todo. Te recuerda la copia **cada semana** si has cambiado algo. Guárdala en OneDrive o iCloud.
- **Actualizaciones**: en Ajustes ves la versión que tienes y el botón **«Buscar actualizaciones»**. Además, Atril mira solo si hay una nueva cuando vuelves a la app después de unas horas.

## Apple Pencil y voz

- **Escribir a mano y que se convierta en letra**: escribe con el Apple Pencil directamente sobre el texto del editor y el iPad lo pasa a letra. Tiene que estar activado en *Ajustes del iPad → Apple Pencil → Escribir a mano*. Funciona en español.
- **Dibujar o dejar la letra a mano**: en el editor, *Insertar → Dibujo o a mano*. Tienes bolígrafo (con el lápiz, engorda al apretar), rotulador, goma, 4 colores y 3 grosores, deshacer, «Más espacio» y «Borrar todo». En cuanto usas el lápiz, el dedo solo mueve la hoja, así que puedes apoyar la mano. Al tocar «Hecho» se mete en el texto; tócalo para cambiarlo o quitarlo. Sale también al leer, en Presentar, y en Word y PDF como imagen.
- **Nota a mano**: en *Notas → Nota a mano* se abre directamente la hoja y se guarda como nota.
- **Dictar**: en *Notas → Dictar* (o *Insertar → Dictar* en el editor) se abre el teclado: toca su **micrófono** y habla. Di «coma», «punto» o «nuevo párrafo». Con teclado físico, pulsa dos veces la tecla 🌐 o Fn. (Apple no deja que las apps web de la pantalla de inicio usen su propio botón de dictado, por eso se usa el del teclado.)

