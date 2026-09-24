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
