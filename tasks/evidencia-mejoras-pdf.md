# Evidencia · Mejoras de los PDF (D01, D02, D04–D07)

Registro por subtarea de lo cambiado, lo verificado con su resultado real y lo
que sigue pendiente. `tasks/todo.md` lo integra el responsable principal.

## D01.a

**Cambio realizado.** Contratos auxiliares de distancia en
`packages/shared/src/entrenamiento.ts`, validables aparte y **fuera** de las
uniones públicas hasta D01.g:

- `SeriePrescritaDistanciaSchema`: `{ id, tipoMedicion: "distancia", pesoKg, metros }`.
- `SerieRegistradaDistanciaSchema`: campos de registro comunes + `metros` nulo
  mientras no se escribe; «hecha» exige metros y no admite `omitida`.
- `ValoresEjecutadosDistanciaSchema`: `{ tipoMedicion: "distancia", pesoKg, metros, rir? }`.
- `metros`: entero de 1 a 100 000. Todas las variantes son estrictas, así que
  no aceptan `repeticiones` ni `segundos`.
- `mantieneUnidadYCarga(serie, objetivo, tipoCarga)`: regla única de «misma
  unidad y carga que pide el ejercicio». La usan ya `crearRegistroDeSesionSchema`
  y `ResultadoEntrenamientoSchema` (mismo comportamiento que antes) y acepta la
  variante de distancia para validarla aparte.
- El refinamiento de `SerieRegistradaSchema` deja de asumir dos unidades
  (`tiempo ? segundos : repeticiones`): usa `cantidadRegistrada`, un `switch`
  exhaustivo que ya contempla `metros`. Las variantes se extraen a constantes
  para que D01.g solo añada `SerieRegistradaDistanciaBase` a la unión.
- `SPEC-entrenamiento.md` (especificación vigente del módulo: enlazada desde
  `README.md`, nombrada en D01.a y con la sección de la iteración 24-09):
  nueva sección «Ampliación D01» con nombres fijados, reglas de carga y la
  activación en dos pasos.

No hay migración: los documentos de prescripción y registro son JSON.

**Archivos:** `packages/shared/src/entrenamiento.ts`,
`apps/api/src/entrenamiento/contratos.spec.ts`, `SPEC-entrenamiento.md`,
`tasks/evidencia-mejoras-pdf.md`.

**Pruebas nuevas** (`contratos.spec.ts`, bloque «Distancia en metros (D01,
contrato auxiliar)», datos sintéticos): metros con y sin carga; ausente, nulo,
cero, negativo y decimal; kilos negativos; `repeticiones`/`segundos` añadidos;
registro vacío que no se convierte en cero; hecha sin metros; hecha y omitida;
carga según `tipoCarga` (con carga, sin carga y documento anterior sin
`tipoCarga`); unidad distinta; y el cierre «no se publica hasta D01.g» con un
registro histórico de repeticiones y tiempo que se lee igual.

**Comandos y resultado real:**

| Comando                                                                                                              | Resultado                                                                |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `npm test --workspace apps/api -- --runInBand contratos.spec.ts` (antes del cambio)                                  | 3 suites, 31 pruebas en verde (línea base)                               |
| Mismo comando con las pruebas nuevas y sin implementación                                                            | 1 suite fallida: 3 fallidas, 20 correctas (rojo esperado)                |
| `npm run build:shared`                                                                                               | Correcto tras resolver una referencia circular de tipos                  |
| `npm test --workspace apps/api -- --runInBand contratos.spec.ts`                                                     | 3 suites, 35 pruebas en verde                                            |
| `npm test --workspace apps/api -- --runInBand` (regresión unitaria API)                                              | 17 suites, 104 pruebas en verde                                          |
| `npm test --workspace apps/mobile -- --runInBand contratos.spec.ts registro-modelo.spec.ts registro-control.spec.ts` | 3 suites, 24 pruebas en verde                                            |
| `npm run test:e2e --workspace apps/api -- --runTestsByPath test/entrenamiento-registro.e2e-spec.ts`                  | 1 suite, 8 pruebas en verde (base desechable `alpha_omega_e2e_claude_d`) |
| `npm run typecheck`                                                                                                  | Correcto (shared, api y mobile)                                          |
| `npx eslint` sobre los dos `.ts` tocados                                                                             | Sin avisos                                                               |
| `npx prettier --write` y `--check` sobre los cuatro archivos                                                         | Aplicado; todos con el estilo de Prettier                                |

### Inventario de consumidores de `tipoMedicion`

Comando: `rg -n "tipoMedicion" --glob '!node_modules' --glob '!**/dist/**'
--glob '!**/*.spec.ts' --glob '!**/*.spec.tsx' --glob '!**/*.e2e-spec.ts' apps packages`,
completado con los ayudantes que formatean unidades (`objetivoDeSerie`,
`valoresLegibles`, `hechoLegible`, `mejorSerie`). Estado en el commit de D01.a:

| Consumidor (código de producción)                                                                                     | Supuesto actual                                                              | Subtarea        |
| --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------- |
| `packages/shared/src/entrenamiento.ts` (uniones y refinamientos)                                                      | Preparado en D01.a; uniones públicas aún con dos unidades                    | D01.g           |
| `apps/api/src/entrenamiento/registros.service.ts:152-157`                                                             | Construye lo ejecutado con `tiempo ? segundos : repeticiones`                | D01.f           |
| `apps/api/src/entrenamiento/sesiones.service.ts:27` (`cantidad`), `:30` (`mejorSerie`)                                | Binario; compara metros como repeticiones                                    | D01.f           |
| `apps/api/src/entrenamiento/sesiones.service.ts:211-214` (fuerza estimada)                                            | Solo repeticiones con kilos; la distancia ya queda fuera, conservar          | D01.f           |
| `apps/mobile/src/entrenamiento-entrenador/editor-modelo.ts:6,28,45,47,100,105`                                        | Tipo `"repeticiones" \| "tiempo"` y ternarios                                | D01.b           |
| `apps/mobile/src/entrenamiento-entrenador/constructor/modelo.ts:135,146,263,265`                                      | Booleano `tiempo`                                                            | D01.b           |
| `apps/mobile/src/entrenamiento-entrenador/editor-plan.tsx:221`                                                        | `"s" : "rep"`                                                                | D01.b           |
| `apps/mobile/src/entrenamiento/registro-modelo.ts:49,66,80`                                                           | `tiempo ? segundos : repeticiones`                                           | D01.c           |
| `apps/mobile/src/entrenamiento/registro-control.ts:270,286`                                                           | Compara unidad al recuperar copias (genérico, revisar con la tercera unidad) | D01.c           |
| `apps/mobile/src/entrenamiento/sesion/modelo.ts:51-55` (`objetivoDeSerie`), `:187-189`                                | Binario; lo usan `plan/modelo.ts`, `ficha-modelo.ts` y `sesion/partes.tsx`   | D01.c           |
| `apps/mobile/src/entrenamiento/tabla-series.tsx:25,31,33,57,123,139`                                                  | Etiquetas y campos binarios                                                  | D01.d           |
| `apps/mobile/src/entrenamiento/registro-cliente.tsx:313`                                                              | Objetivo binario                                                             | D01.d           |
| `apps/mobile/src/entrenamiento/resultado.tsx:12` (`valoresLegibles`; también `detalle.tsx` vía `PrescripcionVisible`) | `s` o `rep`                                                                  | D01.d / D01.f   |
| `apps/mobile/src/entrenamiento-entrenador/editor-sesion.tsx:148-166`                                                  | Selector de dos unidades                                                     | D01.e / D01.g   |
| `apps/mobile/src/entrenamiento-entrenador/constructor/tabla.tsx:280-284`                                              | Interruptor «Se mide en segundos»                                            | D01.e / D01.g   |
| `apps/mobile/src/entrenamiento-entrenador/ficha-modelo.ts:30-32,46`                                                   | Binario                                                                      | D01.e           |
| `apps/mobile/src/seguimiento/progreso.tsx:368,377`                                                                    | Lee la mejor serie por repeticiones de la API; depende de D01.f              | D01.f (revisar) |

`plan/guia.tsx` y `sesion/tiempo.ts` (previstos en D01.e) no leen hoy
`tipoMedicion` ni las unidades de serie; revisarlos entonces por si cambian.

Pruebas y ayudas que construyen series con `tipoMedicion` (23 archivos; se
actualizan con su subtarea): API `contratos.spec.ts`, `test/entrenamiento-ayuda.ts`,
`entrenamiento-{concurrencia,limites,novedades,registro}.e2e-spec.ts`,
`ficha-entrenador.e2e-spec.ts`, `seguimiento.e2e-spec.ts`; móvil
`cargar-rutina`, `constructor/modelo`, `contratos`, `editor-modelo`,
`ficha-modelo`, `hoy-toca`, `plan/modelo`, `plan/pantallas`, `registro-control`,
`registro-modelo`, `sesion/modelo`, `sesion/partes`, `sesion/tiempo`,
`tabla-series` y `ver-tecnica` (`.spec.ts`/`.spec.tsx`).

**Pendiente:**

- D01.g debe invertir a propósito el caso «no se publica hasta D01.g» de
  `apps/api/src/entrenamiento/contratos.spec.ts`. Ese archivo no figura en la
  lista de D01.g: contarlo como sexto archivo o hacerlo en una subtarea propia.
- Al activar, generalizar el mensaje «Una serie hecha necesita repeticiones o
  segundos registrados» y añadir `SerieRegistradaDistanciaBase`,
  `SeriePrescritaDistanciaSchema` y `ValoresEjecutadosDistanciaSchema` a sus uniones.
- Sin recorrido autenticado ni prueba en móvil físico: D01.a no cambia nada
  visible y la distancia aún no se puede elegir ni enviar.

## D01.b

**Cambio realizado.** Los modelos profesionales dejan de asumir dos unidades y
representan la distancia con el contrato auxiliar de D01.a, sin ofrecerla aún
en la interfaz ni publicarla:

- `editor-modelo.ts`: tipos `SerieConDistancia` (prescrita o de distancia),
  `TipoMedicion` y `SesionConDistancia` (una `SesionEnRutina` cuyas series
  pueden ir en metros). `SerieEditable.tipoMedicion`
  admite las tres unidades. Nuevas `desdeSerie` y `convertirSerie` (con
  `switch` exhaustivo; la segunda aplica la regla de carga de siempre: sin
  kilos si el ejercicio va sin carga externa o se calibra) y `unidadCorta`
  («rep», «s», «m»). `desdeSesion` acepta `SesionConDistancia` y
  `convertirSesion` usa `convertirSerie`, pero sigue validando con
  `SesionEnRutinaSchema`: una serie en metros lanza hasta D01.g.
- `constructor/modelo.ts`: `EjercicioDelConstructor.tipo` usa `TipoMedicion`.
  `desdeSesionEnRutina` acepta `SesionConDistancia` y lee el objetivo con un
  `switch` (`objetivoDeFila`). La construcción de series pasa a `seriesDeFila`
  (exportada, sin validar, conserva `idsSeries`); `aSesionEnRutina` la usa y
  sigue validando con el contrato público. `faltaEnDia` rechaza un rango en
  metros («escribe los metros, como 20.») para que «8–10» no quede en 8 m.
- `editor-plan.tsx`: la revisión del plan usa `unidadCorta` en vez de
  `tiempo ? "s" : "rep"`.
- Interfaz sin cambios: `editor-sesion.tsx` y `constructor/tabla.tsx` siguen
  ofreciendo solo repeticiones y segundos; `nuevaSerie` y `nuevoEjercicio`
  nacen en repeticiones (comprobado en pruebas y con
  `grep -i "distancia\|metros"` sobre `editor-sesion.tsx`, `constructor/tabla.tsx`,
  `constructor/partes.tsx` y `constructor/constructor.tsx`: sin resultados).

No hay migración ni cambios en `packages/shared`.

**Archivos:** `apps/mobile/src/entrenamiento-entrenador/editor-modelo.ts`,
`editor-modelo.spec.ts`, `editor-plan.tsx` (mismo directorio),
`apps/mobile/src/entrenamiento-entrenador/constructor/modelo.ts`,
`constructor/modelo.spec.ts`, `tasks/evidencia-mejoras-pdf.md`.

**Pruebas nuevas** (datos sintéticos):

- `editor-modelo.spec.ts`, bloque «Distancia en metros (D01, aún sin
  publicar)»: serie en metros con carga que se carga y se reescribe igual
  (validada con `SeriePrescritaDistanciaSchema`), sin kilos si va sin carga o
  calibrando; reabrir y volver a guardar una sesión con metros y repeticiones
  conserva unidad, carga e ids; una sesión existente en repeticiones y segundos
  produce el mismo documento; cambiar la unidad conserva id y carga sin dejar la
  cantidad de la otra; `unidadCorta`; y el cierre «no se publica hasta D01.g»
  (`convertirSesion` lanza) con las series nuevas en repeticiones.
- `constructor/modelo.spec.ts`, bloque «distancia en metros en el constructor»:
  reabrir/duplicar una fila en metros conserva unidad, carga, RIR e ids, y una
  serie añadida recibe id nuevo con la misma unidad; sin carga o calibrando no
  hay kilos; los metros no admiten rango mientras el mismo «8–10» sigue siendo
  válido en repeticiones (con `repeticionesMax`), y pasar a metros conserva el
  id sin arrastrar campos; y el cierre «no se publica hasta D01.g»
  (`aSesionEnRutina` lanza) con las filas nuevas en repeticiones.

**Comandos y resultado real:**

| Comando                                                                                             | Resultado                                                                                                        |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `npm test --workspace apps/mobile -- --runInBand editor-modelo.spec.ts modelo.spec.ts` (línea base) | 9 suites, 54 pruebas en verde                                                                                    |
| Mismo comando con las pruebas nuevas y sin implementación                                           | 2 suites fallidas: 8 fallidas, 56 correctas (rojo esperado; ya pasaban el documento existente y los dos cierres) |
| `npm test --workspace apps/mobile -- --runInBand editor-modelo.spec.ts modelo.spec.ts`              | 9 suites, 64 pruebas en verde                                                                                    |
| `npm test --workspace apps/mobile -- --runInBand` (regresión móvil completa)                        | 51 suites, 304 pruebas en verde                                                                                  |
| `npm run typecheck`                                                                                 | Correcto (shared, api y mobile)                                                                                  |
| `npx eslint` sobre los cinco archivos de código                                                     | Sin avisos                                                                                                       |
| `npx prettier --write` y `--check` sobre los cinco archivos de código y esta evidencia              | Aplicado; todos con el estilo de Prettier                                                                        |

**Pendiente:**

- D01.g debe invertir los dos cierres «no se publica hasta D01.g» de
  `editor-modelo.spec.ts` y `constructor/modelo.spec.ts` (ahora esperan que
  `convertirSesion`/`aSesionEnRutina` lancen con metros). Esos archivos no
  figuran en la lista de D01.g: sumarlos a los ya señalados en D01.a
  (`contratos.spec.ts`) o hacerlo en una subtarea propia. Tras activar, los
  tipos `SerieConDistancia`/`SesionConDistancia` equivalen a los públicos y
  pueden simplificarse.
- Consumidor no incluido en el inventario de D01.a:
  `constructor/partes.tsx:46,50` (etiqueta y marcador del objetivo con
  `e.tipo === "tiempo" ? … : …`). Añadirlo a D01.e junto a
  `constructor/tabla.tsx:283-284` (interruptor «Se mide en segundos», que con
  una fila en metros mostraría «apagado» y la pasaría a segundos).
- Para D01.e: en `faltaEnDia`, una fila en segundos sigue aceptando «30–40» y
  publica 30 s, y su mensaje habla de repeticiones. No se ha cambiado aquí para
  no alterar el comportamiento de segundos fuera de la subtarea.
- Observación ajena a D01, sin cambiar: `convertirSesion` solo reescribe id,
  ejercicio, indicaciones, `modoRir`, `tipoCarga`, `calibrar` y las series, y
  `convertirSerie` no emite `repeticionesMax`. Al «Ajustar esta sesión»
  (`app/entrenador/sesion/[id]/ajustar.tsx`) una prescripción hecha con el
  constructor pierde sección, RIR, descanso, dosis, nota, alternativas, subida,
  compuesto y el tope del rango. Conviene revisarlo en una tarea propia.
- Sin recorrido autenticado ni prueba en móvil físico: D01.b no cambia nada
  visible salvo el texto de unidad de la revisión del plan, que para
  repeticiones y segundos es idéntico.

## D01.c

**Cambio realizado.** El registro local y los modelos de sesión dejan de asumir
dos unidades. Representan la distancia con los tipos auxiliares de D01.a, sin
guardarla ni enviarla aún:

- `registro-modelo.ts`: tipos `SerieConDistancia`, `EjercicioConDistancia`,
  `PrescripcionConDistancia` y `RegistroConDistancia` (los públicos más la
  variante en metros). `desdePrescripcion` los acepta y lee lo registrado con
  un `switch` exhaustivo (`cantidadRegistrada`). Si la serie registrada tiene
  **otra unidad** que la pautada, queda pendiente y vacía: antes, 10
  repeticiones de un borrador se mostraban como «10» en una serie de segundos.
  La construcción del registro pasa a `registroSinValidar`, exportada y sin
  validar, con un `switch` que escribe `repeticiones`, `segundos` o `metros`.
  Antes, cualquier unidad distinta de tiempo acababa en `repeticiones`.
  `registroParaEnviar` la valida con `crearRegistroDeSesionSchema`, así que una
  serie en metros sigue lanzando hasta D01.g. Una serie ajena a la
  prescripción sigue rechazándose con `ZodError`. Nueva `edicionRecuperada`: la
  fusión de «Recuperar mi copia», que antes vivía en el control, pasa aquí sin
  cambiar su lógica. Así se puede probar con las tres unidades.
- `registro-control.ts`: `recuperarCopia` llama a `edicionRecuperada`. Las
  series con otra unidad o una carga incompatible quedan pendientes. El
  respaldo se conserva hasta que el cliente lo descarta.
- `sesion/modelo.ts`: `objetivoDeSerie` usa un `switch` exhaustivo («8–10»,
  «30 s», «20 m»); `resumenPrescrito` acepta ejercicios con metros («2 × 20 m
  · RIR 2–3 · 90 s»). En `proximaVez`, el tope sale de `topeDeSerie`, en la
  unidad de la serie. Antes, una serie en metros leía `repeticiones`
  (`undefined`). El descanso sigue saliendo solo del texto del entrenador
  (`segundosDeDescanso`). Estos modelos no calculan volumen.
- Formato de la copia local sin cambios: `EdicionRegistroSchema` guarda texto
  por serie y la unidad la pone la prescripción del mismo documento, así que
  las copias anteriores se leen igual. `DocumentoSesionSchema` sigue usando los
  contratos públicos: hasta D01.g no puede contener una prescripción en metros.

No hay migración ni cambios en `packages/shared` ni en la interfaz.

**Archivos:** `apps/mobile/src/entrenamiento/registro-modelo.ts`,
`registro-modelo.spec.ts`, `registro-control.ts`, `registro-control.spec.ts`
(mismo directorio), `apps/mobile/src/entrenamiento/sesion/modelo.ts`,
`sesion/modelo.spec.ts`, `tasks/evidencia-mejoras-pdf.md`. Hay seis archivos
de código frente a los cinco previstos. El sexto es `sesion/modelo.spec.ts`,
la prueba del modelo previsto. El patrón `modelo.spec.ts` de la verificación
ya lo ejecuta. No se ha dividido porque sin él `sesion/modelo.ts` quedaría sin
prueba.

**Pruebas nuevas** (datos sintéticos, sin datos personales):

- `registro-modelo.spec.ts`, bloque «Distancia en metros (D01, aún sin
  publicar)»:
  - preparar: series vacías; el objetivo no cuenta como ejecución; la edición
    cabe en `EdicionRegistroSchema`; la serie vacía cumple
    `SerieRegistradaDistanciaSchema`.
  - ida y vuelta: metros y kilos con coma decimal y RIR, con y sin carga;
    cumplen el contrato auxiliar y `mantieneUnidadYCarga`, y
    `desdePrescripcion` devuelve la misma edición.
  - sin peso escrito no se inventan kilos y un transporte con carga no se
    puede enviar.
  - cierre «no se guarda ni se envía hasta D01.g»: `RegistroSchema` rechaza
    los metros.
  - matriz 3 × 3 de cambios de unidad (repeticiones, segundos, metros): solo
    vuelve lo registrado en la misma unidad, tanto al preparar un registro
    como al recuperar la copia. El respaldo no se modifica y lo enviado nunca
    contiene el 12 en otra unidad.
- `registro-control.spec.ts`, bloque «Cambio de unidad y copias anteriores
  (D01)»:
  - repeticiones → segundos con conflicto y «Recuperar mi copia»: la serie
    queda pendiente, el respaldo es idéntico al original tras reabrir y se
    envía `segundos: null`, no 10 s.
  - un borrador del servidor en otra unidad se abre pendiente.
  - una copia guardada con el formato anterior (sin RIR, tiempo activo, vista
    ni intención de envío) se lee y se envía igual.
- `sesion/modelo.spec.ts`, bloque «Distancia en metros (D01, aún sin
  publicar)»:
  - objetivo y resumen en metros, con descanso escrito; repeticiones y
    segundos sin cambios.
  - «La próxima vez» compara metros con metros: 20 de 20 m propone subir y
    15 de 20 mantiene.

**Comandos y resultado real:**

| Comando                                                                                                                        | Resultado                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `npm test --workspace apps/mobile -- --runInBand registro-modelo.spec.ts registro-control.spec.ts modelo.spec.ts` (línea base) | 10 suites, 79 pruebas en verde                                                                                            |
| Mismo comando con las pruebas nuevas y sin implementación                                                                      | 3 suites fallidas: 16 fallidas, 81 correctas (rojo esperado; las dos pruebas de control que ya cumplía el código pasaban) |
| `npm test --workspace apps/mobile -- --runInBand registro-modelo.spec.ts registro-control.spec.ts modelo.spec.ts`              | 10 suites, 97 pruebas en verde                                                                                            |
| `npm test --workspace apps/mobile -- --runInBand` (regresión móvil completa)                                                   | 51 suites, 322 pruebas en verde                                                                                           |
| `npm run typecheck`                                                                                                            | Correcto (shared, api y mobile)                                                                                           |
| `npx eslint` sobre los seis archivos de código                                                                                 | Sin avisos                                                                                                                |
| `npx prettier --write` y `--check` sobre los seis archivos de código y esta evidencia                                          | Aplicado; todos con el estilo de Prettier                                                                                 |

**Pendiente:**

- D01.g debe invertir el cierre «no se guarda ni se envía hasta D01.g» de
  `registro-modelo.spec.ts`. Con las uniones ampliadas, `registroParaEnviar`
  aceptará los metros sin cambiar el código. Se suma a los archivos que D01.a
  y D01.b ya señalaron fuera de la lista de D01.g. Tras activar,
  `PrescripcionConDistancia` y `RegistroConDistancia` equivalen a los tipos
  públicos y pueden simplificarse. `SerieConDistancia` existe ahora en
  `registro-modelo.ts` y en `editor-modelo.ts` con el mismo significado.
- **Decisión para confirmar con David:** en «La próxima vez» (panel del
  entrenador), una serie en metros se compara con sus metros pautados, igual
  que el tiempo con sus segundos. Si se prefiere que la distancia nunca
  proponga subir carga, basta con cambiar `topeDeSerie`/`proximaVez`. Solo es
  una propuesta: la app no cambia la prescripción.
- Consumidores que siguen siendo binarios, ya repartidos en el inventario:
  - `ficha-modelo.ts:30-32` (`edicionDesdeResultado`, D01.e): hasta entonces,
    un resultado en metros llega a `proximaVez` como `NaN` y queda en «igual».
  - `registro-cliente.tsx`: el mensaje «repeticiones y segundos deben ser
    enteros positivos» (D01.d).
- Sin recorrido autenticado ni prueba en móvil físico. D01.c no cambia nada
  visible: los textos de repeticiones y segundos son idénticos (las pruebas
  existentes de `resumenPrescrito`, `plan/modelo`, `partes` y `tabla-series`
  siguen en verde) y la distancia aún no se puede pautar, guardar ni enviar.

## D01.d

**Cambio realizado.** La entrada y la lectura del cliente nombran cada magnitud
con un `switch` exhaustivo. Una serie en metros ya se pide, se marca y se lee
como metros. La distancia sigue sin poder pautarse ni enviarse: el contrato
público no la acepta hasta D01.g y ninguna pantalla ofrece aún el selector.

- `tabla-series.tsx` («Sesión en curso»):
  - Acepta `EjercicioConDistancia` y un «Anterior» en metros.
  - Cabecera: «Reps», «Seg» o «Metros». Si el ejercicio mezcla unidades, se
    unen («Reps / s», igual que antes, o «Reps / m»).
  - Campo accesible «Metros — ejercicio, serie N». Sugerencia «32 kg, 20
    metros». Marcador y «Hecha» usan los metros pautados.
  - «Anterior» muestra «30 kg × 18 m» o «30 m».
  - Kilos: solo si el ejercicio lleva carga, con la regla de siempre.
  - Nueva `cantidadObjetivo(serie)`, exportada: el objetivo en su unidad.
- `resultado.tsx`: `valoresLegibles` usa un `switch` («20 m · 32 kg»).
  `PrescripcionVisible` acepta `ResultadoConDistancia`, un tipo local en el que
  encaja cualquier resultado actual. Así «Entrenamiento enviado» lee objetivo y
  hecho en metros. `detalle.tsx` del entrenador compila sin cambios.
- `sesion/partes.tsx` (calentamiento y final): `ListaMarcable` acepta
  ejercicios en metros. El relleno de «marcar el ejercicio» pasa aquí como
  `seriesMarcadas`, con la misma lógica pero usando `cantidadObjetivo`. Antes
  vivía sin prueba en `registro-cliente.tsx` y leía el objetivo como segundos
  o, si no, repeticiones.
- `registro-cliente.tsx`: `marcarLista` llama a `seriesMarcadas`. El aviso de
  valores no válidos solo nombra los metros si la sesión los pauta; sin metros,
  el texto no cambia.

No hay migración ni cambios en `packages/shared`.

**Archivos:** `apps/mobile/src/entrenamiento/tabla-series.tsx`,
`tabla-series.spec.tsx`, `registro-cliente.tsx`, `resultado.tsx` (mismo
directorio), `apps/mobile/src/entrenamiento/sesion/partes.tsx`,
`sesion/partes.spec.tsx`, `tasks/evidencia-mejoras-pdf.md`. Hay seis archivos
de código frente a los cinco previstos. El sexto es `sesion/partes.spec.tsx`:
la verificación de la subtarea ya lo ejecuta, y sin él la lista de
calentamiento y `seriesMarcadas` quedarían sin prueba. `resultado.tsx` no tiene
prueba propia, así que su resumen se comprueba en `tabla-series.spec.tsx`.

**Pruebas nuevas** (datos sintéticos, sin datos personales):

- `tabla-series.spec.tsx`, bloque «Distancia en metros (D01, aún sin
  publicar)»:
  - con carga: resumen «2 × 20 m», cabeceras «Kg» y «Metros», «Anterior 30 kg
    × 18 m», etiqueta de la serie «20 m · 32 kg», campo «Metros —…» con
    marcador y sugerencia en metros, sin campos de repeticiones ni segundos;
    escribir y marcar «Hecha» rellenan metros y kilos pautados.
  - sin carga: sin kilos, «Anterior 30 m», marcar rellena solo los metros y
    omitir queda como omitida.
  - error y corrección, con una tabla que guarda su estado: «20,5» marcada no
    cumple `SerieRegistradaDistanciaSchema`. Corregida a «18», el registro es
    `{ tipoMedicion: "distancia", metros: 18, pesoKg: 32 }` sin `repeticiones`
    y cumple `mantieneUnidadYCarga`. Desmarcar conserva «18» en metros.
  - series existentes: «Reps / s», «Anterior 55 kg × 6», «6 reps», etiquetas
    «Repeticiones —»/«Segundos —» y sugerencia «8 repeticiones» sin cambios;
    la mezcla con metros muestra «Reps / m».
  - resumen enviado (`PrescripcionVisible`): objetivo y hecho en metros, con y
    sin kilos, omitida, «3/4» y una serie en segundos que se lee igual.
- `sesion/partes.spec.tsx`:
  - `seriesMarcadas` con repeticiones y segundos: marca con lo escrito o lo
    pautado, quita la omisión y, al desmarcar, conserva lo escrito.
  - distancia con carga: «Paseo del granjero, 2 × 20 m», kilos por serie y
    casilla bloqueada hasta escribir el peso que falta; marcar rellena 20 m y
    los kilos, y cada serie cumple el contrato auxiliar sin repeticiones ni
    segundos.
  - distancia sin carga: sin kilos; marcar rellena 30 m.

**Comandos y resultado real:**

| Comando                                                                                        | Resultado                                                                                                   |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `npm test --workspace apps/mobile -- --runInBand tabla-series.spec.tsx partes.spec.tsx` (base) | 2 suites, 7 pruebas en verde                                                                                |
| Mismo comando con las pruebas nuevas y sin implementación                                      | 2 suites fallidas: 8 fallidas, 7 correctas (rojo esperado; lo anterior a «Reps / m» ya pasaba en su prueba) |
| `npm test --workspace apps/mobile -- --runInBand tabla-series.spec.tsx partes.spec.tsx`        | 2 suites, 15 pruebas en verde                                                                               |
| `npm test --workspace apps/mobile -- --runInBand` (regresión móvil completa)                   | 51 suites, 330 pruebas en verde                                                                             |
| `npm run typecheck`                                                                            | Correcto (shared, api y mobile)                                                                             |
| `npx eslint` sobre los seis archivos de código                                                 | Sin avisos                                                                                                  |
| `npx prettier --write` y `--check` sobre los seis archivos de código y esta evidencia          | Aplicado; todos con el estilo de Prettier                                                                   |

**Pendiente:**

- El aviso de `registro-cliente.tsx` («…repeticiones, segundos y metros deben
  ser enteros positivos…») no tiene prueba automática: `RegistroCliente` no
  tiene spec. Solo lo cubren `npm run typecheck` y la revisión del código.
  Hasta D01.g, el documento local usa el contrato público y no puede pautar
  metros, así que el texto no cambia.
- Sin cambiar en esta subtarea:
  - «Copia · serie N: … kg · …» (respaldo tras un envío desde otro
    dispositivo) muestra la cantidad sin unidad, como ya pasaba con
    repeticiones y segundos. Se ha dejado igual para no alterar la
    presentación existente.
  - La pregunta de RIR («¿Cuántas te quedaban?», «Repeticiones que te
    quedaban») se muestra igual en una serie en metros si el entrenador activa
    el RIR. Decidir en D01.e/D01.g si se ofrece para distancia.
- D01.g: la tabla, la lista y el resumen ya aceptan los tipos `…ConDistancia`.
  Al ampliar las uniones públicas, `ResultadoConDistancia` equivale a
  `ResultadoEntrenamiento` y puede simplificarse. Los casos nuevos no dependen
  del contrato público, así que no hay que invertir ningún cierre.
- Consumidores restantes, ya repartidos: `plan/guia.tsx` y `sesion/tiempo.ts`
  (D01.e), `detalle.tsx` y la lectura de la API (D01.f).
- Sin recorrido autenticado ni prueba en móvil físico. Para repeticiones y
  segundos, la vista activa, la lista y el resumen se ven igual; lo comprueban
  las pruebas existentes y la nueva de presentación. La distancia aún no
  llega a ninguna pantalla real.

## D01.e

**División.** D01.e prevé cinco archivos de producción. Con sus pruebas son
diez, así que se reparte en dos commits de la misma ejecución:

- **D01.e** (esta sección): editor de sesión, ficha del entrenador, guía y
  revisión de `sesion/tiempo.ts`.
- **D01.e2** (sección siguiente): el constructor. Incluye `constructor/tabla.tsx`,
  prevista en D01.e, y `constructor/partes.tsx`, un consumidor que no estaba en
  el inventario de D01.a y que encontró D01.b. Van juntos porque `partes.tsx`
  usa la celda de `tabla.tsx` y ambos se prueban en `constructor.spec.tsx`.

**Cambio realizado.** El editor, la ficha y la guía nombran cada unidad. Una
serie en metros se lee y se edita en metros, con su carga y su id. Al pautar
todavía no se ofrecen los metros.

- `editor-sesion.tsx` («Ajustar esta sesión» y el editor de patrón):
  - Los dos botones fijos pasan a una lista `UNIDADES_OFRECIDAS`
    (repeticiones y segundos). D01.g solo tiene que añadir `"distancia"`.
  - Si una serie ya viene en metros, su unidad aparece marcada («✓ Metros») y
    no se pierde. Antes no se marcaba ninguna y el campo decía «Segundos».
  - El campo usa `NOMBRE_DE_UNIDAD`: «Repeticiones —», «Segundos —» o
    «Metros — Paseo del granjero, serie 1».
  - Cambiar de unidad conserva id y kilos y vacía la cantidad, como antes.
- `ficha-modelo.ts` (tabla de la sesión en la ficha del cliente):
  - `edicionDesdeResultado`, `hechoLegible` y `filasDeSesion` aceptan
    `ResultadoConDistancia` (de `resultado.tsx`, D01.d). Cualquier resultado
    actual encaja sin cambios.
  - La cantidad hecha sale de un `switch` exhaustivo (`cantidadEjecutada`).
    Antes, una serie en metros llegaba como «undefined»: «Hecho» mostraba
    «32 × undefined» y «La próxima vez» recibía `NaN`. Ahora se lee «32 × 20 m
    · 34 × 18 m», «30 m» sin kilos y «40 s, 40 m» si se mezclan.
  - `resumenDeResultado` y `senalesDeVolumen` no cambian: solo cuentan series,
    esfuerzo y RIR, sin leer la unidad.
- `plan/guia.tsx`: nuevo tema «Cómo se mide cada serie», tercero de la lista.
  Sus ejemplos salen de `objetivoDeSerie` con una serie sintética de cada
  unidad, así que se leen como en la sesión: «8–10» son repeticiones, «30 s»
  son segundos y «20 m» son metros. Pide registrar en esa misma unidad y
  añadir los kilos si el ejercicio lleva carga. El tipo de `EJEMPLOS` exige un
  ejemplo por unidad: una unidad nueva sin ejemplo no compila.
- `sesion/tiempo.ts`: revisado, sin cambios. Solo calcula la duración de la
  sesión con `inicio`, `tiempoActivoSegundos` y `tramoActivoDesde`. No lee
  series, unidades ni valores registrados, así que no puede tomar metros ni
  segundos de una serie como tiempo de sesión. `tiempo.spec.ts` sigue en verde.

No hay migración ni cambios en `packages/shared`.

**Archivos:** `apps/mobile/src/entrenamiento-entrenador/editor-sesion.tsx`,
`editor-sesion.spec.tsx`, `ficha-modelo.ts`, `ficha-modelo.spec.ts` (mismo
directorio), `apps/mobile/src/entrenamiento/plan/guia.tsx`,
`plan/pantallas.spec.tsx`, `tasks/evidencia-mejoras-pdf.md`. Son seis archivos
de código: tres de producción y sus tres pruebas. La prueba de la guía vive
en `plan/pantallas.spec.tsx`, donde ya se probaba `Guia`.

**Pruebas nuevas** (datos sintéticos, sin datos personales):

- `ficha-modelo.spec.ts`, bloque «Distancia en metros (D01, aún sin
  publicar)», con series validadas con los contratos auxiliares:
  - tabla: «2 × 20 m · RIR 2–3», sugerido «32 kg», hecho «32 × 20 m · 34 × 18 m»
    y RIR «2». Sin carga: «30 m», «—» y «30 m». La serie de repeticiones del
    mismo resultado se lee igual («1 × 6», «67,5 × 6»).
  - `edicionDesdeResultado` entrega 20, 18 y 30 como valores, con sus kilos y
    RIR, y la serie de repeticiones sin cambios.
  - `hechoLegible`: «30 m, 25 m» y «40 s, 40 m».
- `editor-sesion.spec.tsx`, bloque del mismo nombre:
  - una serie en metros con carga muestra «✓ Metros», «Metros — …» con 20 y
    «Peso kg — …» con 32, sin campos de repeticiones ni segundos. Escribir 25
    produce `{ id, tipoMedicion: "distancia", pesoKg: 32, metros: 25 }`, que
    cumple `SeriePrescritaDistanciaSchema`.
  - al pautar no hay botón de metros, ni antes ni después de pasar a
    segundos, y cada campo nombra su unidad.
  - pasar esa serie a repeticiones conserva id y kilos y deja la cantidad
    vacía: nunca «20 repeticiones».
- `plan/pantallas.spec.tsx`: la guía explica «8–10», «30 s» y «20 m», que son
  lo que `objetivoDeSerie` devuelve para una serie sintética de cada unidad.

**Comandos y resultado real:**

| Comando                                                                                                                      | Resultado                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `npm test --workspace apps/mobile -- --runInBand editor-sesion.spec.tsx constructor.spec.tsx ficha-modelo.spec.ts` (base)    | 3 suites, 7 pruebas en verde                                                                                           |
| `npm test --workspace apps/mobile -- --runInBand editor-sesion.spec.tsx ficha-modelo.spec.ts plan.pantallas.spec.tsx` (rojo) | 3 suites fallidas: 5 fallidas, 11 correctas. Rojo esperado; las dos pruebas de guarda del editor ya cumplían el código |
| Mismo comando tras implementar                                                                                               | 3 suites, 16 pruebas en verde                                                                                          |
| `npm test --workspace apps/mobile -- --runInBand editor-sesion.spec.tsx constructor.spec.tsx ficha-modelo.spec.ts`           | 3 suites, 13 pruebas en verde                                                                                          |
| `npm test --workspace apps/mobile -- --runInBand plan.pantallas.spec.tsx tiempo.spec.ts`                                     | 2 suites, 8 pruebas en verde                                                                                           |
| `npm test --workspace apps/mobile -- --runInBand` (regresión móvil completa)                                                 | 51 suites, 337 pruebas en verde                                                                                        |
| `npm run typecheck`                                                                                                          | Correcto (shared, api y mobile)                                                                                        |
| `npx eslint` sobre los seis archivos de código                                                                               | Sin avisos                                                                                                             |
| `npx prettier --write` sobre los seis archivos de código y esta evidencia                                                    | Aplicado; los de código ya tenían el estilo de Prettier                                                                |

**Pendiente:**

- D01.g: añadir `"distancia"` a `UNIDADES_OFRECIDAS` de `editor-sesion.tsx`
  (archivo ya previsto en D01.g). Hasta entonces, una serie que se pasa de
  metros a otra unidad no puede volver a metros desde el editor. Solo puede
  ocurrir con una serie en metros ya guardada, y hoy ninguna lo está.
- **Cambio visible antes de D01.g:** el tema «Cómo se mide cada serie» de la
  guía menciona los metros aunque todavía no se puedan pautar. Así lo pide
  D01.e («guía … muestran la unidad explícita»). No pauta ni envía nada. Si
  David prefiere no mencionarlos hasta activarlos, basta con quitar ese tema o
  su frase sobre metros.
- **Decisión para confirmar con David:** el RIR sigue disponible para las series
  en metros. El contrato auxiliar de D01.a lo admite (`rir` opcional en
  `ValoresEjecutadosDistanciaSchema`) y el editor no lo oculta. El texto del
  cliente («Repeticiones que te quedaban») sigue igual, ya señalado en D01.d.
- `resumenDeResultado` y `senalesDeVolumen` siguen tipados con
  `ResultadoEntrenamiento`. Con el tipo ampliado, `seriesDeTrabajo`
  (`sesion/modelo.ts`, fuera de esta subtarea) también tendría que aceptar
  `PrescripcionConDistancia`. No leen unidades; tras D01.g los tipos coinciden.
- Sin recorrido autenticado ni prueba en móvil físico. Para repeticiones y
  segundos, el editor y la ficha se ven igual, como comprueban las pruebas
  existentes (`editor-plan.spec.tsx` usa las etiquetas «Repeticiones — …»). La
  guía tiene un tema más, que no se ha revisado en pantalla real.

## D01.e2

**Alcance.** Segunda parte de D01.e: el constructor de planes. Cubre
`constructor/tabla.tsx`, prevista en D01.e, y dos consumidores que no
figuraban en el inventario de D01.a:

- `constructor/partes.tsx:46,50`: la lista de calentamiento, circuito y final.
  Lo señaló D01.b.
- `constructor/constructor.tsx:149` («Exportar PDF», solo en la web):
  escribía «2 × 20» bajo «Series × reps». Encontrado al revisar el
  constructor en esta subtarea.

**Cambio realizado.** El constructor nombra la unidad de cada fila y el panel
ya no reduce la unidad a «segundos sí o no». Los metros siguen sin ofrecerse al
pautar.

- `tabla.tsx`:
  - `UNIDADES_DE_FILA` da el nombre, la columna, la abreviatura y el marcador
    de cada unidad. Lo usan la tabla, la lista y el PDF.
  - Tabla principal:
    - La columna del objetivo dice «Reps», «Seg», «Metros» o la mezcla
      («Reps / Metros»).
    - El campo se llama «Metros de Paseo del granjero» (o «Segundos de …»),
      con marcador «m» o «s». Antes todos se llamaban «Repeticiones de …» y
      mostraban «8–10».
    - Bajo el nombre se lee «En segundos» o «En metros». Una fila de
      repeticiones no lleva etiqueta: una tabla solo de repeticiones se ve
      igual.
  - Panel del ejercicio:
    - El interruptor «Se mide en segundos» se cambia por «Se mide en», una
      lista de opciones como «Tipo de carga». Ofrece `UNIDADES_OFRECIDAS`
      (repeticiones y segundos) y, si la fila ya está en metros, «✓ Metros».
    - Antes, una fila en metros aparecía como «apagado» (repeticiones), y
      tocar el interruptor la pasaba a segundos o repeticiones con la misma
      cifra.
    - Cambiar de unidad conserva id, carga e ids de series y vacía el
      objetivo, como en el editor de sesión. Tocar la unidad actual no borra
      nada.
  - `objetivoConUnidad` devuelve «8–10», «30 s» o «20 m».
- `partes.tsx`: la lista usa la misma tabla de unidades: «Metros de …» con
  marcador «m». Repeticiones («reps») y segundos («s») no cambian.
- `constructor.tsx`: «Exportar PDF» escribe el objetivo con
  `objetivoConUnidad`: «4 × 6», «3 × 30 s», «2 × 20 m» y, fuera de la parte
  principal, «30 m» si no hay dosis. La cabecera sigue siendo «Series × reps».

No hay migración ni cambios en `packages/shared` ni en `constructor/modelo.ts`.

**Archivos:** `apps/mobile/src/entrenamiento-entrenador/constructor/tabla.tsx`,
`partes.tsx`, `constructor.tsx`, `constructor.spec.tsx` (mismo directorio) y
`tasks/evidencia-mejoras-pdf.md`. Son cuatro archivos de código.

**Pruebas nuevas** (`constructor.spec.tsx`, bloque «unidad de cada fila (D01,
metros aún sin publicar)», datos sintéticos validados con
`SeriePrescritaDistanciaSchema`). Las filas salen de `desdeSesionEnRutina` o
`nuevoEjercicio`.

- Tabla principal:
  - Mezcla: «Reps / Metros» y «En metros». «Metros de Paseo del granjero»
    tiene 20 y marcador «m», y la carga inicial, 32. El press banca conserva
    «Repeticiones de …» con «8–10».
  - Solo repeticiones: cabecera «Reps» y ninguna etiqueta «En …».
  - Segundos: «Seg», «En segundos» y «Segundos de Plancha» con 30, nunca
    «Repeticiones de Plancha».
- Panel:
  - Una fila en metros muestra «✓ Metros» y no el interruptor anterior. Pasar
    a repeticiones solo cambia `{ tipo, objetivo: "" }`.
  - Una fila en repeticiones no ofrece metros. Tocar su unidad no cambia nada;
    pasar a segundos vacía el objetivo.
- Lista de calentamiento o final: «Metros de …» (20, «m»), «Segundos de …»
  («s») y «Repeticiones de …» («reps»).
- `objetivoConUnidad`: «8–10», «30 s», «20 m» y vacío si no hay objetivo.

**Comandos y resultado real:**

| Comando                                                                                                            | Resultado                                                                                    |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `npm test --workspace apps/mobile -- --runInBand constructor.spec.tsx` con las pruebas nuevas y sin implementación | 1 suite fallida: 6 fallidas, 4 correctas. Rojo esperado; ya pasaba la de «solo repeticiones» |
| `npm test --workspace apps/mobile -- --runInBand constructor.spec.tsx`                                             | 1 suite, 10 pruebas en verde                                                                 |
| `npm test --workspace apps/mobile -- --runInBand editor-sesion.spec.tsx constructor.spec.tsx ficha-modelo.spec.ts` | 3 suites, 20 pruebas en verde (verificación de D01.e completa)                               |
| `npm test --workspace apps/mobile -- --runInBand` (regresión móvil completa)                                       | 51 suites, 344 pruebas en verde                                                              |
| `npm run typecheck`                                                                                                | Correcto (shared, api y mobile)                                                              |
| `npx eslint` sobre los cuatro archivos de código                                                                   | Sin avisos                                                                                   |
| `npx prettier --write` sobre los cuatro archivos de código y esta evidencia                                        | Aplicado                                                                                     |

Inventario tras D01.e y D01.e2: en `apps/mobile/src` y `apps/mobile/app` no
queda ningún ternario de dos unidades. Lo comprueba
`rg '=== "tiempo"|!== "tiempo"|"tiempo" \?|tipo: v \?'` fuera de las pruebas,
que solo encuentra `apps/api/src/entrenamiento/sesiones.service.ts:27` y
`registros.service.ts:155` (D01.f). Las lecturas directas de `.repeticiones`
fuera de un `switch` quedan en `seguimiento/progreso.tsx:368,377`, que depende
de la mejor serie de la API (D01.f).

**Pendiente:**

- **Cambio de comportamiento para repeticiones y segundos:** en el panel del
  constructor, cambiar entre repeticiones y segundos vacía el objetivo. Antes
  el interruptor lo conservaba, así que «8–10» pasaba a publicarse como 8 s. Es
  la regla de D01.b («sin arrastrar la cantidad de la otra») y la del editor de
  sesión. La etiqueta accesible «Se mide en segundos» desaparece; ninguna
  prueba ni pantalla la usaba.
- D01.g: añadir `"distancia"` a `UNIDADES_OFRECIDAS` de `tabla.tsx` (archivo
  ya previsto en D01.g). `partes.tsx` y `constructor.tsx` no necesitan más
  cambios.
- Sin cambiar, ya señalado en D01.b: `faltaEnDia` (`constructor/modelo.ts`)
  sigue aceptando un rango en segundos («30–40» → 30 s) y, con el objetivo
  vacío en segundos, dice «escribe las repeticiones». Ahora la celda se llama
  «Segundos de …», así que el aviso contradice la etiqueta. Conviene corregirlo
  en una subtarea propia. Tocaría `constructor/modelo.ts` y su prueba, y
  cambiaría qué se puede publicar en segundos.
- La cabecera «Series × reps» del PDF no se ha cambiado. Una fila en metros
  se lee «2 × 20 m» debajo.
- «Exportar PDF» solo existe en la web (`Platform.OS === "web"`) y abre
  `window.print()`. Se prueba `objetivoConUnidad`, no el HTML generado ni la
  impresión.
- Sin recorrido autenticado ni prueba en móvil físico o navegador: la tabla,
  el panel con sus opciones de unidad y la etiqueta «En segundos» no se han
  revisado en pantalla real, en ancha ni en estrecha.

## D01.f

**Origen.** Un intento anterior se cortó por el límite de uso y dejó sin commit
los dos servicios y las tres pruebas de esta sección. Se ha revisado entero, se
ha comprobado el rojo con la lógica anterior y se ha ejecutado de nuevo; no ha
hecho falta corregir el código.

**Cambio realizado.** La entrega y la lectura de la API ya distinguen los
metros, sin publicarlos: las uniones públicas siguen con dos unidades hasta
D01.g, así que hoy nadie puede pautar, guardar ni enviar una serie en metros.

- `registros.service.ts`: nueva `valoresHechos(real)`, exportada, con un
  `switch` exhaustivo que escribe `repeticiones`, `segundos` o `metros` en lo
  ejecutado. Antes, cualquier unidad distinta de tiempo acababa en
  `repeticiones`: una serie en metros se habría guardado como
  `repeticiones: undefined`. `enviar` la usa; el resto no cambia.
  - La validación de entrega sigue siendo `crearRegistroDeSesionSchema` con
    la prescripción del servidor, que desde D01.a aplica
    `mantieneUnidadYCarga`: misma unidad que la pautada y la carga que pide el
    ejercicio.
  - Idempotencia y conflictos sin cambios: el reintento con el mismo
    `operacionId` y el mismo contenido devuelve la misma respuesta; con otro
    contenido, 409 `operacion_incompatible`, antes de validar.
- `sesiones.service.ts`:
  - `cantidad` pasa a un `switch` exhaustivo que incluye `metros`.
  - `mejorSerie` («Anterior»), exportada: más carga y, a igual carga, más
    cantidad, **pero solo en la misma unidad**. 20 m no superan 10
    repeticiones, ni 40 s superan 6 repeticiones. Con unidades distintas e
    igual carga se queda la primera serie, en el orden de la prescripción.
  - `fuerzaEstimada`, exportada: la estimación de Epley que antes estaba en
    línea en `fuerza`, con la misma lógica. Solo repeticiones con kilos;
    tiempo y distancia devuelven `null` y no entran en «Fuerza».
- `detalle.tsx` (prevista): **sin cambios.** La lectura del entrenador delega
  en `PrescripcionVisible` (`resultado.tsx`, D01.d), que ya escribe «Hecho:
  18 m · 34 kg». La nueva prueba de `detalle.spec.tsx` lo comprueba con el
  resumen real. `api.resultado` usa el contrato público, así que hasta D01.g
  no puede llegar un resultado en metros.
- `seguimiento/progreso.tsx:368,377` (inventario de D01.a, «revisar»): sin
  cambios. Lee `/fuerza`, que solo contiene repeticiones con kilos.

No hay migración ni cambios en `packages/shared` ni en pantallas.

**Archivos:** `apps/api/src/entrenamiento/registros.service.ts`,
`sesiones.service.ts` (mismo directorio),
`apps/api/test/entrenamiento-distancia.e2e-spec.ts` (nuevo),
`apps/mobile/src/entrenamiento-entrenador/contratos.spec.ts`,
`detalle.spec.tsx` (mismo directorio) y `tasks/evidencia-mejoras-pdf.md`. Son
cinco archivos de código: `detalle.spec.tsx` ocupa el lugar de `detalle.tsx`,
que no necesita cambios.

**Pruebas nuevas** (datos sintéticos, sin datos personales):

- `entrenamiento-distancia.e2e-spec.ts`:
  - Bloque «Lo hecho y las métricas en metros (D01.f, sin publicar)», sin
    base de datos, con valores validados con los contratos auxiliares:
    - `valoresHechos`: metros con y sin carga, con RIR, sin `repeticiones` ni
      `segundos`, y cumple `ValoresEjecutadosDistanciaSchema`. Repeticiones y
      segundos se guardan igual que antes.
    - `mejorSerie`: metros entre sí (más metros o más carga), repeticiones
      contra metros y segundos contra repeticiones con la misma carga, y los
      casos de siempre en la misma unidad.
    - `fuerzaEstimada`: 20 kg × 10 → 26,7; metros con o sin carga, segundos
      con carga, repeticiones sin kilos y ausencia dan `null`.
  - Bloque HTTP «Entrega e histórico con la tercera unidad preparada (D01.f)»,
    con las unidades actuales:
    - cierre «hasta D01.g no se pueden pautar metros»: un plan con una serie
      en metros recibe 400.
    - otra unidad (`tiempo`/`distancia` en una serie de repeticiones,
      `repeticiones`/`distancia` en una de segundos), una cantidad ajena
      añadida, hecha sin peso cuando el objetivo lleva kilos y hecha sin
      cantidad: 400 al guardar y al enviar. No se guarda borrador, resultado ni
      operación y la agenda sigue abierta.
    - reintento del envío: misma respuesta. Misma operación con otra unidad:
      409 `operacion_incompatible` y el resultado guardado no cambia.
    - histórico: un resultado anterior al RIR, al check-in y al cronómetro,
      escrito directamente en la base, se lee igual en `/resultado` y en la
      ficha. «Fuerza» solo cuenta 20 kg × 10 (los 5 kg de la plancha no) y
      «Anterior» da esa serie. Después de leerlo, el documento guardado es el
      mismo.
  - Bloque `describe.skip` «metros de la pauta al resultado (preparado para
    D01.g)», tres casos que **no cuentan como pasados**:
    - pautar un transporte con carga (2 × 20 m, 32 kg) y zancadas sin carga
      (30 m), guardar, reintentar, enviar con una omitida y leer resultado,
      ficha, «Fuerza» (sin los ejercicios de metros) y «Anterior» en metros.
    - rechazar otra unidad, `repeticiones` añadidas, 0, 12,5, vacío, falta de
      peso con carga externa y kilos sin carga.
    - tras cambiar la pauta a metros, la copia vieja choca
      (`revision_obsoleta`) y las repeticiones ya no entran.
- `contratos.spec.ts` (móvil), bloque «Distancia en metros en la lectura del
  entrenador (D01, aún sin publicar)»:
  - un resultado histórico se lee igual en la sesión y en la ficha
    (`ListadoResultadosSchema`), sin campos añadidos. Otra unidad o una
    cantidad ajena lo invalidan.
  - `mantieneUnidadYCarga` con metros: carga externa, sin carga, repeticiones
    contra metros y metros contra una serie de repeticiones.
  - cierre «no se publica hasta D01.g»: resultado, ficha y «Anterior» aún
    rechazan los metros.
- `detalle.spec.tsx`: el detalle del entrenador, con el resumen real, lee
  «Serie 1 · Objetivo: 20 m · 32 kg», «Hecho: 18 m · 34 kg», «Omitida» y
  «1/2», sin ningún «rep». La prueba anterior sigue usando el resumen simulado.

**Comandos y resultado real:**

| Comando                                                                                                                                                                  | Resultado                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:e2e --workspace apps/api -- --runTestsByPath test/entrenamiento-distancia.e2e-spec.ts test/entrenamiento-registro.e2e-spec.ts` con los servicios de `HEAD` | 1 suite fallida y 1 correcta, 8 pruebas en verde: la de distancia no compila porque faltan las exportaciones (rojo esperado)                                      |
| `npm run test:e2e … entrenamiento-distancia.e2e-spec.ts` con la lógica de `HEAD` solo exportada (copia temporal, restaurada)                                             | 2 fallidas (`valoresHechos` y `mejorSerie`), 5 correctas y 3 omitidas. `fuerzaEstimada` ya dejaba fuera la distancia; las HTTP describen el comportamiento actual |
| `npm run test:e2e --workspace apps/api -- --runTestsByPath test/entrenamiento-distancia.e2e-spec.ts test/entrenamiento-registro.e2e-spec.ts`                             | 2 suites en verde: 15 pruebas correctas y 3 omitidas (las preparadas para D01.g). Base desechable `alpha_omega_e2e_claude_d`                                      |
| `npm run test:e2e … entrenamiento-concurrencia entrenamiento-novedades ficha-entrenador seguimiento` (regresión de envío, ficha y «Fuerza»)                              | 4 suites, 16 pruebas en verde                                                                                                                                     |
| `npm test --workspace apps/api -- --runInBand` (regresión unitaria API)                                                                                                  | 17 suites, 104 pruebas en verde                                                                                                                                   |
| `npm test --workspace apps/mobile -- --runInBand contratos.spec.ts`                                                                                                      | 1 suite, 9 pruebas en verde                                                                                                                                       |
| `npm test --workspace apps/mobile -- --runInBand detalle.spec.tsx`                                                                                                       | 1 suite, 2 pruebas en verde                                                                                                                                       |
| `npm test --workspace apps/mobile -- --runInBand` (regresión móvil completa)                                                                                             | 51 suites, 348 pruebas en verde                                                                                                                                   |
| `npm run typecheck`                                                                                                                                                      | Correcto (shared, api y mobile)                                                                                                                                   |
| `npx eslint` sobre los cinco archivos de código                                                                                                                          | Sin avisos                                                                                                                                                        |
| `npx prettier --write` sobre los cinco archivos de código y esta evidencia                                                                                               | Aplicado                                                                                                                                                          |

Las pruebas del móvil pasaban desde el principio: fijan lo que D01.a y D01.d
ya hacían, porque `detalle.tsx` no cambia.

**Ensayo de los casos preparados (no cuenta como pasado).** Para no dejar a
D01.g casos mal escritos, se añadieron temporalmente las tres variantes de
metros a las uniones públicas de `packages/shared/src/entrenamiento.ts`, se
compiló `shared` y se quitó el `.skip`. Resultado: 9 correctas y 1 fallida, el
cierre «hasta D01.g no se pueden pautar metros» (201 en vez de 400), como se
espera al activar. Después se restauraron el contrato y la prueba, se volvió a
compilar `shared` y se repitió la verificación de arriba. `git status` no
muestra cambios en `packages/shared`. D01.g debe ejecutarlos de verdad.

Inventario tras D01.f:
`rg '=== "tiempo"|!== "tiempo"|"tiempo" \?|tipo: v \?'` sobre `apps/api/src`,
`apps/mobile/src`, `apps/mobile/app` y `packages/shared/src`, fuera de las
pruebas, no encuentra nada. En la API, `tipoMedicion` solo se lee en los
`switch` de estos dos servicios.

**Pendiente:**

- D01.g, en `entrenamiento-distancia.e2e-spec.ts` (ya en su lista): quitar el
  `.skip`, invertir el cierre «hasta D01.g no se pueden pautar metros» y
  ejecutar los tres casos.
- D01.g, fuera de su lista: invertir el cierre «no se publica hasta D01.g» de
  `apps/mobile/src/entrenamiento-entrenador/contratos.spec.ts`. Se suma a los
  ya señalados en D01.a, D01.b y D01.c. Tras activar, `ValoresEnUnidad`
  (`sesiones.service.ts`) equivale a `ValoresEjecutados` y el parámetro de
  `valoresHechos` puede ser solo `SerieRegistrada`.
- **Cambio de comportamiento para repeticiones y segundos:** en «Anterior»,
  con series de repeticiones y de segundos en el mismo ejercicio e igual
  carga, antes ganaba la cifra mayor (40 s frente a 6 repeticiones) y ahora se
  queda la primera. No cambia ningún documento guardado: solo lo que se
  calcula al leer.
- **Decisión para confirmar con David:** la carga se sigue comparando entre
  unidades. En un ejercicio que mezcle series, 34 kg × 18 m gana a
  32 kg × 10 repeticiones como «Anterior». Es la regla de siempre («más
  carga»), pero no se ha consultado.
- Sin recorrido autenticado ni prueba en móvil físico. El detalle del
  entrenador en metros solo se ha comprobado con una API simulada; el
  recorrido real depende de D01.g.

## D01.g

**División.** D01.g prevé cinco archivos, pero activar el contrato obliga a
invertir en el mismo commit los cierres «no se publica hasta D01.g» que D01.a,
D01.b, D01.c y D01.f dejaron en cinco pruebas fuera de esa lista. Si no, la
suite queda en rojo. Se reparte en tres commits de la misma ejecución:

- **D01.g** (esta sección): el contrato público acepta metros, se invierten los
  cierres y se ejecutan los casos HTTP preparados. Siete archivos: uno de
  producción y seis de prueba.
- **D01.g2**: el editor de sesión y el constructor ofrecen «Metros» al pautar.
- **D01.g3**: la recuperación en cliente con una pauta en metros y la
  especificación.

**Cambio realizado.** `packages/shared/src/entrenamiento.ts` incorpora la
variante de distancia a las tres uniones públicas:

- `SeriePrescritaSchema` incluye `SeriePrescritaDistanciaSchema`;
  `SerieRegistradaSchema` incluye `SerieRegistradaDistanciaBase`, con los mismos
  refinamientos (hecha exige cantidad y no puede estar omitida); y
  `ValoresEjecutadosSchema` incluye `ValoresEjecutadosDistanciaSchema`. Los
  esquemas auxiliares se siguen exportando y se definen antes de su unión.
- Todo lo que usa esas uniones acepta ya metros sin más cambios:
  `PrescripcionSchema`, `SesionEnRutinaSchema`, `PatronRutinaSchema`
  (rutinas y planes), `CambiarPrescripcionSchema`, `RegistroSchema`,
  borrador, envío, `ResultadoEntrenamientoSchema`, ficha y «Anterior».
  `crearRegistroDeSesionSchema` y el resultado ya validaban con
  `mantieneUnidadYCarga` desde D01.a.
- El mensaje «Una serie hecha necesita repeticiones o segundos registrados»
  pasa a «Una serie hecha necesita la cantidad registrada en su unidad».
  Ninguna prueba ni pantalla usaba el texto anterior.
- Comentarios que decían «auxiliar hasta D01.g» actualizados. Sin migración:
  prescripción y registro son JSON y ningún documento guardado cambia.

`npm run typecheck` pasa sin tocar ningún consumidor: D01.b–D01.f ya los
habían preparado con `switch` exhaustivos. Tras el cambio, la búsqueda
`rg '=== "tiempo"|!== "tiempo"|"tiempo" \?|\.segundos \?\?|\.repeticiones \?\?'`
en código de producción no encuentra nada. `!== "repeticiones"` solo aparece
donde es correcto: `fuerzaEstimada`, `rangosValidos`, el rótulo «reps» de
`tabla-series.tsx` y la etiqueta «En …» de `constructor/tabla.tsx`.

**Archivos:** `packages/shared/src/entrenamiento.ts`,
`apps/api/src/entrenamiento/contratos.spec.ts`,
`apps/api/test/entrenamiento-distancia.e2e-spec.ts`,
`apps/mobile/src/entrenamiento-entrenador/contratos.spec.ts`,
`editor-modelo.spec.ts` (mismo directorio),
`apps/mobile/src/entrenamiento-entrenador/constructor/modelo.spec.ts`,
`apps/mobile/src/entrenamiento/registro-modelo.spec.ts` y
`tasks/evidencia-mejoras-pdf.md`.

**Pruebas** (datos sintéticos, sin datos personales):

- Cierres invertidos, uno por subtarea anterior:
  - `contratos.spec.ts` (API, D01.a): las tres uniones leen metros sin
    cambiarlos. Siguen rechazando `repeticiones` añadidas, otra unidad, hecha
    sin metros y hecha omitida. `crearRegistroDeSesionSchema` con una pauta de
    repeticiones y metros acepta ambas. Rechaza el transporte sin kilos con
    carga externa, 18 repeticiones en la serie de metros y 8 m en la de
    repeticiones. El registro histórico se lee igual.
  - `editor-modelo.spec.ts` (D01.b): `convertirSesion` publica la sesión en
    metros con su carga; las series nuevas siguen naciendo en repeticiones.
  - `constructor/modelo.spec.ts` (D01.b): reabrir una fila en metros y
    publicarla con `aSesionEnRutina` conserva id, carga, RIR e ids de serie.
  - `registro-modelo.spec.ts` (D01.c): `registroParaEnviar` entrega metros y
    kilos (`34 kg × 18 m`, `25 m` sin carga y una pendiente vacía) y lanza si
    falta el peso con carga externa.
  - `contratos.spec.ts` (móvil, D01.f): resultado, ficha y «Anterior» leen los
    metros sin convertirlos, y rechazan repeticiones, una cantidad ajena o
    la falta de kilos.
- `entrenamiento-distancia.e2e-spec.ts`:
  - el cierre HTTP pasa a «desde D01.g se guardan, reutilizan y publican
    metros»: una rutina con metros se guarda (201), se lee igual y de ella
    sale un plan cuya sesión devuelve las mismas series. Una serie con
    `repeticiones` o `segundos` añadidos, 0, 12,5 o sin metros da 400 al
    guardar la rutina y al asignar el plan.
  - el bloque `describe.skip` preparado en D01.f se ejecuta ya (tres casos):
    pautar un transporte con carga y zancadas sin carga, guardar, repetir el
    guardado, enviar con una omitida, reintentar, chocar con otra unidad
    (409), leer resultado, ficha, «Fuerza» (sin los metros) y «Anterior» en
    metros. Rechazar otra unidad, cantidades no válidas y la carga que no
    toca. Tras cambiar la pauta a metros, la copia vieja choca
    (`revision_obsoleta`), las repeticiones no entran y los metros sí.

**Comandos y resultado real:**

| Comando                                                                                                                                                                                  | Resultado                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `npm test --workspace apps/api -- --runInBand contratos.spec.ts` con el cierre invertido y el contrato de `HEAD`                                                                         | 1 suite fallida: 1 fallida, 34 correctas (rojo esperado: la unión no admite «distancia»)  |
| `npm test --workspace apps/mobile -- --runInBand contratos.spec.ts editor-modelo.spec.ts modelo.spec.ts registro-modelo.spec.ts` (rojo)                                                  | 4 suites fallidas: 4 fallidas, 87 correctas. Solo fallan los cuatro cierres invertidos    |
| `npm run test:e2e --workspace apps/api -- --runTestsByPath test/entrenamiento-distancia.e2e-spec.ts` (rojo)                                                                              | 1 suite fallida: 4 fallidas, 6 correctas. El cierre invertido y los tres casos preparados |
| `npm run build:shared` y `npm run typecheck`                                                                                                                                             | Correcto (shared, api y mobile)                                                           |
| `npm test --workspace apps/api -- --runInBand contratos.spec.ts`                                                                                                                         | 3 suites, 35 pruebas en verde                                                             |
| `npm test --workspace apps/mobile -- --runInBand contratos.spec.ts editor-modelo.spec.ts modelo.spec.ts registro-modelo.spec.ts`                                                         | 10 suites, 91 pruebas en verde                                                            |
| `npm run test:e2e --workspace apps/api -- --runTestsByPath test/entrenamiento-distancia.e2e-spec.ts`                                                                                     | 1 suite, 10 pruebas en verde, ninguna omitida. Base desechable `alpha_omega_e2e_claude_d` |
| `npm run test:e2e … entrenamiento-registro entrenamiento-concurrencia entrenamiento-novedades entrenamiento-rutinas entrenamiento-limites ficha-entrenador seguimiento` (regresión HTTP) | 7 suites, 28 pruebas en verde                                                             |
| `npm run test:e2e … entrenamiento-asignacion`                                                                                                                                            | 1 suite, 4 pruebas en verde                                                               |
| `npm test --workspace apps/api -- --runInBand` (regresión unitaria API)                                                                                                                  | 17 suites, 104 pruebas en verde                                                           |
| `npm test --workspace apps/mobile -- --runInBand` (regresión móvil completa)                                                                                                             | 51 suites, 348 pruebas en verde                                                           |
| `npx eslint` sobre los siete archivos de código                                                                                                                                          | Sin avisos                                                                                |
| `npx prettier --write` sobre los siete archivos de código y esta evidencia                                                                                                               | Aplicado                                                                                  |

**Pendiente:**

- D01.g2: ofrecer «Metros» en `editor-sesion.tsx` y `constructor/tabla.tsx`.
  Hasta ese commit, una serie en metros solo llega por API o por un documento
  ya guardado.
- Tipos y comentarios que quedan redundantes y no se tocan aquí para no ampliar
  el commit: `SerieConDistancia`/`SesionConDistancia` (`editor-modelo.ts`),
  `PrescripcionConDistancia`/`RegistroConDistancia` (`registro-modelo.ts`),
  `ResultadoConDistancia` (`resultado.tsx`, `ficha-modelo.ts`) y
  `ValoresEnUnidad` (`sesiones.service.ts`) equivalen ya a los tipos públicos.
  Sus comentarios aún dicen que el contrato «no la acepta hasta D01.g».
  Conviene simplificarlos en una subtarea propia.
- Los bloques de otras pruebas siguen titulados «(D01, aún sin publicar)»:
  `sesion/modelo.spec.ts`, `sesion/partes.spec.tsx`, `tabla-series.spec.tsx`,
  `ficha-modelo.spec.ts` y `detalle.spec.tsx`. Solo es el nombre; sus casos no
  dependen del contrato.

## D01.g2

**Cambio realizado.** El entrenador ya puede pautar en metros desde las dos
pantallas que D01.g prevé:

- `editor-sesion.tsx` («Ajustar esta sesión» y el editor de patrón):
  `UNIDADES_OFRECIDAS` pasa a repeticiones, segundos y metros. Cada serie
  muestra «Repeticiones», «Segundos» y «Metros». Se retira `unidadesDe`, que
  solo servía para enseñar marcada una unidad no ofrecida y ya no hace nada.
- `constructor/tabla.tsx` (panel del ejercicio, «Se mide en»): el mismo cambio,
  con la etiqueta accesible «Medir … en metros».
- Sin cambios en la regla de D01.e/D01.e2: cambiar de unidad conserva id y
  kilos y vacía la cantidad, así que «12» repeticiones u «8–10» nunca se
  publican como metros. Las series y filas nuevas siguen naciendo en
  repeticiones.

**Archivos:** `apps/mobile/src/entrenamiento-entrenador/editor-sesion.tsx`,
`editor-sesion.spec.tsx` (mismo directorio),
`apps/mobile/src/entrenamiento-entrenador/constructor/tabla.tsx`,
`constructor/constructor.spec.tsx` y `tasks/evidencia-mejoras-pdf.md`. Son
cuatro archivos de código.

**Pruebas** (datos sintéticos; el constructor usa «Cliente de prueba»):

- `editor-sesion.spec.tsx`:
  - el cierre «al pautar aún no se ofrecen metros» pasa a «al pautar se
    ofrecen metros, sin arrastrar las repeticiones escritas». Una serie con
    «12» pasa a «✓ Metros» con el campo vacío. Con 20 m y 32 kg,
    `convertirSesion` produce una sesión que cumple `SesionEnRutinaSchema`, con
    el mismo id de serie y `tipoCarga: "conCargaExterna"`.
  - nueva: cada campo nombra su unidad y cada serie, también una añadida,
    ofrece las tres unidades.
- `constructor.spec.tsx`:
  - el cierre del panel pasa a «se ofrecen las tres unidades y cambiar vacía el
    objetivo». Tocar la unidad actual no cambia nada; pasar a segundos o a
    metros envía `{ tipo, objetivo: "" }`.
  - nueva, de principio a fin con `ConstructorPlan`: añadir «Paseo del
    granjero» desde la biblioteca, marcar carga externa, «Medir … en metros»,
    2 series de 20 m y 32 kg, y «Publicar plan». Lo que llega a `api.asignar`
    cumple `AsignarPlanSchema` y lleva dos series
    `{ tipoMedicion: "distancia", pesoKg: 32, metros: 20 }`.

**Comandos y resultado real:**

| Comando                                                                                                                                   | Resultado                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `npm test --workspace apps/mobile -- --runInBand editor-sesion.spec.tsx constructor.spec.tsx` con las pruebas nuevas y sin implementación | 2 suites fallidas: 4 fallidas, 12 correctas (rojo esperado: no existe el botón de metros) |
| Mismo comando tras implementar                                                                                                            | 2 suites, 16 pruebas en verde                                                             |
| `npm test --workspace apps/mobile -- --runInBand editor-sesion.spec.tsx tabla-series.spec.tsx registro-control.spec.ts` (verificación)    | 3 suites, 33 pruebas en verde                                                             |
| `npm test --workspace apps/mobile -- --runInBand` (regresión móvil completa)                                                              | 51 suites, 350 pruebas en verde                                                           |
| `npm run typecheck`                                                                                                                       | Correcto (shared, api y mobile)                                                           |
| `npx eslint` sobre los cuatro archivos de código                                                                                          | Sin avisos                                                                                |
| `npx prettier --write` sobre los cuatro archivos de código y esta evidencia                                                               | Aplicado                                                                                  |

**Pendiente:**

- Sin recorrido autenticado (C00) ni prueba en móvil físico o navegador: los
  botones «Metros» del editor y del panel, y la publicación real con la API,
  no se han revisado en pantalla. La publicación desde el constructor solo se
  ha comprobado con `api.asignar` simulada; la API real se cubre aparte con las
  pruebas HTTP de D01.g.
- Sin cambiar, del editor anterior: en `editor-sesion.tsx`, tocar la unidad que
  la serie ya tiene también vacía la cantidad (el panel del constructor no lo
  hace), y «+ Añadir serie» crea la serie nueva en repeticiones aunque las
  anteriores sean metros. No convierte nada, pero obliga a elegir la unidad en
  cada serie.
- **Decisión para confirmar con David**, ya señalada en D01.d y D01.e: el RIR se
  sigue ofreciendo en series de metros y el cliente lee «Repeticiones que te
  quedaban».

## D01.g3

**Cambio realizado.** Cierra D01.g con la comprobación de la recuperación en
cliente que pide su criterio y con la especificación al día. No cambia código
de producción.

- `registro-control.spec.ts`, bloque «Cambio de unidad y copias anteriores
  (D01)». Hasta D01.g no se podía probar con metros, porque la copia local
  (`DocumentoSesionSchema`) usa el contrato público:
  - el caso «cambiar la unidad deja pendiente lo hecho» pasa a `it.each` con
    segundos y **metros**. El entrenador cambia la pauta de 10 repeticiones a
    20 m con carga externa. «Recuperar mi copia» deja la serie pendiente y
    vacía, y conserva el respaldo original con la pauta anterior. Se envía
    `{ tipoMedicion: "distancia", metros: null, pesoKg: null, hecha: false }`,
    nunca 10 m. Al reabrir se leen la pauta en metros, la serie pendiente y el
    respaldo.
  - nuevo: «una sesión en metros se recupera sin conexión y reenvía la misma
    operación». 34 kg × 18 m hechos; el primer envío pierde la respuesta; se
    reabre sin red desde el dispositivo, con la pauta en metros y lo escrito
    intactos; el segundo envío repite exactamente la misma petición, con
    `{ tipoMedicion: "distancia", pesoKg: 34, metros: 18, hecha: true }`. Guarda
    el resultado en metros y no deja nada pendiente.
- `SPEC-entrenamiento.md`:
  - la ampliación D01 pasa a «activa desde D01.g» y la activación se cuenta en
    pasado.
  - añade dos reglas ya implementadas: al cambiar la unidad, la copia queda
    pendiente con su respaldo; y las series nuevas nacen en repeticiones.
  - el criterio de aceptación 6 nombra la distancia (metros) junto a
    repeticiones y tiempo, como anunciaba la propia sección.

**Archivos:** `apps/mobile/src/entrenamiento/registro-control.spec.ts`,
`SPEC-entrenamiento.md` y `tasks/evidencia-mejoras-pdf.md`.

**Comandos y resultado real:**

| Comando                                                                                                                                         | Resultado                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `npm test --workspace apps/mobile -- --runInBand registro-control.spec.ts`                                                                      | 1 suite, 20 pruebas en verde                                                              |
| Mismo comando con `packages/shared/src/entrenamiento.ts` de D01.f (`b67582e`), copia temporal compilada y restaurada después                    | 1 suite fallida: 2 fallidas (los dos casos en metros), 18 correctas. Dependen de D01.g    |
| `npm run typecheck`                                                                                                                             | Correcto (shared, api y mobile), con el contrato restaurado                               |
| `npm run test:e2e --workspace apps/api -- --runTestsByPath test/entrenamiento-distancia.e2e-spec.ts` (verificación de D01.g)                    | 1 suite, 10 pruebas en verde, ninguna omitida. Base desechable `alpha_omega_e2e_claude_d` |
| `npm test --workspace apps/mobile -- --runInBand editor-sesion.spec.tsx tabla-series.spec.tsx registro-control.spec.ts` (verificación de D01.g) | 3 suites, 35 pruebas en verde                                                             |
| `npm test --workspace apps/mobile -- --runInBand` (regresión móvil completa)                                                                    | 51 suites, 352 pruebas en verde                                                           |
| `npm test --workspace apps/api -- --runInBand` (regresión unitaria API)                                                                         | 17 suites, 104 pruebas en verde                                                           |
| `npx eslint` sobre `registro-control.spec.ts`                                                                                                   | Sin avisos                                                                                |
| `npx prettier --write` sobre `registro-control.spec.ts`, `SPEC-entrenamiento.md` y esta evidencia                                               | Aplicado                                                                                  |

`git status` tras el ensayo con el contrato anterior solo mostraba
`registro-control.spec.ts` y `SPEC-entrenamiento.md`: `packages/shared` quedó
igual que en D01.g.

**Estado de D01.g** (D01.g, D01.g2 y D01.g3):

- Criterio 1: crear, reutilizar (rutina guardada), publicar y ajustar una
  prescripción en metros, y registrarla, entregarla y consultarla con carga
  cuando procede, está cubierto con pruebas HTTP sobre la base desechable y
  con pruebas de editor, constructor y modelos. Los documentos anteriores
  siguen válidos.
- Criterio 2: los casos HTTP de metros, reintento y cambio de pauta se
  ejecutan (ninguno omitido) y la recuperación en cliente se comprueba con
  `RegistroControl`. No quedan casos preparados sin ejecutar.
- Punto de control D1-C: metros funciona de prescripción a resultado en las
  pruebas; legado, copias locales y fuerza conservan su significado; ningún
  resultado se convierte entre unidades.

**Pendiente:**

- **Recorrido completo autenticado (C00): no disponible, no se ha hecho.** La
  verificación de D01.g lo pide. Falta pautar metros desde la app con una
  cuenta de entrenador, registrarlos y enviarlos desde un cliente, y leerlos en
  la ficha, en web y en móvil físico. Nada de lo anterior se ha visto en
  pantalla real.
- Heredados y sin cambiar: tipos `…ConDistancia` redundantes y sus
  comentarios (D01.g); títulos «aún sin publicar» en cinco pruebas (D01.g); y
  los dos detalles del editor y la decisión sobre el RIR (D01.g2).
- Decisiones abiertas de D01.c y D01.f para David: «La próxima vez» propone
  subir cuando se alcanzan los metros pautados, y «Anterior» compara la carga
  entre unidades.
