# Verificación de entrenamiento — iteración 2

Fecha: 2026-09-18. Rama: `codex/entrenamiento-iteracion-2`.

## Checkpoint 0A — C00–C02

### C00: contratos

- Contratos de catálogo, agenda, prescripción, borrador privado y resultado enviado.
- TDD en cuatro grupos: cada prueba falló antes de añadir su comportamiento.
- 17 pruebas de contratos: fechas, unidades, mezcla de series, campos incompatibles,
  envío parcial válido y ausencia de datos privados en respuestas públicas.
- Revisión independiente sin hallazgos accionables.
- Commit `0f07539`, guardado por otra sesión; no se reescribió.

### C01: pruebas móviles

- Commit `b456523`. Cuatro pruebas reales de interacción de los formularios existentes:
  bloqueo de doble acción y etiqueta accesible en los tres botones, edición de un
  campo controlado con `useState` y comunicación de su error.
- Se reprodujo un fallo de hooks con `test-renderer` 1.3 y su reconciliador para
  React 19.3. La versión 1.2.0 fijada en móvil y en el override raíz resuelve
  React 19.2.3 una sola vez; los tests comprueban esa combinación.
- Dependencias de SQLite y Crypto instaladas según el plan. Todavía no se ha
  implementado ni probado el almacén de borradores C04.
- Revisión independiente de configuración, lockfile y prueba: sin hallazgos.

### C02: persistencia del catálogo

- Commit `eade5f2`.
- Modelos `Ejercicio` y `GrupoSecundarioDeEjercicio`, once grupos cerrados,
  nombre normalizado único, secundarios únicos y estados publicado/retirado.
- Módulo registrado sin endpoints. Fable añadirá servicios y controles de acceso.
- SQL aditivo revisado: dos enums, dos tablas, tres índices y una clave externa.
  No modifica tablas de identidad. Se generó con `prisma migrate diff` entre
  el esquema de `b456523` y el nuevo, porque PostgreSQL no estaba disponible.
- Reversión documentada en `apps/api/prisma/rollback/catalogo_minimo.sql`.
  No se ejecutó; aborta si hay datos. Una migración aplicada correctamente se
  revierte mediante una nueva migración compensatoria y el esquema correspondiente.
- `20260918201624_catalogo_minimo` aplicada con `prisma migrate dev`, que confirma
  que la base está sincronizada con el esquema. No se aceptó ni ejecutó ningún reset.
- Las 204 pruebas HTTP existentes pasan contra PostgreSQL real, incluida salud
  de la aplicación con el nuevo módulo. Los endpoints del catálogo son trabajo de Fable.
- Revisión independiente del modelo, DDL y reversión: sin hallazgos accionables.

### Comandos comprobados

| Comprobación                         | Resultado                         |
| ------------------------------------ | --------------------------------- |
| `npm run test`                       | 65 pruebas API + 4 móviles pasan  |
| `npm run typecheck`                  | Pasa en raíz, shared, API y móvil |
| `npm run lint`                       | ESLint y Prettier pasan           |
| `npx prisma validate`                | Esquema válido                    |
| `npm run db:generate`                | Cliente Prisma 7.10 generado      |
| `npm run build --workspace apps/api` | Compila                           |
| `git diff --check`                   | Sin errores                       |

Además, `npx prisma migrate dev` aplicó la migración y confirmó la sincronización.
`npm run test:e2e --workspace apps/api -- --runInBand`: 204 pruebas pasan, 14 suites.

Los tests móviles utilizan el renderer y los mocks del preset Expo; no demuestran
funcionamiento nativo. No se ha probado esta iteración en dispositivo.

### Incidencia del entorno local

Docker estaba apagado. Al iniciarlo falló por sockets temporales antiguos e
inaccesibles en `Docker/run` y `docker-secrets-engine`, bajo AppData/Local.
Se comprobaron sus contenidos (solo sockets vacíos), se apartaron en carpetas
de respaldo y se inició Docker con ambos directorios regenerados. PostgreSQL
volvió a estar sano con su volumen existente; no se tocaron volúmenes ni configuración.
Respaldos conservados: `Docker/run-c02-backup-20260918`,
`Docker/run-c02-backup-20260918-2019` y `docker-secrets-engine-c02-backup-20260918`.

### Coordinación y siguiente revisión

La entrega de lectura de Fable apareció durante el trabajo. Se conserva sin editar.
Las respuestas están en [su encargo](fable.md): columna de nombre normalizado,
relación de secundarios, búsqueda, permisos y respuestas de retirada/reposición.
C03 se divide en C03a (errores compartidos) y C03b (transporte) para entregar
un código `nombre_duplicado` estable sin superar cinco archivos por tarea.

El checkpoint 0A se presenta a David antes de C03. La skill
`planning-and-task-breakdown`, paso 5, incluye «Review with human before proceeding»;
el plan adoptó ese punto de revisión cada dos o tres tareas.

### Límites y pendientes ajenos al incremento

- La auditoría de dependencias observó 17 avisos (13 moderados y 4 altos) en
  dependencias existentes. No se ejecutó `npm audit fix --force`, que proponía
  cambios mayores ajenos al plan. El diff del lock no cambia versiones de paquetes
  ya presentes en la misma ruta.
- El peer de `react-native-worklets` y el aviso de motor de `@angular-devkit`
  ya existían. No se actualizó React, React Native ni Node para ocultarlos.
- C03 sigue pendiente. Fable espera el commit común C00–C03 para comenzar.
- Las animaciones tienen su [comparación propia](../../docs/animaciones-ejercicios.md).
  No se ha comprado ni integrado una biblioteca.
