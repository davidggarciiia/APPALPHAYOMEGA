# Plan: entrenamiento, segunda iteración

> Preparado el 2026-09-18 con `planning-and-task-breakdown` de Agent Skills.
> **Estado: plan aprobado; David autoriza comenzar la parte de Codex el 2026-09-18.**
> Especificaciones aprobadas: [entrenamiento](../../SPEC-entrenamiento.md) y
> [agenda](../../SPEC-agenda.md). [Plan de Fable](plan-fable.md) · [Encargo](fable.md).
> Carpeta autorizada por David. El plan de identidad permanece en `tasks/`.

## Resultado

El entrenador crea una rutina, la asigna durante varias semanas y ve los
resultados enviados. El cliente cambia el día dentro de la semana, registra
series por repeticiones o tiempo, recupera su borrador y envía el entrenamiento.

## Estado del flujo de Agent Skills

David ha revisado los planes y ha indicado «vale, comienza tu parte». Esa
instrucción autoriza iniciar las tareas de Codex. Se conserva abajo el registro
del punto de revisión previo, ya superado para esta ejecución. Fable recibe
su encargo cuando exista el commit común; no se ha iniciado otra sesión.
La investigación adicional de animaciones está en
[bibliotecas de figuras](../../docs/animaciones-ejercicios.md); aún no fija un proveedor.

| Fase      | Estado                                                          | Validación para avanzar                                                                  |
| --------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| SPECIFY   | Entrevista y especificaciones de agenda/entrenamiento aprobadas | Ya recibida; se conserva                                                                 |
| PLAN      | Este plan y el plan de Fable preparados para revisión           | David valida enfoque, reparto, contratos, dependencias y vocabulario mínimo del catálogo |
| TASKS     | Desgloses anticipados conservados como borradores sin validar   | Después de PLAN, ajustar y revisar tareas de Codex y Fable con David                     |
| IMPLEMENT | Sin iniciar                                                     | Requiere PLAN y TASKS validados; comprobar y revisar cada incremento                     |

`spec-driven-development` exige validar cada fase antes de pasar a la siguiente.
Los [borradores de Codex](todo.md) y [Fable](todo-fable.md) no habilitan ejecución.
Sus identificadores se usan abajo como referencias provisionales, pendientes
de la revisión de TASKS. `planning-and-task-breakdown` guía su tamaño y verificación.

## Base revisada y cambios recientes

Base de coordinación: `055c401`, posterior al borrador del catálogo `8917775`.
`055c401` cambia servicios y tests de identidad: acceso del nutricionista a
clientes desactivados, límites de login y recuperación, alta de entrenadores,
rotación y revocación de tokens. Son cambios existentes que se conservan.
Se ha leído el diff; esta fase de planificación no afirma haber vuelto a
ejecutar sus tests.

David confirma que Fable no tiene trabajo en marcha. No hay una tarea llamada
Fable accesible desde Codex; el encargo se entrega por archivo para que David
lo pase a su sesión. Escribir este plan no inicia trabajo en esa sesión.

El código actual aún no tiene catálogo, agenda ni entrenamiento. La app móvil
tampoco tiene ejecutor de tests. Su restauración exige red y el cliente HTTP no
renueva automáticamente el token en las peticiones. Estos puntos son parte del
recorrido nuevo: un entreno puede durar más que el token y sufrir cortes de red.

## Reparto de responsabilidades

| Responsable | Entrega                                                       | Archivos propios                                                                                                  |
| ----------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Codex       | Contratos, migraciones e integración                          | `packages/shared/`, `apps/api/prisma/`, módulos raíz, dependencias y lockfile                                     |
| Fable       | Catálogo mínimo completo: API, permisos y pantalla de gestión | `apps/api/src/catalogo-ejercicios/`, sus tests; `apps/mobile/src/catalogo-ejercicios/` y sus rutas                |
| Codex       | Agenda y servicios de entrenamiento                           | `apps/api/src/agenda/`, `apps/api/src/entrenamiento/` y sus tests                                                 |
| Codex       | Registro del cliente, guardado, recuperación y envío          | `apps/mobile/src/entrenamiento-cliente/`, `apps/mobile/src/lib/`, `apps/mobile/src/sesion.tsx`, rutas del cliente |
| Fable       | Editor de rutinas, asignación y resultados del entrenador     | `apps/mobile/src/entrenamiento-entrenador/`, rutas `app/entrenador/` y sus tests                                  |
| Codex       | Conexión con las pantallas existentes y seguimiento           | `app/index.tsx`, `app/_layout.tsx`, `app/cliente/[id].tsx`, documentos de esta iteración                          |

Los contratos se fijan primero. Fable puede construir sus pantallas con respuestas
de prueba que satisfagan esos contratos mientras Codex prepara la API. Un flujo
solo se marca terminado después de conectarlo a la API y comprobarlo completo.

## Cómo trabajar sin interferencias

1. Antes de empezar, Codex registra las especificaciones aprobadas y este plan
   en una rama `codex/entrenamiento-iteracion-2`, con las comprobaciones exigidas.
   Esto ocurre después de validar PLAN y TASKS; ahora solo se preparan documentos.
2. Codex prepara contratos y configuración comunes. Tras integrar la base C00–C03,
   Fable crea una copia de trabajo independiente en `codex/fable-catalogo` desde
   ese commit. No cambia la rama de la carpeta en la que trabaja Codex.
3. Solo Codex edita Prisma, genera/aplica migraciones, exporta contratos desde el
   índice compartido y cambia dependencias. Fable solicita cambios en su entrega;
   no duplica esas modificaciones por su cuenta.
4. Las pruebas HTTP y las migraciones que usan la misma base local se ejecutan
   en turnos. Las pruebas unitarias y de componentes pueden correr en paralelo.
   Fable entrega una solicitud de turno o utiliza una base de pruebas separada.
5. Fable entrega commits concretos, comandos ejecutados, resultados y límites
   pendientes. Codex revisa e integra solo esos commits; no hace `git add .` ni
   sobrescribe archivos ajenos. El acceso a GitLab no hace necesario un push para
   coordinar el trabajo local.
6. Después del catálogo se comparte el nuevo commit integrado y Fable continúa
   el editor y el panel del entrenador desde esa base.

## Orden de entregas

| Incremento                   | Codex                                                        | Fable                                                | Comprobación de salida                                                 |
| ---------------------------- | ------------------------------------------------------------ | ---------------------------------------------------- | ---------------------------------------------------------------------- |
| 0. Base coordinada           | C00–C03: contratos, tests móviles, catálogo y conexión común | Lee el encargo y comunica dudas                      | Contratos compilados y primera prueba móvil ejecutable                 |
| 1. Elegir un ejercicio       | C04–C07: persistencia local y sesión                         | F01–F03: crear, buscar, retirar y reponer ejercicios | El entrenador crea un ejercicio desde el móvil y lo vuelve a encontrar |
| 2. Asignar y ver una sesión  | C08–C10: modelo y primera asignación                         | F04: editor de una sesión                            | El entrenador asigna y el cliente abre esa sesión                      |
| 3. Registrar y enviar        | C11–C15: borrador, movimiento, envío y vista cliente         | F05: panel de resultados                             | Se completa el recorrido más pequeño con API real                      |
| 4. Rutinas de varias semanas | C16–C17: bloques, copias y ajustes                           | F06–F07: editor semanal y biblioteca                 | Reutilizar/adaptar no altera otras personas ni históricos              |
| 5. Cierre                    | C18–C19: carreras, integración, documentación y dispositivo  | F08: revisión de sus pantallas y correcciones        | Evidencia para cada criterio de las especificaciones                   |

La primera demostración usa una sola sesión con un ejercicio y una serie. No se
espera a terminar todos los editores para comprobar que asignación, ejecución y
envío funcionan. Cada incremento tiene tareas de ambos lados y una verificación
vertical; terminar solo la API o una pantalla con datos simulados no lo cierra.

## Decisiones técnicas propuestas

### Contratos comunes antes de trabajar en paralelo

Zod sigue siendo la fuente de tipos. Archivos por módulo, exportados por
`packages/shared/src/index.ts`. Las nuevas rutas usan esquemas estrictos;
errores distinguen 400, 401, 403/404, 409 y fallos de transporte. Para recursos
ajenos se devuelve una respuesta genérica sin revelar su existencia.

| Operación                  | Ruta propuesta                                                      | Quién                                              |
| -------------------------- | ------------------------------------------------------------------- | -------------------------------------------------- |
| Buscar / crear ejercicio   | `GET/POST /ejercicios`                                              | Lectura cliente/entrenador; creación entrenador    |
| Leer / editar ejercicio    | `GET/PATCH /ejercicios/:id`                                         | Lectura cliente/entrenador; edición entrenador     |
| Retirar / reponer          | `POST /ejercicios/:id/retirar`, `/reponer`                          | Entrenador                                         |
| Crear plan personalizado   | `POST /entrenamiento/clientes/:clienteId/planes`                    | Entrenador                                         |
| Consultar semana           | `GET /entrenamiento/clientes/:clienteId/sesiones?semana=YYYY-MM-DD` | Propietario o entrenador                           |
| Abrir sesión               | `GET /entrenamiento/sesiones/:id`                                   | Propietario o entrenador, con respuestas distintas |
| Cambiar día                | `PATCH /agenda/sesiones/:id/fecha`                                  | Propietario o entrenador                           |
| Guardar / leer borrador    | `PUT/GET /entrenamiento/sesiones/:id/borrador`                      | Solo propietario                                   |
| Enviar                     | `POST /entrenamiento/sesiones/:id/enviar`                           | Solo propietario                                   |
| Leer resultado             | `GET /entrenamiento/sesiones/:id/resultado`                         | Propietario o entrenador                           |
| Listar / guardar plantilla | `GET/POST /entrenamiento/rutinas`                                   | Entrenador                                         |
| Leer / editar plantilla    | `GET/PATCH /entrenamiento/rutinas/:id`                              | Entrenador                                         |
| Ajustar sesión no iniciada | `PATCH /entrenamiento/sesiones/:id/prescripcion`                    | Entrenador                                         |

Las sesiones de la agenda comparten su id con la sesión de entrenamiento para
evitar dos identificadores intercambiables en el cliente. El entrenador recibe
prescripción, fechas y estado público; nunca una entidad Prisma completa con el
borrador incluido. Sus consultas no exponen revisión, notas ni valores privados.

Una prescripción contiene sesiones con día de la semana, ejercicios ordenados,
series identificadas y objetivos. `tipoMedicion` es `repeticiones` o `tiempo`;
el objetivo tiene `pesoKg` nullable y exactamente `repeticiones` o `segundos`.
El registro real se guarda aparte. Un borrador puede tener campos incompletos;
solo una serie marcada debe satisfacer todos los requisitos de ejecución.

### Catálogo mínimo y vocabulario pendiente

No se necesita figura ni vídeo para empezar. La ficha expone esos campos como
ausentes y conserva el hueco previsto. No se implementa almacenamiento de medios
ni se elige un proveedor en esta iteración.

La spec del catálogo deja los grupos musculares abiertos. Para poder cerrar el
contrato se propone esta lista inicial: `pecho`, `espalda`, `hombros`, `biceps`,
`triceps`, `antebrazos`, `abdomen`, `gluteos`, `cuadriceps`, `isquiotibiales` y
`gemelos`. Principal obligatorio y secundarios opcionales; no significa que el
mapa muscular esté diseñado. Esta propuesta forma parte de la revisión del plan.
Se mantiene la denegación al nutricionista y al empleado ya descrita por la spec.

Nombre único normalizado por espacios y mayúsculas; no se fusionan ejercicios
automáticamente. Alta manual suficiente para la primera entrega; no se rellena
la biblioteca con ejercicios inventados ni se promete un catálogo completo.

### Datos y operaciones atómicas

- `Ejercicio`: catálogo sin referencias a clientes. Nombre normalizado único,
  grupos, instrucciones y estado publicado/retirado.
- `SesionProgramada` y `CambioDeFecha`: fechas originales/actuales, estado y
  revisión. Campos PostgreSQL `date`; intercambio como `YYYY-MM-DD`.
- `PlanEntrenamiento`: cliente, semanas, id de operación y copia del patrón.
- `SesionEntrenamiento`: id de agenda, prescripción validada como documento
  versionado, revisión, estado de inicio, borrador privado y resultado enviado.
- `RutinaGuardada`: nombre, patrón versionado y revisión, sin datos de ejecución.
- `ReferenciaEjercicio`: relación sesión–ejercicio y clave estable dentro de la
  prescripción, para mantener integridad sin confiar solo en ids dentro de JSON.

Los documentos de prescripción y ejecución evitan crear tablas por cada campo
de una serie en este primer recorrido. Se validan en cada escritura y lectura;
los índices y relaciones resuelven cliente, sesión, fechas y ejercicios. El
resultado conserva la prescripción y el nombre utilizado al asignar, aunque luego
se edite el catálogo. No hay consultas analíticas masivas en esta iteración.

Revisiones separadas para agenda, prescripción y borrador. Mover la fecha no debe
invalidar cada tecla del cliente. El envío comprueba las revisiones necesarias y
cierra agenda y entrenamiento en una sola transacción. El guardado tardío no puede
reabrir una sesión. El primer borrador sincronizado y la edición de prescripción
compiten por una actualización condicional; la copia local se conserva si pierde.

Asignación y envío llevan un id de operación estable. La misma operación con el
mismo contenido devuelve el mismo resultado; reutilizarla con contenido diferente
da conflicto. La unicidad se impone también en base de datos. Las transacciones
son cortas, sin correo ni llamadas externas dentro.

Prisma 7 permite transacciones interactivas y comprobación de versiones para
evitar escrituras concurrentes perdidas. Se aplicarán a estas operaciones nuevas,
sin reemplazar el mecanismo de identidad.
[Fuente: transacciones de Prisma 7](https://docs.prisma.io/docs/orm/v7/prisma-client/queries/transactions).

### Guardado local y sesión

Se propone `expo-sqlite` para persistir borradores y la prescripción descargada,
con una fila por cuenta/sesión. El contenido se cifra con las APIs AES de
`expo-crypto`; la clave por cuenta queda en el SecureStore existente. Las
escrituras se serializan y llevan una secuencia local. Guardar un borrador exige
que su contenido haya quedado escrito, no solo que se haya iniciado una promesa.
[SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/) y
[Crypto](https://docs.expo.dev/versions/latest/sdk/crypto/#aes-encryption-and-decryption).

SecureStore se reserva para claves pequeñas, porque el sistema puede rechazar
valores grandes. No se fragmenta una rutina en decenas de entradas del llavero.
[Fuente: SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/).

En web de desarrollo se usa un adaptador local equivalente con almacenamiento
del navegador y la limitación ya aceptada para credenciales web; no se presenta
como la misma protección del llavero nativo. No se activa SQLCipher ni se cambia
a una compilación nativa propia para este incremento. La prueba de C04 debe
comprobar cifrado y persistencia en Expo Go antes de construir sobre ellos.

La sesión conserva una identidad local mínima, asociada a una autenticación
previa. Ante un fallo de red al reabrir, permite únicamente el registro local de
sesiones descargadas del cliente. No concede acceso al servidor ni al panel del
entrenador. Un 401 confirmado limpia el acceso; una caída de red no borra datos.
El cierre explícito limpia la cuenta local, tras advertir de cambios no
sincronizados. Los datos de una cuenta no reaparecen al entrar como otra.

El acceso HTTP se coordina con el proveedor de sesión: una sola renovación en
vuelo, guardar el nuevo refresh antes de usarlo y reintentar como máximo una vez.
Los reintentos de escritura conservan el id de operación. Se usa el servidor de
identidad tal como quedó en `055c401`; no se modifican sus servicios.

### Sincronización y actualización del panel

El guardado local ocurre antes de sincronizar. Una cola por sesión envía revisiones
en orden; conserva el texto parcial local y nunca aplica una respuesta antigua
encima de una edición nueva. Ante 409 guarda ambas versiones y permite recuperar
la del servidor sin borrar silenciosamente la local.

El panel consulta cada cinco segundos solo cuando está visible y la app activa,
y al recuperar el foco. No se introduce WebSocket. Los resultados permanecen
invisibles al entrenador hasta el envío; las fechas sí se actualizan antes.

## Dependencias concretas para aprobar con el plan

No se ha instalado nada. Se han contrastado las versiones con
`node_modules/expo/bundledNativeModules.json` y con los metadatos de npm.

| Paquete                         | Versión propuesta | Uso                                             |
| ------------------------------- | ----------------- | ----------------------------------------------- |
| `expo-sqlite`                   | `~57.0.3`         | Persistencia local                              |
| `expo-crypto`                   | `~57.0.3`         | Cifrado de borradores y generación de ids       |
| `jest-expo`                     | `~57.0.5`         | Preset móvil                                    |
| `@react-native/jest-preset`     | `0.86.3`          | Peer requerido por el preset Expo               |
| `@testing-library/react-native` | `14.0.1`          | Pruebas de interacción                          |
| `test-renderer`                 | `1.3.0`           | Peer de Testing Library compatible con React 19 |

Jest 30 y `@types/jest` ya existen en la API; se declara la dependencia de
desarrollo móvil compatible y se fija el resultado en el lockfile. No se actualiza
React ni React Native. `react-server-dom-webpack` es un peer opcional que no se
necesita. `jest-expo` trae una dependencia transitiva de `react-test-renderer`;
las pruebas propias usarán Testing Library y su renderer, sin basarse en esa API
obsoleta. La primera prueba debe confirmar que la combinación funciona.

Los tests móviles se colocan fuera de `app/`, con `jest-expo` y Testing Library,
siguiendo [Expo](https://docs.expo.dev/develop/unit-testing/),
[Expo Router](https://docs.expo.dev/router/reference/testing/) y
[Testing Library 14](https://oss.callstack.com/react-native-testing-library/docs/start/quick-start).
No se añade TanStack Query en esta iteración: el sondeo visible y la cola local
quedan acotados al entrenamiento, sin migrar las pantallas existentes.

## Comprobaciones y revisión

- Cada tarea tiene aceptación, dependencias y comando en [todo.md](todo.md).
  El desglose de Fable está en [todo-fable.md](todo-fable.md). Ambos son borradores
  para revisar después de validar los planes.
- Un checkpoint cada dos o tres tareas por línea de trabajo verifica el recorrido
  disponible. Codex y Fable revisan la entrega ajena leyendo sus cambios; el
  responsable corrige sus propios archivos.
  Se presenta a David la evidencia del checkpoint antes de avanzar al siguiente
  incremento. La revisión cruzada complementa la revisión humana.
- `npm run test`, `npm run typecheck` y `npm run lint` antes de cada commit, como
  exige el proyecto. Pruebas HTTP por turno de base de datos y suites enfocadas.
- La prueba final en móvil incluye interrupción de red, cierre/reapertura, sesión
  larga, cambio de día, valores distintos del objetivo y reintento de envío.
- Los resultados se registran como implementado, probado automáticamente y
  comprobado en dispositivo. No se marca el último estado sin evidencia real.

## Riesgos y decisiones de revisión

| Riesgo                                      | Tratamiento                                                              |
| ------------------------------------------- | ------------------------------------------------------------------------ |
| Agentes editando archivos comunes           | Worktrees separados; Codex integra contratos, migraciones y dependencias |
| Guardado local no compatible o inseguro     | C04 lo comprueba pronto, antes del editor completo                       |
| Borrador visible al entrenador              | DTOs públicos separados y tests negativos HTTP                           |
| Pérdida por edición o envío simultáneo      | Versiones, claves de operación y pruebas con PostgreSQL real             |
| Tests móviles aparentan verificar el nativo | Se distinguen tests con mocks de pruebas en Expo Go                      |
| Pendientes de identidad ocultos             | Se conserva su plan y no se marca identidad completa                     |

El siguiente punto de revisión es el checkpoint 0A, tras C00–C02. Se presentarán
las comprobaciones del incremento antes de avanzar. La compra o integración de
una biblioteca de animaciones se decide por separado tras evaluar las muestras.
