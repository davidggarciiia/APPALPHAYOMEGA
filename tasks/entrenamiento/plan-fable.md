# Plan de Fable — catálogo y pantallas del entrenador

> Preparado el 2026-09-18 siguiendo Agent Skills.
> **Estado: plan aprobado el 2026-09-18; Fable pendiente del commit común.**
> [Plan y coordinación general](plan.md) · [Encargo para Fable](fable.md).

## Objetivo y alcance

Fable entrega el catálogo mínimo y las pantallas del entrenador. El entrenador
podrá crear ejercicios, preparar una rutina personalizada, asignarla durante
varias semanas, reutilizar una rutina guardada y consultar resultados enviados.

La referencia funcional es [entrenamiento](../../SPEC-entrenamiento.md),
[agenda](../../SPEC-agenda.md) y el subconjunto textual del
[catálogo](../../SPEC-catalogo-ejercicios.md) delimitado en el plan general.
Figuras, vídeos y mapa muscular quedan fuera de esta entrega.

## Flujo de la skill y punto actual

1. **SPECIFY:** entrevista y especificaciones de agenda/entrenamiento aprobadas.
2. **PLAN:** David revisa este plan junto con el reparto y las decisiones comunes.
3. **TASKS:** después se ajusta y revisa el [desglose de Fable](todo-fable.md),
   ahora conservado como borrador anticipado sin autorización de ejecución.
4. **IMPLEMENT:** solo tras validar las tareas, Fable trabaja por incrementos:
   prueba, implementación, verificación y commit; revisión en cada checkpoint.

Esta secuencia procede de `spec-driven-development`, y la descomposición sigue
`planning-and-task-breakdown`, ambos en `C:/Users/david/.claude/skills/`.

## Responsabilidad y límites de archivos

Fable mantiene `apps/api/src/catalogo-ejercicios/` y sus tests,
`apps/mobile/src/catalogo-ejercicios/`, `apps/mobile/app/catalogo/`,
`apps/mobile/src/entrenamiento-entrenador/` y `apps/mobile/app/entrenador/`.

Codex entrega los contratos compartidos, migraciones, dependencias, transporte
autenticado y API de agenda/entrenamiento. También conecta las nuevas rutas con
el inicio y la ficha de cliente existentes. Estos archivos comunes tienen un
único responsable para evitar modificaciones incompatibles.

Las pantallas reutilizan el tema negro y dorado, los formularios, la navegación
y los componentes existentes. Fable no añade librerías por su cuenta. Si un
contrato necesita cambiar, documenta la propuesta para que Codex la integre.

## Orden de construcción y dependencias

| Incremento              | Entrega de Fable                                                          | Necesita de Codex                                                | Checkpoint verificable                                                                          |
| ----------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Catálogo                | API con permisos y pantalla para crear, buscar, editar, retirar y reponer | Contratos, modelo, módulo registrado, tests móviles y transporte | Crear desde el móvil y volver a encontrar el ejercicio; comprobar denegaciones por rol          |
| Primera asignación      | Editor de una sesión con un ejercicio y una serie                         | API de asignación y semana del cliente                           | Asignar desde entrenador y abrir desde cliente                                                  |
| Resultado               | Panel por cliente y semana; objetivo frente a ejecución                   | API de resultados enviados y control de cambio de día            | Antes del envío no aparecen valores privados; después aparece el resultado y se reflejan fechas |
| Varias semanas          | Editor semanal con resumen de fechas                                      | API para repetir el patrón semanal                               | Crear dos semanas sin duplicados al reintentar                                                  |
| Reutilización y ajustes | Biblioteca de rutinas y edición de sesiones permitidas                    | API de plantillas y ajuste con control de revisión               | Adaptar una copia sin cambiar otro cliente ni el histórico                                      |
| Cierre                  | Revisión de todas sus pantallas en la versión integrada                   | Integración y pruebas de concurrencia                            | Recorrido completo y evidencia por plataforma                                                   |

Fable puede preparar componentes con ejemplos que cumplan el contrato mientras
Codex implementa el proveedor. La verificación de salida siempre usa la API real.
Los detalles de tareas, archivos y comandos se validarán en la fase TASKS.

## Coordinación

Tras aprobar plan y tareas, Codex entrega un commit común con contratos,
configuración, modelo del catálogo y transporte. Desde ese commit Fable prepara
su worktree separado en la rama `codex/fable-catalogo`.

Se comparten commits en cada checkpoint; Codex revisa e integra los de Fable,
y proporciona la base actualizada antes del siguiente incremento. Las pruebas
HTTP sobre una misma base de datos se ejecutan por turnos. Las pruebas unitarias
y de componentes pueden correr en paralelo.

El encargo se entrega por archivo para que David lo pase a su sesión de Fable.
Este documento no ha iniciado esa sesión.

## Verificación y riesgos

Cada incremento combina tests de API, permisos y componentes con comprobación
del recorrido real. Antes de entregar un commit se ejecutan `npm run test`,
`npm run typecheck` y `npm run lint`; los cambios de API también deben compilar
con `npm run build --workspace apps/api`.

| Riesgo                                           | Tratamiento                                                                 |
| ------------------------------------------------ | --------------------------------------------------------------------------- |
| Contratos o archivos comunes divergentes         | Contratos primero, propietario único y entregas por commit                  |
| Pantallas terminadas solo contra simulaciones    | Checkpoint con API real antes de marcar el incremento integrado             |
| Exposición del borrador del cliente              | DTO de entrenador independiente y pruebas negativas antes/después del envío |
| Duplicación al reintentar asignaciones           | Mantener el mismo id de operación hasta conocer el resultado                |
| Cambios en rutinas que alteran históricos        | Copias independientes y pruebas con dos clientes y varias semanas           |
| Pruebas automáticas que no cubren el dispositivo | Registrar por separado tests y comprobaciones en Android/iOS/web            |

## Revisión pendiente

David revisa ahora el alcance de Fable, el reparto de archivos, el orden y los
checkpoints, junto con las decisiones comunes del plan general. Validado ese
paso, se revisa el desglose de tareas antes de implementar.
