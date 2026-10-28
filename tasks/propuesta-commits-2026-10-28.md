# Propuesta de commits — trabajo sin commit del 27-10 y de esta tanda (M01)

> **Nada de esto se ha ejecutado.** Es una propuesta para que David decida. El árbol de `codex/cliente-intuitivo` lleva ~245 archivos sin commit (166 modificados, +16 805 / −11 341 según `git diff --shortstat` del 28-10). Un `git checkout`, un `git clean` o un fallo de disco los pierde. Regla: **`git add` con rutas explícitas, nunca `git add .`**, y revisar `git diff --cached --stat` antes de cada commit.

## Dos formas de hacerlo (elige una)

| Opción                         | Qué es                                                                        | Ventaja                                                 | Riesgo                                                                                                                         |
| ------------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **A. Por módulo** (14 commits) | Un commit por área, con su código y sus pruebas, como hizo RI00 el 24-09.     | Historia legible y revertible por área.                 | Los cambios de Codex cruzan módulos (`shared`, `config`): algún commit intermedio puede no compilar solo. Hay que verificarlo. |
| **B. Por capa** (4 commits)    | `api`, `móvil` + `shared`, `documentación y evidencias`, `herramientas y CI`. | Cada commit compila y pasa pruebas; mucho menos riesgo. | Historia más gruesa; revertir un módulo concreto cuesta más.                                                                   |

Recomendación: **B ahora** (asegura el trabajo ya) y, si luego importa la granularidad, reordenar con calma. En ambos casos, tras cada commit: `npm run typecheck`.

## Qué NO se añade (decisión de David si cambia)

- `PDF/` — referencias personales con resultados reales; ya ignoradas desde esta tanda (`PDF/referencias-entrenador/`). `PDF/ALPHA Y OMEGA.pdf` queda sin versionar a la espera de que digas si es del proyecto.
- `Alpha & Omega · Pantallas con el plan.html` (4,3 MB, referencia visual) y `compass_artifact_wf-….md` (documento de investigación): son de David; no se suben sin que lo pida.
- `.claude/launch.json` (rutas locales a otra carpeta de demos), `build/`, `.almacen-local/`, `node_modules/`, `.env`: ya ignorados o locales.
- `tools/animaciones-propias/__pycache__/`: ignorado desde esta tanda.

## Opción A — por módulo (orden de dependencia)

Cada línea: mensaje propuesto → rutas.

1. `build: alinear dependencias, parche del router y configuración de lint` → `package.json`, `package-lock.json`, `patches/`, `prisma.config.ts`, `eslint.config.mjs`, `apps/api/package.json`, `apps/mobile/package.json`, `apps/mobile/app.json`, `packages/shared/package.json`
2. `feat(shared): contratos de entrenamiento, medios, nutrición y valoraciones` → `packages/shared/src/`
3. `fix(api): identidad, enlaces de cuenta y sesiones concurrentes` → `apps/api/src/identity/` + `apps/api/test/{auth,revocacion,recuperacion,refresco,carrera-refresco,alta-y-activacion}*`
4. `fix(api): configuración HTTP, PostgreSQL con TLS y plazos, correo y salud` → `apps/api/src/{config,correo,salud,prisma}/`, `apps/api/test/{salud,plazos-postgres}*`, `.env.example`
5. `fix(api): medios y validación real de imágenes` → `apps/api/src/medios/`, `apps/api/test/{medios,imagenes-ayuda}*`
6. `fix(api): entrenamiento y agenda` → `apps/api/src/{entrenamiento,agenda}/`, `apps/api/test/{entrenamiento,agenda,molestias,cierre}*`
7. `fix(api): nutrición con consentimiento vigente` → `apps/api/src/nutricion/`, `apps/api/test/nutricion*`
8. `fix(api): seguimiento y valoraciones` → `apps/api/src/seguimiento/`, `apps/api/test/{seguimiento,valoraciones,solicitudes,evolucion,ficha}*`
9. `feat(api): catálogo ampliado y seed validado` → `apps/api/src/catalogo-ejercicios/`, `apps/api/src/seed*.ts`, `apps/api/test/{catalogo,figuras}*`
10. `fix(móvil): base de formularios, sesión, rutas y candado local` → `apps/mobile/src/{lib,componentes}/`, `apps/mobile/src/{consentimiento,sesion}*`, `apps/mobile/app/_layout.tsx`
11. `fix(móvil): registro de entrenamiento y molestias` → `apps/mobile/src/entrenamiento/`
12. `fix(móvil): constructor y ficha del entrenador` → `apps/mobile/src/entrenamiento-entrenador/`, `apps/mobile/app/{cartera,mis-clientes}.tsx`, `apps/mobile/app/cliente/`, `apps/mobile/app/entrenador/`
13. `fix(móvil): nutrición, seguimiento y catálogo` → `apps/mobile/src/{nutricion,seguimiento,catalogo-ejercicios}/`, `apps/mobile/app/nutri*`
14. `docs: despliegue, pendientes, ADR, evidencias de la revisión del 27-10` → `docs/`, `README.md`, `SPEC.md`, `tasks/`, `tools/animaciones-propias/` (sin `__pycache__`)
15. `ci: flujo de GitHub Actions, cobertura fusionada y guarda de base de pruebas` → `.github/`, `apps/api/test/{cobertura.mjs,exigir-base-de-pruebas.ts,setup-e2e.ts,jest-e2e.json}`, `apps/api/src/config/{cobertura,base-de-pruebas}.spec.ts`, `.gitignore`

> Los prefijos de los E2E son una guía: antes de ejecutar, `git status --short` por carpeta decide a qué commit va cada archivo. Los 14 grupos no se han probado por separado.

## Opción B — por capa

1. `fix(api): endurecimiento de producción del 27-10` → todo `apps/api/` y `packages/shared/` (excepto lo del commit 4) + `package*.json`, `patches/`, `prisma.config.ts`, `eslint.config.mjs`
2. `fix(móvil): corrección de pérdida de datos, navegación y accesibilidad` → todo `apps/mobile/`
3. `docs: revisión de producción, pruebas manuales y despliegue` → `docs/`, `README.md`, `SPEC.md`, `tasks/`, `tools/`
4. `ci: GitHub Actions, cobertura fusionada y guarda de base de pruebas` → `.github/`, `.gitignore`, `apps/api/test/{cobertura.mjs,exigir-base-de-pruebas.ts,setup-e2e.ts,jest-e2e.json}`, specs de `src/config/{cobertura,base-de-pruebas}`

## Receta segura (para cuando decidas)

```bash
git status --short                                  # estado de partida
git add -- <rutas del commit>                       # solo rutas explícitas
git diff --cached --stat                            # revisar antes de confirmar
npm run typecheck                                   # el commit debe compilar
git commit -m "<mensaje>"
```

No usar `git add .`, `git reset --hard`, `git clean` ni `git push --force`. El push no forma parte de esta propuesta.

## Estado

- Ejecutado: nada. `git status --short` es idéntico al de antes de redactar este documento, salvo los archivos nuevos de esta tanda listados en el commit 15.
