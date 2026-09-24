# Spec: `seguimiento-corporal` — configuración y progreso

> Iteración del 24-09-2026. [Mapa de capacidades](CAPABILITY-MAP.md) · [Plan vigente](tasks/plan.md) · [Verificación](tasks/todo.md).

## Propósito y responsabilidades

El entrenador decide qué indicadores verá cada cliente, en qué orden y qué debe registrar. El cliente consulta su evolución y anota sus resultados, sin crear ni modificar pruebas u objetivos. El nutricionista asignado puede consultar la configuración para coordinar su trabajo, sin editarla.

La configuración incluye indicadores `peso`, `pasos`, `sueno`, `cintura`, `fuerza` y `pruebas`; registros solicitados diarios o semanales (con día de semana); objetivo de peso para bajar, mantener o subir, con rango opcional; y pruebas físicas prescritas con nombre, unidad e identificador estable.

## Estado inicial y datos anteriores

Una cuenta sin configuración nueva conserva los indicadores actuales. Peso, pasos y sueño se solicitan diariamente; no se inventan pruebas ni un objetivo de peso. Las medidas y pruebas históricas permanecen accesibles. Las pruebas antiguas sin identificador de prescripción se muestran como historial; las nuevas del cliente referencian una prueba prescrita.

Una variación de peso indica dirección y magnitud. Sin una pauta suficiente del entrenador no se colorea una bajada como éxito ni una subida como fracaso. Progreso muestra primero los indicadores elegidos y el próximo registro que corresponde; el historial completo continúa disponible.

## Contrato y permisos

`GET /seguimiento/clientes/:clienteId/configuracion` permite leer al cliente propio, su entrenador y el nutricionista asignado. `PUT` en la misma ruta solo permite al entrenador responsable editar. La petición incluye `revision`; una revisión desactualizada recibe conflicto y conserva el borrador local del editor. El cliente solo puede registrar resultados de pruebas con `pruebaId` presente en la configuración vigente.

La migración es aditiva. Las cuentas y registros previos siguen siendo válidos; ningún campo nuevo obliga retrospectivamente a introducir datos ni elimina el historial.

## Aceptación

1. El entrenador configura y reabre los indicadores, frecuencia, objetivo y pruebas de un cliente; el cliente ve exactamente lo publicado.
2. Un registro semanal aparece en el día pautado y uno diario cada día. Sin objetivo, el cambio de peso se interpreta de forma neutral.
3. El cliente registra una prueba prescrita, pero no puede editar su definición ni crear otra. Una prueba histórica sigue visible.
4. Dos ediciones concurrentes no se sobrescriben silenciosamente. Los roles ajenos no obtienen acceso ni modifican la configuración.
5. Las comprobaciones HTTP se ejecutan en una base de pruebas separada; la verificación física y de usabilidad se registra en `tasks/todo.md`.
