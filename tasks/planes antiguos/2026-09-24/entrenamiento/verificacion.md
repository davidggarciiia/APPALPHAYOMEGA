# Verificación de entrenamiento — iteración 2

Fecha: 2026-09-18. Rama: `codex/entrenamiento-iteracion-2`.

## Entrega integrada — 2026-09-19

Estado vigente: funcionalidad C00–C18 y F01–F08 integrada en
`codex/entrenamiento-iteracion-2`. C19 queda pendiente únicamente en su
comprobación física Android/iOS. El registro histórico posterior conserva
los resultados de cada checkpoint; sus antiguos «pendientes» no describen
el estado actual.

### Comprobaciones finales

| Comprobación                                           | Resultado                                                      |
| ------------------------------------------------------ | -------------------------------------------------------------- |
| `npm run test`                                         | 76 pruebas unitarias de API y 85 móviles                       |
| `npm run test:e2e --workspace apps/api -- --runInBand` | 261 HTTP, incluidas las de identidad                           |
| `npm run typecheck`                                    | Todos los workspaces                                           |
| `npm run lint`                                         | ESLint y Prettier                                              |
| `npm run build --workspace apps/api`                   | Compilación correcta                                           |
| Cobertura de servicios nuevos                          | 97,71% líneas; 95,86% sentencias; 85,71% ramas; 100% funciones |

Cobertura HTTP reproducible:

```bash
npm run test:e2e --workspace apps/api -- --runInBand --coverage --collectCoverageFrom="src/{entrenamiento,agenda,catalogo-ejercicios}/**/*.service.ts" --coverageReporters=text --coverageReporters=json-summary --coverageDirectory=coverage/iteracion-2
```

Cada servicio nuevo supera el 80% de líneas y ramas. Se reutilizan las guardas
de identidad, con denegaciones HTTP por rol, propiedad y estado. La raíz de Jest
E2E incluye `src` para que instrumente código real: la configuración anterior,
limitada a `test`, producía un informe vacío. Los errores de proveedor de correo
de la suite son simulaciones explícitas, sin enviar correos reales.

### Trazabilidad de criterios

| Criterios                                                      | Implementación y evidencia                                                                                                                    |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Catálogo textual, roles, nombres únicos, retirada/reposición   | `catalogo-ejercicios/`, 37 HTTP, adaptador y componentes móviles                                                                              |
| C04–C07: cifrado, colas, cambio de cuenta, renovación y salida | `almacen-local`, `clave-local`, `sesion-local`, `peticion-autenticada`, `sesion`; unitarios y recorrido web offline                           |
| C08–C10/F04: asignación y prescripción por cliente             | `planes.service`, `sesiones.service`, `editor-plan`; HTTP de asignación/límites y dos tests de componente                                     |
| C11–C12/F05: borrador privado y conservación de ediciones      | `registros.service`, `registro-control`, `registro-modelo`; revisiones, respuestas atrasadas, recuperación y privacidad                       |
| C13: mover dentro de semana e historial                        | `agenda.service`, `fecha-sesion`; HTTP de agenda, contratos de fechas y recorrido real                                                        |
| C14–C15: envío parcial, cierre atómico, idempotencia           | `registros.service`, `registro-cliente`, `resultado`; HTTP de registros y replay tras respuesta perdida                                       |
| C16/F06–F07a: varias semanas y rutinas independientes          | `rutinas.service`, `editor-patron`, `cargar-rutina`; adaptación para otro cliente y conservación tras retirar ejercicios                      |
| C17/F07b: ajuste seguro de una sesión                          | `ajustes.service`, ruta `entrenador/sesion/[id]/ajustar`; revisiones, inicio concurrente y segunda semana intacta                             |
| C18: carreras                                                  | `entrenamiento-concurrencia.e2e-spec.ts`; mover/enviar, primer borrador/ajuste, doble envío y documento incompatible                          |
| Diseño y navegación                                            | `tema`, `armazon`, `agenda-semanal`, formularios y rutas; filtro por fecha actual, cambio domingo/lunes, etiquetas accesibles y recorrido web |

Los archivos propuestos originalmente se agruparon por responsabilidades durante
la ejecución. No se crearon controladores o adaptadores vacíos solo para igualar
los nombres del plan. El catálogo en memoria está en `pruebas/` y solo lo importan
los tests. Todas las rutas nuevas acceden a la API autenticada o a su copia local.

### Recorrido web con datos temporales

1. Crear, buscar, abrir, retirar y reponer un ejercicio desde el catálogo.
2. Preparar una sesión con carga/repeticiones y otra serie por segundos; asignarla
   desde la ficha y abrirla como cliente.
3. Crear una rutina de 15 kg × 12, copiarla al cliente cambiando a 17,5 kg y asignar
   dos semanas. La semana existente se conserva. Ajustar solo la primera sesión
   a 11 repeticiones; la plantilla sigue en 15 kg × 12 al volver a abrirla.
4. Parar la API propia, registrar 22,5 kg × 9, marcar una serie y escribir notas.
   Recargar la página sin servidor: se recupera la cuenta local y el documento
   cifrado, incluidos los valores y la marca. Reconectar y sincronizar.
5. Mover de lunes 14 a sábado 19. Enviar con una serie marcada y otra omitida.
   El valor privado de la serie omitida no aparece en el resultado publicado.
6. Entrar como entrenador y verificar sábado, fecha original, 22,5 kg × 9,
   serie omitida y notas. Un segundo envío desde la interfaz nueva se confirma.
7. Cerrar las cuentas temporales y eliminar exclusivamente sus datos de prueba.

Se usaron API/Nest, PostgreSQL y AES-GCM web reales. Los tests Expo/Jest cubren
los adaptadores mediante dobles; no demuestran SQLite ni SecureStore físicos.

### Diseño y revisión

Referencia: `Theme files review.zip`, HTML v2. Cabecera negra, tarjetas blancas,
texto negro/gris, botones de alto contraste y navegación por rol. El logo del ZIP
se representa con tinte monocromo. Barlow y Barlow Condensed se empaquetan junto
con su licencia OFL; no dependen de descargar fuentes al abrir la app.

Se comprobaron acceso, inicio, agenda, registro, confirmación, resultado, cartera
y rutinas. Revisión responsive a 320/390 px y en tableta/escritorio. Sin desbordamiento
horizontal de la página; el calendario permite desplazarse cuando hacen falta
para mantener objetivos táctiles de 44 px. La revisión independiente no deja
hallazgos Required. Se incorporaron sus mejoras de etiquetas con fecha/estado,
actualización al cruzar de semana y contraste de la barra de estado.

### Límites de la entrega

- Falta ejecutar C04/C19 en Android/iOS físicos: cierre de proceso, SQLite,
  SecureStore, teclado virtual y recuperación sin red. No se presenta como probado.
- Figuras animadas, vídeos y mapa muscular están fuera del subconjunto aprobado.
  Su investigación está en `docs/animaciones-ejercicios.md`; no se compró contenido.
- El worktree de Fable se conserva. No hay push, merge a main ni publicación.
- Los pendientes de producción e identidad anteriores mantienen su alcance.

## Registro histórico de checkpoints

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

David aprobó el checkpoint 0A con «adelant», antes de C03. La skill
`planning-and-task-breakdown`, paso 5, incluye «Review with human before proceeding»;
el plan adoptó ese punto de revisión cada dos o tres tareas.

### Límites y pendientes ajenos al incremento

- La auditoría de dependencias observó 17 avisos (13 moderados y 4 altos) en
  dependencias existentes. No se ejecutó `npm audit fix --force`, que proponía
  cambios mayores ajenos al plan. El diff del lock no cambia versiones de paquetes
  ya presentes en la misma ruta.
- El peer de `react-native-worklets` y el aviso de motor de `@angular-devkit`
  ya existían. No se actualizó React, React Native ni Node para ocultarlos.
- C03 se completó después de la aprobación; su evidencia se registra abajo.
- Las animaciones tienen su [comparación propia](../../docs/animaciones-ejercicios.md).
  No se ha comprado ni integrado una biblioteca.

## Base común C00–C03 — entrega para Fable

### C03a: errores compartidos

- Commit `9fc9003`. `ErrorDeApiSchema` exporta cuerpos estrictos para 400
  (`solicitud_invalida`) y 409 (`nombre_duplicado`, `revision_obsoleta`,
  `operacion_incompatible`). Identidad conserva sus respuestas anteriores.
- Tres pruebas nuevas verifican cuerpos válidos y rechazo de estados/códigos
  incompatibles. Se observaron fallar antes de implementar el contrato.

### C03b: transporte y compatibilidad

- Commit `83177eb`, base común de código C00–C03. `http.ts` concentra la petición,
  valida respuestas con Zod y añade `ErrorDePeticion.detalle` sin cambiar el
  estado numérico de `ErrorDelServidor.codigo` que utiliza identidad.
- La fábrica autenticada obtiene el token actual en cada llamada y conserva los
  headers del consumidor. No renueva tokens ni repite mutaciones automáticamente;
  C06 incorporará la renovación coordinada.
- 22 pruebas HTTP cubren 401/403, red, errores 400/409 nuevos y antiguos,
  contrato de respuesta, 204, headers, token actual, cancelación, límite de diez
  segundos y conservación del cuerpo/id de operación al reintentar explícitamente.
- Se reprodujo con una prueba roja que `AbortSignal.timeout` no está disponible
  en el polyfill de React Native instalado. El transporte utiliza ahora
  `AbortController` y temporizador con limpieza. Esto no sustituye la prueba nativa.
- La revisión independiente detectó que un corte al leer el cuerpo de 400/409
  se confundía con un error HTTP normal. Dos pruebas adicionales reprodujeron el
  problema antes del arreglo. La revisión posterior no deja hallazgos accionables.

### Comprobación web real

La aplicación mostró inicialmente una pantalla en blanco: la configuración manual
de Metro forzaba a Expo/HMR a resolver `pretty-format` 30 de Jest en lugar de 29.
Se añadió `metro.config.js` al alcance de C03b antes de cambiarlo, manteniendo cinco
archivos. Ahora usa `getDefaultConfig(__dirname)` y resolución automática de
workspaces; no se modificaron dependencias ni lockfile. Es la configuración
recomendada desde SDK 52 por [Expo para monorepos](https://docs.expo.dev/guides/monorepos/).

Tras reiniciar Expo con `--clear`, en navegador se comprobó:

1. Formulario de acceso visible.
2. Login correcto con una cuenta local temporal, contra la API y PostgreSQL reales.
3. Lectura de perfil con nombre y correo de esa cuenta.
4. Cierre de sesión y regreso al formulario de acceso.

La consola del navegador no registró errores ni avisos en ese recorrido. La cuenta
temporal se eliminó al finalizar y se cerraron los servidores de prueba iniciados
por Codex. No se modificaron perfiles existentes. Android/iOS siguen sin comprobar.

### Resultado de las comprobaciones de C03

| Comprobación                         | Resultado                         |
| ------------------------------------ | --------------------------------- |
| `npm run test`                       | 68 pruebas API + 26 móviles pasan |
| `npm run typecheck`                  | Pasa en todos los workspaces      |
| `npm run lint`                       | ESLint y Prettier pasan           |
| `npm run build --workspace apps/api` | Compila                           |
| `git diff --check`                   | Sin errores                       |
| Login, perfil y logout web           | Verificados con API real          |

Las 204 pruebas HTTP de C02 no se repitieron en C03: no se cambió implementación
de servidor, esquema Prisma ni migraciones. Los tests móviles siguen usando el
entorno Jest/Expo y no prueban dispositivos. C04, C05 y C06 permanecen pendientes.
El [encargo de Fable](fable.md) está preparado; este trabajo no inicia su sesión.
