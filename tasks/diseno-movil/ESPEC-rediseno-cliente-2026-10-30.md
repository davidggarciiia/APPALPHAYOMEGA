# Rediseño del cliente · 30-10-2026

Fuente: los CAMBIOS que pidió el dueño tras probar la app en Android (30-10). Amplía [ESPEC.md](ESPEC.md); si algo choca, manda este documento. Lo implementa Codex; Claude revisa. Para el cliente: **la app existe para simplificarle la vida**.

## 0. Reglas para las cuatro pestañas

1. **Sin subtítulos salvo que cambien una decisión.** Por cada `Text` secundario (13 px tenue, microetiquetas, leyendas, «Semana x de y · fase», explicaciones), preguntarse: «¿el cliente haría algo distinto sin él?». Si no, fuera. Se quedan los textos de error, los vacíos de una línea y los datos (cifras con su unidad).
2. **Tamaños de letra fijos.** Prohibido `adjustsFontSizeToFit`, `minimumFontScale` y elegir el estilo según la longitud del texto. Cada pieza usa un estilo de `tipo` (`tema.ts`); si no cabe, `numberOfLines` con elipsis o salto de línea. Guarda permanente: un test estático como `accesibilidad-estatica.spec.ts` que falle si aparece cualquiera de esas props en `src/` o `app/` (hoy: `componentes/barra-ajuste.tsx:359` y `entrenamiento-entrenador/constructor/tabla.tsx:225`; la del constructor es del entrenador, pero la regla vale para toda la app).
3. **Jerarquía de tres niveles, nada más:** título de pantalla o de bloque (`tipo.titulo` o `tituloPantalla`), filas (`tipo.fila`) y datos o secundario (`tipo.secundario`). Un botón principal por pantalla. Separación entre grupos de `espacio` grande, en vez de tarjetas dentro de tarjetas.
4. **Menos información por pantalla.** Primero lo que el cliente tiene que hacer hoy; el detalle, un toque más abajo (fila → pantalla o hoja). Nada de bloques informativos que no piden acción.
5. **Movimiento y rendimiento (sigue a K):** sin animaciones de entrada ni reentradas; solo respuesta a la pulsación, destello al completar serie y el marcador. Nada en bucle infinito. Listas largas con `FlatList`. Cualquier animación que en Android baje de 60 fps se quita, no se afina.

## 1. Entreno

### 1.1 Sesión por bloques (registro del cliente)

Hoy la sesión es una única lista larga con todas las secciones. Pasa a **un bloque por pantalla**, en el orden de `SECCIONES_DE_SESION` (`calentamiento → principal → circuito → final`), saltando las secciones vacías:

- Barra superior igual que hoy (volver, reloj, «Terminar»). Debajo, solo el nombre del bloque (`tipo.titulo`, p. ej. «CALENTAMIENTO») y un indicador de pasos discreto (rayas, una por bloque, la actual en `acento`). Sin «x de y series», sin subtítulo.
- Contenido: los ejercicios de ese bloque con su tabla de series de siempre (`TablaSeries`, `FilaSerie`).
- Pie fijo: **«Siguiente»** (`BotonPrincipal`) para pasar al bloque siguiente; en el último bloque, «Terminar». «Anterior» como enlace a la izquierda desde el segundo bloque. Navegar entre bloques **no envía nada ni valida**; el borrador local se guarda como hoy.
- «Terminar» sigue las reglas de ESPEC.md §6 (series pendientes → diálogo «¿Terminar ya?»), contando las de todos los bloques.
- Al reabrir una sesión a medias, abre el primer bloque con series pendientes.
- «Abs y cardio»: hoy no existen como secciones; el dueño los nombra como ejemplo. Usar `final` con el nombre que ponga el entrenador si la sección lo tiene; si no, «FINAL». **No ampliar el contrato** para añadir secciones nuevas sin preguntar.
- Pruebas: navegar entre bloques conserva las series marcadas; las secciones vacías no salen; terminar desde el bloque 1 cuenta las pendientes de todos; reapertura en el bloque correcto; lector de pantalla anuncia «Bloque 2 de 3, Principal».

### 1.2 Hoy y calendario

- Quitar los subtítulos de la tarjeta de hoy y de la semana que no cambian una decisión (regla 0.1). La tarjeta de hoy: nombre de la sesión y «Empezar». Nada más por defecto.
- Reservar: **lo hace el entrenador** (SPEC-reservas). En el calendario, el cliente verá sus reservas y su saldo cuando llegue R4; no añadir ahora ningún botón «Reservar».

## 2. Plan

- **Fuera la pestaña «Bloque»** (`plan/bloque.tsx` y su opción en `plan-cliente.tsx`). Si algo de ella sirve, como el objetivo del bloque o las notas del entrenador, pasa a una sola fila en Rutina, solo si existe.
- Quedan **Semana · Rutina · Guía**, con tamaños de letra fijos (regla 0.2).
- Jerarquía (regla 0.3): cada día es un grupo con su título; las sesiones, filas de alto fijo; sin tarjetas anidadas ni subtítulos de fase o semana.
- Pruebas: la opción «Bloque» ya no existe; ninguna prop de autoescalado (lo cubre la guarda).

## 3. Nutrición

- Mantener la estructura (el dueño la ve bien), pero aplicar la regla 0.4: en la pantalla principal, la comida que toca ahora o la siguiente, y la lista del día como filas. Los macros y totales, en una sola línea discreta o un toque más abajo; no varios paneles.
- Quitar subtítulos y leyendas sobrantes (regla 0.1).
- Arreglar los bugs visuales que se encuentren al revisar a 360 y 390 px (recortes, saltos al recargar: N-06 del informe de auditoría). Anotar cada uno con su captura antes y después.

## 4. Progreso — se rehace entera

Problema: las gráficas están bonitas pero no responden a «¿estoy progresando?». Hoy son pestañas por indicador (peso, pasos, sueño, cintura, fuerza…) con gráficas sueltas.

**Nueva estructura: un resumen arriba y cinco secciones fijas, siempre en el mismo orden**, cada una con su respuesta en una frase y el detalle a un toque:

1. **Resumen (arriba, sin gráfica):** de 3 a 5 filas «qué ha cambiado desde el inicio», con valor inicial → actual y diferencia en color (`exito` si va en la dirección del objetivo del cliente, `aviso` si va en contra; si no hay objetivo, neutro). Ejemplos: «Peso 111,6 → 104,2 kg · −7,4», «Press banca 80 → 95 kg», «Cintura −6 cm». Sale de `punto-de-partida.ts`, que ya calcula la primera toma.
2. **Fuerza por ejercicio:** lista de los ejercicios principales con mejor marca actual y cambio desde el primero (reutilizar `ListaProgresion` y `progresion-ejercicio.tsx` del entrenador, en modo cliente). Toque → pantalla del ejercicio con su gráfica y el historial.
3. **Medidas y peso:** filas por medida (peso, cintura, cadera, etc.) con último valor y cambio; toque → gráfica de esa medida. Se acabó el tener las gráficas todas a la vez.
4. **Composición corporal (bioimpedancia y pliegues):** última valoración frente a la primera: % graso, masa muscular y lo que tenga el método; toque → evolución (`EvolucionValoraciones`).
5. **Pruebas físicas:** una fila por prueba con su último resultado, el cambio respecto al primero y la fecha; toque → historial de esa prueba.
6. **Fotos:** comparador antes/ahora directo (`comparador-fotos.tsx`) con la primera y la última toma de la misma pose; toque → galería por fecha. Las solicitudes de fotos pendientes, como una fila de acción arriba solo si existen.

Reglas:

- Sin pestañas: las secciones se ven bajando, en `FlatList` o `SectionList`, con las que no tienen datos ocultas. Si no hay nada: una línea, «Tu entrenador registrará tu punto de partida en la primera valoración».
- Pasos y sueño **no** van en Progreso (son del día a día, ya están en Hoy). Si el entrenador los activó como indicador, solo una fila de media semanal en Medidas.
- Respetar la configuración del seguimiento (`configuracion.indicadores`): lo no activado no aparece.
- El modo entrenador de `progreso.tsx` (ficha del cliente) no cambia en esta tarea; separar el componente del cliente si hace falta para no romperlo.
- Datos: todo existe ya en `seguimiento/api.ts` (medidas, pruebas, configuración), `valoraciones-api.ts`, `medios-api.ts` y la progresión del entrenamiento. **No ampliar la API**; si falta algo, anotarlo y seguir.
- Pruebas: resumen con inicial → actual y signo correcto, según el objetivo; secciones ocultas sin datos; respeta indicadores desactivados; toque en cada fila abre su detalle; vacío total con su línea.

## 5. Verificación de la tanda

- `npm run typecheck`, `npm run lint`, `npm test` (móvil y compartido) en verde; ninguna aserción debilitada.
- Capturas o vídeo a 390 px y a 360 px de: sesión pasando por los bloques, Plan sin «Bloque», Nutrición y Progreso con la cuenta de demo.
- Registrar en `tasks/para-codex-2026-10-30.md` (sección de entregas) qué subtítulos se quitaron por pantalla.
