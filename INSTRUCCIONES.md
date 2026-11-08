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
- **Abrir Word**: eliges un .docx desde Archivos, iCloud, OneDrive o el correo (guardado antes en Archivos).
- **Leer**: separa dos dedos sobre el texto para agrandar la letra y pellízcalo para achicarla. El texto se recoloca solo, como en una web de móvil.
- **Un toque en el texto** oculta la barra de arriba para tener toda la pantalla. Otro toque la devuelve.
- **Dos toques en un párrafo** lo marcan como «Voy por aquí» (una raya azul a la izquierda). Se recuerda al volver a abrir y sale en el esquema. Dos toques otra vez lo quitan.
- **T**: tamaño, tema (claro, sepia u oscuro), tipo de letra e interlineado.
- **Cronómetro**: tócalo para empezar o pararlo. Con la flecha circular vuelve a cero.
- La pantalla no se apaga mientras lees (se puede desactivar en Ajustes).
- **Citas bíblicas**: las citas como «Sal 37:4» o «1 Cor. 13:4-7» salen subrayadas; tócalas para abrir el versículo en JW Library (en Ajustes puedes elegir jw.org o quitar los enlaces).
- **Esquema** (botón de las tres rayas): muestra solo los títulos y lo que hayas resaltado. Toca un punto para ir a esa parte del texto. Arriba puedes filtrar: solo títulos o solo un color.
- **Duración del discurso** (en **T**): pon los minutos que tienes. Con el cronómetro en marcha verás «Adelantado», «En tiempo» o «Retrasado»; se pone naranja cuando queda poco y rojo si te pasas. Si un título termina en «(5 min)», calcula el ritmo por partes.
- Con la barra oculta queda un cronómetro pequeño abajo a la derecha; tócalo para pausar.
- **Lápiz**: editar. Se guarda solo mientras escribes. El **marcador** abre los colores (amarillo, verde, azul y rosa): selecciona el texto y toca un color. Con el cursor dentro de un resaltado, otro color lo cambia y «Quitar» lo borra. Los colores se respetan al abrir y al guardar en Word.

**El botón ⋯ del lector**
- **Buscar en el texto**: da igual mayúsculas o acentos («pasion» encuentra «pasión»). Las flechas van de una a otra.
- **Tarjetas**: una parte del discurso por pantalla, con letra grande. Desliza el dedo o toca a la derecha o a la izquierda para pasar. Funciona también con un teclado o un pedal de pasar páginas.
- **Desplazamiento automático**: el texto sube solo, al ritmo de tu objetivo de tiempo (o a 130 palabras por minuto). Abajo tienes pausa, más despacio, más deprisa y terminar. Un toque en el texto también pausa.
- **Ensayos**: cada vez que pones el cronómetro a cero después de al menos 30 segundos se guarda el ensayo, con el tiempo total y el de cada parte, comparado con tu objetivo. Si activas **Grabar audio al ensayar**, se graba tu voz mientras corre el cronómetro; luego puedes escucharla, saltar a cada parte y guardarla en Archivos. Se guardan las 5 últimas grabaciones de cada discurso, solo en el iPad.
- **Guardar como Word** o **como PDF** (para imprimir; puedes elegir letra normal, grande o muy grande). Después, **Guardar en Archivos** o mandarlo por correo o WhatsApp.

**Discurso nuevo con plantilla**
En **Nuevo discurso → Con plantilla** pones el título, los minutos y cuántos puntos tiene. Atril prepara la introducción, los puntos y la conclusión con los minutos repartidos (10 % para la introducción, 10 % para la conclusión y el resto entre los puntos), y cada punto con texto bíblico, explicación, ilustración y aplicación.

**Notas**
- **Nueva nota**: título y texto. Se guarda sola.
- Para pasármelas: **⋯ → Compartir el texto** y eliges la app de Claude, o **Copiar el texto** y lo pegas en el chat.
- También puedes guardarla como Word directamente.

**Copia de seguridad** (rueda dentada → Hacer copia de seguridad)
Haz una de vez en cuando y guárdala en Archivos o iCloud. **Si borras el icono de la app, se borran sus datos**, y con la copia los recuperas (Restaurar una copia). La copia lleva los discursos, las notas, los objetivos de tiempo y el historial de ensayos; las grabaciones de audio no (guárdalas aparte si quieres conservarlas).

## 4. Cuando haya una versión nueva

Cada cambio que se sube a GitHub se publica solo en unos minutos. Al abrir Atril en el iPad saldrá «Hay una versión nueva» → **Actualizar**. Tus datos no se tocan.

## 5. Seguir mejorándola con Claude Code en tu PC

1. El proyecto está en `C:\Users\ermak\Proyectos\Atril`.
2. En PowerShell, dentro de esa carpeta: `npm install` y luego `claude`.
3. Pídele lo que quieras. El archivo CLAUDE.md le explica cómo está hecha.
4. Cuando funcione, que lo suba a GitHub (`git push`) y se publica solo.
