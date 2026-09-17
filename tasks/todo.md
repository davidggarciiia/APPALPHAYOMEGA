# Tareas: `identity`

> Plan y decisiones: [tasks/plan.md](plan.md) · Spec: [SPEC-identity.md](../SPEC-identity.md)
>
> Se hace una tarea cada vez. Ninguna se marca hecha sin su verificación pasada.

## Fase 0 · Andamiaje

- [x] **Tarea 1: Monorepo y herramientas** — hecha 2026-09-12

  Crear el monorepo con workspaces de npm, TypeScript en modo estricto, ESLint y
  Prettier. Sin código de negocio todavía.

  **Aceptación**
  - Existen `apps/api`, `apps/mobile` y `packages/shared` como workspaces
  - `tsconfig` con `strict: true` y `noUncheckedIndexedAccess: true`
  - `packages/shared` exporta un tipo y los otros dos lo importan sin error

  **Verificación**
  - `npm run typecheck` pasa
  - `npm run lint` pasa

  **Dependencias:** ninguna · **Alcance:** S

- [x] **Tarea 2: Postgres local y primera migración** — hecha 2026-09-12

  Levantar Postgres con Docker Compose y crear el esquema inicial de `Usuario`
  con su enumerado de rol.

  > Prisma 7 dejó de admitir la URL de conexión dentro de `schema.prisma`. Vive
  > ahora en `prisma.config.ts`, en la raíz. Por eso los comandos `db:*` se
  > ejecutan desde la raíz y no desde `apps/api`.

  **Aceptación**
  - `docker compose up -d` levanta Postgres y persiste entre reinicios
  - `schema.prisma` define `Usuario` con id, email único, passwordHash opcional,
    rol, estado y creadoEn
  - `rol` es un enumerado de cuatro valores, no texto libre
  - `estado` es un enumerado de tres: pendiente, activo y desactivado
  - Existe una migración versionada en `prisma/migrations`

  **Verificación**
  - `npx prisma migrate dev` aplica sin error
  - `npx prisma studio` muestra la tabla vacía

  **Dependencias:** 1 · **Alcance:** S

- [x] **Tarea 3: Esqueleto de la API** — hecha 2026-09-12

  Aplicación NestJS con módulo de Prisma y un endpoint de salud. Es la tarea donde
  se aprende la estructura del framework sin lógica que distraiga.

  **Aceptación**
  - `GET /salud` devuelve estado y comprueba que la base de datos responde
  - `PrismaService` se inyecta por el contenedor, sin instanciarlo a mano
  - El cliente de Prisma se construye con un adaptador de driver explícito.
    Prisma 7 ya no conecta solo, así que entran `@prisma/adapter-pg` y `pg`
  - Hay un test e2e que arranca la app y golpea el endpoint
  - **Se borra `scripts/sin-tests.mjs`** y el script `test` de la raíz vuelve a
    ser real: `npm run build:shared && npm run test --workspaces --if-present`.
    El marcador existe solo para que `npm test` no dé un verde falso mientras no
    hay tests, y deja de tener sentido en cuanto esta tarea aterriza

  **Verificación**
  - `npm run test:e2e --workspace apps/api` pasa
  - `npm run test` desde la raíz ejecuta tests de verdad y sale en verde
  - `npm run dev --workspace apps/api` arranca sin avisos

  **Dependencias:** 2 · **Alcance:** S

- [x] **Tarea 4: Esqueleto de la app** — hecha 2026-09-12, pendiente la prueba en dispositivo

  App Expo con Expo Router y un cliente HTTP que apunta a la API local.

  > Verificado sin dispositivo exportando el bundle de Android completo, lo que
  > demuestra que todo el grafo de modulos resuelve, incluido el paquete
  > compartido a traves del monorepo. **Queda pendiente que David la abra en un
  > movil real y confirme que la pantalla muestra el estado de la API.**

  **Aceptación**
  - La app arranca en un dispositivo real o emulador
  - Una pantalla llama a `GET /salud` y muestra la respuesta
  - La URL de la API sale de una variable de entorno, no está escrita en el código

  **Verificación**
  - `npm run dev --workspace apps/mobile` abre la app y la pantalla muestra el estado
  - `npm run typecheck` pasa

  **Dependencias:** 3 · **Alcance:** S

### Checkpoint 0 — superado

- [x] Tests pasan, typecheck limpio — verificado 2026-09-12
- [x] La app en un móvil real habla con la API de tu máquina — verificado por David en su teléfono, 2026-09-12
- [x] Revisión antes de seguir — hecha 2026-09-16. Auditoría adversarial de seis ángulos sobre el andamiaje y la app, que era el único código sin revisar. 30 hallazgos propuestos, 26 confirmados, los 26 arreglados

## Fase 1 · Sesión

- [x] **Tarea 5: Login con contraseña en la API** — hecha 2026-09-12

  Endpoint de login que verifica con Argon2id y devuelve un token de acceso.
  Incluye un seed que crea la cuenta del entrenador.

  **Aceptación**
  - `POST /auth/login` devuelve token de acceso con credenciales correctas
  - Credenciales incorrectas y correo inexistente devuelven **el mismo** error
  - El hash de contraseña no aparece en ninguna respuesta
  - El seed crea al entrenador con contraseña cifrada

  **Verificación**
  - Tests unitarios del servicio y e2e del endpoint pasan
  - Un test comprueba que la respuesta no contiene `passwordHash`

  **Dependencias:** 3 · **Alcance:** M

- [x] **Tarea 6: Autenticación global y denegar por defecto** — hecha 2026-09-12

  Guard global que exige token válido en toda ruta, más un decorador para marcar
  las públicas de forma explícita. Es la tarea que protege todo el resto del
  proyecto.

  **Aceptación**
  - Toda ruta sin decorador explícito exige autenticación
  - Un endpoint nuevo creado sin pensar queda protegido solo
  - El rol se lee del token verificado en el servidor, nunca del cuerpo ni de una
    cabecera que mande la app

  **Verificación**
  - Existe un test que crea un endpoint de prueba sin decorador y comprueba que
    deniega sin token
  - Tests de la tarea 5 siguen pasando

  **Dependencias:** 5 · **Alcance:** M

- [x] **Tarea 7: Tokens de refresco** — hecha 2026-09-12

  Emitir, renovar y revocar. El token de acceso dura poco, el de refresco dura
  mucho y vive en la base de datos para poder matarlo.

  **Aceptación**
  - El login devuelve también un token de refresco, guardado cifrado en la tabla
  - `POST /auth/refresh` devuelve un token de acceso nuevo
  - `POST /auth/logout` revoca el de refresco y un intento posterior falla
  - Un token de refresco caducado no renueva

  **Verificación**
  - Test e2e del ciclo completo: login, refresh, logout, refresh que falla

  **Dependencias:** 6 · **Alcance:** M

- [x] **Tarea 8: Pantalla de login y sesión persistente** — hecha 2026-09-12

  La primera pantalla de verdad. Formulario con React Hook Form y Zod, token de
  refresco en el almacén seguro del dispositivo, y renovación automática cuando
  el de acceso caduca.

  **Aceptación**
  - El entrenador entra con su correo y contraseña
  - El token de refresco se guarda en el almacén seguro, nunca en almacenamiento normal
  - Cerrar y reabrir la app mantiene la sesión
  - Cuando el token de acceso caduca, se renueva sin que el usuario note nada
  - Un error de credenciales muestra un mensaje que no revela si el correo existe

  **Verificación**
  - Prueba manual en un móvil: entrar, cerrar la app, reabrir y seguir dentro
  - Test de componente de la pantalla de login

  **Dependencias:** 7, 4 · **Alcance:** M

### Checkpoint 1 — superado

- [x] El entrenador entra desde un móvil real y la sesión sobrevive a cerrar la app — verificado por David, 2026-09-12. El token persiste en el llavero del sistema, que es la rama de código que el navegador nunca ejecuta
- [x] Todos los tests pasan — verificado 2026-09-12
- [x] Revisión antes de seguir — hecha 2026-09-16 junto con la del checkpoint 0. Cuatro hallazgos críticos en la app, todos invisibles probando en navegador contra localhost

## Fase 2 · Permisos

- [x] **Tarea 9: Matriz de roles con tests de denegación** — hecha 2026-09-12

  Convertir la tabla de la especificación en un guard de roles, con un test por
  cada celda que dice "no".

  **Aceptación**
  - Existe un decorador de roles aplicable a controlador o a ruta
  - Cada capacidad de la matriz tiene su regla
  - **Cada celda "no" de la matriz tiene un test que demuestra la denegación**

  **Verificación**
  - `npm run test --workspace apps/api` pasa
  - Cobertura de las guardas por encima del 80%

  **Dependencias:** 6 · **Alcance:** M

- [x] **Tarea 10: Alcance por asignación del nutricionista** — hecha 2026-09-12

  El rol no basta. El nutricionista solo ve los clientes que tiene asignados, así
  que hace falta una comprobación de pertenencia además de la de rol.

  **Aceptación**
  - Tabla `AsignacionNutricionista` con su migración
  - Un nutricionista sin asignación recibe denegación al pedir un cliente
  - Con asignación, lo recibe
  - La comprobación es reutilizable por los módulos `nutricion` y
    `seguimiento-corporal`, que la van a necesitar

  **Verificación**
  - Tests de los tres casos: sin asignación, con asignación, y con asignación a
    otro nutricionista

  **Dependencias:** 9 · **Alcance:** M

### Checkpoint 2

- [x] Los cuatro roles están separados y demostrado por tests
- [x] Un endpoint nuevo sin regla deniega
- [x] Revisión antes de seguir — auditoría adversarial de seis ángulos. Ocho hallazgos confirmados, los ocho arreglados. Ver ADR 0004

## Fase 3 · Invitaciones

- [x] **Tarea 11: Envío de correo** — hecha 2026-09-12, pendiente un envío real

  Integrar Resend.

  > Funcionando en **modo de pruebas**: el remitente es el dominio de Resend, que
  > solo permite enviar a la dirección con la que se registró la cuenta. Basta
  > para desarrollar. **Antes de invitar a un cliente real hay que verificar el
  > dominio.** Ver [docs/PENDIENTE-PARA-PRODUCCION.md](../docs/PENDIENTE-PARA-PRODUCCION.md), punto 1.

  **Aceptación**
  - Un servicio de correo inyectable con una implementación real y otra falsa
    para los tests
  - Las credenciales van en `.env`, nunca en el repositorio
  - Los tests usan la implementación falsa y no envían nada de verdad

  **Verificación**
  - Un envío real llega a una bandeja de entrada
  - Los tests pasan sin red

  **Dependencias:** 3, y la decisión de la pregunta abierta 1 · **Alcance:** S

- [x] **Tarea 12: Alta directa y activación con contraseña** — hecha 2026-09-12

  El entrenador crea el perfil con nombre, correo y rol. Nace pendiente y ya se le
  pueden asignar entrenos. Se le envía un enlace de activación con el que fija su
  contraseña y pasa a activo.

  **Aceptación**
  - `POST /usuarios` solo lo puede llamar el entrenador, y crea el perfil en
    estado pendiente y sin contraseña
  - **Un perfil pendiente puede recibir entrenos asignados y no puede iniciar sesión**
  - El token de activación se guarda cifrado y caduca a los siete días
  - Activar fija la contraseña y pasa el estado a activo
  - Un token usado, caducado o inventado no activa nada
  - **Ningún endpoint crea una cuenta sin pasar por el entrenador**

  **Verificación**
  - Test e2e del ciclo: crear pendiente, login denegado, activar, login correcto
  - Tests de token usado, caducado e inventado
  - Prueba manual: crear un perfil con tu propio correo y activarlo

  **Dependencias:** 11, 9 · **Alcance:** M

- [ ] **Tarea 13: Prueba de humo de Google** — APLAZADA hasta después de la 18

  > **Cambio de orden, decidido el 2026-09-16.** Esta tarea y la 14 se ejecutan
  > después de la 18, no antes.
  >
  > **Motivo:** necesitan un proyecto en Google Cloud con credenciales de OAuth,
  > y eso solo puede crearlo David. Es un bloqueo externo, no una preferencia.
  >
  > **Por qué se puede mover sin romper nada:** su única dependencia es la tarea
  > 4, que está hecha. Ninguna tarea posterior depende de ella salvo la 14, que
  > viaja con ella. El propio plan la describía como aislada y adelantable.
  >
  > **Consecuencia:** hasta que se hagan, la única forma de entrar en la app es
  > con contraseña. El requisito 7 de SPEC-identity.md queda sin implementar, y
  > con él el riesgo de la directriz 4.8 de Apple sigue abierto.
  >
  > Orden de ejecución real: 12 → 15 → 16 → 17 → 18 → 13 → 14 → 19 → 20 → 21.

  Aislada y adelantable. Solo demostrar que el flujo nativo de OAuth devuelve un
  token de identidad válido en Android y en iOS.

  **Aceptación**
  - Cliente de OAuth creado en Google Cloud para las dos plataformas
  - Una pantalla de prueba lanza el flujo y muestra el token que vuelve
  - El servidor verifica ese token contra las claves públicas de Google

  **Verificación**
  - Funciona en un Android real y en un iPhone real
  - Un token manipulado es rechazado por el servidor

  **Dependencias:** 4 · **Alcance:** M

- [ ] **Tarea 14: Aceptar invitación con Google** — APLAZADA, viaja con la 13

  Vincular la identidad de Google a la cuenta en el momento de aceptar la
  invitación, no en el primer login.

  **Aceptación**
  - Al abrir el enlace, el invitado elige contraseña o Google
  - Con Google se crea `IdentidadExterna` ligada a esa invitación
  - Entrar con Google sin invitación aceptada deniega y **no crea ninguna cuenta**
  - Un invitado a un correo que acepta con otra cuenta de Google queda vinculado
    igualmente
  - Una cuenta puede tener contraseña y Google a la vez, y las dos llevan al mismo sitio

  **Verificación**
  - Tests de los cinco casos anteriores
  - Prueba manual con una cuenta de Google cuyo correo no sea el invitado

  **Dependencias:** 12, 13 · **Alcance:** M

### Checkpoint 3

- [ ] El entrenador invita y el invitado entra, por los dos caminos
- [ ] No existe forma de crear una cuenta sin invitación
- [ ] Revisión antes de seguir

## Fase 4 · Gestión

- [x] **Tarea 15: Perfil propio** — hecha 2026-09-16. La foto se traslada a seguimiento-corporal

  Ver y editar nombre, apellidos, teléfono, fecha de nacimiento y foto. Vale para
  los cuatro roles.

  > Partida en dos rebanadas. **La primera está hecha**: los datos de texto, de
  > punta a punta, con pantalla en la app y once casos de prueba.
  >
  > **La foto sale de esta tarea** (decidido el 2026-09-16 con David). El problema
  > real no es la foto de perfil sino las de evolución corporal, que son datos de
  > salud, pesan mucho más y exigen enlaces firmados. Entra con el módulo
  > `seguimiento-corporal`. Montar el almacenamiento dos veces es trabajo tirado.
  > Ver [ADR 0005](../docs/adr/0005-almacenamiento-de-fotos.md).

  **Aceptación**
  - Cada usuario ve y edita solo su perfil
  - Un intento de editar el perfil de otro deniega, incluso siendo entrenador

  **Verificación**
  - Tests de acceso propio y ajeno

  **Dependencias:** 9 · **Alcance:** M

- [x] **Tarea 16: Listado de clientes** — hecha 2026-09-16

  Pantalla del entrenador con la lista de sus clientes y búsqueda por nombre.

  > Solo lista clientes. El nutricionista y el empleado se administran desde sus
  > propias pantallas (tareas 17 y 18): mezclarlos convertiría la lista de trabajo
  > diario en un listín de todo el mundo.
  >
  > La respuesta lleva `total` además de las filas, y la pantalla dice "mostrando
  > 5 de 12" cuando no caben todos. Una lista cortada en silencio es de los fallos
  > que más tardan en descubrirse.
  >
  > La búsqueda ignora mayúsculas pero **no ignora tildes**: buscar "Garcia" no
  > encuentra a "García". Con una cartera de decenas de personas se resuelve
  > mirando la lista, así que no compensa todavía una columna normalizada.
  >
  > De paso se separó el 403 del 401 en el cliente de la app (`ErrorDePermiso`
  > frente a `ErrorDeSesion`). Tenían consecuencias opuestas y estaban mezclados:
  > ante un 401 hay que descartar la credencial guardada y ante un 403 no.

  **Aceptación**
  - Solo el entrenador accede
  - Búsqueda por nombre y apellidos
  - La lista distingue los tres estados a simple vista: pendiente, activo y
    desactivado. Ver quién no ha activado todavía es información que el entrenador
    necesita para perseguirlo

  **Verificación**
  - Test de denegación para los otros tres roles
  - Prueba manual con al menos diez clientes de prueba

  > Catorce casos en `apps/api/test/listado-usuarios.e2e-spec.ts`: denegación a los
  > otros tres roles y sin sesión, los tres estados, búsqueda por nombre, apellidos
  > y correo, filtros de rol y estado, límite con total honesto, filtros mal
  > formados y búsqueda sin resultados.
  >
  > Prueba manual hecha con doce clientes en la base local: lista completa,
  > búsqueda, filtro de pendientes, aviso de lista recortada, y un cliente que
  > fuerza la ruta y recibe "esta pantalla es solo para el entrenador".

  **Dependencias:** 12 · **Alcance:** M

- [x] **Tarea 17: Alta, edición y desactivación de cliente** — hecha 2026-09-16

  > **Agujero encontrado y cerrado.** `activar` escribía estado `activo` sin mirar
  > el estado anterior, así que dar de baja a alguien que seguía pendiente no
  > servía de nada: le bastaba abrir el correo que ya tenía. Ahora la baja quema
  > los enlaces vivos y, además, activar solo activa a quien está pendiente. Dos
  > defensas, cada una con su test.
  >
  > **La baja son tres escrituras en una transacción**: estado, revocar las
  > sesiones vivas y quemar los enlaces. Sin las dos últimas el código parece
  > correcto porque el guard ya corta el acceso al leer el estado, y el fallo no
  > aparece hasta que alguien reactiva la cuenta y le resucitan las sesiones.
  >
  > **Reactivar entra en el alcance** (decidido con David el 2026-09-16). El
  > estado se deriva de si hay contraseña: quien nunca activó vuelve a pendiente,
  > no a activo. Ponerlo activo sin contraseña dejaría a esa persona encerrada
  > fuera, sin poder entrar ni recibir un enlace nuevo.
  >
  > **Corregir el correo entra también** (misma conversación), acotado a quien
  > sigue pendiente. Un correo mal tecleado en el gimnasio deja una cuenta que no
  > recibe nada y que no se puede borrar. En cuanto alguien entra con esa
  > dirección, cambiarla sería cambiarle la identidad.
  >
  > El diseño salió de una revisión con siete agentes sobre la spec y el código:
  > tres leyendo, tres proponiendo con lentes distintas y uno sintetizando.

  **Aceptación**
  - El alta reutiliza el endpoint de la tarea 12, no abre una vía paralela
  - Se puede reenviar el enlace de activación a quien sigue pendiente
  - La desactivación impide entrar pero conserva todo el histórico
  - **No existe borrado duro de clientes**

  **Verificación**
  - Test de que un cliente desactivado no puede iniciar sesión
  - Test de que sus datos siguen existiendo después de desactivarlo
  - Test de que el reenvío invalida el enlace anterior

  > Treinta y dos casos en `apps/api/test/gestion-clientes.e2e-spec.ts` y siete
  > unitarios en `usuarios.service.spec.ts`. Las tres verificaciones exigidas
  > están, y además: la baja mirada en la base y no solo por el 401, el enlace
  > quemado, un token de refresco anterior a la baja que sigue muerto tras
  > reactivar, los quince casos de denegación por rol, el actor que no se
  > administra a sí mismo, y que el login de un desactivado responde exactamente
  > lo mismo que un correo inexistente.
  >
  > Los dos tests que más importan se comprobaron rompiendo el código a
  > propósito: quitar la revocación de sesiones y quitar el quemado de enlaces
  > ponen cada uno su test en rojo. Un test que no falla cuando el código está mal
  > no es una verificación, es decoración.
  >
  > Prueba manual completa en el móvil: alta, corrección de correo mal tecleado,
  > edición, baja con confirmación, reactivación, y la lista actualizándose al
  > volver. El reenvío se probó contra Resend en modo de pruebas: rechazó la
  > dirección falsa y la pantalla dijo la verdad en lugar de fingir que salió.

  **Dependencias:** 16 · **Alcance:** M

- [x] **Tarea 18: Asignación al nutricionista** — hecha 2026-09-16

  Pantalla donde el entrenador marca qué clientes ve el nutricionista.

  > **Un interruptor por cliente.** El nutricionista está subcontratado: no ve
  > nada por defecto y el entrenador le va dando acceso persona a persona. La
  > pantalla dice en voz alta a cuántos ve de cuántos.
  >
  > **Retirar corta en la petición siguiente**, sin cerrar sesión ni esperar a
  > que caduque nada, porque el alcance se consulta contra la tabla en cada
  > petición. Hay un test que lo demuestra con el mismo token antes y después.
  >
  > **El alta del nutricionista entra aquí**, que es donde se dijo en la tarea 16
  > al dejar el alta acotada a clientes. La pantalla de reparto lo ofrece cuando
  > todavía no existe, porque sin su perfil no hay a quién asignar nada. No hay
  > selector libre de rol: un desplegable con "entrenador" dentro sería una vía
  > cómoda para crear un segundo administrador sin querer.
  >
  > **Dar de baja a un cliente NO borra su asignación.** Borrarla perdería el
  > rastro de quién tuvo acceso a los datos de salud de quién. La consecuencia es
  > que el nutricionista sigue viendo a un cliente dado de baja: queda anotado en
  > `docs/PENDIENTE-PARA-PRODUCCION.md` (9d) como la fuga más plausible del
  > módulo, y filtrarlo exige decidir antes si un histórico de bajas se consulta
  > o no.
  >
  > **Sin migración.** Retirar borra la fila en lugar de cerrarla con una fecha,
  > porque añadir `hasta` al modelo es cambio de esquema y eso se pregunta antes.
  > Queda la traza en el log con quién, a quién y cuándo, solo identificadores.

  **Aceptación**
  - Solo el entrenador asigna
  - Quitar una asignación corta el acceso de inmediato
  - El nutricionista ve su lista de asignados y nada más

  **Verificación**
  - Test de que retirar la asignación deniega en la siguiente petición
  - Prueba manual con dos cuentas abiertas a la vez

  > Diecisiete casos en `apps/api/test/asignaciones.e2e-spec.ts`: denegación a
  > los otros tres roles en las tres rutas, un nutricionista que no puede mirar
  > la lista de otro, asignar e idempotencia, y el caso que manda, que retirar
  > deniega en la petición siguiente con el mismo token.
  >
  > Comprobado rompiendo el código: si retirar no borra la fila, ese test y el de
  > "retirar a uno no toca al otro" se ponen en rojo.
  >
  > Prueba manual con las dos cuentas a la vez: con el nutricionista dentro de la
  > app, el entrenador le retiró un cliente y la siguiente pantalla del
  > nutricionista ya no lo incluía.

  **Dependencias:** 10, 16 · **Alcance:** M

### Checkpoint 4

- [ ] El entrenador administra su cartera completa desde el móvil
- [ ] El nutricionista ve exactamente a sus asignados
- [ ] Revisión antes de seguir

## Fase 5 · Cumplimiento

- [ ] **Tarea 19: Consentimiento de datos de salud**

  Pantalla de consentimiento explícito en el primer acceso del cliente, y bloqueo
  en el servidor mientras no esté dado.

  **Aceptación**
  - Se registra fecha, hora y versión del texto aceptado
  - **Sin consentimiento registrado, el servidor rechaza guardar peso, medidas,
    pliegues o fotos**
  - Cambiar la versión del texto vuelve a pedirlo
  - El consentimiento se puede retirar

  **Verificación**
  - Test de que guardar un peso sin consentimiento deniega
  - Test de que con consentimiento sí guarda

  **Dependencias:** 15 · **Alcance:** M

- [x] **Tarea 20: Recuperación de contraseña** — hecha 2026-09-17

  > **La API no la escribí yo.** Me encontré el servicio, la migración y sus
  > catorce casos de prueba sin commitear en el árbol de trabajo, hechos por otra
  > sesión trabajando en la misma carpeta mientras yo estaba parado por el límite
  > de uso. Los verifiqué, no los firmo: ver el commit `e157d50`.
  >
  > **La mitad móvil sí es mía**: enlace de "he olvidado mi contraseña" en el
  > login, pantalla para pedir el enlace y pantalla donde aterriza el correo.
  > Según la regla del propio plan, la tarea no está hecha sin la pantalla.
  >
  > La pantalla dice lo mismo exista o no la cuenta, igual que el servidor.
  > Contestar "ese correo no está registrado" sería cómodo y convertiría la
  > pantalla en un buscador de quién es cliente del entrenador.

  **Aceptación**
  - Token de un solo uso que caduca en una hora
  - La respuesta es idéntica exista o no el correo
  - Cambiar la contraseña revoca todos los tokens de refresco de ese usuario

  **Verificación**
  - Tests de token válido, usado, caducado e inventado
  - Test de que las sesiones abiertas se cierran al cambiar la contraseña

  > Catorce casos en `apps/api/test/recuperacion.e2e-spec.ts`, incluidos los
  > cuatro tipos de enlace, dos solicitudes simultáneas dejando uno solo vivo,
  > dos canjes simultáneos consumiéndolo una vez, que activación y recuperación
  > no se aceptan los tokens cruzados, y que cambiar la contraseña cierra las
  > sesiones abiertas incluida la ventana de gracia de los tokens ya rotados.
  >
  > Prueba manual de las pantallas: pedir el enlace deja el mensaje que no
  > confirma si la cuenta existe, y un enlace inventado responde "este enlace ya
  > no vale" sin distinguir si está gastado, caducado o nunca existió.

  **Dependencias:** 11, 7 · **Alcance:** M

- [ ] **Tarea 21: Borrado a petición**

  **Aceptación**
  - Anonimiza los datos personales y elimina los de salud
  - El histórico agregado no identificable sobrevive
  - La acción queda registrada con fecha
  - Requiere confirmación explícita del titular, no basta con un botón

  **Verificación**
  - Test de que tras el borrado no queda ningún dato de salud del usuario
  - Test de que los entrenos agregados siguen contando

  **Dependencias:** 19 · **Alcance:** M

### Checkpoint final

- [ ] Los trece criterios de éxito de `SPEC-identity.md` tienen su test y pasa
- [ ] Cobertura por encima del 80% en servicios y guardas
- [ ] `npm run test`, `npm run lint` y `npm run typecheck` limpios
- [ ] Revisión antes de abrir el módulo siguiente
