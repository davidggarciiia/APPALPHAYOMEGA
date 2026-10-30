# Encargo para Codex · 30-10-2026

Reparto de siempre: **Codex implementa; Claude revisa, verifica y hace los commits.** Rama de trabajo: `mejoras/base-2026-10-28-qxnjhw` (ya en GitHub). Antes de empezar, `git pull` de esa rama: hay dos commits nuevos de Claude (`perf(móvil)…` y el `.gitignore` de los archivos personales).

## Reglas

- Sin commit ni staging; deja los cambios en el árbol y apunta al final de este archivo qué tarea cerraste y con qué evidencia.
- Cada cambio con prueba que falla antes y pasa después. No quitar, saltar ni debilitar aserciones ni subir plazos.
- E2E solo contra `alpha_omega_e2e_codex` (la guarda `exigir-base-de-pruebas` lo impone). Migraciones aditivas, nunca `reset` sobre `alpha_omega`.
- Antes de entregar: `npm run typecheck`, `npm run lint`, `npm test` y, si tocas la API, `npm run test:cobertura` (umbral 80 %). Anota las cifras.
- Cierra los procesos auxiliares que abras (Expo, API, Jest en modo vigilancia) al terminar cada tarea.
- No tocar los archivos personales de David (`PDF/`, el HTML de pantallas, `compass_artifact_*.md`, `.claude/launch.json`).
- No avanzar nada que dependa de una decisión de David (lista al final).

## Tareas, en orden

### 1. Reservas R2–R6 ([plan-reservas.md](plan-reservas.md), [SPEC-reservas.md](../SPEC-reservas.md))

R1 está hecho (`ac6c79b`). Seguir el plan tal cual:

- **R2 · disponibilidad** (API + e2e): huecos del entrenador, repetición semanal, cierre y huecos libres para el cliente. Criterios 5–6.
- **R3 · reservas** (API + e2e): reservar con crédito o cupo, concurrencia (dos reservas simultáneas al último hueco: solo una gana), petición de cancelación, decisión del entrenador, asistencia y notificaciones. Criterios 7–10.
- **Checkpoint 1:** API y e2e en verde → avisar aquí antes de pasar al móvil, para que Claude revise el contrato.
- **R4 · cliente**, **R5 · entrenador**, **R6 · datos de demo**: criterios 11–12 y la cuenta de demo (`build/manual-20261027/perfil-demo.mjs`, idempotente).
- **Checkpoint 2:** vídeo a 390 px de reservar (cliente) y de la agenda (entrenador).

### 2. P1/P2 pendientes de las auditorías ([informe-noche-2026-10-28.md](informe-noche-2026-10-28.md), «Pendiente»)

Comprobar primero si alguno ya quedó resuelto en D7–H; marcar los resueltos con el commit.

- T-04: confirmar al quitar un ejercicio, una fase o un deporte.
- N-06: parpadeo al recargar Nutrición. N-04/N-05: copia sin conexión en nutrición.
- E-04/E-05: sondeos de 5 s con escritura cifrada.
- A-06/A-12: pestañas con `router.replace` y rutas públicas con sesión abierta.
- Los ~40 `Pressable` sueltos: migrar solo los que son botones (no tarjetas, chips ni filas) y proponer aquí dónde usar «mantener para confirmar» en los destructivos.

### 3. Verificaciones que solo se pueden hacer con la app arrancada

- **M11:** abrir Expo web + API y confirmar que la consola ya no muestra «Image: style.resizeMode/tintColor is deprecated». Anotar el resultado.
- `AbortError` de `play()` en la intro en web: corregir la carrera si es local y sencillo, si no documentarla.
- **Rendimiento:** medir el arranque en frío de la web, el tamaño del bundle y los endpoints más usados (Inicio, ficha, semana). Solo medir y anotar; nada de optimizar sin las cifras.

## Lo que hace Claude, no Codex

- Revisar cada entrega, preparar los commits atómicos y subirlos.
- M13 (documentación final) y M14 (revisión final y go/no-go en `tasks/cierre-mejoras-2026-10-28.md`) cuando terminen 1–3.
- Lanzar el CI en GitHub cuando David autorice abrir un PR.

## Bloqueado por decisiones de David (no tocar)

- D2 · borrado a petición, opción A o B ([ADR 0006](../docs/adr/0006-borrado-a-peticion.md)) → M08a–c.
- D3/D4 · las dos políticas de acceso de seguimiento → texto en `SPEC-seguimiento-corporal.md` (M09).
- D5 · login con Google en la v1 (M10).
- Si `PDF/ALPHA Y OMEGA.pdf` es del proyecto y se versiona.

## Entregas de Codex

<!-- Codex: añade aquí, por tarea, qué cambió, archivos y cifras de verificación. -->
