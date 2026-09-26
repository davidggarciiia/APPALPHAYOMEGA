# Spec: `agenda` — fechas de entrenamiento

> Estado: aprobada por David en esta conversación. Redactada el 2026-09-17. Módulo del
> [mapa aprobado](CAPABILITY-MAP.md); depende de `identity`.
> Esta especificación cubre solo la parte necesaria para la segunda iteración.
> Intención: [entrenamiento](docs/intent/entrenamiento-iteracion-2.md).
> Fundamentos, stack y convenciones: [SPEC.md](SPEC.md).
>
> **Ampliación del 2026-09-25:** [horarios y reservas](#ampliación-horarios-y-reservas),
> que va antes que entrenamiento. Pasa a depender también de `planes`
> ([SPEC-planes.md](SPEC-planes.md)). Redactada a partir del plan aprobado por
> David ese día; el texto espera su revisión.
> Intención: [horarios y reservas](docs/intent/horarios-y-reservas.md).

## Objetivo

El entrenador programa sesiones en fechas concretas. El cliente puede moverlas
dentro de su semana y ambos ven la fecha actualizada. El cambio conserva la
identidad de la sesión y sus registros.

## Alcance

- Fechas de sesiones individuales de entrenamiento de clientes.
- Consulta semanal, con selección de semanas anteriores y posteriores.
- Cambio de día de una sesión y consulta de su fecha original y actual.
- Contrato de programación consumido por `entrenamiento`.

Las reservas con hora y el horario del boxeo se especifican en la
[ampliación](#ampliación-horarios-y-reservas) al final de este documento. Los
aforos con reserva, los recordatorios y la vista mensual completa siguen fuera y
no se eliminan del mapa del proyecto.

## Decisiones aprobadas

1. La semana va de lunes a domingo, según `Europe/Madrid`. Una fecha de agenda
   representa un día de calendario, no un instante a medianoche convertido por
   la zona del teléfono. Los instantes de auditoría se guardan en UTC.
2. La sesión guarda una fecha original y una fecha actual. Su semana de
   pertenencia se calcula desde la original y no cambia al moverla varias veces.
3. Un cambio afecta solo a esa sesión. No modifica el patrón de la rutina ni
   recoloca las sesiones de semanas posteriores.
4. Se admiten varias sesiones en un mismo día. Mover una no sobrescribe,
   intercambia ni borra otra.
5. Una sesión enviada está cerrada y no se puede recolocar. Una sesión abierta
   puede moverse a cualquier día de su semana, incluso si tiene un borrador.
   Esto cambia la planificación; la fecha real de envío se conserva por separado.
6. El entrenador también puede recolocar una sesión abierta dentro de su
   semana. Trasladarla a otra semana queda fuera de esta primera versión.

## Requisitos y permisos

| Acción                                       | Cliente      | Entrenador                    | Nutricionista / empleado |
| -------------------------------------------- | ------------ | ----------------------------- | ------------------------ |
| Ver fechas de sesiones                       | Solo propias | Todos sus clientes            | No                       |
| Mover una sesión abierta dentro de su semana | Solo propia  | Sí                            | No                       |
| Programar sesiones                           | No           | Sí, a través de entrenamiento | No                       |
| Ver cambios de fecha                         | Solo propios | Todos sus clientes            | No                       |
| Cambiar una sesión cerrada                   | No           | No en esta iteración          | No                       |

- El servidor comprueba el propietario de la sesión, además del rol. El
  identificador del cliente del cuerpo nunca concede acceso.
- El entrenador puede programar para clientes pendientes o activos. No se
  crean nuevas sesiones para cuentas desactivadas. El histórico se conserva.
- Un cambio exitoso devuelve la sesión actualizada y su revisión. Dos cambios
  concurrentes no se pisan silenciosamente: el segundo recibe un conflicto.
- Cada cambio registra fecha anterior, fecha nueva, autor e instante. La vista
  muestra la fecha actual y una indicación del cambio respecto de la original.
- El entrenador ve los cambios automáticamente mientras consulta esa semana:
  con conexión y la pantalla activa, en un máximo de diez segundos. Volver a la
  pantalla vuelve a consultar los datos. No requiere una notificación externa.
- La agenda no devuelve pesos, repeticiones, tiempos ni notas de borradores.
- Si un cambio de fecha falla, no se muestra como confirmado. La sesión y el
  borrador conservan sus datos y se ofrece reintentar.

## Contrato con `entrenamiento`

`agenda` ofrece operaciones para programar un conjunto de sesiones, consultarlas,
moverlas y cerrarlas. `entrenamiento` consume esas operaciones y conserva el enlace
por `sesionProgramadaId`.

El registro del resultado y el cierre de su sesión se confirman en la misma
transacción. Si falla alguno, no se publica el resultado ni se cierra la sesión.
El módulo de agenda no importa servicios de entrenamiento: su estado de cierre
es suficiente para denegar un movimiento. No aparecen dependencias circulares.

Los nombres definitivos de rutas y tipos se concretarán en el plan. El contrato
mínimo público contiene `id`, `clienteId`, `fechaOriginal`, `fechaActual`,
`estado` y `revision`. El contrato interno de cierre no se expone como una ruta
que el cliente pueda llamar directamente.

## Modelo conceptual

| Entidad            | Responsabilidad                                                     |
| ------------------ | ------------------------------------------------------------------- |
| `SesionProgramada` | Cliente, fechas original y actual, estado abierta/cerrada, revisión |
| `CambioDeFecha`    | Sesión, fecha anterior y nueva, autor e instante                    |

No hay borrado en cascada de sesiones por desactivar un cliente. Una nueva
migración añade las entidades; no reescribe ni elimina las tablas de identidad.

## Estructura y estilo

- API: `apps/api/src/agenda/`; permisos en los bordes y reglas en servicios.
- Contratos Zod: archivos del módulo dentro de `packages/shared/src/`.
- Pantalla semanal: composición en `apps/mobile/app/entrenos/`, con componentes
  y cliente de API del módulo fuera de los archivos de ruta.
- Tests unitarios junto a los servicios; integración en `apps/api/test/`.
- Tests de componentes en `apps/mobile/`, una vez configurado su ejecutor.

Se aplican el vocabulario español, los retornos explícitos, la validación Zod
y el ejemplo de controlador real de `apps/api/src/identity/usuarios.controller.ts`.
No se introduce otro stack ni se cambia el sistema de sesión.

## Comandos de verificación

Desde la raíz, con la base de pruebas disponible:

```bash
npm run build:shared
npm run test --workspace apps/api -- --runInBand agenda
npm run test:e2e --workspace apps/api -- --runInBand agenda
npm run build --workspace apps/api
npm run typecheck
npm run lint
```

Los filtros `agenda` seleccionarán tests nuevos previstos por el plan. No son
pruebas que existan hoy. El comando de componentes móviles se añadirá al
configurar ese entorno; actualmente `apps/mobile` no tiene script de test.

## Criterios de aceptación

1. Una sesión del lunes se mueve al viernes de la misma semana y conserva su
   identificador, sus ejercicios y cualquier borrador existente.
2. El entrenador ve la fecha nueva y puede reconocer la fecha original sin
   consultar al cliente ni recargar manualmente.
3. Moverla de nuevo no permite salir de la semana de su fecha original.
4. Moverla a un día ocupado conserva las dos sesiones.
5. Mover una sesión no cambia las ocurrencias de las semanas siguientes.
6. Los límites de semana se verifican incluyendo domingo/lunes, fin de año y
   cambios de horario de verano, sin desplazamientos por zona del dispositivo.
7. Otro cliente, el nutricionista, el empleado y una petición sin sesión reciben
   denegación al intentar consultar o cambiar esa sesión.
8. Una sesión cerrada no se mueve. En una carrera entre mover y enviar, queda
   un estado coherente: envío con la fecha ganadora o rechazo del movimiento.
9. Dos movimientos con la misma revisión no pueden sobrescribirse en silencio.
10. Un fallo de red conserva el día confirmado anteriormente y permite reintentar.

Cada regla de permisos tiene pruebas de denegación. La consulta semanal y el
cambio de fecha se verifican también en el móvil, sin sustituir esa comprobación
por una exportación del bundle.

## Fronteras

**Siempre:** validar fechas y propiedad en el servidor, registrar cambios,
conservar históricos y aplicar la definición de terminado del proyecto.

**Revisar con la especificación:** las entidades nuevas, la definición de semana,
el cierre de sesiones y el contrato con entrenamiento. Su aprobación cubre las
migraciones necesarias para este alcance; no una reestructuración de identidad.

**Nunca:** borrar registros al mover una sesión, filtrar resultados del borrador
desde agenda, aceptar el rol del cuerpo o modificar los planes de otras semanas
como efecto secundario.

---

## Ampliación: horarios y reservas

> Redactada el 2026-09-26 a partir del plan aprobado por David el 2026-09-25.
> Intención: [horarios y reservas](docs/intent/horarios-y-reservas.md). Saldo,
> productos y cobros: [SPEC-planes.md](SPEC-planes.md). Tareas:
> [tasks/horarios/todo.md](tasks/horarios/todo.md).

### Objetivo

El cliente reserva entrenamientos personales en los huecos libres del entrenador
desde la pestaña de inicio, al estilo Booksy, y la reserva queda confirmada al
instante. El entrenador define su horario, ve su agenda, gestiona las reservas y
pasa lista en las clases de boxeo. Todo en la hora de `Europe/Madrid`, sin que la
zona del teléfono o del servidor mueva nada.

`Reserva` y `SesionProgramada` son entidades distintas. Una reserva es una cita
con hora en la agenda del entrenador. Una sesión programada es un día de la rutina
que el cliente hace por su cuenta. No se convierten una en otra.

### Alcance

- Servicios reservables: EP individual y EP en pareja o grupo privado. El
  catálogo admite servicios nuevos, como el quiromasaje de 30 o 60 minutos, sin
  cambiar el modelo.
- Horario del entrenador: plantilla semanal, cierres y aperturas puntuales.
- Reservar, cancelar, mover y devolver sesiones.
- Horario fijo del boxeo femenino y asistencia a sus clases.
- Ajustes de la agenda: antelación, horizonte, plazo de cancelación e intervalo.

Fuera: notificaciones y recordatorios, reservas de clases con aforo o lista de
espera, varias agendas o profesionales, y cualquier pago dentro de la app.

### Decisiones aprobadas

1. Una sola agenda, la del entrenador.
2. La reserva se confirma al instante. Si el servicio gasta saldo, se descuenta en
   la misma operación según [SPEC-planes.md](SPEC-planes.md).
3. La duración pertenece al servicio. EP individual y EP en grupo duran 60 minutos.
4. El entrenador fija la antelación mínima (por defecto 2 horas), el horizonte
   máximo (4 semanas), el plazo para cancelar sin perder la sesión (24 horas) y el
   intervalo entre inicios posibles (60 minutos, en punto).
5. El cliente cancela; no mueve. Para cambiar de hora cancela y vuelve a reservar.
   Mover es cosa del entrenador.
6. Si una operación del entrenador deja fuera de su horario reservas ya
   confirmadas, la operación no se aplica y devuelve la lista de reservas
   afectadas. Él las mueve o cancela una a una y después repite la operación.
7. El boxeo tiene un horario fijo propio y no se reserva. El entrenador pasa lista
   y sus clases bloquean los huecos de EP que se solapan.
8. Sin notificaciones en esta versión. Todo se ve al abrir la app.

### Disponibilidad

- La plantilla semanal se compone de franjas con día de la semana y horas de
  inicio y fin en hora local. Las aperturas puntuales añaden tiempo y los cierres
  lo quitan.
- Quitan también tiempo las clases de boxeo activas y las reservas confirmadas.
- Los inicios posibles van cada `intervalo` minutos desde el comienzo de cada
  tramo libre. Un hueco solo se ofrece si el servicio completo cabe en él.
- El cliente solo ve huecos que empiezan después de la antelación mínima y antes
  del horizonte. El entrenador puede saltarse esos dos límites, pero nunca solapar.
- Cambio de hora: la hora que no existe en marzo no se ofrece; la repetida de
  octubre se entiende como la primera. La duración de un hueco es tiempo real.
- La disponibilidad dice qué huecos están libres, nunca quién ocupa los demás.
- El servidor calcula los huecos y solo acepta una reserva cuyo inicio esté entre
  ellos. La app los muestra; no los inventa.

### Reservar, cancelar y mover

- **Reservar.** El cliente reserva para sí mismo. El entrenador reserva para
  cualquier cliente pendiente o activo, nunca para uno dado de baja. Cada
  reserva lleva un id de operación: repetirla con el mismo contenido devuelve la
  misma reserva, y con otro contenido da conflicto.
- **Sin saldo.** Si el servicio gasta saldo y no queda, la reserva se rechaza y
  la app ofrece los productos de `planes`.
- **En pareja o grupo.** Quien reserva indica de 2 a 6 personas. No gasta saldo y
  crea un cobro pendiente por personas × tarifa. Cancelar anula ese cobro.
- **Cancelar el cliente.** Antes del plazo recupera la sesión. Después libera el
  hueco, pero la sesión se da por gastada. Una reserva ya empezada no se cancela.
- **Cancelar el entrenador.** Siempre devuelve la sesión.
- **No presentarse.** Cuenta como sesión gastada. No hace falta marcar nada.
- **Devolver a mano.** El entrenador puede devolver la sesión de una reserva
  cancelada tarde o de una pasada, una sola vez por reserva.
- **Mover.** Solo el entrenador y solo a un hueco libre. Si la nueva fecha cae en
  otro mes, la sesión se devuelve al mes anterior y se gasta del nuevo en la misma
  operación. Si no hay saldo en el nuevo mes, no se mueve.
- **Baja del cliente.** Dar de baja cancela sus reservas futuras con devolución,
  en la misma operación que la baja. Reactivar no las recupera.

### Boxeo

- El entrenador edita el horario fijo de clases. Editar una clase la retira y
  crea otra, así la asistencia pasada conserva a qué clase fue.
- La clienta ve el horario si tiene cuota o bono de boxeo vigente. La app no
  guarda el sexo de nadie: el acceso lo da el producto.
- Pasar lista marca asistentes por clase y fecha. Cada asistencia se cubre, por
  orden, con la cuota semanal, con el bono de boxeo o queda sin cobertura, con un
  aviso para el entrenador.
- Marcar dos veces no cuenta dos veces. Desmarcar devuelve lo que se descontó.
- Cambiar el horario de boxeo sigue la decisión 6: si pisa reservas de EP, no se
  aplica y devuelve la lista.

### Permisos

| Acción                                              | Cliente          | Entrenador | Nutricionista / empleado |
| --------------------------------------------------- | ---------------- | ---------- | ------------------------ |
| Ver servicios y huecos libres                       | Sí               | Sí         | No                       |
| Reservar                                            | Para sí          | Para todos | No                       |
| Ver reservas                                        | Solo las propias | Todas      | No                       |
| Cancelar                                            | Solo las propias | Todas      | No                       |
| Mover y devolver una sesión a mano                  | No               | Sí         | No                       |
| Editar horario, cierres, ajustes, servicios y boxeo | No               | Sí         | No                       |
| Ver el horario de boxeo                             | Con producto     | Sí         | No                       |
| Pasar lista                                         | No               | Sí         | No                       |

- El cliente sale siempre de la sesión, nunca del cuerpo de la petición.
- Una reserva de otro cliente responde igual que una que no existe.
- Cada regla tiene su test de denegación para los otros roles y sin sesión.

### Modelo conceptual

| Entidad           | Responsabilidad                                                            |
| ----------------- | -------------------------------------------------------------------------- |
| `AjustesAgenda`   | Fila única con los ajustes. Sirve también de candado de la agenda          |
| `Servicio`        | Duración, personas mínimas y máximas, clase de saldo o pago en efectivo    |
| `TarifaGrupo`     | Precio por persona según cuántas vienen                                    |
| `FranjaSemanal`   | Plantilla del horario en hora local                                        |
| `ExcepcionAgenda` | Cierre o apertura puntual, con motivo y autor                              |
| `ClaseBoxeo`      | Clase fija del horario de boxeo                                            |
| `AsistenciaBoxeo` | Quién vino a qué clase y fecha, y con qué se cubrió                        |
| `Reserva`         | Servicio, cliente, inicio y fin, personas, estado, motivo, autor, revisión |

- Dos reservas confirmadas nunca se solapan. Lo garantiza la base de datos, no
  solo el código.
- Las reservas no se borran. Cancelar cambia su estado y guarda motivo, autor e
  instante.
- La migración es aditiva. No toca las tablas de identidad.

### Criterios de aceptación

1. Con un horario de lunes a viernes de 8:00 a 14:00, el cliente ve huecos de 60
   minutos solo dentro de ese horario, respetando la antelación y el horizonte.
2. Dos clientes que piden a la vez el mismo hueco: uno lo obtiene y el otro
   recibe un conflicto. Nunca quedan dos reservas solapadas, tampoco con
   servicios de duraciones distintas.
3. Un cliente con una sola sesión que reserva dos huecos a la vez obtiene una
   sola reserva.
4. Repetir una reserva con el mismo id de operación no crea otra ni gasta otra
   sesión.
5. Cancelar antes del plazo devuelve la sesión; después, libera el hueco y no la
   devuelve. Cuando cancela el entrenador, siempre vuelve.
6. Cerrar una franja con reservas devuelve la lista de afectadas y no cierra
   nada. Cuando se cancelan, el cierre se aplica.
7. Una clase de boxeo activa quita los huecos de EP que se solapan con ella.
8. Pasar lista dos veces a la misma clienta en la misma clase no descuenta dos
   veces. Desmarcarla devuelve lo descontado.
9. Una reserva en pareja no gasta saldo y crea un cobro pendiente de 50 €.
   Cancelarla anula el cobro.
10. Los huecos del 29 de marzo y del 25 de octubre de 2026 son correctos en la
    API y en la app, sin depender de la zona horaria del servidor ni del teléfono.
11. Otro cliente no puede ver, cancelar ni adivinar reservas ajenas. El
    nutricionista y el empleado reciben denegación en todas las rutas, y sin
    sesión se recibe 401.
12. Dar de baja a un cliente cancela sus reservas futuras y libera esos huecos
    en la misma operación.
13. Con la app abierta más de quince minutos, reservar sigue funcionando sin
    volver a entrar.

### Estructura

- API en `apps/api/src/agenda/`. Consume `SaldoService` de `apps/api/src/planes/`
  dentro de su misma transacción. `planes` nunca importa `agenda`.
- Contratos en `packages/shared/src/agenda.ts`. La hora local va en
  `packages/shared/src/tiempo-local.ts`, compartida por app y servidor, sin
  librerías de zonas horarias.
- App en `apps/mobile/src/features/agenda/`, con pestañas por rol. El cliente
  reserva desde Inicio; el entrenador tiene Agenda, Clientes, Cobros, Boxeo y
  Ajustes.
- Rutas, entidades y comandos concretos: [tasks/horarios/plan.md](tasks/horarios/plan.md).

### Fronteras

**Siempre:** calcular los huecos en el servidor, guardar autor e instante de
cada cancelación y movimiento, y probar los cambios de hora.

**Nunca:** borrar una reserva, decir quién ocupa un hueco, aceptar el cliente del
cuerpo de la petición, o aplicar a medias un cambio de horario que pisa reservas.
