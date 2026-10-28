# Rediseño de la experiencia del cliente

Documento vivo de las decisiones de diseño y UX tomadas con David.

- Creado: **4 de octubre de 2026**. Última actualización: **5 de octubre de 2026**.
- Fuente: conversación con David.
- Estado: definición del diseño. Este documento recoge acuerdos y propuestas; no significa que los cambios estén implementados ni que exista un diseño visual completo aprobado.
- Se actualizará con las siguientes respuestas, conservando la diferencia entre lo confirmado y lo pendiente.
- Primera ronda de preguntas cerrada por ahora: David no señala más problemas de uso en este momento y avisará cuando detecte otros.

## 1. Objetivo y prioridades

La prioridad es la **experiencia del cliente**, con una revisión importante de la app.

David considera que la app actual:

- Se ve «muy IA» y parecida a cualquier otra app.
- No tiene suficiente personalidad.
- Tiene una distribución poco pensada para la experiencia del usuario.
- Usa una fuente grande que le recuerda a Fortnite y una pequeña demasiado genérica.

Las pantallas que más quiere revisar son **Inicio y Progreso**. **Dietas** es la referencia positiva por lo fácil que resulta usarla. La información actual está, en general, bastante bien; el problema principal es cómo se organiza y se presenta.

Las preguntas seguirán siendo breves y de una en una, sin repetir un cuestionario enorme.

## 2. Dirección visual

### Confirmado

- Una estética **deportiva y con carácter**.
- Conservar los **colores y el fondo** que le gustan de la app actual.
- Títulos **compactos y más o menos grandes**.
- Revisar tanto la tipografía de títulos como la de textos pequeños.
- La animación que quiere tomar como referencia es el vídeo de logo que ha aportado, identificado en la sección de carga.

### Tipografías rechazadas

- Barlow y Barlow Condensed.
- Oswald.
- Teko.

No hay una marca o app externa que David quiera usar como referencia. Las tipografías se han valorado dentro de las pantallas completas, junto con su distribución.

### Tipografías elegidas: confirmado

- **Chivo** para los títulos compactos.
- **IBM Plex Sans** para el texto funcional y los controles.
- David ha confirmado que la combinación del último mockup de comparación se mantenga **en el resto de la app**. La elección de las fuentes no implica aplicar el mismo tamaño a todos los textos ni aprobar todas las composiciones de pantalla.

La composición global de las pantallas sigue abierta. La elección concreta de Inicio se recoge a continuación.

### Primeras propuestas visuales

Se preparan dos variantes de Inicio compacto, con la paleta y la navegación acordadas:

- **Sesión:** el entrenamiento destaca como acción principal y las comidas y suplementos se agrupan en filas sencillas. Se propone Chivo para títulos.
- **Agenda:** el contenido sigue un orden continuo, con menos cajas y los pendientes visibles por filas. Se propone Saira Semi Condensed para títulos.

En ambas se propuso IBM Plex Sans para el texto funcional. La primera comparación no se aprobó en conjunto; David conservó la parte superior de Sesión y pidió rehacer la zona inferior. Posteriormente confirmó Chivo e IBM Plex Sans para el resto de la app tras valorar el mockup de comparación de fotos.

Las propuestas usan datos de ejemplo, sin modificar la app ni sus registros reales.

### Respuesta a las primeras propuestas

- David considera que Inicio **sigue siendo demasiado poco visual**.
- **Le gusta la parte superior** de la propuesta; conservarla como base durante la siguiente revisión.
- No le gusta el bloque inferior **«Para hoy»**, con Comidas y Suplementos. Ha aclarado que se refiere a ese bloque, no a la pequeña etiqueta junto al entrenamiento.
- Rehacer la presentación de Comidas y Suplementos para que tenga más presencia visual, manteniendo el uso sencillo y la composición compacta.
- David ha elegido **bloques gráficos, sin fotos**, para la nueva presentación de Comidas y Suplementos.
- Esta preferencia se concreta en la elección de la segunda revisión que figura debajo. No supone cambios implementados en la app.

### Segunda revisión de Inicio: bloques gráficos

Se preparan dos tratamientos de la zona inferior, conservando la parte superior de la propuesta Sesión:

- **Secuencia:** las comidas pautadas se representan en orden, con la acción pendiente más visible; los suplementos ocupan una banda de estructura distinta.
- **Bloques:** un bloque de mayor contraste destaca la siguiente comida; el registro de suplementos queda visible y permite marcar «Tomado» o «No tomado».

Ambas composiciones son propuestas con datos de ejemplo. No se añaden puntuaciones, porcentajes de progreso, calorías ni nuevas obligaciones para el cliente.

**Elección de David: opción 2, «Bloques».** Esta será la base visual para la zona de Comidas y Suplementos de Inicio, conservando la parte superior de Sesión. Se acepta el bloque de Comidas de mayor contraste y la presentación del registro de suplementos de esa variante.

La elección se refiere a esta composición de Inicio, no a los platos, cantidades, suplementos o registros de ejemplo ni al diseño de todas las pantallas. La app todavía no se ha modificado.

## 3. Qué hace cada persona

| Persona       | Responsabilidad acordada                                                                                                            |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Cliente       | Realiza el entrenamiento, registra sus pesos y repeticiones, marca las comidas pautadas y señala si ha tomado o no los suplementos. |
| Entrenador    | Prepara la rutina y registra **peso corporal, medidas y pruebas físicas** del cliente.                                              |
| Nutricionista | Prepara la dieta cuando corresponda.                                                                                                |

El cliente **no configura el seguimiento ni introduce los datos corporales o las pruebas físicas**. Recibe lo que le han preparado los profesionales y completa las acciones que le tocan.

Hay que distinguir el **peso utilizado en un ejercicio**, que introduce el cliente durante el entrenamiento, del **peso corporal**, que registra el entrenador.

No se ha concretado en esta conversación quién prepara la dieta cuando no interviene un nutricionista; no debe inferirse una nueva restricción de permisos a partir de esta nota.

## 4. Inicio

### Confirmado

- Una **distribución compacta en Inicio**, para ver más contenido de un vistazo y reducir la necesidad de desplazarse.
- Facilitar el acceso al **entrenamiento que le toca** al cliente.
- Mostrar también lo pendiente del día, como las comidas y los registros que corresponden al cliente según la división de responsabilidades anterior.
- Mantener el **calendario en Inicio**.
- La vista inicial del calendario será **semanal**.
- Poder ampliarlo para ver el **mes completo**.
- Revisar el aspecto del calendario: el formato semanal le gusta, pero su presentación actual no le termina.
- Al **tocar un día del calendario**, mostrar el **entrenamiento de ese día debajo**, sin salir de Inicio.

La jerarquía y la distribución final de calendario, entrenamiento y demás tareas todavía deben proponerse visualmente, siguiendo la preferencia por un Inicio compacto. Está confirmado que el entrenamiento del día seleccionado aparece debajo del calendario; falta concretar la composición y el tamaño de los bloques.

### Notificaciones

- Los cambios de rutina y los comentarios del entrenador estarán en una **pequeña pestaña de notificaciones**.
- La pequeña pestaña de notificaciones estará **arriba**, junto al acceso al perfil. Su presentación visual concreta todavía debe proponerse.
- David pide **«notificaciones normales»**: avisos del sistema del móvil, también cuando la app esté cerrada, además del acceso a notificaciones dentro de la app.

### Navegación del cliente: confirmado

- **Barra inferior:** Inicio, Rutina, Nutrición y Progreso, en ese orden.
- **Parte superior:** acceso al perfil y pequeña pestaña de notificaciones.
- Esta decisión corresponde a la experiencia del cliente; no redefine la navegación de los profesionales.

## 5. Entrenamiento

### Presentación y navegación

- La rutina se realiza **ejercicio por ejercicio**, como si fueran pasando tarjetas.
- En la misma pantalla del ejercicio estarán la **animación, las indicaciones y las series**, con los campos de registro correspondientes.
- No obligar a elegir entre ver la animación o registrar las series: ambas cosas deben convivir en esa vista.
- Al completar la última serie de un ejercicio, **pasar automáticamente al siguiente ejercicio**.
- El cliente puede **dejar un ejercicio pendiente y seguir con el siguiente**, por ejemplo si una máquina está ocupada, y **retomarlo después durante la misma sesión**. Pasar al siguiente no marca el ejercicio pendiente como realizado.

### Registro de las series

- El registro se realiza **una serie a la vez**. David concreta la agrupación: **un bloque por ejercicio, con las series de ese ejercicio dentro**; no un bloque independiente por cada serie.
- Los ejercicios pueden estar prescritos **por repeticiones o por tiempo**, según lo indique el entrenador. La misma agrupación por ejercicio debe admitir ambas modalidades y adaptar el registro; no exigir repeticiones en los ejercicios por duración.
- En los ejercicios por tiempo, el cliente **anota la duración que realmente ha realizado y pulsa «Hecho»**, igual que al registrar una serie por repeticiones. El campo de duración mantiene la referencia anterior en gris y la acción voluntaria «Usar valores anteriores». **No hay botón «Empezar» ni cuenta atrás para ejecutar el ejercicio**; el temporizador de descanso ya acordado se mantiene.
- El cliente introduce los pesos y las repeticiones que realmente hace.
- Los valores de la sesión anterior aparecen **en gris dentro de los campos**, como una referencia o sugerencia.
- La referencia gris no debe confundirse con un registro de la sesión actual.
- Cada serie tendrá la acción **«Usar valores anteriores»**, que rellena los kilos y repeticiones de esa serie en la última sesión del mismo ejercicio. El cliente puede corregirlos antes de marcar **«Hecho»**.
- Los valores de referencia no se convierten en registros por sí solos: **solo se registran al pulsar «Hecho»**. La acción de reutilizarlos es voluntaria, sin rellenar automáticamente todas las series al entrar.

Se ha preparado un **mockup interactivo del bloque de un ejercicio**: agrupa sus tres series de ejemplo, destaca la activa y mantiene las demás identificables en filas compactas. Permite probar «Usar valores anteriores», confirmar con «Hecho», avanzar a la siguiente serie y corregir una serie completada conservando los campos preparados de la siguiente. El descanso aparece en una barra pequeña. David señala que faltaba la demostración de técnica: se incorpora **encima de las series, dentro del mismo bloque**, repitiéndose en bucle y con control para pausarla o reproducirla. El ejemplo pasa a **Press inclinado con mancuernas**, coincidiendo con la animación propia disponible; no se presenta como press de banca. La animación es una muestra pendiente de revisión técnica, no una asignación al catálogo. Tras quitar los contornos y separadores, David acepta esta **presentación visual** con «perfecto» y recuerda que también hay ejercicios por tiempo. El registro manual de la duración está confirmado; su presentación visual todavía debe mostrarse. El mockup representa el componente del ejercicio, no toda la pantalla. Las indicaciones siguen previstas en la misma vista según el acuerdo anterior. Los datos son ficticios y la app todavía no se ha modificado.

**Preferencia visual confirmada para este componente:** David pide «quita los bordes esos raros, que quede todo uniforme» y acepta el resultado. El bloque del ejercicio debe formar una **superficie uniforme, sin contornos decorativos ni separadores marcados**. Esta indicación se refiere al mockup `ejercicio-series.html`; no extiende esta preferencia a otras pantallas.

### Descanso y molestias

- El temporizador de descanso empieza **automáticamente al marcar una serie como completada**.
- Durante el descanso, el temporizador aparece en una **barra pequeña**, manteniendo visibles el ejercicio y sus series.
- Eliminar los cuestionarios de **energía y esfuerzo de antes y después del entrenamiento**.
- Mantener un **botón opcional para avisar de molestias o dolor**.
- El aviso queda **asociado al ejercicio que el cliente está realizando** y permite añadir una **nota opcional para el entrenador**.

Se propuso que el descanso siguiera visible al cambiar de ejercicio y que fuera posible volver a tarjetas anteriores. Son criterios de diseño propuestos, no decisiones expresamente confirmadas por David.

Está confirmada la asociación del aviso al ejercicio y la nota opcional para el entrenador. La presentación visual y la forma de consultar esos avisos por parte del entrenador siguen pendientes.

### Al finalizar: confirmado

- Mostrar una pantalla de **«Entrenamiento terminado»**.
- **No hace falta un resumen**, ni siquiera breve.
- No añadir los cuestionarios de energía y esfuerzo eliminados anteriormente.
- El cliente pulsa **«Finalizar entrenamiento»** para cerrar la sesión; completar la última serie no la finaliza automáticamente. Al pulsar el botón aparece **«Entrenamiento terminado»**.
- Puede **finalizar aunque queden ejercicios pendientes**. Se conservan las series y registros completados, y el entrenador puede ver qué ejercicios quedaron **no realizados**. Finalizar la sesión no convierte los pendientes en ejercicios completados.

**Presentación y salida confirmadas:** pantalla limpia con un **check**, el texto **«Entrenamiento terminado»** y un único botón **«Volver a Inicio»**. No incluye resumen. El botón devuelve al cliente a Inicio.

El avance automático al siguiente ejercicio se mantiene. El cierre de la sesión requiere el botón **«Finalizar entrenamiento»**, como ha elegido David.

## 6. Progreso

### Uso del cliente

**Progreso será una pantalla de consulta para el cliente.** No debe presentarse como una pantalla donde tenga que configurar indicadores o introducir peso corporal, medidas o pruebas físicas.

Los datos del entrenamiento se aprovechan para mostrar la evolución: el cliente **no vuelve a introducir los pesos y las repeticiones en Progreso**.

### Organización de Progreso: confirmado

El contenido se separará en **tres apartados**:

1. **Entrenamiento:** acceso a la rutina completa, sus ejercicios agrupados por día y su progresión de pesos, series y repeticiones.
2. **Medidas y pruebas:** incluye el peso corporal, las medidas y las pruebas físicas que registra el entrenador, con sus gráficas correspondientes.
3. **Fotos:** consulta y subida de las fotos de progreso, con las vistas y los límites acordados más abajo.

David ha elegido **tres bloques gráficos de entrada**, uno por apartado, frente a la alternativa de pestañas superiores. Al tocar un bloque se accede a su contenido.

La forma, el tamaño y la distribución concretos de los tres bloques todavía deben valorarse visualmente. Mantener la línea de bloques gráficos elegida para Inicio y evitar convertir esta entrada en un panel de métricas genéricas.

### Propuestas de entrada a Progreso: pendientes de elegir

- **Franjas:** tres bloques a todo el ancho, uno debajo de otro.
- **Mosaico:** Entrenamiento ocupa el ancho completo; Medidas y pruebas y Fotos aparecen debajo, en paralelo.

Las dos variantes mantienen los tres accesos confirmados y la cabecera y navegación de la línea elegida para Inicio. El amarillo destaca el acceso a Entrenamiento; el resto conserva las superficies oscuras.

David ha indicado que le gusta la propuesta que estaba viendo y ha pedido mejorar la orientación de las fotos con un muñeco de referencia junto a cada vista. No ha nombrado una variante concreta ni aprobado con ello todos los destinos interiores.

El prototipo permite entrar y volver para valorar la navegación. La rutina, la comparación de series y el peso corporal que aparecen son **datos de ejemplo**; los destinos interiores no están aprobados como diseño final. La selección de una foto solo se previsualiza en el prototipo, sin subir archivos ni modificar el almacenamiento de la app.

### Acceso a la progresión de ejercicios

La estructura aceptada es:

1. Acceder a la **rutina completa que entrega el entrenador**.
2. Ver los **ejercicios agrupados por día**, con los ejercicios de cada día visibles.
3. Tocar un ejercicio para consultar su **progresión de pesos**, con las series y repeticiones reales de cada sesión.

No se plantea una lista general del catálogo ni pedirle al cliente que elija manualmente sus ejercicios principales: aparecen los que le corresponden en su rutina.

La idea de comparar las series de la última sesión con las de la anterior fue bien recibida, con acceso al resto del historial. La presentación concreta de esa comparación sigue pendiente de diseño.

### Enfoques que no encajaron

- Un resumen personalizado o manual como base de Progreso: David considera que no es escalable.
- Las métricas genéricas propuestas: no le resultaron útiles.
- Para la progresión de fuerza quiere consultar **lo que está haciendo realmente con los pesos de sus ejercicios**.

### Datos que registra el entrenador: confirmado

- El cliente puede consultar en **Progreso** su **peso corporal, medidas y pruebas físicas**.
- Estos datos tendrán sus **gráficos correspondientes** para ver su evolución.
- Los introduce el **entrenador**; el cliente los consulta, sin tener que registrarlos ni configurar los indicadores.

El rechazo a las métricas genéricas propuestas no implica eliminar estos datos: David ha confirmado expresamente que quiere verlos en Progreso con sus gráficas.

**Orden confirmado en «Medidas y pruebas»:** arriba se muestra la **última revisión del entrenador, con fecha y comentario**; debajo aparecen las medidas con sus gráficas. La composición visual concreta y el formato de cada gráfico todavía deben proponerse.

### Rutinas anteriores: confirmado

David no quiere que el cliente pueda consultar **las rutinas anteriores y sus registros como rutinas archivadas**. Progreso se centra en la **rutina actual**, con sus ejercicios agrupados por día, sin añadir un «Historial de rutinas».

Esta decisión define el acceso del cliente, no el borrado de los registros. **Continuidad confirmada:** si un mismo ejercicio aparece en la nueva rutina, su gráfica **conserva los pesos anteriores**; no empieza desde cero por el cambio de rutina. El historial de ese ejercicio se mantiene sin ofrecer una consulta de las rutinas antiguas como planes archivados.

### Fotos de progreso

- El **cliente también puede subir fotos** de progreso.
- El límite es de **una foto por vista corporal a la semana**, no de una foto en total por cliente.
- Las vistas indicadas por David son:
  1. **Frontal, relajado**.
  2. **Espalda, relajado**.
  3. **Frontal, doble bíceps**.
  4. **Espalda, doble bíceps**.
  5. **Apretando pierna**.
  6. **Perfil izquierdo**.
  7. **Perfil derecho**.
- Contando ambos perfiles por separado, son **siete vistas**, cada una con su propio límite semanal. Esto no implica que subir las siete sea obligatorio: no se ha definido esa obligación.
- **Cada vista tendrá un muñeco al lado que muestre la postura**, acompañado de su nombre, para evitar confusiones al elegir o tomar la foto. Distinguir frontal y espalda, brazos relajados y doble bíceps, y los dos perfiles.
- Los muñecos deben **encajar con la estética de la app**. Tras ver la primera referencia, David lo ha recalcado: usar figuras sencillas y coherentes con la paleta oscura, los grises y el amarillo, en vez de introducir ilustraciones realistas con colores ajenos.
- **Incluir el logo de Alpha & Omega en los pantalones de los muñecos**, como ha pedido David. Mantenerlo pequeño y coherente con la indumentaria deportiva.
- Para los perfiles, la izquierda y la derecha se refieren al **cuerpo del cliente**. En el prototipo se aclara con «Tu lado izquierdo» y «Tu lado derecho».
- El ángulo de **«Apretando pierna»** sigue sin definirse. La referencia visual puede destacar la contracción de la pierna sin fijar una orientación de cámara que no se haya acordado.
- El límite se aplica por **semana de calendario, de lunes a domingo**, y **se reinicia cada lunes** para cada vista. No se exige esperar siete días desde la subida anterior.

#### Sustitución y almacenamiento: confirmado

- El cliente **puede sustituir una foto equivocada durante esa misma semana**.
- La nueva foto sustituye el mismo registro semanal de esa vista: sigue habiendo **una sola foto por vista y semana**.
- Al sustituirla, el **backend debe eliminar el archivo anterior**, no limitarse a ocultarlo o quitar su referencia de la interfaz.
- **No conservar copias ni versiones de la foto sustituida** en el almacenamiento de la aplicación. Eliminar también sus miniaturas y demás archivos derivados, si existen, para ahorrar espacio.
- Este borrado afecta a la foto que se sustituye, no a las fotos válidas de otras semanas que sirven para consultar la evolución.
- Criterio para implementar la sustitución: validar y guardar correctamente la nueva foto antes de retirar la anterior, para que un fallo de subida no deje el registro sin foto. Al completar la sustitución, no debe quedar almacenado el archivo anterior.

#### Comparación de fotos: referencia solicitada

- David quiere poder **comparar sus fotos como en MyFitnessPal**, que permite ver fotos de progreso lado a lado. Referencia: [MyFitnessPal · Progress Photos](https://blog.myfitnesspal.com/how-to-use-myfitnesspal-for-weight-loss/).
- Primera propuesta de flujo: elegir una **vista corporal**, seleccionar **dos fotos de semanas distintas** de esa misma vista y mostrarlas **lado a lado, con la fecha de cada una**.
- Las fotos válidas de semanas anteriores se conservan para esta comparación. La eliminación acordada afecta únicamente al archivo que se sustituye dentro del mismo registro semanal.
- Se ha preparado un **mockup navegable de la comparación**, con dos fotos de ejemplo de «Frontal, relajado», fechas visibles, selector de vista y selección de dos semanas. La más antigua aparece a la izquierda. Las fotos se muestran completas y se pueden ampliar con un toque.
- El mockup incluye estados para una vista sin fotos y para una vista con una sola foto: en este último caso se muestra la imagen y se indica que hace falta otra semana para comparar.
- En el ejemplo, las fotos de archivo son del **7 y 21 de septiembre de 2026**, ambas anteriores a la semana actual. Una selección local de la semana actual puede añadirse a la comparación; reemplazarla mantiene un solo registro de esa vista para esa semana.
- **Valoración de David del primer mockup:** le gusta el diseño, pero lo considera **poco práctico** y pide explorar una solución que le convenza más. La presentación lado a lado y su flujo de selección no están aprobados como diseño final.

#### Comparación con dos modos y un botón para cambiar

- Mantener la estética de la comparación y dar más espacio a la foto. El mockup contiene dos modos dentro de la misma pantalla:
  - **Una a una:** una foto a todo el ancho; dos botones con sus fechas permiten cambiar entre la anterior y la reciente con un toque.
  - **Superpuestas:** dos fotos a todo el ancho se muestran mediante un separador arrastrable. También se puede pulsar cada fecha para ver esa foto completa. El agarre queda en la parte inferior de la imagen para dejar libre la zona central del cuerpo.
- **Petición de David:** añadir un botón para acceder a la otra vista. Junto a «Otras semanas», el botón muestra **«Ver superpuestas» o «Ver una a una»** según el modo al que permite cambiar. Cambiar de modo conserva la vista corporal y las dos fechas seleccionadas.
- Entrada: **comparar automáticamente las dos últimas fotos disponibles de la misma vista corporal**, inicialmente una a una. «Otras semanas» queda como acceso secundario para elegir una pareja diferente.
- Al cambiar de vista corporal se vuelve a sus dos últimas fotos; una pareja elegida manualmente se mantiene durante esa comparación. Las fechas siguen visibles y ordenadas de la más antigua a la más reciente.
- Las dos variantes conservan las proporciones y la imagen completa; **no se ajustan los cuerpos automáticamente para hacerlos coincidir**. La comparación deslizante resulta más fácil de interpretar con encuadres similares.
- **Valoración de David:** «que no salga deslizar, no se entiende, por lo demás perfecto». Da el visto bueno al resto del mockup de comparación y pide aclarar el nombre del botón. Se ha sustituido «Deslizar» por «Ver superpuestas» y «Alternar» por «Ver una a una», con las guías «Mueve la línea para comparar» y «Pulsa una fecha para cambiar de foto».
- Las imágenes son ficticias y la selección de archivos del prototipo es solo local: la función sigue pendiente de implementación en la app y su backend.

## 7. Dietas: referencia de facilidad

David explicó que le gusta **todo el flujo**, porque:

- Va en orden.
- El cliente solo tiene que elegir entre lo que le han pautado.
- Marca como «OK» o hecho, con una experiencia parecida a un cuestionario.

La referencia de UX es: **ver lo que toca → elegir entre las opciones preparadas por el profesional → confirmar que está hecho**.

**Registro de cada comida: confirmado.** El cliente puede marcar **«Hecha» o «No seguida»**. «No seguida» deja registrado que no siguió esa comida pautada; no se presenta como una comida pendiente de registrar.

**Corrección de registros: confirmado.** Si se equivoca, el cliente puede corregir el registro de una comida **también en días anteriores**; no se limita al día actual. No se ha fijado un plazo máximo para estas correcciones.

Mantener esa facilidad y usarla como criterio al organizar el resto de la experiencia. Esto no significa convertir todas las pantallas, incluida la consulta de Progreso, en cuestionarios.

## 8. Suplementos

- El cliente indica si se ha tomado o no los suplementos pautados.
- Debe ser una acción sencilla, coherente con la facilidad de Dietas.
- En la variante **Bloques** elegida para Inicio, el suplemento pendiente permite marcar **«Tomado» o «No tomado»** directamente; también hay acceso para revisar los demás suplementos.
- «No tomado» es un registro realizado y no debe confundirse con «pendiente de registrar». La composición final de las pantallas de detalle todavía debe concretarse.
- El cliente puede **corregir los registros de suplementos de días anteriores**, igual que los de comidas; no se limita al día actual. No se ha fijado un plazo máximo para estas correcciones.

## 9. Pantalla de carga

### Recurso confirmado

Vídeo aportado por David:

**`C:/Users/david/Desktop/logo-lenta.mp4`**

Se ha comprobado que el archivo existe. Es un MP4 vertical de aproximadamente **8,4 segundos**, con resolución **780 × 1688**. Se ha inspeccionado un fotograma de referencia del logo.

### Comportamiento pedido

- Usar **este vídeo**, el de la animación del principio.
- Mostrar el **logo pequeño**.
- Repetir el vídeo **en bucle durante la carga**.

Se propuso centrar el logo y entrar en Inicio en cuanto la app esté lista, sin esperar artificialmente a que termine el vídeo. David no ha confirmado expresamente la posición exacta del logo ni la transición.

El vídeo todavía **no se ha copiado ni integrado en la app**.

## 10. Herramientas de diseño instaladas

Las tres skills comunitarias solicitadas están instaladas en `C:/Users/david/.codex/skills`:

- [Impeccable](https://github.com/pbakaus/impeccable): personalidad visual, tipografía y distribución.
- [UI/UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill): jerarquía, accesibilidad y criterios de interfaz para React Native.
- [Improve UI](https://github.com/ibelick/ui-skills): revisión de problemas de la interfaz a partir de evidencia real.

La instalación está verificada. No se ha aplicado configuración adicional de Impeccable a este proyecto ni se han implementado cambios de diseño en esta conversación.

## 11. Próximas decisiones

- Completar las propuestas visuales de Inicio y Progreso con las tipografías elegidas: Chivo e IBM Plex Sans.
- Presentación visual de la pequeña pestaña de notificaciones; su ubicación arriba ya está confirmada.
- Presentación de la comparación de sesiones y acceso al historial de ejercicios. Está confirmado que la gráfica conserva los pesos anteriores al cambiar de rutina; no habrá consulta de rutinas anteriores.
- Composición visual de «Medidas y pruebas»: está confirmado que la última revisión del entrenador, con fecha y comentario, aparece arriba y las medidas con sus gráficas debajo. Los tres apartados de Progreso —Entrenamiento, Medidas y pruebas, y Fotos— ya están confirmados.
- Presentación visual de la barra inferior y de los accesos superiores; los apartados y sus ubicaciones ya están confirmados.
- Presentación del aviso opcional de molestias y su consulta por el entrenador; la asociación al ejercicio y la nota opcional ya están confirmadas. Detalles del registro de suplementos.
- Tamaño y colocación final de la animación de carga.

Estos puntos no son nuevos acuerdos ni un cuestionario que deba contestarse entero. Se irán resolviendo de forma gradual; los detalles rutinarios pueden proponerse dentro del diseño para valorarlos en contexto.
