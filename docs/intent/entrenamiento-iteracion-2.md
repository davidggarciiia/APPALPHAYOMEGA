# Intención — segunda iteración de entrenamiento

> Recogida el 2026-09-17 con `interview-me`, del flujo Agent Skills instalado
> en Claude. Las decisiones funcionales proceden de la conversación con David.
> David ha aprobado las especificaciones que las desarrollan en esta conversación.

## Resultado y usuarios

El entrenador prepara y asigna una rutina; el cliente registra lo realizado y
envía el entrenamiento al terminar; el entrenador consulta esos resultados.
Es el primer recorrido completo del núcleo de Alpha & Omega.

## Por qué ahora y cómo se reconoce el éxito

La app ya tiene cuentas, sesión y gestión de clientes. Esta iteración debe
permitir comprobar el trabajo del cliente desde la app, siguiendo la intención
original: el entrenador ve lo que ha levantado sin tener que preguntárselo.

Una demostración completa incluye asignar una rutina, cambiar el día de una
sesión, registrar una serie por repeticiones y otra por tiempo, recuperar el
borrador tras cerrar la app y enviar los resultados al entrenador.

## Decisiones confirmadas en la entrevista

- El entrenador prepara un plan de varios días que se repite durante varias
  semanas y ajusta según los resultados.
- Crear rutinas personalizadas desde cero es el camino principal. También debe
  poder elegir una rutina guardada y adaptarla.
- El entrenador asigna cada sesión a una fecha. El cliente puede cambiarla
  dentro de la misma semana y el entrenador ve el cambio reflejado.
- El cliente registra su ejecución; el entrenador decide los ejercicios y las
  series de la rutina.
- Cada serie presenta dos campos: peso y repeticiones, o peso y tiempo cuando
  el ejercicio se mide por duración. El objetivo aparece tenue como guía.
- El cliente introduce lo que realmente ha hecho y marca la serie como hecha.
- El borrador se guarda automáticamente para no perder el registro.
- Los resultados llegan al entrenador al pulsar «Enviar entrenamiento» al final;
  no se muestran al entrenador mientras el cliente está rellenándolos.

## Restricciones y alcance

Se conserva Expo/React Native, NestJS, Prisma, PostgreSQL, los cuatro roles y la
identidad visual negra y dorada. Se aprovecha la gestión de clientes existente.

Esta iteración cubre el catálogo mínimo necesario para elegir ejercicios,
las fechas de las sesiones y el recorrido de entrenamiento. No amplía nutrición,
seguimiento corporal, leads, fichajes ni los trámites de publicación. El mapa
muscular, las figuras animadas y la subida de vídeos siguen en el alcance futuro
del catálogo; no son necesarios para comprobar este primer recorrido.

## Detalles aprobados junto con la especificación

- Semana de lunes a domingo según `Europe/Madrid`.
- Mover una sesión modifica solo esa ocurrencia, no las semanas siguientes.
- Se conserva la fecha original junto a la actual, para que el entrenador
  pueda reconocer qué cambió.
- Se pueden enviar entrenamientos incompletos, mostrando qué series faltan.
- Una sesión enviada queda en modo consulta en esta primera versión.
- La conexión es necesaria para descargar una sesión y confirmar su envío;
  un borrador ya abierto se conserva aunque se pierda la conexión.

## Documentos de continuación

- [Mapa de capacidades existente](../../CAPABILITY-MAP.md).
- [Catálogo existente, actualmente en borrador](../../SPEC-catalogo-ejercicios.md).
- [Agenda: fechas y cambios de día](../../SPEC-agenda.md).
- [Entrenamiento: prescripción, registro y envío](../../SPEC-entrenamiento.md).

`tasks/plan.md` y `tasks/todo.md` contienen trabajo pendiente de `identity`.
David ha aprobado guardar el nuevo plan en `tasks/entrenamiento/plan.md` y
`tasks/entrenamiento/todo.md`, conservando los anteriores.
