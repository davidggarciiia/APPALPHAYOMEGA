# Encargo para Fable — segunda iteración de Alpha & Omega

> Propuesta de reparto preparada el 2026-09-18. No significa que Fable haya
> recibido o iniciado el trabajo. David pasará este archivo a su sesión.

## Contexto que debes leer

El usuario pidió continuar con Agent Skills, no Superpowers. La entrevista y
las especificaciones están aprobadas. La fase actual es PLAN: se revisa primero
el plan técnico y este reparto; después se validan las tareas antes de implementar.

1. `C:/Users/david/.claude/skills/using-agent-skills/SKILL.md`.
2. [Tu plan](plan-fable.md), [coordinación](plan.md) y [SPEC.md](../../SPEC.md).
   Los borradores de [tus tareas](todo-fable.md) y [las de Codex](todo.md)
   indican dependencias provisionales; se validarán en TASKS.
3. [Spec de catálogo](../../SPEC-catalogo-ejercicios.md), limitada al subconjunto
   de texto descrito por el plan para esta iteración.
4. [Entrenamiento](../../SPEC-entrenamiento.md) y [agenda](../../SPEC-agenda.md).

La base revisada es `055c401`, con los nuevos arreglos de identidad. No los
reimplementes ni los retires. El plan de identidad en `tasks/plan.md` y
`tasks/todo.md` conserva pendientes: no lo sustituyas.

## Tu responsabilidad

- F01–F03: catálogo mínimo de extremo a extremo, con permisos y pruebas.
- F04, F06, F07a–F07b: pantallas del entrenador para crear una sesión, ampliar a varias
  semanas, reutilizar rutinas y ajustar sesiones no iniciadas.
- F05: panel para consultar los resultados enviados.
- F08: revisar y comprobar tus pantallas contra la API integrada.

No basta con maquetas: cada incremento debe acabar conectado a los servicios
reales. Mientras un endpoint no esté integrado, las respuestas de prueba cumplen
los esquemas compartidos y se marcan como tales en la entrega.

## Límites de escritura

Tus archivos: catálogo de API, tests de catálogo, componentes móviles del catálogo,
`apps/mobile/src/entrenamiento-entrenador/` y rutas `apps/mobile/app/entrenador/`.
Las rutas del catálogo van en `apps/mobile/app/catalogo/`.

Codex mantiene Prisma y migraciones, `packages/shared/`, `app.module.ts`, los
archivos de dependencias, `src/lib/`, `src/sesion.tsx`, `_layout.tsx`, `index.tsx`,
la ficha existente de cliente y los documentos de coordinación.

Si necesitas cambiar un contrato o un archivo común, entrega la propuesta exacta
a Codex por medio de David. No lo modifiques unilateralmente ni inventes una API
para salir del paso. Nunca edites el guard de alcance general para conceder
acceso al catálogo: su permiso depende del rol, no de un cliente asignado.

## Inicio y secuencia

Tras validar David PLAN y TASKS y recibir el commit de C00–C03, crea un worktree
separado desde ese commit, rama `codex/fable-catalogo`. No cambies la rama ni
instales paquetes en la carpeta principal que está usando Codex.

Empieza por F01; después F02 y F03. Entrega el catálogo con sus commits y pruebas.
Continúa F04 cuando Codex comparta el contrato y el servicio de asignación C09.
F05 necesita C13b y C14; F06 necesita C16a; F07a necesita C16b; F07b necesita C17.
Puedes preparar componentes
antes con contratos fijos, pero las pruebas completas esperan al proveedor real.

Aplica `incremental-implementation` y `test-driven-development`; revisa con
`code-review-and-quality`. Un fallo no autoriza a borrar tests ni a descartar
cambios de otra sesión. Mantén la marca negra y dorada y usa el tema existente.
En cada checkpoint presenta evidencia para revisión de David antes de avanzar.

## Qué entregar en cada checkpoint

- Commit o commits y lista de archivos modificados.
- Criterios satisfechos y comportamiento que ya se puede probar desde el móvil.
- Comandos ejecutados y resultado; distingue prueba con mocks y dispositivo.
- Cambios de contrato propuestos, limitaciones y siguiente tarea.

Coordina las pruebas HTTP con Codex para no compartir la base en uso; las
unitarias y móviles no necesitan ese turno. No publiques, subas a GitLab ni
fusiones a `main` como efecto de este encargo.

## Mensaje corto para iniciar esta sesión

> Sigue Agent Skills y lee `tasks/entrenamiento/fable.md` y `plan-fable.md`.
> Tu parte es el catálogo completo mínimo y las pantallas del entrenador. Codex
> lleva contratos, migraciones, agenda y registro del cliente. Comprueba que el
> PLAN y TASKS están validados y que C00–C03 tienen commit de entrega antes de implementar.
> Trabaja en un worktree independiente, respeta los archivos comunes y entrega
> tus avances por los checkpoints indicados.
