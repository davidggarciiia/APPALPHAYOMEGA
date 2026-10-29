# F · Ficha del cliente

Diseño aprobado: `diseno-movil/ESPEC-ficha.md`; contratos y permisos existentes prevalecen. Sin commits ni dependencias nuevas.

- [x] Contrato aditivo `revisadaEn`, mejor serie semanal por Epley y estado observado; fuerza solo principal. El resumen semanal ya filtraba principal y conserva su prueba de secciones.
- [x] Reutilizar progresión E2 y sustituir la recomendación de revisión por estado observado. Regresión de calentamientos y aproximaciones.
- [x] Barra del bloque, tira accesible y tarjetas condicionales; movimiento de marca reducido y pausa de barra durante hojas.
- [x] Ficha sin pestañas: cadencias 10/60 s, cargas y destinos con datos vivos; permisos, copias, respuestas concurrentes y hoja E6.
- [x] Pantallas de sesiones, progreso, valoraciones y molestias; enlaces anteriores y protección del editor.
- [x] Pruebas de navegación y rutas independientes; permisos, guardado, sondeo y accesibilidad preservados.
- [x] Verificación final con límites: móvil 300 s, API 180 s, e2e 300 s, typecheck 180 s y lint 180 s. Revisar diff sin modificar Git.

## Ficheros

- `apps/mobile/src/entrenamiento-entrenador/ficha/`: ficha y pruebas reescritas; nuevos `use-datos-ficha.ts`, `barra-bloque.tsx`, `tira-semana.tsx`, `tarjeta-accion.tsx`, `cargas-ficha.tsx`, `destino-ficha.tsx` y sus pruebas; progresión y sesiones adaptadas.
- `apps/mobile/app/entrenador/cliente/[id]/`: nuevas rutas `sesiones.tsx`, `progreso.tsx`, `valoraciones.tsx`, `molestias.tsx`.
- `apps/mobile/src/entrenamiento-entrenador/ejercicios-revision.tsx`, su nueva prueba y `detalle.spec.tsx`.
- `apps/api/src/entrenamiento/sesiones.service.ts`, su prueba, `apps/api/test/ficha-entrenador.e2e-spec.ts`, `progresion-ejercicio.e2e-spec.ts`.
- `packages/shared/src/entrenamiento.ts`, `progresion.ts`, `packages/shared/test/progresion.spec.cjs`.
- Este plan. Los tipos ignorados de Expo se regeneraron mediante la función oficial de Expo57.

## Sustitución de pruebas

Ninguna prueba se salta ni se debilitan guardas. Las pruebas de la antigua interfaz se sustituyen por estas comprobaciones del comportamiento equivalente:

| Antes                                                                                     | Sustitución                                                                                                                                                             |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Valoración inicial en Resumen, alta y enlace de Notificaciones                            | `ficha-cliente.spec.tsx`: cliente nuevo, tres casos sin inicial y dos accesos antiguos a rutas independientes; `destino-ficha.spec.tsx`: inicial con nacimiento         |
| Cinco pestañas y dos botones de cabecera; Semana con nombre completo                      | Ficha: cabecera sin pendientes, cuatro destinos sin pestañas y menú con nombre completo                                                                                 |
| Cambiar pestaña conserva el editor                                                        | Destino: valoración independiente conserva borrador al refrescar y al cancelar salida, con protección de Atrás                                                          |
| Aislamiento de ficha y borradores al cambiar cliente/cuenta                               | Ficha: aislamiento de ficha y hoja al cambiar identidad; editor ya vive en una ruta con clave por cliente/cuenta                                                        |
| Sondeo, espera de consulta pendiente, conservación de nombre/nacimiento, copia y permisos | Ficha: mismos casos, ampliados a cadencia 60 s y nueve fuentes; fallo lento persistente hasta recuperación                                                              |
| Responder no reabre una molestia por una respuesta antigua                                | Ficha: sondeo anterior no reabre molestia respondida                                                                                                                    |
| Ver sesión de molestia C o fuera del historial y revisar la última                        | Destino: sesión real de molestia fuera del historial; Ficha: abrir la única pendiente y varias con filtro                                                               |
| Revisión individual de Última sesión y consulta del resto al abrir Sesiones               | Ficha: resultados sin N+1; Sesiones: campo agregado sin lecturas extra y cinco pruebas previas de fallback/errores/concurrencia conservadas                             |
| Revisión sin permiso oculta ficha                                                         | Ficha: resultados sin permiso ocultan datos; Sesiones mantiene `sinAcceso` para fallback                                                                                |
| Resumen reserva novedades para Notificaciones                                             | Ficha: cabecera sin pendientes ni novedades; no llama a `novedades`                                                                                                     |
| Carga inicial, Volver, hoja E6, enlace antiguo y guardado                                 | Ficha: esqueletos, historial, menú y hoja con actualización del nombre                                                                                                  |
| Próxima vez en revisión y selección de fuerza por mayor kg                                | `detalle.spec.tsx` y `ejercicios-revision.spec.tsx`: estado observado, tres estados y fallos auxiliares; unitaria API y e2e de progresión ahora seleccionan mayor Epley |

También se cubren semanas con ajustes reales, cuatro estados de día, K-1, texto grande, reduce-motion, pausa durante hojas, primera semana, RIR nulo, series omitidas y exclusión de secciones no principales en móvil/API.

## Adaptación al contrato

La lista semanal y `PlanVigente` no exponen los ejercicios prescritos. Cargas muestra hasta cuatro principales con historial enviado; los ejercicios prescritos sin ningún envío no se inventan ni generan lecturas por sesión. No se amplía ese contrato. Las aproximaciones se representan como ejercicios de calentamiento, ya que no existe una bandera por serie. Se conserva `seccion` ausente como principal por compatibilidad.

Se mantiene el destello puntual del botón existente: la sección 3.1 del ESPEC general manda sobre el bucle dorado propuesto en la sección 10 de la ficha.

## Verificación

API: 48 suites / 501 pruebas; shared: 43 pruebas; e2e: 50 suites / 537 pruebas, 179,535 s, límite 300 s, `POSTGRES_DB=alpha_omega_e2e_codex`. Caso 15 clientes y 8 semanas: 253,7 ms. Móvil final: 152 suites / 1.546 pruebas, 95,51 s, límite 300 s. Typecheck completo en verde. Lint completo y diff sin errores. Sin commits ni cambios de rama.

Pendientes de comprobación manual: dispositivo real, hápticos, teclado físico y rendimiento/60 fps reales.
