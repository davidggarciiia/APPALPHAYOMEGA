# Iteración 3 — cierre del entrenamiento, nutrición y seguimiento corporal

Fecha: 2026-09-23. Preparado con Agent Skills: `using-agent-skills`,
`spec-driven-development`, `planning-and-task-breakdown` y
`git-workflow-and-versioning`, en `C:/Users/david/.claude/skills/`.

## Alcance confirmado y estado del flujo

David ha elegido: **«Cerrar lo actual y después nutrición y seguimiento corporal»**.
Pide dos planes para trabajar con Fable en Claude y Codex en paralelo.
Reparto ampliado por David: Fable asume más cierre del entrenamiento y **ejercicios
y animaciones tienen el mismo responsable**, incluida la conexión con el registro.
Esta entrega contiene planificación; no inicia Claude ni modifica implementación.

El [mapa de capacidades](../../CAPABILITY-MAP.md) ya está aprobado y conserva
sus identificadores. No hace falta repetir la entrevista de todo el producto.

| Bloque                          | SPECIFY                                                                            | PLAN / TASKS                                                       | IMPLEMENT                                                     |
| ------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------- |
| Diseño y estabilidad existentes | Requisitos anteriores y corrección de colores conservados                          | Desglosados en el plan de Codex para revisión                      | No iniciado en esta entrega; hay cambios previos sin terminar |
| Muestra de animaciones          | Catálogo especificado; falta concretar proveedor, licencia y entrega de la muestra | F01 y C05 preparan esa decisión; construcción depende de validarla | Pendiente                                                     |
| Nutrición                       | Alcance general aprobado; falta especificación del módulo                          | F06 define la spec; después F07 genera plan y tareas               | Pendiente de esas fases                                       |
| Seguimiento corporal            | Alcance general aprobado; falta especificación del módulo                          | C08 define la spec; después C09 genera plan y tareas               | Pendiente de esas fases                                       |

La skill `spec-driven-development` establece: «Do not advance to the next phase
until the current one is validated». Los módulos nuevos conservan ese orden:
SPECIFY → PLAN → TASKS → IMPLEMENT. Aprobar el reparto no convierte preguntas
abiertas sobre nutrición o mediciones en requisitos aprobados.

## Documentos y listas de tareas

- [Plan y lista de Codex](plan-codex.md): diseño, estabilidad, base común,
  integración y seguimiento corporal.
- [Plan y lista de Fable](plan-fable.md): ejercicios, rutinas, pantallas y validación
  del entrenamiento, animaciones integradas y nutrición.
- [Encargo para pegar en Claude](fable.md).

Se amplía la planificación existente con el mismo patrón por carpeta usado en
`tasks/entrenamiento/`. Las listas de esta iteración viven dentro de cada plan
individual; no se duplican en `tasks/todo.md`, que sigue siendo de identidad.
Los pendientes nativos de la iteración 2 se referencian y solo se cerrarán allí
cuando exista evidencia real. Ninguna casilla anterior se marca hecha ahora.

## Punto de partida comprobado

- Rama actual: `codex/entrenamiento-iteracion-2`; HEAD observado: `947c9ef`.
- Código de entrenamiento y entrega anterior de Fable integrados. No retomar
  `tasks/entrenamiento/fable.md` como si fuera el encargo vigente.
- Cuatro archivos con cambios de color sin cerrar, responsabilidad de Codex:
  `apps/mobile/src/tema.ts`, `src/componentes/armazon.tsx`,
  `src/componentes/formulario.tsx` y `apps/mobile/app/_layout.tsx`.
- `PDF/` es contenido ajeno sin seguimiento: no borrar, mover ni incluir en commits.
- Catálogo devuelve `figura: null` y `video: null`; el contrato Zod también exige
  `null`. No basta con poner un reproductor en una pantalla.
- La última verificación completa documentó 167 tests unitarios/componentes.
  Es evidencia anterior; no prueba los cambios de color incompletos ni esta iteración.
- Entrenamiento offline en dispositivo físico y renovación entre pestañas siguen
  pendientes. Identidad básica sí tuvo una prueba móvil anterior.
- `docs/PENDIENTE-PARA-PRODUCCION.md` contiene entradas antiguas ya resueltas
  (tests móviles, renovación dentro de una pestaña, revocación al restablecer y
  acceso del nutricionista a bajas). Contrastar con código antes de arrastrarlas.

## Reparto y propiedad de archivos

| Área                                                  | Responsable | Rutas                                                                                                                                         |
| ----------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Tema, navegación, formularios, pantallas actuales     | Codex       | `apps/mobile/src/tema.ts`, `src/componentes/`, `app/index.tsx`, `app/perfil.tsx`, rutas de acceso y `_layout.tsx`                             |
| Sesión y lógica de registro/persistencia              | Codex       | `apps/mobile/src/sesion*`, `src/lib/`, `src/entrenamiento/` salvo las vistas asignadas abajo                                                  |
| Contratos, Prisma, registro de módulos y dependencias | Codex       | `packages/shared/`, `apps/api/prisma/`, `apps/api/src/app.module.ts`, configuración, manifests y lockfile                                     |
| Ejercicios y sus animaciones, juntos                  | Fable       | `apps/api/src/catalogo-ejercicios/`, sus tests, `apps/mobile/src/catalogo-ejercicios/`, `app/catalogo/`                                       |
| Vistas de entrenamiento y conexión con las figuras    | Fable       | `apps/mobile/src/entrenamiento/agenda-semanal.tsx`, `tabla-series.tsx`, `registro-cliente.tsx`, `resultado.tsx` y tests nuevos de esas vistas |
| Rutinas, asignación y resultados del entrenador       | Fable       | `apps/mobile/src/entrenamiento-entrenador/`, `app/rutinas/`, `app/entrenador/` y tests propios                                                |
| Comprobación funcional y física del entrenamiento     | Fable       | `tasks/iteracion-3/pruebas-entrenamiento-fable.md` y correcciones en sus archivos; Codex atiende fallos de sus servicios                      |
| Nutrición, después de su spec                         | Fable       | `SPEC-nutricion.md`, `apps/api/src/nutricion/`, tests propios, `apps/mobile/src/nutricion/`, nuevas rutas `app/nutricion/`                    |
| Seguimiento corporal, después de su spec              | Codex       | `SPEC-seguimiento-corporal.md`, API, tests, componentes y rutas de ese módulo                                                                 |
| Almacenamiento privado reutilizable                   | Codex       | Nuevo módulo de infraestructura delimitado en C05/C09; proveedor y configuración pendientes                                                   |
| Documentación común e integración                     | Codex       | README, SPEC común, mapa, ADRs, verificación y este plan                                                                                      |
| Evidencia y propuestas de Fable                       | Fable       | `tasks/iteracion-3/entrega-fable.md`, `docs/animaciones-ejercicios.md` y sus planes futuros de nutrición                                      |

Que Fable sea responsable de nutrición incluye API y pantallas: no es una entrega
de maquetas. Propone los cambios de contratos/modelo a Codex; Codex los incorpora
en una entrega común pequeña antes de cada recorrido funcional.

Fable también es responsable del recorrido ejercicio → figura → serie registrada.
No se divide la animación entre un autor de catálogo y otro de la pantalla final.
Codex prepara los tokens y componentes comunes de C01; desde esa entrega Fable
aplica el diseño a las cuatro vistas de entrenamiento en F08. Codex no las edita
en paralelo. La lógica de sincronización, cifrado y envío sigue en sus archivos
actuales de Codex; cualquier cambio de comportamiento se coordina explícitamente.

## Secuencia y dependencias

1. **Arranque:** Codex C00 prepara base y aislamiento. Fable F00 lee el encargo;
   F01 puede investigar muestras mientras Codex cierra los componentes comunes
   C01; después Fable hace F08 en las vistas de entrenamiento mientras Codex
   ajusta acceso, perfil e inicio en C02–C03.
2. **Cierre visual y sesión:** Codex C04 reproduce y corrige la concurrencia web.
   No se debilita la rotación de tokens para esconder el fallo.
3. **Primera animación real:** F01 propone alcance y licencia → revisión de la
   decisión → C05 concreta contratos/infraestructura y sus tareas → F02 servicio
   de lectura → F03 ficha → F03b conexión al entrenamiento → F04 prueba offline.
   Cada expansión se valida con API real antes de añadir más ejercicios.
4. **Cierre del recorrido:** F09 verifica catálogo, rutinas y resultados; F10
   comprueba el recorrido físico de las dos plataformas sobre la versión integrada.
   F05 entrega evidencia y Codex C07 integra/revisa. F10 no bloquea la integración
   necesaria para poder probar: entrega primero el código verificado en web y
   añade después la evidencia nativa o la limitación concreta.
5. **Definir lo siguiente:** F06 especifica nutrición y C08 seguimiento corporal.
   Pueden preparar entrevistas/documentación mientras esperan una prueba física;
   no deben afirmar que el cierre nativo ya pasó.
6. **Construcción de los módulos nuevos:** tras validar cada spec, F07/C09
   desglosan tareas pequeñas. Codex publica la base común. Se construyen en
   paralelo por recorridos completos, con integración frecuente.

No hay dependencia funcional de seguimiento corporal sobre nutrición ni al revés.
Ambos dependen de identidad. La escritura de migraciones sí se serializa.

## Trabajo simultáneo e integración

- Fable usa un worktree independiente, con rama propuesta `codex/fable-iteracion-3`.
  Codex conserva la carpeta actual y sus cuatro cambios pendientes. No cambiar
  la rama de la carpeta del otro ni usar `git stash`, `reset` o `clean` globales.
- C00 registra el SHA común real en la entrega; `947c9ef` es la referencia de
  lectura, no un SHA nuevo que incluya estos planes ni el diseño pendiente.
- Si Fable ya ha empezado algo, primero registra rama, SHA, archivos y tarea;
  se reconcilia ese trabajo antes de aplicar este reparto.
- Solo Codex integra cambios comunes. Fable solicita una modificación mediante
  contrato propuesto, motivo y ejemplo; nunca mantiene una copia divergente.
- Cada agente conserva su servidor y puertos. No detener procesos del otro.
  Tests HTTP usan bases exclusivas o turnos explícitos. Nunca `db:reset` sobre
  la base demo. No ejecutar migraciones concurrentes.
- Cada entrega incluye SHA, tarea, archivos, pruebas con resultado y limitaciones.
  Codex revisa commits concretos y vuelve a comprobar el recorrido integrado.
- Integrar en esta rama de desarrollo no implica publicar, hacer push ni fusionar
  en `main`. La cuenta demo y los cambios posteriores del usuario se conservan.

## Criterios de cierre

| Checkpoint            | Evidencia requerida                                                                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — Diseño y sesión   | Colores contrastados con el ZIP; perfil y registro siguen funcionando; dos pestañas no se expulsan al renovar                                             |
| B — Muestra de medios | Ejercicio real → ficha → animación; licencia registrada; pausa y errores controlados; alcance offline demostrado o pendiente explícito                    |
| C — Entrenamiento     | Asignar, mover día, registrar offline, reabrir, enviar y consultar con entrenador; aislamiento entre cuentas; Android/iOS registrados por separado        |
| D — Specs nuevas      | Roles, datos, edición, fechas, estados, límites y ejemplos aprobados para cada módulo; tareas y contratos publicados antes de código                      |
| E — Módulos nuevos    | Dieta editada por profesional y leída por su cliente; mediciones y fotos según la spec; permisos negativos, datos reales de API y sin pantallas ficticias |

Una pantalla con fixtures no cierra un checkpoint. Los datos demo son sintéticos,
persistentes y se introducen por los servicios del dominio sin sobrescribir otras
cuentas. Una prueba web o un mock no cuenta como Android/iOS físico.

Fable aporta la evidencia funcional y física de ejercicios/entrenamiento
(F08–F10). Codex verifica la integración, revisa esa evidencia y actualiza el estado
común; no se vuelven a repartir las mismas comprobaciones como dos implementaciones.

## Límites y decisiones pendientes

- La referencia visual vigente es `C:/Users/david/Downloads/Theme files review (1).zip`:
  crema, blanco, dorado y verde de completado. La corrección posterior sustituye
  el anterior blanco y negro; comparar roles del color, no recolorear todo de oro.
- Animaciones: David confirmó que esta iteración usa únicamente
  opciones gratuitas. Fable evalúa RepDB Free y presenta una muestra real para
  verificar calidad, derechos y tipo de movimiento; el contrato no presume MP4.
  No se promete cobertura de todo el catálogo ni descarga offline sin licencia.
- Este cierre incluye la prueba integrada de animaciones, no el mapa muscular,
  una biblioteca completa de medios, subida de vídeos propios ni agenda mensual,
  clases y horarios. Son ampliaciones pendientes conservadas en el mapa general.
- Google, leads, fichajes y publicación quedan fuera de este tramo. Consentimiento
  y borrado mantienen el aplazamiento decidido por David; los módulos de salud
  se desarrollan con datos sintéticos hasta retomar esas tareas. No añadir un
  bypass de consentimiento en una ruta destinada a producción.
- Falta definir el detalle de dietas, quién introduce/corrige mediciones, acceso
  a fotos, funcionamiento offline de los módulos nuevos y proveedor de objetos.
  F06/C08 presentan decisiones pequeñas y concretas a David; no se rellenan con
  lo que parezca habitual en otras apps de gimnasio.

## Verificación de esta planificación

- [x] Estado del repositorio, contratos actuales y scripts inspeccionados.
- [x] Alcance de las dos etapas elegido por David.
- [x] Propiedad, dependencias, verificaciones y pendientes previos conservados.
- [ ] Revisión de los dos planes por David antes de iniciar la ejecución nueva.

No se han ejecutado las pruebas de la app al escribir estos documentos. Las
pruebas de ejecución y los checkpoints permanecen pendientes en ambos planes.
