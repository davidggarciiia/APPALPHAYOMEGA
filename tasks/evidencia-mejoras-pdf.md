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
