# Spec: reservas con bonos y seguimiento

Estado: aprobado por el dueño en sus respuestas del 30-10-2026. Amplía `SPEC.md`.

## Objetivo

El entrenador cobra en efectivo. Sus entrenos personales y sesiones de seguimiento
se gestionan en la app sin pagos dentro de ella: el entrenador carga bonos cuando
cobra y la app descuenta.

**Decisión del dueño (30-10, tras probar la app): RESERVA EL ENTRENADOR.** El
cliente no reserva por sí mismo: el entrenador asigna al cliente un hueco (que
gasta su crédito o su cupo) y el cliente lo ve en su calendario, con su saldo y
cupo visibles. Donde los criterios de abajo dicen «el cliente reserva» o «el
cliente pide cancelar», se entiende que lo hace el entrenador; la pantalla del
cliente es de consulta.

- **Entreno personal**: va por libre; cada reserva gasta 1 crédito de un bono de
  entrenos personales que el entrenador carga al cobrar (p. ej. 10).
- **Seguimiento**: el entrenador hace medidas, pesos y mide el progreso; incluye
  **2 h gratis al mes** por cliente con seguimiento activo. Las reservas de
  seguimiento descuentan minutos de ese cupo mensual, que se renueva cada mes
  natural y no se acumula.
- **Quiromasaje**: previsto para el futuro; el modelo lo admite como servicio con
  su propio bono, pero no se ofrece todavía.

| Módulo           | Qué resuelve                                              | Depende de        |
| ---------------- | --------------------------------------------------------- | ----------------- |
| `bonos`          | Servicios, bonos cargados por el entrenador y movimientos | identity          |
| `disponibilidad` | Huecos que abre el entrenador                             | —                 |
| `reservas`       | Reservar, cancelar y la decisión del entrenador           | los dos de arriba |
| `calendario`     | Vistas del cliente y agenda del entrenador                | los tres          |

## Criterios de aceptación

### bonos

1. El entrenador carga a un cliente un bono de un servicio con número de créditos
   y nota opcional (p. ej. «10 entrenos · pagado en efectivo»); queda un movimiento
   de «carga» con autor y fecha. Puede ajustar a mano con motivo.
2. El entrenador marca si un cliente tiene **seguimiento activo**; con él, el cliente
   dispone de 120 min al mes para reservas de seguimiento.
3. El cliente ve sus créditos restantes por servicio y los minutos de seguimiento
   que le quedan este mes; nunca ve los de otros clientes.
4. Todo cambio de saldo es un movimiento (carga, consumo, devolución, ajuste) y el
   saldo es la suma de sus movimientos; no se borran movimientos.

### disponibilidad

5. El entrenador abre huecos: día, hora de inicio, duración (por defecto 60 min) y
   qué servicios admite (entreno personal, seguimiento o ambos). Puede repetir un
   hueco semanalmente durante N semanas y cerrar huecos libres.
6. El cliente ve solo los huecos libres de los servicios que puede reservar; un hueco
   reservado no revela quién lo reservó.

### reservas

7. El cliente reserva un hueco libre eligiendo el servicio: un entreno personal gasta
   1 crédito; un seguimiento gasta la duración del hueco de su cupo mensual. Sin
   créditos o sin cupo no puede reservar y se le explica por qué.
8. Dos reservas simultáneas del mismo hueco: solo una gana (prueba de concurrencia);
   la otra recibe un error claro y no gasta nada.
9. El cliente puede pedir cancelar una reserva; **el entrenador decide** si devuelve
   el crédito o los minutos. El entrenador también puede cancelar él mismo
   (devolviendo) y marcar asistencia.
10. Notificaciones: el entrenador se entera de reservas nuevas y peticiones de
    cancelación; el cliente, de la decisión. Usan la campana existente.

### calendario

11. En el calendario expandido del cliente (Hoy) se ven sus sesiones del plan y sus
    reservas, y una acción «Reservar» que lista los huecos libres por día y servicio,
    con su saldo visible.
12. El entrenador tiene una agenda por día y semana con huecos libres y reservas, que
    **distingue entreno personal y seguimiento** a simple vista; desde ella abre
    huecos, cancela y decide cancelaciones. Desde la ficha del cliente («Datos del
    cliente» o una fila «Bonos») carga bonos y activa el seguimiento.
13. Diseño del ESPEC móvil, mobile-first, sin animaciones de entrada con desplazamiento.

### Para todos

14. Migraciones Prisma aditivas; contratos en `packages/shared`; e2e de permisos
    (un cliente no ve ni reserva por otro), saldo, concurrencia y cancelación.
15. Suites del móvil, la API, el paquete compartido y las e2e, typecheck y lint en verde.

## Límites

- Siempre: sin pagos en la app; saldos por movimientos; privacidad entre clientes.
- Preguntar antes: cobros online, caducidad de bonos, penalizaciones automáticas.
- Nunca: borrar movimientos de saldo; reservar sin crédito ni cupo.

## Supuestos (cambiables)

- El cupo de seguimiento son 120 min por mes natural, sin acumular.
- La duración por defecto de un hueco es 60 min.
- Los bonos no caducan.
