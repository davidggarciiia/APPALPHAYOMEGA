# D8 · Experiencia móvil

**Objetivo:** aplicar las mejoras D8 aprobadas sobre `tasks/diseno-movil/ESPEC.md`, sin cambios de contrato ni dependencias.

**Arquitectura:** reutilizar componentes de marca y endpoints existentes. Consultar la cartera en lotes acotados. Mantener la pila nativa y los borradores; animar sus pantallas sin bloquear controles y respetar movimiento reducido.

**Stack:** Expo Router, React Native y Reanimated ya instalados.

- [x] Inicio y ficha: probar panel, límites de consultas, carga/error/vacío y destinos; quitar la pestaña Molestias, conservar respuesta desde Resumen y revisión; retirar código muerto con pruebas sustitutas.
- [x] Movimiento: probar revelado al enfocar y cancelación con movimiento reducido; integrar mediante `screenLayout` de la pila, sin remontar pantallas; crear fila animada compartida con entrada/salida diagonal y transición de layout.
- [x] Sesión: probar comparación pura de récords y marcado/deshacer sin repetir premio; integrar destello y diferencia breve usando la mejor serie anterior disponible. Regresiones cubren copia local con red pendiente y recuperación remota con disco lento. El reacomodo se suspende durante el destello del récord.
- [x] Novedades y constructor: probar máximo visible, expansión y lectura; animar filas con claves estables al añadir/quitar/reordenar y al leer.
- [x] Integración: revisar diff y cobertura de D8; ejecutar pruebas dirigidas durante los cambios, después `npm test --workspace apps/mobile`, `npm run typecheck` y `npm run lint`.

No realizar commits ni modificar Git. No editar el informe de la noche. Verificación de dispositivo, hápticos y rendimiento condicionada a dispositivos locales disponibles.

## Alcance y sustituciones de pruebas

Inicio consulta cuatro activos y ocho activaciones por página, con un máximo de dieciocho peticiones. Comprueba el plan de esta semana, el último envío y las tres primeras molestias abiertas de cada activo. Ofrece paginación y acceso al resto en la ficha; no inspecciona todos los envíos históricos porque falta un agregado de revisiones en la API.

`ficha/checkins.spec.tsx` se sustituye por el caso de atención abierta y acceso a sesión en `ficha/atencion.spec.tsx`, el envío y protección frente a sondeo en `ficha/ficha-cliente.spec.tsx`, y la respuesta conservada en `detalle.spec.tsx` (por ejercicio, general y referencia fuera de prescripción). La barra visual pertenecía a la pestaña eliminada. La prueba de la pestaña Molestias se sustituye por la comprobación de las cinco pestañas y Resumen seleccionado.

El récord compara con la mejor serie de la última sesión disponible, no con un histórico absoluto. No hay dispositivo local conectado: sin comprobación física de hápticos, teclado, fluidez ni rendimiento nativo.

## Ficheros de D8

Todos bajo `apps/mobile`, salvo este documento:

- `app/_layout.tsx`.
- `src/componentes/fila-serie.tsx`, `revelado.tsx`, nuevos `lista-animada.tsx` y `transicion-pantalla.tsx`, con sus respectivos `.spec.tsx`.
- `src/entrenamiento/registro-modelo.ts` y `.spec.ts`, `registro-cliente.tsx`, `tabla-series.tsx` y `novedades.tsx`, con sus respectivos `.spec.tsx`.
- `src/inicio-entrenador/inicio-entrenador.tsx` y `.spec.tsx`, nuevos `cargar-trabajo.ts` y `.spec.ts`.
- `src/entrenamiento-entrenador/constructor/tabla.tsx`, `partes.tsx` y nuevo `listas.spec.tsx`.
- `src/entrenamiento-entrenador/detalle.tsx`, `detalle.spec.tsx`, `ejercicios-revision.tsx`.
- `src/entrenamiento-entrenador/ficha/ficha-cliente.tsx`, `ficha-cliente.spec.tsx`, `atencion.spec.tsx`; eliminados `checkins.tsx` y `checkins.spec.tsx`.

## Verificación final

- `npm.cmd test --workspace apps/mobile`: 131 suites, 1297 pruebas correctas.
- `npm.cmd run typecheck`: correcto desde la raíz (API, móvil y shared).
- `npm.cmd run lint`: ESLint y Prettier correctos desde la raíz.
- `git diff --check`: correcto. Sin cambios de API, contrato, dependencias ni informe nocturno.

En PowerShell se usa `npm.cmd` porque la política local bloquea `npm.ps1`; se conserva la misma CLI y no se modifica la política. Revisión independiente cerrada tras las regresiones de recuperación local/remota.
