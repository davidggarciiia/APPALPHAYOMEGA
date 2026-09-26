# Plan: horarios y reservas

> Aprobado por David el 2026-09-25. Especificaciones:
> [ampliación de agenda](../../SPEC-agenda.md#ampliación-horarios-y-reservas) y
> [planes](../../SPEC-planes.md), las dos pendientes de la revisión de su texto.
> Intención: [horarios y reservas](../../docs/intent/horarios-y-reservas.md).
> Tareas: [todo.md](todo.md). El plan de entrenamiento queda en pausa hasta
> terminar este; sus tareas C01, C03 y C06 pasan aquí como H03 y H04.

## Resultado

El cliente reserva entrenamientos desde la pestaña de inicio y la reserva queda
confirmada al instante, descontando de su saldo. El entrenador define su horario,
ve su agenda, pasa lista en boxeo, activa lo que cobra en efectivo y ve lo
pendiente y el total del mes.

## Orden de trabajo

1. **Fase 0, base.** Arreglar los e2e intermitentes, poner CI, montar los tests
   de la app y renovar el token durante el uso. Sin la renovación, la agenda del
   entrenador deja de funcionar a los quince minutos.
2. **Fase 1, cimientos.** Hora local, contratos, esquema y catálogo inicial.
3. **Fases 2 a 5, cortes verticales.** Cada fase termina en algo que se puede
   enseñar en un móvil: horario y huecos, reservar con saldo, cierres con
   conflicto y «Lo quiero», y pasar lista de boxeo.

Cada fase cierra con un checkpoint y David revisa la evidencia antes de la
siguiente.

## Diseño técnico

### Módulos y baja de clientes

- **API**: `apps/api/src/agenda/` y `apps/api/src/planes/`, registrados en
  `apps/api/src/app.module.ts`.
- **Saldo en la misma transacción**: `PlanesModule` exporta `SaldoService`, cuyos
  métodos reciben `tx` (mismo patrón que `revocarTodosDe(id, tx)` en
  `tokens-refresco.service.ts`). Reservar y consumir saldo van en una sola
  transacción.
- **Sin ciclos**: `planes` no importa `agenda`. Cada movimiento guarda
  `origenTipo` + `origenId` (`reserva`, `asistencia_boxeo`, `manual`).
- **Baja sin que `identity` importe `agenda`**:
  - `apps/api/src/identity/bajas.ts` define `RegistroDeBajas` con la interfaz
    `ParticipanteDeBaja { alDarDeBaja(clienteId, autorId, tx) }`.
  - `agenda` y `planes` se registran en `onModuleInit`.
  - `UsuariosService.desactivar` (`usuarios.service.ts`, transacción existente)
    llama a `registro.ejecutar(id, quien, tx)`.
  - `IdentityModule` ya es global, así que no hace falta ninguna dependencia nueva.

### Modelo de datos (una migración aditiva `horarios_y_planes`)

Importes en céntimos (`Int`), fechas de calendario con `@db.Date` e instantes con
`@db.Timestamptz(3)`.

**En `agenda`:**

| Entidad           | Qué guarda                                                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AjustesAgenda`   | Fila única (id=1): antelación, horizonte, ventana de cancelación e intervalo. Es también el candado de la agenda                                                                      |
| `Servicio`        | `codigo` (`ep_individual`, `ep_grupo`; más adelante `quiromasaje_30/60`), duración, participantes mín./máx., `claseDeSaldo?` (nulo = se paga en efectivo), precio, reservable, activo |
| `TarifaGrupo`     | Precio por persona según el número de personas (2 a 6)                                                                                                                                |
| `FranjaSemanal`   | Plantilla del horario: `diaSemana`, `inicioMin`, `finMin` en hora local                                                                                                               |
| `ExcepcionAgenda` | Cierres y aperturas puntuales (`inicio`, `fin`, motivo, autor)                                                                                                                        |
| `ClaseBoxeo`      | Horario fijo: día, hora, activa. Editar = desactivar y crear otra, para conservar el historial                                                                                        |
| `AsistenciaBoxeo` | Clase + fecha + clienta, `cobertura {cuota, bono, sin_cobertura}`, `operacionId` único                                                                                                |
| `Reserva`         | Servicio, cliente, `inicio`/`fin`, personas, estado, motivo de cancelación, `creadaPorId`, `operacionId` único, revisión                                                              |

**En `planes`:**

| Entidad           | Qué guarda                                                                                                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Producto`        | Plan, bono o matrícula: precio, EP/mes, boxeo/semana, meses (1 o 3), sesiones, validez, regalo (solo texto), `visibleParaCliente`, activo. La sesión suelta es un bono de 1 |
| `Suscripcion`     | Cliente, producto, `mesInicio`, meses. Copia EP/mes y boxeo/semana al activar                                                                                               |
| `Bono`            | Clase de saldo, sesiones, `primerUsoEn?`, `caducaEn?`, origen (compra o compensación)                                                                                       |
| `MovimientoSaldo` | Libro de ±1 por fuente (suscripción + periodo, o bono), con origen y autor. Único por (`origenTipo`, `origenId`, `motivo`)                                                  |
| `Solicitud`       | "Lo quiero": producto, precio copiado, estado, `operacionId`. Solo una pendiente por cliente y producto                                                                     |
| `Cobro`           | Concepto, importe, estado (pendiente, cobrado o anulado), `cobradoEn`, `operacionId`                                                                                        |

- **Saldo derivado**: es lo concedido más la suma de movimientos. No hay
  contadores ni tareas programadas: el cupo del mes se calcula y lo no usado se
  pierde solo.
- **Catálogo inicial**: lo crea `apps/api/src/seed.ts` a partir del PDF, de forma
  idempotente y sin pisar precios ya editados.

### Concurrencia

1. **Candado de agenda**: `tx.ajustesAgenda.updateMany({where:{id:1}, data:{actualizadoEn}})`.
   Lo toman reservar, mover, cerrar franjas y editar la plantilla o el boxeo.
2. **Red de seguridad en la base** (SQL a mano en la migración, sin `btree_gist`):
   `EXCLUDE USING gist (tstzrange(inicio, fin, '[)') WITH &&) WHERE (estado = 'confirmada')`.
   Si salta (código 23P01), la API responde 409.
3. **Candado del cliente**: `tx.usuario.updateMany({ where: { id, estado: { not: "desactivado" } } })`,
   el mismo patrón que `tokens-refresco.service.ts`. Orden fijo: **primero la
   agenda, después el cliente**.
4. **Idempotencia**: `operacionId` generado en la app. Misma operación con el mismo
   contenido devuelve el resultado; con contenido distinto, 409.

### Hora local sin librería

Funciones puras en `packages/shared/src/tiempo-local.ts`: `desfaseMin`,
`aInstante(fecha, minutos)`, `partesLocales`, `lunesDe`, `mesDe` y
`calcularHuecos(...)`.

- **Zona horaria**: se calcula con `Intl.DateTimeFormat` y `timeZone: "Europe/Madrid"`
  (`ZONA_AGENDA`, ya en `packages/shared/src/agenda.ts`).
- **Cambio de hora**: la hora inexistente de marzo da `null`; la hora repetida de
  octubre resuelve a la primera.
- **El servidor manda**: solo acepta un `inicio` que `calcularHuecos` devuelva.

### Rutas

C = cliente, E = entrenador. Nutricionista y empleado, denegados en todas.

| Rutas                                                                                                                                                                                                  | Roles |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| `GET /agenda/servicios`, `/agenda/disponibilidad?servicioId&desde&dias≤14`, `/agenda/boxeo/horario`                                                                                                    | C, E  |
| `GET/POST /agenda/mis-reservas`, `POST /agenda/mis-reservas/:id/cancelar`                                                                                                                              | C     |
| `GET /agenda/reservas`, `POST /agenda/clientes/:clienteId/reservas`, `PATCH /agenda/reservas/:id` (mover), `POST …/cancelar`, `POST …/devolver-credito`                                                | E     |
| `GET/PUT /agenda/horario-semanal`, `GET/POST/DELETE /agenda/excepciones`, `PUT /agenda/boxeo/horario` (409 con `{conflictos}`)                                                                         | E     |
| `GET/PATCH /agenda/ajustes`, `PATCH /agenda/servicios/:id`, `PUT /agenda/servicios/:id/tarifas`                                                                                                        | E     |
| `GET /agenda/boxeo/sesiones?fecha`, `PUT/DELETE /agenda/boxeo/clases/:claseId/fechas/:fecha/asistentes/:clienteId`                                                                                     | E     |
| `GET /planes/productos` (el cliente solo ve los visibles)                                                                                                                                              | C, E  |
| `GET /planes/mi-saldo`, `GET/POST /planes/mis-solicitudes`, `POST …/anular`                                                                                                                            | C     |
| `PATCH /planes/productos/:id`, `GET /planes/solicitudes`, `POST …/activar` (`{mesInicio: "actual"\|"siguiente", importeCentimos}`), `POST …/rechazar`, `POST /planes/clientes/:clienteId/activaciones` | E     |
| `GET /planes/clientes/:clienteId/saldo` y `/movimientos`, `GET /planes/cobros`, `POST /planes/cobros/:id/cobrar` y `/anular`, `GET /planes/cobros/resumen?mes`                                         | E     |

- **Validación**: todos los cuerpos son `z.strictObject` y pasan por `ZodPipe`
  (`apps/api/src/comun/zod.pipe.ts`).
- **Permisos**: cada ruta lleva `@Roles(...)` (`roles.decorator.ts`).
- **Quién es el cliente**: sale siempre de `peticion.usuario.sub`
  (`identity/peticion.ts`), nunca del cuerpo. Un recurso de otro cliente responde 404.

### App móvil

- **Pestañas por rol** con el `Tabs` de expo-router 57 (ya instalado).
  - `app/index.tsx` redirige a `/(cliente)/inicio` o a `/(entrenador)/agenda`.
  - Nutricionista y empleado se quedan como están.
  - Cliente: Inicio, Planes y Perfil.
  - Entrenador: Agenda, Clientes, Cobros, Boxeo y Ajustes.
  - `cartera` y `cliente/[id]` siguen en el `Stack` raíz.
- **Inicio del cliente**:
  - `TiraDeDias` y `HuecosDelDia`, con chips agrupados en Mañana y Tarde.
  - Hoja de confirmación que dice de dónde sale el crédito, o el importe por
    persona si es un grupo.
  - "Mis próximas reservas", con el plazo para cancelar sin perder la sesión.
  - `ResumenSaldo`, con EP del mes, bonos y su caducidad, y el boxeo.
- **Planes del cliente**: productos con precio y "Lo quiero".
- **Entrenador**:
  - Agenda de día y semana, con reservas, boxeo y cierres.
  - Acciones: mover, cancelar, devolver crédito y cobrar.
  - Editor de plantilla y cierres, con resolución de conflictos.
  - Pasar lista de boxeo.
  - Solicitudes y cobros.
  - "Saldo y plan" dentro de `app/cliente/[id].tsx`.
  - Ajustes y precios.
- **Dónde vive el código**: en `src/features/agenda/` y `src/features/planes/`.
  - Se reutilizan `src/tema.ts`, `src/componentes/formulario.tsx` e
    `insignia-estado.tsx`.
  - Se añade un hook `src/lib/use-recurso.ts` que vuelve a consultar al recuperar
    el foco. TanStack Query sigue aplazado.

## Cambios que este plan autoriza (SPEC.md, "Preguntar antes")

- Esquema de datos: una migración aditiva que no toca las tablas de identidad.
- Módulo nuevo `planes` en el mapa de capacidades.
- CI: workflow de GitHub Actions.
- Dependencias nuevas:
  - `expo-crypto` (`operacionId`).
  - `jest-expo`, `@testing-library/react-native`, `@react-native/jest-preset` y
    `test-renderer`, con las versiones ya fijadas en
    `tasks/entrenamiento/plan.md`.
- ADRs:
  - 0006: EXCLUDE y candados.
  - 0007: registro de bajas.
  - 0008: hora local sin librería.
- `docs/PENDIENTE-PARA-PRODUCCION.md`:
  - Los servicios físicos se pagan fuera de la app sin compra integrada (App Store
    3.1.3(e) y 3.1.3(d)).
  - Consultar al gestor si registrar cobros sin facturar afecta a VERI\*FACTU.

## Verificación

- **En cada tarea**: `npm test`, `npm run typecheck` y `npm run lint`. Si hay e2e:
  `npm run test:e2e` contra Postgres real, una vez en paralelo y otra con
  `--runInBand`.
- **En CI**: todo lo anterior en cada push.
- **Recorrido completo en móvil real (Expo Go)**:
  1. El entrenador fija su horario de lunes a viernes de 8 a 14 y cierra un
     jueves que tiene una reserva: la app le muestra el conflicto.
  2. El entrenador activa Presencial Esencial a un cliente, "desde este mes".
  3. El cliente ve "Te quedan 2 EP", reserva a las 10:00 y el hueco desaparece
     para otro cliente.
  4. Cancela con más de 24 h y el saldo vuelve.
  5. Pide un bono de 6 con "Lo quiero"; el entrenador lo activa al cobrar y queda
     registrado el cobro de 192 €.
  6. Un cliente reserva una EP en pareja y aparece un cobro pendiente de 50 €.
  7. El entrenador pasa lista de boxeo el lunes a las 18:00 y ese hueco no se
     ofrece para EP.
  8. Con la app abierta más de 15 minutos, todo sigue funcionando.
- **Cambio de hora**: disponibilidad del domingo 25-10-2026 correcta en la app y
  en la API.

## Riesgos

1. **Prisma y EXCLUDE**: Prisma podría no reconocer la restricción, y la forma del
   error 23P01 con `adapter-pg` no está confirmada. Se valida en H07 y H11.
2. **`Intl` en Hermes**: el soporte de `timeZone` se prueba en dispositivo en H09.
   Mitigación: el servidor calcula los huecos y la app solo formatea.
3. **Alcance**: son 18 tareas, y la Fase 0 (base de tests, CI y token) es trabajo
   que antes no estaba previsto. Sin ella, la app del entrenador falla a los 15
   minutos.
4. **Tiendas de apps**: revisar las normas vigentes antes de publicar. Ya se
   mitiga ocultando los packs online.
