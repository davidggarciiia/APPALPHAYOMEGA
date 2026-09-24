# Alpha & Omega — experiencia del cliente

> Iteración aprobada por David el 24-09-2026. Base: `d7d8ef0`, integrada mediante avance directo en `codex/cliente-intuitivo`. [Tareas y verificaciones](todo.md) · [Planes anteriores](planes%20antiguos/2026-09-24/INDEX.md).

## Objetivo

El entrenador o nutricionista configura; el cliente entiende qué le toca, registra lo realizado y recibe respuesta. Las pantallas conservan el tema dorado y oscuro actual y las cuatro pestañas Entreno, Plan, Nutrición y Progreso. El borrador del entrenamiento continúa privado hasta el envío.

## Decisiones de producto

- El cliente puede mover una sesión dentro de su misma semana; el entrenador ve el cambio. No necesita aprobarlo.
- Por ejercicio, el entrenador elige RIR desactivado, al acabar ejercicio o en cada serie. La respuesta del cliente es opcional.
- La prescripción distingue ejercicios con y sin carga externa. Se registran kilos solo donde corresponde; repeticiones y segundos mantienen su unidad.
- Un ejercicio activo ocupa la pantalla principal del entrenamiento; el resto aparece en una lista plegable. El cliente puede marcar, corregir u omitir series y saltar a otro ejercicio. Omitida y pendiente se distinguen.
- Salir de la pantalla de entrenamiento pausa el cronómetro; bloquear el móvil o abrir otra app no lo pausa. Se guarda tiempo acumulado, tramo activo y estado de pausa. Los registros antiguos sin estos campos conservan su tiempo transcurrido sin presentarlo como activo.
- «Empezar», «Continuar» y «Ver resumen» dependen del estado real. Si hay varios borradores, se destaca el más reciente y se accede a los otros.
- Guardado local y entrega al entrenador son estados diferentes. La intención de envío y su UUID se conservan antes de operar con la red; el servidor confirma antes de enseñar «Enviado».
- La subida automática de carga es propuesta interna para el entrenador. El cliente ve solamente la prescripción que el entrenador haya publicado.
- El entrenador marca una sesión «Revisada» con una acción explícita. Abrirla o comentarla no la revisa. Cliente y entrenador tienen avisos dentro de la app, con lectura individual persistida.
- En nutrición cada comida puede ser de platos completos (`alternativas`) o intercambio por grupos (`intercambio`). Platos completos permiten uno o varios platos con cantidades profesionales. Comida y Cena proponen intercambio al crear; el profesional puede cambiar la forma.
- El cliente elige explícitamente un plato o un alimento por grupo antes de registrar; nunca se registra la primera opción de manera silenciosa. Los suplementos del inicio salen de la dieta publicada y comparten el registro con Nutrición.
- El entrenador configura por cliente indicadores visibles, orden, frecuencia diaria/semanal, día de registro semanal, objetivo y rango de peso opcional, y pruebas prescritas. El cliente registra resultados, sin configurar las pruebas.
- La evolución de peso usa un indicador de dirección neutral salvo que el objetivo y el rango del entrenador permitan interpretar el resultado.

## Arquitectura y compatibilidad

`packages/shared` define contratos Zod opcionales y compatibles con documentos antiguos. Los campos nuevos de prescripción y registro se persisten en JSON existente cuando procede; las configuraciones, revisiones y lecturas requieren migraciones aditivas con rollback. `apps/api` valida rol y alcance de cliente; `apps/mobile` conserva su copia local y las revisiones optimistas. Las dos formas actuales de comida y sus IDs permanecen. Las cuentas, dietas, sesiones, medidas y registros existentes continúan legibles.

Interfaces nuevas: `PUT /entrenamiento/sesiones/:id/revision` (entrenador), `GET /entrenamiento/clientes/:clienteId/novedades` (alcance vigente), `POST /entrenamiento/sesiones/:id/novedades/leidas` (actor), `GET` y `PUT /seguimiento/clientes/:clienteId/configuracion` (lectura según alcance; escritura entrenador con revisión). Las rutas actuales de borrador, envío, fecha y comida siguen operativas.

La intención de envío congela el contenido visible, reutiliza el identificador de operación y procesa antes los borradores pendientes. Si hay conflicto entre versiones, se conservan ambas y se ofrece resolución; no se informa «Enviado» hasta confirmación. La lectura de novedades es por usuario y sesión, sin marcar como leído lo de otra persona.

Las pruebas HTTP se ejecutan en una base desechable separada de `alpha_omega`. El recorrido visual se comprueba a 360 y 390 px y en el panel profesional. La prueba física del teléfono y la prueba observada con tres personas se registran como pendientes hasta ejecutarse, sin afirmaciones de verificación por una captura web.

## Orden y puntos de control

1. **T00:** integrar base, archivar documentos, fijar plan y especificaciones.
2. **T01–T06:** prescripción, panel profesional, sesión guiada, reloj, inicio y agenda. Punto de control: configurar → iniciar → registrar → salir → continuar → mover de día.
3. **T07–T10:** envío, cierre, revisión profesional y novedades. Punto de control: enviar sin pérdida → revisar → responder → ver en el cliente.
4. **T11–T13:** editor de comidas, registro del cliente y suplementos pautados.
5. **T14–T16:** configuración de seguimiento, panel profesional y Progreso.
6. **T17:** integración, limpieza de código sustituido, pruebas completas y comprobación móvil.

Nutrición y seguimiento son independientes del flujo de entrenamiento una vez consolidada la base. Un solo responsable edita cada contrato y migración compartidos. Cada tarea deja código que compila y pruebas focalizadas; se registra su evidencia en `todo.md` antes de marcarla hecha.

## Verificación final

Desde la raíz: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e`, `npm run build --workspace apps/api`. Se verifican prescripciones y copias antiguas; permisos; omisión/RIR; pausa/reanudación; reintentos y conflictos de envío; cambios de día; novedades; dos formas de comida; frecuencia y objetivos de seguimiento. En web y móvil se revisan foco, teclado, coma decimal y controles táctiles. Tres personas intentan sin explicación: continuar, registrar serie, mover sesión, registrar comida y encontrar respuesta del entrenador.
