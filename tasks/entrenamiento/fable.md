# Encargo para Fable — segunda iteración de Alpha & Omega

> Cierre del encargo (2026-09-19): Codex integró los commits de Fable y terminó
> F02c–F08 por petición de David. La entrega que sigue se conserva como registro
> original; sus pendientes están resueltos salvo la validación física Android/iOS.
> Estado vigente: [integracion.md](integracion.md) y [verificacion.md](verificacion.md).

> Reparto aprobado el 2026-09-18. Dudas de lectura resueltas.
> Base común de código C00–C03: `83177eb`. F01 puede comenzar.

## Contexto que debes leer

El usuario pidió continuar con Agent Skills, no Superpowers. La entrevista y
las especificaciones y el reparto están aprobados. David validó el checkpoint 0A
con «adelant» y Codex completó C03. La evidencia está en [verificacion.md](verificacion.md).

1. `C:/Users/david/.claude/skills/using-agent-skills/SKILL.md`.
2. [Tu plan](plan-fable.md), [coordinación](plan.md) y [SPEC.md](../../SPEC.md).
   [Tus tareas](todo-fable.md) y [las de Codex](todo.md) indican las dependencias.
3. [Spec de catálogo](../../SPEC-catalogo-ejercicios.md), limitada al subconjunto
   de texto descrito por el plan para esta iteración.
4. [Entrenamiento](../../SPEC-entrenamiento.md) y [agenda](../../SPEC-agenda.md).

La base revisada es `055c401`, con los nuevos arreglos de identidad. No los
reimplementes ni los retires. El plan de identidad en `tasks/plan.md` y
`tasks/todo.md` conserva pendientes: no lo sustituyas.

## Tu responsabilidad

- F01–F03: catálogo mínimo de extremo a extremo, con permisos y pruebas.
- F04, F06, F07a–F07b: pantallas del entrenador para crear una sesión, ampliar a varias
  semanas, reutilizar rutinas y ajustar sesiones no iniciadas.
- F05: panel para consultar los resultados enviados.
- F08: revisar y comprobar tus pantallas contra la API integrada.

No basta con maquetas: cada incremento debe acabar conectado a los servicios
reales. Mientras un endpoint no esté integrado, las respuestas de prueba cumplen
los esquemas compartidos y se marcan como tales en la entrega.

## Límites de escritura

Tus archivos: catálogo de API, tests de catálogo, componentes móviles del catálogo,
`apps/mobile/src/entrenamiento-entrenador/` y rutas `apps/mobile/app/entrenador/`.
Las rutas del catálogo van en `apps/mobile/app/catalogo/`.

Codex mantiene Prisma y migraciones, `packages/shared/`, `app.module.ts`, los
archivos de dependencias, `src/lib/`, `src/sesion.tsx`, `_layout.tsx`, `index.tsx`,
la ficha existente de cliente y los documentos de coordinación.

Si necesitas cambiar un contrato o un archivo común, entrega la propuesta exacta
a Codex por medio de David. No lo modifiques unilateralmente ni inventes una API
para salir del paso. Nunca edites el guard de alcance general para conceder
acceso al catálogo: su permiso depende del rol, no de un cliente asignado.

## Inicio y secuencia

La base común de código C00–C03 es `83177eb`; los documentos de entrega se
actualizan en el commit siguiente de `codex/entrenamiento-iteracion-2`. Usa ese
commit de documentación para que el worktree incluya este encargo actualizado.
David te facilitará el hash; confirma que desciende de `83177eb` antes de crear
el worktree separado, rama `codex/fable-catalogo`. No cambies la rama ni instales
paquetes en la carpeta principal que está usando Codex.

Empieza por F01; después F02 y F03. Entrega el catálogo con sus commits y pruebas.
Continúa F04 cuando Codex comparta el contrato y el servicio de asignación C09.
F05 necesita C13b y C14; F06 necesita C16a; F07a necesita C16b; F07b necesita C17.
Puedes preparar componentes
antes con contratos fijos, pero las pruebas completas esperan al proveedor real.

Aplica `incremental-implementation` y `test-driven-development`; revisa con
`code-review-and-quality`. Un fallo no autoriza a borrar tests ni a descartar
cambios de otra sesión. Mantén la marca negra y dorada y usa el tema existente.
En cada checkpoint presenta evidencia para revisión de David antes de avanzar.

## Respuesta a las dudas de la entrega de lectura

Decisiones del 2026-09-18 para F01; no se modifica tu archivo de entrega.

1. La columna es `Ejercicio.nombreNormalizado`, con índice único. El servicio
   normaliza con `nombre.trim().replace(/\s+/gu, " ").toLocaleLowerCase("es")`.
   No se eliminan acentos. Fable implementa y prueba esa función dentro del
   catálogo; el formulario no decide la unicidad y presenta el 409 del servidor.
   No hace falta exportar la función a `shared` para un único consumidor.
2. Secundarios: relación `Ejercicio.gruposSecundarios` a
   `GrupoSecundarioDeEjercicio`, clave compuesta `ejercicioId, grupo`.
   El DTO mantiene el array de nombres; Fable transforma la relación al leer.
3. Nombre repetido: HTTP 409 y cuerpo `{ statusCode: 409, codigo:
"nombre_duplicado", message: "Ya existe un ejercicio con ese nombre" }`.
   El formulario usa `codigo`, nunca compara el mensaje. El esquema ya está
   exportado por `@alpha-omega/shared` y el transporte lo reconoce.
4. `grupo` coincide con principal o secundario. El mapa muscular queda fuera.
5. Cliente que pide `retirado` o `todos`: 403. Leer uno retirado por id sigue permitido.
6. `buscar` usa el nombre normalizado y conserva acentos; orden por nombre
   normalizado y después id para que sea estable.
7. Retirar/reponer: 200 con `EjercicioSchema`; repetición idempotente.
8. `:id` se valida con `z.uuid()` en el controlador, sin nuevo alias compartido.
9. Edición textual completa sin revisión en esta iteración; última escritura gana.
10. Pruebas de catálogo con prefijo propio y turno de base de datos, como propones.

## Transporte disponible para F02

Importa `crearPeticionAutenticada` y el tipo `PeticionAutenticada` desde
`src/lib/peticion-autenticada.ts`. Tu adaptador de catálogo puede recibir esa
función como dependencia. La fábrica recibe un getter que devuelve el token
vigente o `null`; cada llamada consulta ese getter. No cierres sobre una copia
antigua del estado de sesión: actualiza la referencia o reconstruye el adaptador
cuando cambie el token. No crees un almacén global de credenciales.

La firma es `pedir(ruta, esquemaZodDeRespuesta, opcionesRequestInit?)`.
La ruta empieza por `/`, el cuerpo se pasa como JSON serializado y los headers
se combinan con `Authorization: Bearer …`. La respuesta se valida antes de
entregarla al consumidor; un 204 requiere un esquema que admita `null`.

Errores exportados por `src/lib/http.ts`:

- `ErrorDePeticion`: cuerpo validado de 400/409. Para nombre duplicado comprueba
  `error.detalle.codigo === "nombre_duplicado"`. `error.codigo` sigue siendo el
  estado HTTP numérico, por compatibilidad con identidad.
- `ErrorDeSesion`: 401 o ausencia de token antes de la petición.
- `ErrorDePermiso`: 403; no indica cierre de sesión.
- `ErrorDeRed`: fallo de transporte, cancelación o límite de diez segundos,
  también durante la lectura del cuerpo.
- `ErrorDelServidor`: otros estados HTTP o un cuerpo de error no conforme.

El esquema de error 400 requiere `{ statusCode: 400, codigo: "solicitud_invalida",
message: "…" }`. Los de 409 admiten `nombre_duplicado`, `revision_obsoleta` y
`operacion_incompatible`. Son contratos estrictos: no añadas campos extra.

C06 añadirá la renovación coordinada; esta base no renueva ni reintenta sola.
F02 puede conectar con una sesión vigente, dejando la prueba de sesión larga
pendiente de C06. Conserva cuerpo e id de operación al reintentar operaciones
que lo incluyan; el transporte no genera otro id. Las respuestas de identidad
anteriores y sus imports siguen funcionando.

## Qué entregar en cada checkpoint

- Commit o commits y lista de archivos modificados.
- Criterios satisfechos y comportamiento que ya se puede probar desde el móvil.
- Comandos ejecutados y resultado; distingue prueba con mocks y dispositivo.
- Cambios de contrato propuestos, limitaciones y siguiente tarea.

Coordina las pruebas HTTP con Codex para no compartir la base en uso; las
unitarias y móviles no necesitan ese turno. No publiques, subas a GitLab ni
fusiones a `main` como efecto de este encargo.

## Mensaje corto para iniciar esta sesión

> Sigue Agent Skills y lee `tasks/entrenamiento/fable.md` y `plan-fable.md`.
> Tu parte es el catálogo completo mínimo y las pantallas del entrenador. Codex
> lleva contratos, migraciones, agenda y registro del cliente. PLAN y TASKS están
> aprobados; C00–C03 están en `83177eb`. Parte del commit de documentación que
> acompaña a esta entrega para conservar el encargo actualizado. Crea tu worktree
> independiente en `codex/fable-catalogo` y empieza F01. Respeta los archivos comunes,
> coordina las pruebas HTTP y entrega tus avances por los checkpoints indicados.
