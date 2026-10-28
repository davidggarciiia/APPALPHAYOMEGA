# Alpha & Omega — plan de mejoras post-revisión de producción

> **Creado el 28-10-2026** con las skills `planning-and-task-breakdown`, `using-agent-skills` y las que cita cada fase. Es un plan **paralelo** al [plan RI del 24-09](plan.md) y su [lista](todo.md), que **no se tocan** (decisión de David: archivos separados). Las tareas de este plan se numeran `M00…` para no chocar con `RI`, `F`, `E`, `D`, `Q`. Lista de tareas: [todo-mejoras-2026-10-27.md](todo-mejoras-2026-10-27.md).

## Objetivo

Cerrar lo que la [revisión de producción del 27-10](revision-produccion-2026-10-27.md) dejó abierto **y que se puede resolver programando**: robustez operativa de la API, una puerta de calidad automática, privacidad (borrado a petición), decisiones de acceso pendientes y calidad de la app móvil. Lo que depende de dominio, tiendas, dispositivos físicos o asesoría jurídica **no se finge**: queda listado como bloqueo externo.

## Punto de partida (verificado en el código)

| Hallazgo                                                                                                                                               | Evidencia                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Árbol con **225 archivos sin commit** de Codex (166 modificados, +16 805 / −11 341) en `codex/cliente-intuitivo`.                                      | `git status`, `git diff --shortstat`                             |
| **No hay CI**: no existe `.github/`. Remotos `origin` (GitHub) y `gitlab`.                                                                             | `ls .github`, `git remote -v`                                    |
| `PrismaPg(urlDeConexion())` sin plazos de conexión/consulta ni tamaño de pool.                                                                         | `apps/api/src/prisma/prisma.service.ts:17`, `config/postgres.ts` |
| Resend se invoca sin plazo; `correo.service.ts` tiene 45,45 % de líneas.                                                                               | `correo/correo.service.ts:54`, revisión 27-10                    |
| `SPEC.md:191` exige 80 % en servicios y guardas, pero `jest.config.mjs` solo declara `collectCoverageFrom`, sin umbral.                                | `apps/api/jest.config.mjs:24`                                    |
| `SPEC-identity.md` #7 (Google) y #18 (borrado a petición) **sin implementar**.                                                                         | revisión 27-10, `grep` de `borrado`                              |
| Avisos de desarrollo por propiedades de `Image` y una advertencia de PostgreSQL en el arnés E2E.                                                       | `prueba-manual-2026-10-27.md` § Límites                          |
| `npm test` móvil sin flags: **3 timeouts de 5 s** (2 suites) bajo carga; con `--runInBand` pasan 36/36 en 9,5 s. Tipos, lint y API (352/352) en verde. | Línea base del 28-10 → tarea **M00b**                            |
| Dos políticas de acceso con contrato ambiguo (entrenador/cliente de baja; nutricionista/pruebas físicas).                                              | revisión 27-10 § Pendientes                                      |

La línea base de tipos, lint y tests se registra en **M00** antes de cambiar nada.

## Suposiciones (corrígelas ahora o procedo con ellas)

1. El trabajo de Codex de hoy es válido y **se conserva tal cual**; no se revierte ni se reescribe fuera del alcance de cada tarea.
2. Se trabaja **en la rama actual `codex/cliente-intuitivo`** (decisión de David: sin rama nueva). **No hay commit, push ni despliegue** sin que lo pidas.
3. Las pruebas HTTP/E2E solo usan la base dedicada `alpha_omega_e2e_codex`; nunca `alpha_omega`.
4. Nada llama a Resend, S3 ni Apple/Google reales. Todo con dobles y datos sintéticos.
5. CI en **GitHub Actions** (`origin`). El espejo de GitLab queda fuera salvo que digas lo contrario.

## Decisiones pendientes (bloquean solo las tareas marcadas)

| ID  | Decisión                                                                                                                                                                    | Por defecto si no dices nada                            | Bloquea |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------- |
| D1  | Cobertura 80 %: ¿agregado de servicios+guardas (unitarias+E2E fusionadas) o mínimo por archivo?                                                                             | Agregado + informe de archivos por debajo               | M05     |
| D2  | Borrado a petición: qué se anonimiza, qué se elimina, qué conserva el entrenador (SPEC #14 dice que el histórico sobrevive a la baja) y plazos. Requiere revisión jurídica. | Ninguno: **M07 redacta la propuesta, no la implementa** | M08a–c  |
| D3  | ¿El entrenador puede completar medidas/pruebas de un cliente dado de baja?                                                                                                  | Se mantiene el permiso vigente                          | M09     |
| D4  | ¿Qué pruebas físicas ve el nutricionista?                                                                                                                                   | Se mantiene el permiso vigente                          | M09     |
| D5  | ¿Login con Google en la v1? Apple exige ofrecer su login si hay terceros.                                                                                                   | Diferir y reflejarlo en SPEC                            | M10     |

## Grafo de dependencias

```text
M00 línea base ──┬─ M00b pruebas móviles estables bajo carga ── (antes de M06)
                 ├─ M01 propuesta de commits (necesita OK)
                 ├─ M02 plazos PostgreSQL ── M03 sonda /salud con plazo
                 ├─ M04 plazo + cobertura de correo
                 ├─ M05 umbral de cobertura (D1) ── M06 CI en GitHub Actions
                 ├─ M07 spec/ADR de borrado (D2) ── M08a ── M08b ── M08c   [bloqueadas]
                 ├─ M09 pruebas de caracterización de acceso (D3, D4)
                 ├─ M10 Google: alcance (D5)
                 ├─ M11 avisos de Image
                 └─ M12a auditoría de accesibilidad ── M12b correcciones
                                  todas ── M13 documentación ── M14 revisión final
```

M02–M06 son la cadena crítica (robustez + puerta de calidad). M11 y M12 son independientes de la API y pueden ir en paralelo con ella **si se reparten archivos distintos**; por seguridad se ejecutan en serie.

## Decisiones de arquitectura

- **Rebanadas verticales**: cada tarea deja un comportamiento verificable (código + prueba + documentación mínima), nunca "toda la capa X".
- **Reutilizar lo existente**: `urlDeConexion` sigue siendo la única fuente de la conexión; los plazos entran por variables opcionales con valores por defecto seguros, validadas en `entorno.ts`, sin DATABASE_URL nueva.
- **Plazos con evidencia**: se verifican contra la documentación de `@prisma/adapter-pg` 7 y `pg` (`source-driven-development`) antes de fijar los nombres de opciones; no se asume la API de memoria.
- **La puerta de calidad no se rebaja**: ningún umbral, prueba o regla de lint se debilita para llegar a verde (`constraint-driven-development`).
- **Migraciones solo aditivas**; los SQL de reversión van en `apps/api/prisma/rollback/` como hasta ahora.
- **Simplicidad** (`ponytail`/`code-simplification`): el cambio más pequeño que cierre cada criterio; sin abstracciones nuevas "por si acaso".

## Fases

1. **Base segura** — M00, M00b, M01. Checkpoint 0.
2. **Robustez operativa y puerta de calidad** — M02–M06. Checkpoint 1.
3. **Privacidad y política de acceso** (spec primero) — M07–M10. Checkpoint 2.
4. **Calidad de la app móvil** — M11, M12a, M12b. Checkpoint 3.
5. **Cierre** — M13, M14. Checkpoint final.

## Fuera de alcance (y por qué)

- Pruebas físicas Android/iOS, TalkBack/VoiceOver, enlaces verificados con firmas reales, Resend real, S3 en la UE, DNS, alojamiento y copias programadas: **requieren dispositivos, cuentas o infraestructura que no hay**. Siguen en [PENDIENTE-PARA-PRODUCCION](../docs/PENDIENTE-PARA-PRODUCCION.md).
- Las 128 tareas abiertas del plan RI (RI03, RI07, F03b, F04b/F05b, E02c, D04/D07…): siguen en su plan; este no las duplica.
- Validación jurídica del texto de consentimiento y de la política de privacidad.

## Riesgos y mitigaciones

| Riesgo                                                                                                       | Impacto | Mitigación                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Tocar archivos que Codex modificó hoy (p. ej. `config/postgres.ts`, `correo.service.ts`) y mezclar autorías. | Alto    | M00 guarda copia del diff base; cada tarea lista sus archivos y se revisa su diff aislado con `git diff -- <archivo>`.                  |
| Plazos demasiado cortos rompen consultas legítimas largas (informes, paginación de 5 000 filas).             | Medio   | Valores por defecto holgados y configurables; prueba E2E con consulta larga controlada; documentado en DESPLIEGUE.                      |
| El workflow de CI no se puede ejecutar aquí.                                                                 | Medio   | Se valida sintaxis y se ejecutan los mismos comandos en local; se declara explícitamente "no ejecutado en GitHub" hasta el primer push. |
| El umbral de cobertura (86 % ramas / 95 % líneas fusionado) depende de los E2E con base real.                | Medio   | El job de cobertura levanta PostgreSQL de servicio; unitarias solas no pueden cumplirlo (49,77 %) y no se pretende.                     |
| Borrado a petición toca datos de salud y objetos del bucket: irreversible.                                   | Alto    | Spec-first (M07), aprobación humana, migración aditiva, E2E con datos sintéticos, sin ejecutar nunca contra `alpha_omega`.              |
| Docker/PostgreSQL local fue manipulado hoy (directorios de sockets apartados).                               | Bajo    | M00 comprueba `alpha-omega-db` sano antes de los E2E.                                                                                   |

## Preguntas abiertas

- ¿Quieres que las propuestas de commit (M01) agrupen por módulo como en RI00, o prefieres un único commit de consolidación?
- ¿Se mantiene el espejo de GitLab? Si sí, M06 añade un `.gitlab-ci.yml` equivalente.
