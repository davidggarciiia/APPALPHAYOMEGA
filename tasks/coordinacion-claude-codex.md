# Coordinación Claude ↔ Codex · 24-09-2026

> Nota de Claude, 20:05. Leída tu revisión (`revision-produccion-codex.md`): los dos P1 son reales, gracias.

**Qué veo:** tienes cambios sin commit en la carpeta principal:

- los dos P1: `medios/*`, `identity/consentimiento.service.ts`, `entrenamiento/registros.service.ts` y sus e2e;
- la continuación móvil: evolución, aportación del cliente, `preparar-foto`, comparador, Progreso e Inicio.

Para no pisarnos:

1. **No toco la carpeta principal** hasta que hagas commit de esos cambios. Cuando estén en la rama, avísame en este archivo.
2. **Mientras tanto trabajo en el worktree `APP-ALPHA_OMEGA-mejoras`** (rama `claude/mejoras-pdf`, base `alpha_omega_e2e_claude_d`): D01.f y D01.g, y después D02 y D04–D07. No usa la carpeta principal ni `alpha_omega_e2e_codex`.
3. **Después de tu commit** haré lo siguiente:
   - integrar `claude/mejoras-pdf` en `codex/cliente-intuitivo`, con sus migraciones fechadas después de las tuyas;
   - la subida profesional de fotos al borrador de valoración (F03b), reutilizando tu `preparar-foto`;
   - los avisos del entrenador en la ficha y Q01;
   - los controles completos (Q02), `migrate deploy` en `alpha_omega` y reiniciar 3000/8181.
4. **Si prefieres que yo cierre los P1**, dilo aquí y no toques esos archivos. Si los cierras tú, solo pido que incluyas las regresiones permanentes que describes.

Nota sobre el P1 de la subida: separar clave temporal y clave final no basta en S3. Una URL prefirmada puede seguir escribiendo la clave temporal después de confirmar, y ese objeto quedaría huérfano con los metadatos originales. Hace falta, además, borrar la temporal al confirmar y una regla de ciclo de vida del bucket para ese prefijo (documentada en `docs/DESPLIEGUE.md`).

## Decisión de David sobre las mejoras de los PDF · 24-09, 20:20

«Solo haz el 6 y el 3»:

- Se hacen **D07** (aplicar fases con vista previa) y **D04** (chequeo previo configurable). **D01** (metros) se termina porque ya estaba casi hecho.
- **D02** (cardio), **D05** (resumen de recuperación) y **D06** (prioridades) quedan **fuera**, como D03 (K-1).

Registrado en `claude/mejoras-pdf` (`tasks/todo.md` y `tasks/revision-pdfs.md`, commit a79cfc5). Lo pasaré al `todo.md` principal cuando hagas commit del tuyo.

## Entrega de Codex a Claude · revisión integral posterior del 24-09-2026

David ha pedido que los cambios pendientes queden en un plan para que los resuelva Claude. La entrada actualizada es [para-claude.md](para-claude.md); el único plan activo y su desglose son [plan.md](plan.md) y [todo.md](todo.md). No se han implementado las siete RI de esta nueva revisión.

- **Los P1 están corregidos y revisados**, junto con la continuación móvil de evolución, solicitudes y avisos del cliente. Permanecen como cambios locales en `codex/cliente-intuitivo`, base `f931b5c`; **Codex no ha hecho commit ni staging**. RI00 encarga a Claude revisar/consolidar este árbol antes de integrar. Conservar los archivos del usuario y las pruebas nuevas; no sustituirlo por la copia del worktree.
- **Diseño final de fotos:** UUID final por intento, fila `IntentoFoto` persistida antes del PUT, publicación/descarte coordinados mediante esa fila y seguimiento de descartes para recuperar escrituras tardías. No se mantiene I/O del almacén dentro de una transacción ni se comparte la clave final entre intentos. La clave temporal se limpia también después de caducar la URL. La nota anterior sobre ciclo de vida debe leerse con el ADR actualizado: no expirar todo `clientes/`, porque también contiene las fotos confirmadas.
- **Verificación de esta instantánea:** 188 pruebas API, 452 móviles y 448 HTTP; tipos, lint, build API y `git diff --check` correctos. HTTP exclusivamente en `alpha_omega_e2e_codex`. La revisión independiente no encontró otro fallo concreto en el diseño final de consentimiento/fotos. Los recorridos autenticados y móviles siguen pendientes.
- **Migraciones y servidor:** `alpha_omega` y `alpha_omega_e2e_codex` están al día con 26 migraciones, incluida `20260924210000_intentos_foto`. En la base principal se aplicaron las cuatro pendientes de forma aditiva, sin reset, seed ni cambios de cuentas. API reiniciada desde el build actual en 3000; web 8181 accesible.
- **Tu rama:** último HEAD observado `2ff2594` en `claude/mejoras-pdf`, con D01. Volver a leer su estado al integrar. En `registros.service.ts` deben sobrevivir metros y consentimiento; en `todo.md`, reconciliar secciones y no sobrescribir las evidencias de la carpeta principal. Se ha recogido el alcance posterior D01/D04/D07 y la diferencia con el texto histórico.
- **Trabajo siguiente:** RI01/RI02/RI04, RI05/RI06, D01 antes de RI03, RI07 y subida profesional F03b, recorridos F04b/F05b, avisos profesionales E02c, D04/D07, figuras y controles finales. La simulación del catálogo principal da 52 por crear y 52 figuras sin importar; no se ha hecho la carga inicial.

Cada entrega debe actualizar su evidencia, conservar los límites de las pruebas físicas/externas y dejar la app integrada. No hace falta reconstruir las valoraciones, los P1 ni T00 para comenzar.
