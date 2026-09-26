# Intención — horarios y reservas

> Recogida el 2026-09-25 en conversación con David, a partir de su hoja de
> servicios (`Servicios_enviar_a_David_App.pdf`, fuera del repositorio). Es la
> entrada de [SPEC-agenda.md](../../SPEC-agenda.md), sección «Ampliación: horarios
> y reservas», y de [SPEC-planes.md](../../SPEC-planes.md). No es una especificación.

## Resultado

El cliente abre la app y en la pestaña de inicio ve un calendario con los huecos
libres del entrenador, al estilo Booksy. Elige uno y queda reservado al instante,
descontando una sesión de su saldo. El entrenador edita su horario, ve su agenda
del día y lleva el saldo y los cobros de cada cliente desde la app.

No hay pasarela de pago. El entrenador cobra en efectivo y la app solo lo registra.

## Por qué ahora

Horarios va antes que entrenamiento. Es más pequeño, le da al cliente un inicio
real (hoy solo ve su perfil, motivo de rechazo en App Store por funcionalidad
mínima) y resuelve un problema diario del negocio: organizar las sesiones y saber
cuántas le quedan a cada uno. El resto del mapa de capacidades no cambia.

## Servicios del negocio

Resumen de la hoja de servicios, lo que la app necesita saber:

| Servicio                      | Forma                                                         | En la app                             |
| ----------------------------- | ------------------------------------------------------------- | ------------------------------------- |
| EP individual                 | 35 €/h suelta; bonos de 6 (192 €), 8 (240 €) y 10 (290 €)     | Se reserva                            |
| EP en pareja o grupo privado  | 60 min, de 2 a 6 personas, precio por persona (25 € a 10 €)   | Se reserva, se paga allí              |
| Packs mensuales               | Presencial Esencial e Integral: 2 EP/mes; Plus: 4; online: 0  | Dan saldo mensual                     |
| Boxeo femenino                | Lunes y viernes 11:30 y 18:00; cuota 1 o 2/semana; bonos 5/10 | Horario propio, se pasa lista         |
| Quiromasaje                   | 30 y 60 min, todavía no se ofrece                             | Fuera de v1; el modelo debe admitirlo |
| Diseño de rutinas y nutrición | Servicios sin sesión en agenda                                | Fuera de este alcance                 |

Condiciones de los bonos: se pagan enteros al comprarlos y valen un año desde la
primera utilización.

## Decisiones confirmadas por David

**Qué se reserva**

- En la primera versión se reservan la EP individual y la EP en pareja o grupo
  privado. El boxeo femenino aparece con su propio horario fijo.
- La duración se configura por servicio. El quiromasaje entrará más adelante sin
  rehacer el modelo.
- Hay una sola agenda: la del entrenador.

**Cómo se reserva**

- La reserva queda confirmada al instante y el saldo se descuenta en ese momento.
- La antelación mínima y el horizonte máximo los fija el entrenador. Por defecto,
  2 horas y 4 semanas.
- Cancelar hasta 24 horas antes devuelve la sesión; el plazo es ajustable. Más
  tarde libera el hueco pero la sesión se pierde. No presentarse cuenta como
  gastada. El entrenador siempre puede devolver una sesión a mano.
- Si el entrenador cierra una franja donde ya hay reservas, la app se las enseña
  y no la cierra hasta que las mueva o cancele. Cuando cancela él, la sesión
  siempre vuelve al cliente.
- Sin notificaciones en la primera versión. Todo se ve dentro de la app. Las
  push llegarán cuando existan las cuentas de Apple y Google.

**Saldo y dinero**

- El saldo se compone de plan, bonos y sesiones sueltas. El plan da un número de
  EP al mes según el pack; los bonos caducan al año de su primer uso. Al reservar
  se gasta primero lo que caduca antes.
- El mes es natural. Las EP del plan que no se usan se pierden al acabar el mes.
  Si el plan se activa a mitad de mes, el entrenador elige si empieza ese mes, con
  su cupo completo, o el siguiente.
- El cliente ve los productos con su precio y pulsa «Lo quiero». Eso crea una
  solicitud que el entrenador activa cuando cobra en efectivo; entonces aparece el
  saldo.
- En pareja o grupo reserva un cliente e indica cuántos vienen. Los acompañantes
  no necesitan cuenta. No gasta saldo: se cobra por persona el día de la sesión y
  queda pendiente de cobro hasta que el entrenador lo marca.
- El boxeo no se reserva. La clienta se presenta y el entrenador pasa lista. Cada
  asistencia cuenta en su cuota semanal o descuenta de su bono. Las clases las da
  el entrenador, así que bloquean su agenda de EP.
- La app guarda el importe y la fecha de cada cobro, lo pendiente y el total del
  mes. No emite facturas ni lleva la contabilidad.

## Decisiones tomadas por defecto en el plan aprobado

David aprobó el plan que las contenía. Se señalan aparte porque no salieron de
una pregunta directa.

- El saldo, los planes, los bonos y los cobros forman un módulo nuevo, `planes`.
- Una sesión gasta saldo del mes en que ocurre, no del mes en que se reservó.
- El primer uso de un bono es la fecha de su primera sesión. Las sueltas y los
  bonos de boxeo caducan igual, al año.
- El cliente no mueve reservas: cancela y vuelve a reservar. Mover es cosa del
  entrenador.
- Los packs online no se ofrecen al cliente en «Lo quiero»: no dan EP y podrían
  leerse como contenido digital en App Store. El entrenador los activa igual.
- Dar de baja a un cliente cancela sus reservas futuras y anula sus solicitudes.
  Los cobros pendientes se conservan porque son deuda real.

## Fuera de alcance

- Pasarela de pago, facturas y contabilidad.
- Notificaciones push, correo y recordatorios.
- Quiromasaje, fisioterapeuta y packs de bienestar.
- Reserva de clases de boxeo con aforo o lista de espera.
- Varias agendas o varios profesionales.

## Riesgos abiertos

1. Tiendas de aplicaciones: los servicios físicos pagados fuera de la app no
   exigen compra integrada, pero hay que revisar las normas vigentes antes de
   publicar.
2. Registrar cobros sin facturar: confirmar con el gestor que la app no pasa a
   ser un sistema de facturación sujeto a VERI\*FACTU.
3. La base técnica que falta (tests de la app, CI, renovación del token) entra
   delante, en la fase 0 del plan. Sin ella, la agenda del entrenador deja de
   funcionar a los quince minutos de tenerla abierta.
