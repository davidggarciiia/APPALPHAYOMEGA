# Spec: `planes` — saldo, productos y cobros

> Redactada el 2026-09-26 a partir del plan aprobado por David el 2026-09-25. El
> texto espera su revisión. Módulo nuevo del [mapa](CAPABILITY-MAP.md); depende
> solo de `identity`. Lo consume `agenda` ([ampliación de horarios](SPEC-agenda.md#ampliación-horarios-y-reservas)).
> Intención: [horarios y reservas](docs/intent/horarios-y-reservas.md).
> Fundamentos, stack y convenciones: [SPEC.md](SPEC.md).

## Objetivo

Saber en todo momento cuántas sesiones le quedan a cada cliente, de dónde salen y
cuándo caducan, y registrar el dinero que el entrenador cobra en efectivo. El
cliente ve su saldo y pide lo que quiera comprar; el entrenador lo activa cuando
cobra.

## Por qué es un módulo propio

Las reglas del dinero y del saldo son distintas de las del calendario: libro de
movimientos, idempotencia, caducidades y cobros. Hay packs, como los online, que
no tocan la agenda. Y `nutricion` podrá leer el plan de un cliente sin depender de
`agenda`. Separarlo evita que la agenda cargue con todo.

## Alcance

- Catálogo de productos con su precio: planes mensuales, bonos, sesiones sueltas
  y matrícula.
- Suscripciones a planes, bonos comprados y el saldo que se deriva de ellos.
- Solicitudes del cliente («Lo quiero») y su activación por el entrenador.
- Cobros en efectivo: pendientes, cobrados y el total del mes.

Fuera: pasarela de pago, facturas, contabilidad e impuestos. La app registra lo
cobrado; no emite ningún documento fiscal.

## Decisiones aprobadas

1. El saldo tiene tres fuentes: el plan (N EP al mes según el pack), los bonos y
   las sesiones sueltas. Una suelta es un bono de una sesión.
2. Hay dos clases de saldo: `ep` y `boxeo`. Cada servicio o asistencia gasta de
   una sola clase.
3. El mes es natural, en `Europe/Madrid`. Lo que el plan da en un mes y no se usa
   se pierde al acabar ese mes.
4. Al activar un plan a mitad de mes, el entrenador elige si empieza este mes, con
   el cupo completo, o el siguiente.
5. Un bono caduca un año después de su primera sesión. Hasta entonces no caduca.
   Las sueltas y los bonos de boxeo siguen la misma regla.
6. Una sesión gasta del mes en que ocurre, no del mes en que se reservó.
7. El cliente pide un producto con «Lo quiero» y el entrenador lo activa al
   cobrar. Los packs online no se ofrecen al cliente: el entrenador los activa
   directamente.
8. Los importes se guardan en céntimos, como enteros. Nunca con decimales.
9. El saldo no es un contador: se calcula a partir de lo concedido y de un libro
   de movimientos que nunca se borra ni se edita. Toda corrección es un
   movimiento nuevo con su autor.

## Conceptos

| Entidad           | Qué es                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------- |
| `Producto`        | Lo que se vende: plan, bono o matrícula. Precio, EP/mes, boxeo/semana, meses, sesiones |
| `Suscripcion`     | Un plan activado para un cliente: mes de inicio y número de meses. Copia sus cupos     |
| `Bono`            | Sesiones compradas de una clase. Guarda su primer uso y su caducidad                   |
| `MovimientoSaldo` | Una sesión gastada o devuelta, con su fuente, su origen y su autor                     |
| `Solicitud`       | Un «Lo quiero» del cliente: producto, precio del momento y estado                      |
| `Cobro`           | Dinero que se debe o que se cobró: concepto, importe, estado y fecha de cobro          |

Los productos se copian al activarse. Cambiar un precio o un cupo del catálogo no
altera lo que ya tiene nadie.

## Reglas del saldo

### Cuánto queda

- EP del mes `m`: lo que den las suscripciones que cubren `m`, más los
  movimientos imputados a esas suscripciones en `m`.
- De un bono: sus sesiones más sus movimientos, si no ha caducado.
- Cuota de boxeo: las clases por semana de la suscripción, en cada semana de lunes
  a domingo cuyo mes esté cubierto.

### De dónde se gasta

Para una sesión en la fecha `d`, por este orden:

1. El plan del mes de `d`.
2. Los bonos ya empezados, primero el que caduca antes.
3. Los bonos sin empezar, del más antiguo al más reciente.
4. Las sesiones sueltas.

Un bono solo sirve si no ha caducado en la fecha de la sesión. Si no queda nada,
la operación se rechaza y la app ofrece los productos.

### Caducidad y devoluciones

- La primera sesión que gasta de un bono fija su primer uso y su caducidad.
- Si se devuelve la única sesión gastada de un bono, vuelve a estar sin empezar.
- Una devolución vuelve a la fuente de la que salió. Si esa fuente ya no sirve (el
  mes pasó o el bono caducó), se crea una sesión suelta de compensación.
- Un mismo origen (una reserva, una asistencia) se gasta una sola vez y se
  devuelve una sola vez. Lo garantiza la base de datos.

### Suscripciones

- No se solapan dos suscripciones que den saldo de la misma clase. Para cambiar
  de plan, la nueva empieza cuando acaba la anterior.
- Un plan trimestral es una suscripción de tres meses con su cupo en cada uno.

## Solicitudes y activación

- El cliente solo ve y pide productos activos marcados como visibles para él.
- Solo puede tener una solicitud pendiente por producto. Puede anularla mientras
  siga pendiente. Repetir la misma petición no crea otra.
- El entrenador activa una solicitud indicando el importe cobrado (por defecto,
  el precio copiado) y, si es un plan, si empieza este mes o el siguiente. En la
  misma operación nacen la suscripción o el bono y su cobro.
- El entrenador también activa productos directamente, sin solicitud. Puede
  dejar el cobro pendiente si el cliente pagará después.
- Rechazar una solicitud no crea nada. Dar de baja al cliente anula sus
  solicitudes pendientes.

## Cobros

- Nacen al activar un producto o al reservar una sesión en pareja o grupo (esta
  segunda vía la crea `agenda`).
- Estados: pendiente, cobrado o anulado. Cobrar guarda la fecha. Anular guarda el
  autor.
- El resumen de un mes suma lo cobrado en ese mes y lista lo pendiente, sea del
  mes que sea.
- Dar de baja a un cliente no borra ni anula sus cobros pendientes: son deuda.

## Catálogo inicial

Sale de la hoja de servicios del entrenador. Lo crea el seed una sola vez y el
entrenador edita después precios y visibilidad. El seed nunca pisa un precio ya
editado.

| Producto                      | Tipo      | Precio | Cupo           | Meses | Visible |
| ----------------------------- | --------- | -----: | -------------- | ----: | ------- |
| Online Entrenamiento          | plan      |   50 € | 0 EP/mes       |     1 | No      |
| Online Entrenamiento, 3 meses | plan      |  138 € | 0 EP/mes       |     3 | No      |
| Online Entrenamiento, 5 meses | plan      |  215 € | 0 EP/mes       |     5 | No      |
| Online Integral               | plan      |   75 € | 0 EP/mes       |     1 | No      |
| Online Integral, 3 meses      | plan      |  219 € | 0 EP/mes       |     3 | No      |
| Presencial Esencial           | plan      |  100 € | 2 EP/mes       |     1 | Sí      |
| Presencial Esencial, 2 meses  | plan      |  190 € | 2 EP/mes       |     2 | Sí      |
| Presencial Esencial, 3 meses  | plan      |  270 € | 2 EP/mes       |     3 | Sí      |
| Presencial Esencial, 5 meses  | plan      |  420 € | 2 EP/mes       |     5 | Sí      |
| Presencial Integral           | plan      |  125 € | 2 EP/mes       |     1 | Sí      |
| Presencial Integral, 3 meses  | plan      |  369 € | 2 EP/mes       |     3 | Sí      |
| Presencial Plus               | plan      |  185 € | 4 EP/mes       |     1 | Sí      |
| Presencial Plus, 3 meses      | plan      |  549 € | 4 EP/mes       |     3 | Sí      |
| Boxeo, 1 clase por semana     | plan      |   30 € | 1 boxeo/semana |     1 | Sí      |
| Boxeo, 2 clases por semana    | plan      |   40 € | 2 boxeo/semana |     1 | Sí      |
| EP suelta                     | bono      |   35 € | 1 EP           |     — | Sí      |
| Bono EP 6                     | bono      |  192 € | 6 EP           |     — | Sí      |
| Bono EP 8                     | bono      |  240 € | 8 EP + regalo  |     — | Sí      |
| Bono EP 10                    | bono      |  290 € | 10 EP + regalo |     — | Sí      |
| Bono boxeo 5                  | bono      |   50 € | 5 boxeo        |     — | Sí      |
| Bono boxeo 10                 | bono      |   80 € | 10 boxeo       |     — | Sí      |
| Matrícula de boxeo            | matrícula |   35 € | —              |     — | No      |

- El «regalo» de los bonos de 8 y 10 es una sesión de quiromasaje. Se guarda como
  texto, porque el quiromasaje todavía no se ofrece.
- «Seguimiento presencial» y «Presencial Esencial» son el mismo producto en la
  hoja de servicios.
- Las tarifas por persona de la EP en pareja o grupo viven en `agenda`, junto al
  servicio.
- Los servicios sin sesión en agenda (diseño de rutinas, nutrición suelta) no
  entran en este catálogo.

## Permisos

| Acción                                             | Cliente        | Entrenador | Nutricionista / empleado |
| -------------------------------------------------- | -------------- | ---------- | ------------------------ |
| Ver productos                                      | Solo visibles  | Todos      | No                       |
| Editar precios y visibilidad                       | No             | Sí         | No                       |
| Ver saldo y movimientos                            | Solo el propio | Todos      | No                       |
| Pedir y anular solicitudes                         | Las propias    | No         | No                       |
| Activar o rechazar solicitudes y activar productos | No             | Sí         | No                       |
| Ver, cobrar y anular cobros; resumen del mes       | No             | Sí         | No                       |

Cada regla tiene su test de denegación para los otros roles y sin sesión. El
cliente sale siempre de la sesión, nunca del cuerpo de la petición.

## Contrato con `agenda`

`PlanesModule` exporta `SaldoService`. Sus métodos reciben el cliente de
transacción de quien llama, para que reservar y gastar ocurran en una sola
operación:

- `consumir(tx, { clienteId, clase, fechaSesion, origen })` devuelve la fuente
  usada o un rechazo por falta de saldo.
- `devolver(tx, { origen, motivo, autorId })` deshace un consumo, con
  compensación si hace falta.
- `resumen(clienteId, fecha)` devuelve lo que queda de cada fuente.

`agenda` crea los cobros de las sesiones en pareja o grupo con
`CobrosService.crearPendiente(tx, ...)`. `planes` guarda el origen de cada
movimiento como tipo e id, sin clave ajena hacia `agenda`, y nunca la importa.

Quien llama toma antes el candado del cliente, bloqueando su fila de usuario.
Si además necesita el de la agenda, lo toma primero.

## Criterios de aceptación

1. Activar Presencial Esencial «este mes» da 2 EP en el mes actual. «El
   siguiente» da 0 este mes y 2 el siguiente.
2. Un plan de tres meses da su cupo en cada uno de los tres meses.
3. Las EP que no se usaron en septiembre no aparecen en octubre.
4. Se gasta por este orden: plan del mes, bono empezado que caduca antes, bono
   sin empezar, suelta.
5. Un bono empieza a caducar con su primera sesión. Devolver esa única sesión lo
   deja sin empezar.
6. Devolver una sesión cuya fuente ya caducó crea una suelta de compensación.
7. Dos consumos simultáneos del último crédito: solo uno lo obtiene.
8. Un cliente no puede pedir un producto oculto. Solo tiene una solicitud
   pendiente por producto, y repetir la petición no crea otra.
9. Activar una solicitud crea el saldo y el cobro en la misma operación.
   Activarla dos veces no duplica nada.
10. El resumen del mes suma lo cobrado en ese mes y lista lo pendiente.
11. El cliente solo ve lo suyo, el nutricionista y el empleado reciben
    denegación en todo, y sin sesión se recibe 401.
12. Ningún movimiento se borra ni se modifica. Toda corrección es un movimiento
    nuevo con autor.

## Estructura

- API en `apps/api/src/planes/`, con servicios de catálogo, saldo, solicitudes y
  cobros. Controladores sin lógica.
- Contratos en `packages/shared/src/planes.ts`.
- App en `apps/mobile/src/features/planes/`: pestaña Planes del cliente, pestaña
  Cobros y saldo dentro de la ficha del cliente del entrenador.
- Tests unitarios de las reglas del saldo junto al servicio. Integración contra
  Postgres real en `apps/api/test/`.

## Preguntas abiertas

1. **Subir de plan a mitad de mes.** Con la regla actual, el plan nuevo empieza
   cuando acaba el anterior. Si el entrenador quiere que alguien pase de Esencial
   a Plus el día 10, hoy tendría que devolver o sumar sesiones a mano.
2. **Fiscal.** Confirmar con el gestor que registrar cobros sin emitir facturas
   no convierte la app en un sistema de facturación sujeto a VERI\*FACTU.

## Fronteras

**Siempre:** importes en céntimos, operaciones idempotentes con id de operación,
autor en cada movimiento y cobro, y activación con su cobro en la misma
transacción.

**Nunca:** cobrar dentro de la app, emitir facturas, borrar o editar movimientos,
mostrar al cliente productos ocultos, o permitir que `planes` importe `agenda`.
