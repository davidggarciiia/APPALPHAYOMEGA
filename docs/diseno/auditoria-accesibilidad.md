# Auditoría de diseño y accesibilidad de `Design.html`

Revisión de las 17 pantallas exportadas de Claude Design contra las
[Web Interface Guidelines de Vercel](https://github.com/vercel-labs/web-interface-guidelines)
(skill `web-design-guidelines` de `vercel-labs/agent-skills`, reglas descargadas el 24-09-2026).
Los contrastes se han calculado con la fórmula de WCAG 2.2.

## Cómo leer las líneas

`Design.html` es un paquete: cada pantalla va comprimida dentro. Las pantallas desempaquetadas
están en [`pantallas/`](pantallas/), con el nombre que tienen en Claude Design (sale de los
enlaces entre ellas). La única sin enlace es `NutricionSinNutricionista.dc.html`; ese nombre es
inventado. Las líneas `archivo:línea` apuntan a esos archivos.

- Las líneas 10–127 de cada pantalla son las fuentes que el exportador mete en línea. En tu
  proyecto de Claude Design las líneas pueden estar desplazadas, así que cada hallazgo cita
  también el texto del elemento.
- Lo marcado **(web)** solo aplica si la pantalla se sirve en navegador, como los paneles de
  entrenador y nutricionista. En la app Expo (`apps/mobile`) los atributos ARIA se traducen a
  `accessibilityRole`, `accessibilityState` y `accessibilityLabel`, pero el problema es el mismo.

## Lo que ya está bien

- `lang="es"` en todas las pantallas.
- Anillo de foco global con `:focus-visible` (`Main.dc.html:135`), sin `outline: none` en ningún sitio.
- `prefers-reduced-motion` respetado en las animaciones (`Main.dc.html:139`, `Sesion.dc.html:139`).
- **Contraste de texto aprobado en todas las combinaciones.** El gris secundario `#A39C8F` da
  5,75:1 en el peor fondo y el placeholder `#948D80` da 4,76:1.
- Los botones solo con icono tienen `aria-label` y los SVG decorativos llevan `aria-hidden`.
- Los campos numéricos usan `inputmode`.
- No hay bloqueo de zoom, ni `transition: all`, ni `onPaste` que impida pegar.

---

## P1 · Crítico: bloquea a quien usa lector de pantalla o teclado

1. **Los selectores de una sola opción no dicen cuál está elegida.** Solo el botón activo lleva
   `aria-pressed="true"`. El resto no lleva `aria-pressed`, así que el lector de pantalla no los
   anuncia como conmutables. En el RIR no hay estado en ningún botón. Deben ser un grupo de radio:
   `<fieldset>` + `<legend>` + `<input type="radio">`, o `role="radiogroup"` con `role="radio"` y
   `aria-checked`. En React Native, `accessibilityRole="radio"` y `accessibilityState={{ checked }}`.
   - `Sesion.dc.html:224-230`: RIR 0…5+ de la serie 3. El «3» elegido solo se ve por el borde. **Es el peor caso.**
   - `Checkin.dc.html:150-155`: «¿Cómo te sientes?» 1–5.
   - `Checkin.dc.html:162-165`: «¿Algo te molesta?».
   - `Cierre.dc.html:164-169`: «¿Cómo terminas?» 1–5.
   - `Cierre.dc.html:176-178`: «Todo bien» / «Algo incómodo».
   - `Molestia.dc.html:163-168`: «Zona». Tampoco tiene nombre de grupo, porque «Zona» es un `<span>` suelto en `:162`.
   - `Molestia.dc.html:179-182`: «Qué notas». Es de opción múltiple, así que van casillas (`checkbox`).
   - `Plan.dc.html:153-158`: días L…V.
   - `NutricionComida.dc.html:165-179`: alimentos del grupo.
   - `NutricionOpciones.dc.html:154-192`: aquí sí hay `aria-pressed` en todos, pero es de elección única y debería ser radio.
   - Las etiquetas de los extremos («Agotado / A tope», «Vacío / Con energía») no están asociadas al
     grupo, así que se oye «1», «2»… sin saber qué significan: `Checkin.dc.html:157`, `Cierre.dc.html:171`.

2. **Tablas de datos maquetadas con `<div>` en rejilla.** El lector no puede relacionar cada
   celda con su cabecera. Deben usar `<table>` con `<th scope="col">` y `<th scope="row">`.
   - `EntrenadorFicha.dc.html:208-219`: Ejercicio / Prescrito / Sugerido / Hecho / RIR / Próxima vez.
   - `EntrenadorConstructor.dc.html:198-207`: Series / Reps / RIR / Descanso / Carga / Subida.
   - `Sesion.dc.html:196-241`: Serie / Kg / Reps / RIR. Es más leve, porque cada input tiene `aria-label`.
   - `PlanBloque.dc.html:184-188`: tabla de la semana (día × parte de la sesión).

3. **En el constructor, elegir un ejercicio no se puede hacer con teclado.** La fila activa
   `EntrenadorConstructor.dc.html:201` («Press banca con barra») solo se distingue por el fondo, y
   es la que alimenta el panel lateral `:215`. Pero las filas son `<span>`, no elementos
   interactivos. Hace falta un `<button>` o enlace por fila con `aria-current`/`aria-selected`.

4. **La semana de Inicio no tiene texto alternativo.** En `Main.dc.html:181-187`, los puntos que
   indican entreno de fuerza u otro deporte son `<span>` vacíos. El lector solo oye «L 28, M 29…»
   sin saber qué se hizo cada día. Añade texto oculto, por ejemplo «lunes 28: fuerza hecha».

5. **Controles invisibles por contraste no textual.** El borde `#3A362F` sobre la tarjeta
   `#1A1916` da **1,46:1**, y WCAG 1.4.11 pide 3:1. El círculo vacío es lo único que dice que ahí
   hay un control.
   - `Nutricion.dc.html:162, 166, 170, 179`: casillas de Comida, Snack, Cena y Creatina.
   - `NutricionSinNutricionista.dc.html:162`: Creatina.
   - `Sesion.dc.html:240`: «Confirmar serie 4», que es una caja vacía (1,62:1).
   - `NutricionistaFicha.dc.html:223`: fondo del interruptor apagado. El tirador sí se ve.

## P2 · Alto

6. **Acciones que envían datos hechas con `<a href>`.** Sin `<button type="submit">` dentro de un
   `<form>` no hay envío con Enter, ni estado «Enviando…», y el doble envío es posible. Además el
   lector anuncia «enlace».
   - `Checkin.dc.html:171`: «Empezar» (guarda el check-in).
   - `Sesion.dc.html:148`: «Terminar».
   - `Molestia.dc.html:187`: «Avisar a mi entrenador».
   - `Molestia.dc.html:158`: «Cerrar» del diálogo.
   - `Cierre.dc.html:192`: «Enviar».
   - `NutricionComida.dc.html:156`: «Hecho».
   - `NutricionOpciones.dc.html:194`: «Hecho».

7. **Acciones irreversibles sin confirmación ni aviso de cambios sin guardar.**
   - `Sesion.dc.html:148`: «Terminar» cierra la sesión de golpe. Necesita confirmación o una ventana para deshacer.
   - `Sesion.dc.html:146`: «Volver» sale de una sesión a medias sin avisar.
   - `Molestia.dc.html:158`: «Cerrar» descarta lo marcado.
   - `EntrenadorConstructor.dc.html:164`: «Publicar» cambia el plan del cliente. Pide confirmación y guarda contra la navegación, porque hay nota editable en `:219`.
   - `NutricionistaFicha.dc.html:162`: «Publicar cambios». Mismo caso, con los campos de `:194`, `:206` y `:232`.

8. **Pestañas mal construidas.**
   - Enlaces disfrazados de pestaña: `<a href role="tab">` anuncia «pestaña 1 de 3», pero navega
     a otra página y no responde a las flechas. Debe ser `<nav>` con enlaces y `aria-current="page"`.
     Pasa en `Plan.dc.html:146-150`, `Guia.dc.html:147-150` y `PlanBloque.dc.html:147-150`.
   - Pestañas reales (botones) sin `aria-controls`, sin `role="tabpanel"`, sin `tabindex="-1"` en
     las inactivas y sin navegación con flechas:
     - `Progreso.dc.html:147-151`
     - `NutricionComida.dc.html:159-163`
     - `NutricionOpciones.dc.html:148-152`
     - `EntrenadorFicha.dc.html:167-174`
     - `EntrenadorConstructor.dc.html:180-186`
     - `NutricionistaFicha.dc.html:165-169`

9. **El diálogo «Molestia» está incompleto** (`Molestia.dc.html:150`). Le faltan `aria-modal="true"`,
   mover el foco dentro al abrir, atrapar el foco y cerrar con Esc. El velo de `:148` también debería
   ocultarse a la tecnología de apoyo. Como es una hoja inferior, añade `overscroll-behavior: contain`
   y `padding-bottom: calc(32px + env(safe-area-inset-bottom))`.

10. **Información que solo se transmite con color.**
    - `Sesion.dc.html:210`: RIR «2» en ámbar, sin texto que explique que está por debajo del objetivo.
    - `EntrenadorFicha.dc.html:211`: RIR «2» en ámbar.
    - `EntrenadorFicha.dc.html:212`: «22 × 10» en ámbar (bajó por la molestia).
    - `Nutricion.dc.html:163`: la comida que toca, «Comida», solo va en amarillo.
    - `EntrenadorConstructor.dc.html:171-174`: la fase actual solo por el color del borde. Usa `aria-current="step"`.
    - `PlanBloque.dc.html:175`: la semana actual.
    - `PlanBloque.dc.html:184`: el día actual.

11. **Cambios en vivo que no se anuncian.** Faltan `aria-live="polite"` o `role="timer"`/`role="status"`.
    - `Sesion.dc.html:147`: cronómetro «34:12» sin nombre. Ponle `aria-label="Tiempo de sesión"` y no lo anuncies cada segundo.
    - `Sesion.dc.html:174`: cuenta atrás del descanso «1:24». Hay que avisar cuando termina.
    - `Molestia.dc.html:187`: tras avisar no hay confirmación («Aviso enviado»).
    - `NutricionistaFicha.dc.html:195`: el gasto total se recalcula al cambiar el factor, sin anunciarlo.
    - `NutricionistaFicha.dc.html:208`: lo mismo con el déficit al cambiar las calorías.

## P3 · Medio

12. **La navegación no marca la página actual** (falta `aria-current="page"`).
    - Barra inferior:
      - `Main.dc.html:207`
      - `Plan.dc.html:223`
      - `Guia.dc.html:190`
      - `Nutricion.dc.html:200`
      - `NutricionSinNutricionista.dc.html:171`
      - `Progreso.dc.html:202`
      - `PlanBloque.dc.html:213`
    - Menú lateral: `EntrenadorFicha.dc.html:145`, `EntrenadorConstructor.dc.html:146`,
      `NutricionistaFicha.dc.html:145`.

13. **Casillas «hecho» con el estado metido en el nombre.** «Comida sin marcar» + `aria-pressed="false"`
    se oye como «Comida sin marcar, no pulsado». El nombre debe ser fijo («Comida») y el estado ir solo
    en `aria-pressed`, o mejor, en un `checkbox`. Además, el texto al lado del círculo de 32 px no forma
    parte del área táctil.
    - `Nutricion.dc.html:154, 158, 162, 166, 170, 179`
    - `NutricionSinNutricionista.dc.html:162-163`
    - `Sesion.dc.html:203, 211`: «Serie 1 hecha», sin `aria-pressed`.
    - `Sesion.dc.html:220`
    - `Main.dc.html:201`: «Marcar» creatina. Sin estado y con un nombre genérico.

14. **Campos sin borde visible.** El fondo del campo contra el de la tarjeta da entre 1,10:1 y 1,12:1.
    - `Sesion.dc.html:200-202, 208-210, 218-219, 237-239`
    - `EntrenadorFicha.dc.html:225`
    - `EntrenadorConstructor.dc.html:219`
    - `NutricionistaFicha.dc.html:194, 206, 232`

15. **Animación en bucle infinito sin botón de pausa** (WCAG 2.2.2, más de 5 s junto a otro contenido):
    `Main.dc.html:162-163` y `Sesion.dc.html:164-165`. La reducción de movimiento sí está resuelta.

16. **Jerarquía de encabezados.**
    - `Sesion.dc.html` no tiene `<h1>`; el primer encabezado es un `<h2>` en `:188`.
    - `Main.dc.html:169-170`: el `<h2>` es «Hoy toca:» seguido de dos `<br>`, y lo importante («Empuje») va en un `<p>`.
    - `Plan.dc.html:176, 190, 203, 213`: deberían ser `<h3>` bajo «Empuje» (`:164`).
    - `NutricionComida.dc.html:150`: «Tu plato» es un `<span>` que hace de título.

17. **Zonas seguras.** `app.json` activa `edgeToEdgeEnabled` en Android, así que la barra inferior
    (`Main.dc.html:206` y equivalentes) y la hoja de `Molestia.dc.html:150` necesitan
    `env(safe-area-inset-bottom)`. En React Native, `useSafeAreaInsets`.

18. **(web) No hay estado _hover_ en botones.** La hoja global solo pone `cursor: pointer`
    (`Main.dc.html:134`, igual en todas). El `a:hover` de `:136` lo anulan los colores en línea de
    los botones-enlace, así que ningún CTA reacciona al ratón. Sobre todo afecta a los paneles de escritorio.

19. **23 enlaces muertos con `href="#"`.**
    - `Sesion.dc.html:178`: «Calentamiento».
    - `Guia.dc.html:177-183`
    - `Nutricion.dc.html:155, 167, 171`
    - `EntrenadorFicha.dc.html:144, 147-149`
    - `EntrenadorConstructor.dc.html:144, 147-149, 225`
    - `NutricionistaFicha.dc.html:144, 146, 147`

20. **Texto que el lector pronuncia mal.**
    - Letras de día sueltas: `Main.dc.html:181-187`, `Plan.dc.html:154-158`, `PlanBloque.dc.html:184`.
      Usa `aria-label="Lunes"` o `<abbr title>`.
    - Minutos con apóstrofo («8–10'»), que se lee «apóstrofo»: `Plan.dc.html:167-170, 176, 190, 213`,
      `PlanBloque.dc.html:182, 185-188`. Escribe «min».
    - Abreviaturas: `Plan.dc.html:167` «Calent.», `PlanBloque.dc.html:175-178` «Sem.»,
      `EntrenadorConstructor.dc.html:199` «Carga ini.».
    - Contador de mensajes pegado, que se lee «Mensajes2»: `EntrenadorFicha.dc.html:149`,
      `EntrenadorConstructor.dc.html:149`, `NutricionistaFicha.dc.html:147`. Añade un texto oculto «2 sin leer».

21. **Gráfica sin datos accesibles** (`Progreso.dc.html:160-170`). El `aria-label` describe la gráfica
    pero no da los valores. Añade una tabla oculta o un resumen con los pesos de cada día.

22. **Puntos de referencia.** Las 14 pantallas de cliente no tienen `<main>`. Las de escritorio sí
    (`EntrenadorFicha.dc.html:154`, `EntrenadorConstructor.dc.html:154`, `NutricionistaFicha.dc.html:152`),
    pero no hay enlace «Saltar al contenido» antes del menú lateral.

23. **HTML inválido y nombre accesible enorme** (`NutricionOpciones.dc.html:154-192`). Hay `<div>`
    dentro de `<button>`, y el lector lee la lista de ingredientes entera como nombre del botón.
    Pon el nombre con `aria-labelledby` apuntando al título de la opción.

## P4 · Bajo

24. **Formularios.**
    - Ningún campo tiene `name` ni `autocomplete="off"`. Afecta a `Sesion.dc.html:200-239`,
      `EntrenadorFicha.dc.html:225`, `EntrenadorConstructor.dc.html:219` y `NutricionistaFicha.dc.html:194, 206, 232`.
    - El comentario y su «Enviar» no están en un `<form>` (`EntrenadorFicha.dc.html:224-226`).
    - Los placeholders se usan como valor sugerido («67,5»): `Sesion.dc.html:217-219, 237-239`.
    - El valor «3.250» con separador de miles dará problemas al parsear (`NutricionistaFicha.dc.html:206`).

25. **El nombre accesible no coincide con el texto visible** (control por voz).
    - Interruptores de `NutricionistaFicha.dc.html:221-223`: el texto visible dice «Creatina
      monohidrato…» y el nombre es «Recordatorio de creatina». Usa `aria-labelledby`.
    - Botón «Perfil» que muestra «DG» (`Main.dc.html:148` y en el resto de pantallas).

26. **(web) Metadatos de tema oscuro.** Falta `color-scheme: dark` en `<html>`, que ahora hace que el
    deslizador, las barras de scroll y el autocompletado se pinten en claro. También faltan
    `<meta name="theme-color" content="#0E0D0B">` y `<meta name="viewport">` en el `<head>` de
    cada pantalla (líneas 2-6).

27. **Táctil.**
    - Falta `touch-action: manipulation` y `-webkit-tap-highlight-color`.
    - Áreas táctiles por debajo de 44 px (pasan el mínimo WCAG de 24 px, pero no la guía de iOS/Android):
      - 32 px: casillas de `Nutricion.dc.html:154-179` e interruptores de `NutricionistaFicha.dc.html:221-223`.
      - 40 px: RIR de `Sesion.dc.html:225-230` y chips de `Molestia.dc.html:164-168, 180-182`.

28. **El logo no tiene `width`/`height`**, lo que provoca un salto de maquetación.
    `Main.dc.html:147`, `EntrenadorFicha.dc.html:142`, `EntrenadorConstructor.dc.html:142`,
    `NutricionistaFicha.dc.html:142`. Añade también `fetchpriority="high"`.

29. **Restos de plantilla.** Textos entre corchetes: `Nutricion.dc.html:146` «[Nutricionista]»,
    `EntrenadorFicha.dc.html:151` y `EntrenadorConstructor.dc.html:151` «[Nombre del entrenador]»,
    `NutricionistaFicha.dc.html:149, 158`. Hay una `<section>` vacía en `Sesion.dc.html:247-251`.

30. **Tamaños fijos que recortan el contenido.** `Main.dc.html:169` fija el título en 305 × 60 px, y
    `Checkin.dc.html:145` usa `height: 527px`. Un texto más largo o un tamaño de letra mayor quedará cortado.

31. **Semántica de listas.**
    - `Ejercicio.dc.html:159`: `<ol>` con `list-style: none`. Safari quita la semántica de lista, así que añade `role="list"`.
    - `Ejercicio.dc.html:172-174`: pares término–descripción, que van en `<dl>`.
    - `Plan.dc.html:177-216`: listas de ejercicios hechas con `<div>`, que van en `<ol>`.
    - `PlanBloque.dc.html:166-170`: objetivos en `<p>`, que van en `<ul>`.

32. **Formato de fechas y números escrito a mano.** Usa `Intl.DateTimeFormat` / `Intl.NumberFormat`.
    - Fechas: `Progreso.dc.html:171, 186`, `EntrenadorFicha.dc.html:197, 223`, `EntrenadorConstructor.dc.html:159`.
    - Falta espacio duro entre número y unidad («111,6&nbsp;kg», «1&nbsp;h&nbsp;38&nbsp;min»):
      `Main.dc.html:170, 198-200`, `Cierre.dc.html:154`, entre otros.
    - Ningún título usa `text-wrap: balance`.

33. **Textos.**
    - Botones genéricos, sin decir qué hacen:
      - `Checkin.dc.html:171` «Empezar»
      - `Sesion.dc.html:148` «Terminar»
      - `Sesion.dc.html:174` «Saltar»
      - `Main.dc.html:201` «Marcar»
      - `Cierre.dc.html:192` y `EntrenadorFicha.dc.html:226` «Enviar»
      - `NutricionComida.dc.html:156` y `NutricionOpciones.dc.html:194` «Hecho»
    - Primera persona en `Molestia.dc.html:187` («mi entrenador»); la guía pide segunda persona.
    - Errata: `Progreso.dc.html:151` «Pruebas fisicas» → «físicas».
    - «Agregar nota» en `Sesion.dc.html:247` frente a «Añadir» en `Cierre.dc.html:180`, `Progreso.dc.html:187`
      y `EntrenadorConstructor.dc.html:187, 208`.
    - No se aplica la regla de «Title Case», porque en español va con mayúscula solo la primera palabra.

34. **(web) La URL no guarda el estado de la vista.** Día, pestaña y sección no van en la URL:
    `Plan.dc.html:153-158`, `Progreso.dc.html:147-151`, `EntrenadorFicha.dc.html:167-174`,
    `EntrenadorConstructor.dc.html:180-186`, `NutricionistaFicha.dc.html:165-169`.

35. **Vídeo de técnica** (`Ejercicio.dc.html:148`). Cuando exista, necesitará subtítulos o
    transcripción. El botón podría llamarse «Reproducir vídeo: press banca con barra».
