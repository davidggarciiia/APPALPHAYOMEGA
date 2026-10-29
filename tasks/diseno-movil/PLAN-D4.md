# D4 · Perfil de entrenador

Fuente: `ESPEC.md` completo, diseño aprobado. Se mantienen contratos, permisos y lógica de datos. Sin dependencias ni operaciones de escritura de Git.

- [x] Inicio y Cartera: cifras de clientes, accesos, filas y filtros móviles, alta flotante y estados.
- [x] Ficha: cabecera propia, Semana/Crear plan, atención condicional, tarjetas de sesiones y hoja de molestias.
- [x] Revisión: tabla compartida con resultado cliente, prescrito/hecho por serie, comentarios por ejercicio y generales, revisión fija y estados.
- [x] Integración: cabeceras propias, Perfil común existente verificado sin modificar `app/perfil.tsx`, botones compactos, nombre conservado desde Semana y regreso a la ficha D4.
- [x] Pruebas por bloque; cobertura trasladada de revisión/comentarios según la tabla siguiente. Sin pruebas saltadas, guardas debilitadas ni cambios de umbrales.
- [x] Revisión independiente de especificación y calidad. Corregido doble inset de zona segura, con prueba que falla al reintroducirlo (48 frente a 24 px).
- [x] Comprobaciones globales finales: suite móvil, tipos y lint.

## Ficheros tocados

Todos relativos a `apps/mobile/`, salvo este plan:

- `app/index.tsx`, `app/cartera.tsx`, `app/entrenamiento/[id].tsx`, `app/entrenador/cliente/[id]/index.tsx`, `app/entrenador/cliente/[id]/entrenos.tsx`.
- `src/componentes/armazon.tsx`, `src/componentes/armazon.spec.tsx`, `src/componentes/botones.tsx`, `src/componentes/botones.spec.tsx`, `src/componentes/perfil.spec.tsx`.
- `src/inicio-entrenador/inicio-entrenador.tsx`, `src/inicio-entrenador/inicio-entrenador.spec.tsx`, `src/cartera/cartera.spec.tsx`.
- `src/entrenamiento-entrenador/detalle.tsx`, `src/entrenamiento-entrenador/detalle.spec.tsx`, `src/entrenamiento-entrenador/detalle-ruta.spec.tsx`, `src/entrenamiento-entrenador/revision-armazon.spec.tsx`, `src/entrenamiento-entrenador/semana-ruta.spec.tsx`.
- `src/entrenamiento-entrenador/comentarios-revision.tsx`, `src/entrenamiento-entrenador/comentarios-revision.spec.tsx`, `src/entrenamiento-entrenador/ejercicios-revision.tsx`.
- `src/entrenamiento-entrenador/ficha/atencion.tsx`, `src/entrenamiento-entrenador/ficha/atencion.spec.tsx`, `src/entrenamiento-entrenador/ficha/checkins.tsx`, `src/entrenamiento-entrenador/ficha/checkins.spec.tsx`, `src/entrenamiento-entrenador/ficha/ficha-cliente.tsx`, `src/entrenamiento-entrenador/ficha/ficha-cliente.spec.tsx`, `src/entrenamiento-entrenador/ficha/sesiones.tsx`, `src/entrenamiento-entrenador/ficha/sesiones.spec.tsx`.
- `src/entrenamiento/resultado.tsx`, `src/entrenamiento/resultado.spec.tsx`.

## Trazabilidad de pruebas sustituidas

La revisión y los comentarios salen de la tabla embebida de Ficha hacia su pantalla. Las seis pruebas anteriores de `ficha/sesiones.spec.tsx` quedan cubiertas así:

| Prueba anterior                                                               | Cobertura equivalente nueva                                                                                                                                                                    |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Distingue día/mes de comentarios de semanas distintas                         | `detalle.spec.tsx`: «conserva la operación de un comentario incierto para reintentarlo y distingue sus fechas»                                                                                 |
| Marca revisada solo al pulsar y conserva la confirmación de cada sesión       | `detalle.spec.tsx`: «solo marca revisada la sesión cuando el entrenador lo solicita» y «reintenta una revisión fallida, evita dos peticiones y deshabilita la acción confirmada»               |
| Error de revisión permite reintentar sin confirmar antes de tiempo            | `detalle.spec.tsx`: «reintenta una revisión fallida, evita dos peticiones y deshabilita la acción confirmada»                                                                                  |
| Doble pulsación revisa A una vez y su respuesta tardía no marca B             | `detalle.spec.tsx`: prueba anterior y «una revisión tardía de otra ruta no confirma la sesión visible»                                                                                         |
| Resultado nuevo conserva la sesión y el borrador activo                       | `detalle.spec.tsx`: «el sondeo conserva el borrador de un ejercicio abierto»; `detalle-ruta.spec.tsx` comprueba el destino explícito de sesión, sin selector dependiente del orden del listado |
| Respuesta perdida conserva el reintento de A y separa borrador/operación de B | `comentarios-revision.spec.tsx`: «separa el borrador y la operación de dos sesiones durante un reintento incierto»                                                                             |

Las pruebas nuevas de `ficha/sesiones.spec.tsx` cubren tarjetas, filtro, todas las series, estados, vacío, metadatos reales, error/reintento y concurrencia máxima de cuatro lecturas. Las restantes pruebas nuevas cubren navegación, Perfil por rol, molestias en hoja, insets y comparación por serie. Se conserva la suite previa de sondeo y permisos.

## Contrato y límites

`ListadoResultados` no incluye `revisadaEn`: se consulta mediante `leerEntrenador` al abrir Resumen/Sesiones, sin alterar API ni sondear todos los estados cada diez segundos. Las lecturas desconocidas o fallidas nunca se presentan como «Sin revisar».

Fuera de D4: constructor 5.5, series extra y vectorización del emblema, por el alcance y las decisiones del dueño. Las señales históricas de volumen se conservan para mantener la lógica existente.

Sin dispositivo/emulador local conectado y sin acceso al host del navegador: no se ha verificado visualmente en ejecución, con teclado nativo o TalkBack/VoiceOver; tampoco hápticos ni rendimiento real/60 fps. Animación y reduce-motion se verifican mediante los componentes existentes y sus pruebas, sin una medición nativa.

## Verificación

- `npm.cmd test --workspace apps/mobile`: 124 suites, 1165 pruebas, todas correctas.
- `npm.cmd run typecheck`: correcto en raíz, API, móvil y shared.
- `npm.cmd run lint`: correcto, ESLint y Prettier de todo el repositorio.
- `git diff --check`: correcto; sin commits ni cambios de rama.
