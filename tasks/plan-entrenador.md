# Plan: perfil de entrenador

Fuente: `SPEC-entrenador.md`. Implementa Codex (`gpt-6.1-sol`) una tarea cada vez; la
sesión que dirige revisa el diff, ejecuta la verificación completa y commitea.

## Tareas

Decisión del dueño (29-10): el entrenador solo prescribe el RIR; el cliente sube la carga. El entrenador observa «Progresa / Estancado / Baja»; la sugerencia «Sube carga la próxima vez» es del cliente. El dueño pidió hacerlo todo en automático: la spec se da por aprobada con esta corrección.

- [ ] E1 · Reglas de progresión (shared): mejor serie, 1RM estimado (Epley), comparación semanal, estado para el entrenador («Progresa / Estancado / Baja») y sugerencia para el cliente («Sube carga la próxima vez»).
  - Acepta: criterio 8 con pruebas unitarias de cada caso.
  - Verifica: `npm test --workspace apps/api` (contratos) y typecheck.
  - Ficheros: `packages/shared/src/progresion.ts`, `index.ts` y su spec.
- [ ] E2 · Progreso por ejercicio en la ficha (móvil, y API solo si falta un dato).
  - Acepta: criterios 7 y 9.
  - Verifica: suite del móvil; e2e si se amplía la API.
- [ ] Checkpoint 1: suites, e2e, typecheck, lint y captura a 390 px de la ficha → Progreso.
- [ ] E3 · Endpoint agregado del resumen semanal (shared + API + e2e con datos y tiempo).
  - Acepta: criterios 3 y 4.
- [ ] E4 · Inicio del entrenador con el resumen semanal (móvil).
  - Acepta: criterios 1, 2, 5 y 6.
- [ ] Checkpoint 2: verificación completa y vídeo del Inicio con David García.
- [ ] E5 · Cartera con filtros y búsqueda.
  - Acepta: criterio 10.
- [ ] E6 · «Datos del cliente»: editar, reenviar activación, baja y reactivar (+ migración aditiva si hace falta).
  - Acepta: criterios 11 y 12.
- [ ] Checkpoint 3: verificación completa, revisión de código de Codex de toda la rama y lista de lanzamiento.

## Riesgos

| Riesgo                                                    | Impacto | Mitigación                                                |
| --------------------------------------------------------- | ------- | --------------------------------------------------------- |
| El agregado semanal es lento o hace N+1                   | Medio   | Una consulta por semana con límite y prueba e2e de tiempo |
| Se filtran borradores al resumen                          | Alto    | Prueba e2e que lo prohíbe expresamente                    |
| «Sube carga» mal calculado con series omitidas o RIR nulo | Medio   | Casos explícitos en las pruebas unitarias                 |
