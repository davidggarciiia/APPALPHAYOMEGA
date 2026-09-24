# Spec: `seguimiento-corporal` — configuración y progreso

> Iteración del 24-09-2026. [Mapa de capacidades](CAPABILITY-MAP.md) · [Plan vigente](tasks/plan.md) · [Verificación](tasks/todo.md).

## Propósito y responsabilidades

El entrenador decide qué indicadores verá cada cliente, en qué orden y qué debe registrar. El cliente consulta su evolución y anota sus resultados, sin crear ni modificar pruebas u objetivos. El nutricionista asignado puede consultar la configuración para coordinar su trabajo, sin editarla.

La configuración incluye indicadores `peso`, `pasos`, `sueno`, `cintura`, `fuerza` y `pruebas`; registros solicitados diarios o semanales (con día de semana); objetivo de peso para bajar, mantener o subir, con rango opcional; y pruebas físicas prescritas con nombre, unidad e identificador estable.

## Estado inicial y datos anteriores

Una cuenta sin configuración nueva conserva los indicadores actuales. Peso, pasos y sueño se solicitan diariamente; no se inventan pruebas ni un objetivo de peso. Las medidas y pruebas históricas permanecen accesibles. Las pruebas antiguas sin identificador de prescripción se muestran como historial; las nuevas del cliente referencian una prueba prescrita.

Una variación de peso indica dirección y magnitud. Sin una pauta suficiente del entrenador no se colorea una bajada como éxito ni una subida como fracaso. Progreso muestra primero los indicadores elegidos y el próximo registro que corresponde; el historial completo continúa disponible.

## Contrato y permisos

`GET /seguimiento/clientes/:clienteId/configuracion` permite leer al cliente propio, su entrenador y el nutricionista asignado. `PUT` en la misma ruta solo permite al entrenador responsable editar. La petición incluye `revision`; una revisión desactualizada recibe conflicto y conserva el borrador local del editor. El cliente solo puede registrar resultados de pruebas con `pruebaId` presente en la configuración vigente.

La migración es aditiva. Las cuentas y registros previos siguen siendo válidos; ningún campo nuevo obliga retrospectivamente a introducir datos ni elimina el historial.

## Valoración inicial y revisiones

Contratos en `packages/shared/src/valoraciones.ts` (V01 de [todo.md](tasks/todo.md)). Una **valoración** es una visita del entrenador: inicial o revisión. Al crearla se copian las definiciones activas de la **plantilla** del cliente para los bloques elegidos (`medidas`, `pliegues`, `bioimpedancia`, `pruebas`, `fotos`); cambiar después la plantilla no altera esa copia. Una revisión copia definiciones, nunca resultados; los anteriores solo se consultan como referencia fechada.

**Definiciones.** Cada campo corporal (magnitud, unidad, zona, lateralidad, instrumento, protocolo) y cada prueba (tipo, variante, protocolo, duración prescrita, instrumento, métricas con una principal) tiene `id` y `version`. Renombrar o desactivar conserva la versión; cambiar cómo se mide la sube (`versionarDefinicionCorporal`, `versionarDefinicionPrueba`) y crea otra serie de comparación. No hay listado fijo de pliegues ni perímetros: los elige el entrenador. Los textos son planos (sin `<` ni `>`) y no contienen fórmulas.

**Resultados.** Cada dato es `pendiente` (sin dato), `registrado` o `noRealizado` con motivo opcional. En pruebas, el cero es un resultado real; en magnitudes físicas (peso, altura, perímetro, pliegue, grasa, masas, agua) no se admite cero, y el peso empieza en 30 kg como en el registro diario. Los valores llevan como máximo dos decimales. Un pliegue guarda el valor adoptado y hasta cinco lecturas originales; las lecturas pueden guardarse mientras el valor sigue `pendiente`, hasta que el profesional lo adopte. Una prueba guarda sus métricas por clave; las opcionales no recogidas (por ejemplo, FC de recuperación) no aparecen. El porcentaje de grasa por pliegues es el que calculó el profesional, con método y fecha; la app no lo calcula. Se distinguen fecha de toma (día de la visita, o de la prueba si fue otro día), creación, actualización y publicación.

**Borrador, publicación y corrección.** El borrador contiene definiciones copiadas, resultados, `conclusion` y `notasInternas`. Se edita nombrando `borradorId` y su `revision`; las definiciones no se cambian desde el borrador. Añadir un bloque copia las definiciones activas de la plantilla vigente para ese bloque; retirarlo solo se admite si no tiene resultados anotados. Publicar congela `proyeccionPublica`: sin notas internas, sin pendientes y solo las definiciones con resultado. `conclusion`, las `notas` de cada prueba y el `motivo` de un no realizado se publican; solo `notasInternas` queda para el entrenador, que conserva el documento interno de la versión vigente (`documentoVigente`). Para corregir, `POST valoraciones` con `corrigePublicacionId` abre un borrador nuevo sobre la **misma** visita copiando ese documento interno (definiciones, pendientes y notas); al publicarlo, la nueva versión (`numero` + 1) indica en `sustituyeId` la que reemplaza, que se conserva como auditoría. Una corrección no crea otra visita ni otro punto en la evolución.

| Rol                    | Lee                                                                                                                             | Escribe                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Entrenador con alcance | Plantilla, historial con estado de trabajo, visitas (`ValoracionProfesional`: borrador, versión vigente y su documento interno) | Plantilla, visitas, borradores, publicaciones, correcciones, próxima revisión |
| Cliente propio         | Publicación vigente (`ValoracionCliente`), historial publicado (`ListadoValoracionesPublicadas`, sin estado) y próxima revisión | Nada de la valoración profesional; solo aportaciones que se le soliciten      |
| Nutricionista asignado | Resultados corporales publicados (`ValoracionCorporal`, sin pruebas, conclusión ni notas) e historial publicado                 | Nada                                                                          |

El nutricionista no recibe fotos, notas internas ni borradores; ampliarlo requiere una decisión expresa. Los permisos se aplican en la API antes de leer el documento, no ocultando botones.

**Idempotencia y errores.** Crear y publicar llevan `operacionId`: repetir la misma operación con el mismo contenido devuelve el mismo resultado; con contenido distinto, `409 operacion_incompatible`. Guardar o publicar con una `revision` que no es la actual devuelve `409 revision_obsoleta` y conserva la versión del servidor. Publicar una corrección que no nombra la publicación vigente, abrir una segunda corrección, editar una visita sin borrador abierto o nombrar un `borradorId` que no es el abierto devuelve `409 estado_incompatible`. Un cuerpo inválido es `400 solicitud_invalida`; un rol sin permiso, `403`; una visita inexistente o de otro cliente, `404`. Para cliente y nutricionista, una visita sin publicación vigente responde `404`, igual que una inexistente; se comprueba antes de leer el documento. La plantilla solo la lee y guarda el entrenador: cambiar cómo se mide una definición exige subir su versión y quitar una definición no se admite (se desactiva).

**Próxima revisión.** `pauta: null` es «Sin programar»; si existe, lleva fecha **o** intervalo en semanas y los bloques que se repetirán. Se guarda con `revision`. No se fija una frecuencia por defecto ni se repiten automáticamente todas las pruebas. Solo crear una revisión con `cumplePauta` (la revisión vigente de la pauta) la marca cumplida y guarda `cumplidaPorId`; abrirla no. Guardar una pauta nueva la deja otra vez pendiente.

## Aceptación

1. El entrenador configura y reabre los indicadores, frecuencia, objetivo y pruebas de un cliente; el cliente ve exactamente lo publicado.
2. Un registro semanal aparece en el día pautado y uno diario cada día. Sin objetivo, el cambio de peso se interpreta de forma neutral.
3. El cliente registra una prueba prescrita, pero no puede editar su definición ni crear otra. Una prueba histórica sigue visible.
4. Dos ediciones concurrentes no se sobrescriben silenciosamente. Los roles ajenos no obtienen acceso ni modifican la configuración.
5. Las comprobaciones HTTP se ejecutan en una base de pruebas separada; la verificación física y de usabilidad se registra en `tasks/todo.md`.
