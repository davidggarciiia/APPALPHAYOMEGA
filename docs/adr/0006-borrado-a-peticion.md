# ADR 0006 — Borrado a petición del titular

**Estado: PROPUESTO (28-10-2026). No aprobado y sin implementar.** Lo redacta Claude para que David decida (D2 de `tasks/plan-mejoras-2026-10-27.md`). Nada de lo que sigue es asesoría jurídica: las dudas legales están listadas al final y **deben resolverlas una persona con título** antes de escribir código.

## Contexto

`SPEC-identity.md` pide dos cosas que chocan en el detalle:

- **#18 Borrado a petición:** «anonimiza los datos personales y elimina los de salud».
- **#14 Gestión de clientes:** el entrenador «nunca borra, porque el histórico de entrenos tiene que sobrevivir a la baja».

Hoy existe la **baja** (estado `desactivado`: revoca sesiones y quema enlaces, ver PENDIENTE §9) y la **retirada del consentimiento** (conserva lo ya guardado). No existe el borrado: la revisión del 27-10 lo lista como pendiente que impide afirmar preparación completa.

## Decisión propuesta

Separar **tres cosas** que hoy se mezclan en la palabra «borrar»:

1. **Anonimizar la identidad** (siempre): el titular deja de ser identificable.
2. **Eliminar los datos de salud** (siempre): medidas, pruebas, valoraciones, fotos, dietas y registros de comida/molestias del titular se borran de verdad, incluidos los objetos del almacén.
3. **Conservar el histórico de entrenamiento solo si queda desvinculado de la persona** (decisión de David, ver opciones): sin nombre, correo, fechas de nacimiento ni forma de volver a atribuirlo.

### Tabla campo a campo (según `apps/api/prisma/schema.prisma`)

| Modelo / dato                                                                                                                                                                   | Acción propuesta                                                                      | Nota                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `Usuario`: `email`, `nombre`, `apellidos`, `telefono`, `fechaNacimiento`, `fotoUrl`, `passwordHash`                                                                             | **Anonimizar** (valor neutro o `null`; `email` único tipo `eliminado-<uuid>@invalid`) | La fila se conserva para no romper claves foráneas y la autoría del entrenador. `estado = desactivado`.                    |
| `TokenRefresco`, `TokenActivacion`, `TokenRecuperacion`                                                                                                                         | **Eliminar**                                                                          | Revocar sesiones primero, en la misma transacción.                                                                         |
| `AsignacionNutricionista` (del cliente)                                                                                                                                         | **Eliminar**                                                                          | Pierde sentido sin titular.                                                                                                |
| `ConsentimientoSalud`                                                                                                                                                           | **Conservar** versión, fecha y hora, sin vínculo a datos personales                   | Sirve de prueba de que hubo base jurídica. **Duda jurídica 3.**                                                            |
| `MedidaCorporal`, `PruebaFisica`, `DiaSeguimiento`, `ConfiguracionSeguimiento`                                                                                                  | **Eliminar**                                                                          | Datos de salud (RGPD art. 9).                                                                                              |
| `Valoracion`, `BorradorValoracion`, `PublicacionValoracion`, `ProximaRevisionValoracion`, `PlantillaValoracion` (del cliente), `OperacionValoracion`, `LecturaAvisoSeguimiento` | **Eliminar**                                                                          | Incluye notas internas del profesional sobre esa persona. **Duda jurídica 4** (notas del profesional).                     |
| `MedioFoto`, `IntentoFoto`, `SolicitudFotos`                                                                                                                                    | **Eliminar** fila **y objeto del almacén**                                            | Borrado del objeto **fuera** de la transacción (ADR 0005); reintentable e idempotente con la limpieza de medios existente. |
| `Dieta`, `ComidaRegistrada`                                                                                                                                                     | **Eliminar**                                                                          | La dieta es dato de salud/nutrición.                                                                                       |
| `Molestia`, `ComentarioSesion`                                                                                                                                                  | **Eliminar**                                                                          | Describen lesiones o estado físico.                                                                                        |
| `PlanEntrenamiento`, `SesionProgramada`, `SesionEntrenamiento`, `CambioDeFecha`, `OperacionEntrenamiento`, `LecturaNovedad`                                                     | **Según opción A o B** (abajo)                                                        | Es el «histórico de entrenos» de SPEC #14.                                                                                 |
| `RutinaGuardada`, `NovedadEntrenamiento`, `Ejercicio`, `ContenidoDeEjercicio`                                                                                                   | **Conservar**                                                                         | Son del entrenador/catálogo, no de la persona.                                                                             |

### Opciones para el histórico de entrenos

- **A. Desvincular y conservar.** Los planes y sesiones pierden la referencia al titular (clave foránea pasa a una identidad anónima única «Cliente eliminado»), se borran notas libres, molestias y comentarios. Cumple SPEC #14 y #18 a la vez, **si** la anonimización es real (no reversible ni por combinación de fechas y cargas). Es la propuesta por defecto.
- **B. Eliminar todo.** Más simple y más conservadora para el titular; el entrenador pierde el histórico de esa persona y sus estadísticas agregadas.

## Flujo propuesto (sin código todavía)

1. El titular solicita el borrado en **Perfil** con confirmación en dos pasos, re-introduciendo su contraseña (no se acepta con solo un token de acceso vivo).
2. La API registra `borradoSolicitadoEn` y desactiva la cuenta (sesiones revocadas); la solicitud es idempotente por `operacionId`.
3. **Plazo de gracia configurable** (propuesta: 14 días, cancelable por el titular iniciando sesión con enlace de recuperación) y ejecución automática después. El plazo máximo legal de respuesta es una **duda jurídica 1**.
4. Una única transacción anonimiza y elimina las filas; **después** se borran los objetos del almacén con la limpieza existente. Un fallo del almacén deja la cola de borrado pendiente, nunca los datos a medias.
5. El entrenador y el nutricionista dejan de ver al titular de inmediato (la baja ya lo garantiza); el entrenador recibe un aviso de «cliente eliminado» sin datos.

## Consecuencias

- **Copias de seguridad:** los datos borrados sobreviven en backups hasta su rotación. La política de privacidad debe decirlo y el plazo de rotación debe ser corto y conocido (**duda jurídica 2**). Hoy no hay backups programados (ver PENDIENTE).
- **Logs:** los correos ya se enmascaran; revisar que no se registren nombres.
- **Irreversible:** una vez ejecutado no hay recuperación, por eso el plazo de gracia y la contraseña.
- **Migración:** solo aditiva (columna `borradoSolicitadoEn` y, si A, una identidad anónima de sistema). Con SQL de reversión en `apps/api/prisma/rollback/`.
- **Pruebas:** E2E con datos sintéticos que cubran cada fila de la tabla, doble solicitud, fallo del almacén a mitad y que un entrenador/nutricionista no ve nada después.

## Dudas jurídicas (sin resolver)

1. Plazo máximo para atender la petición y si el plazo de gracia lo respeta.
2. Conservación en copias de seguridad y qué se informa al titular.
3. Si hay que conservar la prueba del consentimiento y durante cuánto tiempo, y en qué forma.
4. Si las notas internas del profesional sobre una persona deben entregarse (derecho de acceso) antes de borrarse.
5. Si el histórico de entrenamiento desvinculado deja de ser dato personal en la práctica (Opción A) o si basta una combinación de fechas y cargas para reidentificar.
6. Obligaciones de conservación del entrenador como profesional (facturación, responsabilidad) que podrían exigir mantener algún dato.

## Pasos siguientes

1. David decide **A o B** y el plazo de gracia, y alguien con título contesta las dudas 1–6.
2. Entonces se desbloquean M08a (anonimizar), M08b (eliminar salud y medios) y M08c (pantalla) del plan de mejoras.
