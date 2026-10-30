# Encargo para Codex · 30-10-2026

Reparto de siempre: **Codex implementa; Claude revisa, verifica y hace los commits.** Rama de trabajo: `mejoras/base-2026-10-28-qxnjhw` (ya en GitHub). Antes de empezar, `git pull` de esa rama. **Ojo:** el commit `6c3e457 perf(móvil)…` de esta rama es K hecho por Claude en la nube sobre una foto a medias del WIP; en el escritorio K ya está commiteado como `afee1c5`. Al integrar, quedarse con `afee1c5` y descartar `6c3e457` (Claude lo resuelve si hay conflicto). K (rendimiento en Android) está hecho.

## Reglas

- Sin commit ni staging; deja los cambios en el árbol y apunta al final de este archivo qué tarea cerraste y con qué evidencia.
- Cada cambio con prueba que falla antes y pasa después. No quitar, saltar ni debilitar aserciones ni subir plazos.
- E2E solo contra `alpha_omega_e2e_codex` (la guarda `exigir-base-de-pruebas` lo impone). Migraciones aditivas, nunca `reset` sobre `alpha_omega`.
- Antes de entregar: `npm run typecheck`, `npm run lint`, `npm test` y, si tocas la API, `npm run test:cobertura` (umbral 80 %). Anota las cifras.
- Cierra los procesos auxiliares que abras (Expo, API, Jest en modo vigilancia) al terminar cada tarea.
- No tocar los archivos personales de David (`PDF/`, el HTML de pantallas, `compass_artifact_*.md`, `.claude/launch.json`).
- No avanzar nada que dependa de una decisión de David (lista al final).

## Tareas, en orden

### 0. Rediseño del cliente ([ESPEC-rediseno-cliente-2026-10-30.md](diseno-movil/ESPEC-rediseno-cliente-2026-10-30.md)) — primero

Es lo que pidió el dueño tras probar la app en Android: sesión por bloques (calentamiento → principal → final, con «Siguiente»), interfaz sin subtítulos de relleno, Plan sin la pestaña «Bloque» y con tamaños de letra fijos, Nutrición más limpia y Progreso rehecho entero. Va antes que las reservas. Hacerlo en este orden y avisar aquí tras cada punto: 1.1 sesión por bloques, 2 Plan, 4 Progreso, 3 Nutrición, 1.2 Hoy.

### 1. Reservas R2–R6 ([plan-reservas.md](plan-reservas.md), [SPEC-reservas.md](../SPEC-reservas.md))

R1 está hecho (`ac6c79b`). **Decisión del dueño del 30-10, ya en la spec: RESERVA EL ENTRENADOR.** El cliente no reserva ni pide cancelar: el entrenador le asigna un hueco (que gasta su crédito o su cupo) y el cliente lo ve en su calendario con su saldo y cupo. Donde los criterios 6, 7, 9 y 11 dicen «el cliente reserva / pide cancelar», léase «el entrenador»; la pantalla del cliente es solo de consulta.

- **R2 · disponibilidad** (API + e2e): el entrenador abre huecos (día, hora, duración, servicios), los repite semanalmente N semanas y cierra los libres. Criterio 5. No hace falta un listado de huecos libres para el cliente; el cliente solo ve sus propias reservas.
- **R3 · reservas** (API + e2e): **el entrenador** asigna un hueco libre a un cliente con un servicio; personal gasta 1 crédito, seguimiento gasta la duración del cupo mensual; sin saldo se rechaza con motivo claro. Concurrencia: dos asignaciones simultáneas del mismo hueco → solo una gana y la otra no gasta nada. El entrenador cancela (decide si devuelve) y marca asistencia. Notificación al cliente en la campana cuando se le asigna o cancela una reserva. E2E de permisos: el cliente no puede reservar, cancelar ni ver reservas o saldos de otros. Criterios 7–10 reinterpretados.
- **Checkpoint 1:** API y e2e en verde → avisar aquí antes de pasar al móvil, para que Claude revise el contrato.
- **R4 · cliente (solo consulta):** en el calendario expandido de Hoy, sus reservas junto a las sesiones del plan, y su saldo de créditos y minutos de seguimiento del mes. Sin botón «Reservar». Criterio 11 reinterpretado.
- **R5 · entrenador:** agenda por día y semana que distingue personal y seguimiento; abrir huecos, asignar un hueco a un cliente, cancelar y marcar asistencia; desde la ficha («Datos del cliente» o fila «Bonos»), cargar bonos y activar el seguimiento. Criterio 12. Sin animaciones de entrada con desplazamiento (criterio 13 y commit J).
- **R6 · datos de demo:** David con bono de 10 entrenos, seguimiento activo y huecos de la semana (`build/manual-20261027/perfil-demo.mjs`, idempotente).
- **Checkpoint 2:** vídeo a 390 px de la agenda del entrenador asignando una reserva y del calendario del cliente mostrándola con el saldo.
- Actualizar `tasks/plan-reservas.md` (R2–R4) para que diga lo mismo que esta sección.

### 2. P1/P2 pendientes de las auditorías ([informe-noche-2026-10-28.md](informe-noche-2026-10-28.md), «Pendiente»)

Comprobar primero si alguno ya quedó resuelto en D7–J (`bf15ed4` resolvió E-06/E-07, N-07 y el destello blanco de la web; `e0952a2` quitó las animaciones de entrada); marcar los resueltos con el commit.

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
