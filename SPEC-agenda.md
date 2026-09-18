# Spec: `agenda` — fechas de entrenamiento

> Estado: aprobada por David en esta conversación. Redactada el 2026-09-17. Módulo del
> [mapa aprobado](CAPABILITY-MAP.md); depende de `identity`.
> Esta especificación cubre solo la parte necesaria para la segunda iteración.
> Intención: [entrenamiento](docs/intent/entrenamiento-iteracion-2.md).
> Fundamentos, stack y convenciones: [SPEC.md](SPEC.md).

## Objetivo

El entrenador programa sesiones en fechas concretas. El cliente puede moverlas
dentro de su semana y ambos ven la fecha actualizada. El cambio conserva la
identidad de la sesión y sus registros.

## Alcance

- Fechas de sesiones individuales de entrenamiento de clientes.
- Consulta semanal, con selección de semanas anteriores y posteriores.
- Cambio de día de una sesión y consulta de su fecha original y actual.
- Contrato de programación consumido por `entrenamiento`.

Las reservas con hora, aforos, clases colectivas, boxeo, recordatorios y la vista
mensual completa se especificarán cuando se amplíe `agenda`. No forman parte de
este primer recorrido ni se eliminan del mapa del proyecto.

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
