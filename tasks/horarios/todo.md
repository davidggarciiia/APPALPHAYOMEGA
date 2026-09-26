# Tareas — horarios y reservas

> Plan: [plan.md](plan.md), aprobado por David el 2026-09-25. Specs:
> [ampliación de agenda](../../SPEC-agenda.md#ampliación-horarios-y-reservas) y
> [planes](../../SPEC-planes.md).
> Estado: H00 entregada para revisión. Ninguna tarea de código empezada.

## Regla de ejecución

Una tarea cada vez. Ninguna se marca hecha sin su verificación pasada. Si una
tarea supera lo previsto o necesita cambiar un contrato, se actualiza el plan
antes de seguir.

Antes de cada commit: `npm test`, `npm run typecheck` y `npm run lint`. Con e2e,
`npm run test:e2e` contra Postgres real, una vez en paralelo y otra con
`--runInBand`. Los nombres de tests de cada tarea son archivos a crear, no pruebas
que existan hoy.

Cada entrega distingue tres niveles: implementado, probado automáticamente y
comprobado en un móvil. El tercero no se da por hecho sin haberlo visto.

## H00 — Documentos de entrada

- [x] Intención en `docs/intent/horarios-y-reservas.md`.
- [x] Ampliación «horarios y reservas» en `SPEC-agenda.md`.
- [x] `SPEC-planes.md` nuevo.
- [x] `CAPABILITY-MAP.md`: módulo `planes`, orden de construcción y pantallas.
- [x] Este plan y esta lista.
- [ ] David revisa el texto de las dos specs.

**Verificar:** `npm run lint` (Prettier sobre los Markdown).

## Fase 0 · Base

### H01 — Los e2e dejan de fallar a ratos

- [ ] Un canje de refresco que pierde una carrera contra otro canje simultáneo no
      se trata como robo ni revoca la familia (`tokens-refresco.service.ts`,
      `canjear` lee la fila antes de tomar el candado).
- [ ] Test que reproduce la carrera de forma determinista antes del arreglo.
- [ ] «Ni el entrenador puede crear otra cuenta de entrenador» cuenta solo sus
      propias filas (`gestion-clientes.e2e-spec.ts`), no todos los entrenadores de
      la base.
- [ ] Se mantienen las garantías actuales: nunca dos tokens vivos por familia,
      cierre de sesión sin ventana y reuso tardío que corta la familia.

**Dependencias:** ninguna. **Alcance:** S.
**Verificar:** 10 ejecuciones seguidas de `npm run test:e2e` sin `--runInBand`,
todas en verde.

### H02 — Integración continua

- [ ] `.github/workflows/ci.yml` en cada push y PR: `npm ci`, lint, typecheck,
      unitarios y e2e contra un servicio `postgres:17-alpine` con
      `prisma migrate deploy`.
- [ ] Sin secretos reales: el workflow genera sus valores de prueba.

**Dependencias:** H01. **Alcance:** S.
**Verificar:** los checks salen en verde en el PR de la rama.

### H03 — Tests en la app móvil (antes C01)

- [ ] Instalar solo `jest-expo`, `@testing-library/react-native`,
      `@react-native/jest-preset` y `test-renderer`, con las versiones de
      `tasks/entrenamiento/plan.md`.
- [ ] Script `test` en `apps/mobile`, sin modo watch y sin tests dentro de `app/`.
- [ ] Un test real de `src/componentes/formulario.tsx`. El workflow de H02 lo
      ejecuta.

**Dependencias:** H02. **Alcance:** M.
**Verificar:** `npm run test --workspace apps/mobile`.

### H04 — Renovar el token durante el uso (antes C03 y C06)

- [ ] Transporte común extraído de `src/lib/api.ts`, conservando el
      comportamiento actual.
- [ ] Ante un 401: una sola renovación en vuelo aunque fallen varias peticiones
      a la vez, el token nuevo guardado antes de usarse y un único reintento.
- [ ] Se reintenta solo en lecturas o en escrituras con id de operación.
- [ ] Un 403 o un fallo de red nunca cierran la sesión.
- [ ] Cierra el punto 9c de `docs/PENDIENTE-PARA-PRODUCCION.md`.

**Dependencias:** H03. **Alcance:** M.
**Verificar:** test «dos peticiones con el token caducado hacen un solo refresh y
reintentan una vez»; en móvil, la app sigue funcionando tras 15 minutos abierta.

### Checkpoint 0

- [ ] e2e estables, CI en verde, tests móviles ejecutándose y token renovado.
- [ ] David revisa la evidencia antes de la fase 1.

## Fase 1 · Cimientos

### H05 — Hora local y cálculo de huecos

- [ ] `packages/shared/src/tiempo-local.ts`: `desfaseMin`, `aInstante`,
      `partesLocales`, `lunesDe` y `mesDe`, con `Intl` y sin librerías.
- [ ] `calcularHuecos` con plantilla, aperturas, cierres, boxeo, reservas,
      antelación, horizonte e intervalo.
- [ ] Tests del 29-03-2026 y del 25-10-2026, y de los mismos cambios de hora en
      2027; también del paso de domingo a lunes y del fin de año.

**Dependencias:** Checkpoint 0. **Alcance:** M.
**Verificar:** `TZ=UTC` y `TZ=America/New_York` con
`npm run test --workspace apps/api -- tiempo-local huecos`.

### H06 — Contratos

- [ ] Esquemas Zod de horario, reservas y boxeo en `packages/shared/src/agenda.ts`.
- [ ] Esquemas de productos, saldo, solicitudes y cobros en
      `packages/shared/src/planes.ts`, exportados desde `index.ts`.
- [ ] Cuerpos estrictos, sin `clienteId`; importes en céntimos enteros; ids de
      operación en toda escritura.
- [ ] No se tocan los contratos de identidad ni los de entrenamiento.

**Dependencias:** H05. **Alcance:** M.
**Verificar:** `npm run build:shared` y
`npm run test --workspace apps/api -- contratos`.

### H07 — Esquema, migración y catálogo inicial

- [ ] Modelos de `agenda` y `planes` en `schema.prisma`.
- [ ] Una sola migración aditiva `horarios_y_planes`, con SQL a mano para la
      exclusión de solapes, los CHECK y los índices parciales.
- [ ] Módulos vacíos registrados en `app.module.ts`.
- [ ] El seed crea los ajustes, los servicios, las tarifas de grupo, el horario
      de boxeo y el catálogo de `SPEC-planes.md`, sin pisar lo ya editado.

**Dependencias:** H06. **Alcance:** M.
**Verificar:** `npx prisma validate`; aplicar la migración; una
`npx prisma migrate dev --create-only` posterior sale vacía (Prisma no intenta
borrar la exclusión); el seed se puede ejecutar dos veces.

## Fase 2 · El entrenador pone su horario y el cliente ve huecos

### H08 — API de horario y disponibilidad

- [ ] Ajustes, plantilla semanal, excepciones, servicios y tarifas, horario de
      boxeo (lectura) y disponibilidad.
- [ ] `apps/api/test/horarios-permisos.e2e-spec.ts` con una fila por ruta: 401
      sin sesión, 403 para nutricionista y empleado, 403 cruzado entre cliente y
      entrenador, y 400 con campos de más.

**Dependencias:** H07. **Alcance:** M.
**Verificar:** `npm run test:e2e --workspace apps/api -- --runInBand horarios`.

### H09 — Pestañas y huecos en la app

- [ ] Pestañas por rol. Nutricionista y empleado se quedan como están.
- [ ] Inicio del cliente con tira de días y huecos de mañana y tarde, solo lectura.
- [ ] Editor de plantilla y ajustes del entrenador.

**Dependencias:** H08, H04. **Alcance:** M.
**Verificar:** `npm run test --workspace apps/mobile -- agenda`. En un móvil
real: los huecos coinciden con la API y `Intl` con zona horaria funciona en Hermes.

### Checkpoint 2

- [ ] Demostración en móvil: el entrenador cambia su horario y el cliente ve los
      huecos al momento.

## Fase 3 · El cliente reserva con su saldo

### H10 — Saldo

- [ ] Productos, activación directa, suscripciones, bonos y saldo derivado del
      libro de movimientos.
- [ ] Orden de consumo, primer uso y caducidad, devolución y compensación.

**Dependencias:** H07. **Alcance:** M.
**Verificar:** unitarios de cada regla de `SPEC-planes.md`, con
`npm run test --workspace apps/api -- saldo`.

### H11 — Reservas

- [ ] Reservar (cliente y entrenador), cancelar dentro y fuera de plazo, cancelar
      por el entrenador, devolver a mano y mover, incluido el cambio de mes.
- [ ] Candado de agenda y después del cliente; conflicto si salta la exclusión.

**Dependencias:** H08, H10. **Alcance:** M.
**Verificar:** e2e de carreras: dos reservas simultáneas al mismo hueco dan una
y un conflicto; un crédito para dos huecos da una reserva; repetir una operación
no duplica. `npm run test:e2e --workspace apps/api -- --runInBand reservas`.

### H12 — La baja cancela reservas y solicitudes

- [ ] `apps/api/src/identity/bajas.ts` con `RegistroDeBajas` y
      `ParticipanteDeBaja`.
- [ ] `agenda` y `planes` se registran como participantes.
- [ ] `UsuariosService.desactivar` lo ejecuta dentro de su transacción.
- [ ] Los e2e de identidad siguen en verde.

**Dependencias:** H11. **Alcance:** S.
**Verificar:** e2e: la baja cancela con devolución y libera los huecos en la
misma operación; reactivar no restaura nada.

### H13 — Reservar desde la app

- [ ] Confirmación que dice de dónde sale el crédito, próximas reservas con el
      plazo para cancelar, resumen del saldo.
- [ ] Agenda del día y de la semana del entrenador: reservar para un cliente,
      mover, cancelar y devolver.
- [ ] «Saldo y plan» con activación directa en `app/cliente/[id].tsx`.

**Dependencias:** H11, H09. **Alcance:** L; se divide si pasa de cinco archivos
por entrega.
**Verificar:** tests móviles; en un móvil, recorrido completo con dos cuentas.

### Checkpoint 3

- [ ] Demostración: el entrenador activa Presencial Esencial, el cliente ve 2 EP,
      reserva, cancela a tiempo y recupera su sesión.

## Fase 4 · Cierres con conflicto, grupos y «Lo quiero»

### H14 — API de conflictos, grupos, solicitudes y cobros

- [ ] Cerrar una franja o cambiar la plantilla con reservas afectadas devuelve un
      409 con la lista y no aplica nada.
- [ ] Reserva en pareja o grupo con su cobro pendiente; cancelarla lo anula.
- [ ] Solicitudes: pedir, anular, activar y rechazar. Cobros: cobrar, anular y
      resumen del mes.

**Dependencias:** H11. **Alcance:** M.
**Verificar:**
`npm run test:e2e --workspace apps/api -- --runInBand cierres grupos solicitudes cobros`.

### H15 — Conflictos, grupos, Planes y Cobros en la app

- [ ] Resolver conflictos una a una y repetir el cierre.
- [ ] Selector de personas con el importe por persona.
- [ ] Pestaña Planes con «Lo quiero» y pestaña Cobros con lo pendiente y el total
      del mes.

**Dependencias:** H14, H13. **Alcance:** M.
**Verificar:** tests móviles y recorrido en móvil.

### Checkpoint 4

- [ ] Demostración: un bono de 6 pedido con «Lo quiero» y activado al cobrar
      192 €, y una EP en pareja con su cobro pendiente de 50 €.

## Fase 5 · Pasar lista de boxeo

### H16 — API de boxeo

- [ ] Editar el horario de boxeo, con conflicto si pisa reservas de EP.
- [ ] Asistencia cubierta por cuota semanal, luego por bono, o sin cobertura.

**Dependencias:** H14. **Alcance:** M.
**Verificar:** e2e: marcar dos veces no cuenta dos veces; desmarcar devuelve; la
clase quita los huecos de EP.

### H17 — Boxeo en la app y cierre

- [ ] Pasar lista del entrenador; horario y saldo de boxeo de la clienta.
- [ ] Cada criterio de las dos specs enlazado a su test o a su comprobación en
      móvil.
- [ ] `CAPABILITY-MAP.md` y `README.md` actualizados con el estado real.

**Dependencias:** H16, H15. **Alcance:** M.
**Verificar:** `npm test && npm run test:e2e && npm run typecheck && npm run lint`
y el recorrido de [plan.md](plan.md#verificación) en un móvil.

### Checkpoint final

- [ ] Criterios de las dos specs con su evidencia.
- [ ] Cobertura de servicios y guardas nuevos por encima del 80%.
- [ ] Revisión de David. Publicar y fusionar no se dan por hechos.

## Registro de entregas

| Tarea | Commit | Evidencia                                                                    |
| ----- | ------ | ---------------------------------------------------------------------------- |
| H00   | —      | Documentos en la rama `claude/upbeat-ptolemy-yks552`, pendientes de revisión |
