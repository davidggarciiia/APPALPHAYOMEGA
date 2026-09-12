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

### Checkpoint 0

- [ ] Tests pasan, typecheck limpio
- [ ] La app en un móvil real habla con la API de tu máquina
- [ ] Revisión antes de seguir

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

- [ ] **Tarea 8: Pantalla de login y sesión persistente**

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

### Checkpoint 1

- [ ] El entrenador entra desde un móvil real y la sesión sobrevive a cerrar la app
- [ ] Todos los tests pasan
- [ ] Revisión antes de seguir

## Fase 2 · Permisos

- [ ] **Tarea 9: Matriz de roles con tests de denegación**

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

- [ ] **Tarea 10: Alcance por asignación del nutricionista**

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

- [ ] Los cuatro roles están separados y demostrado por tests
- [ ] Un endpoint nuevo sin regla deniega
- [ ] Revisión antes de seguir

## Fase 3 · Invitaciones

- [ ] **Tarea 11: Envío de correo**

  Integrar Resend. Antes de empezarla hay que verificar el dominio
  `alphayomegatraining.com` en su panel añadiendo los registros DNS, porque la
  propagación tarda y no depende de ti.

  **Aceptación**
  - Un servicio de correo inyectable con una implementación real y otra falsa
    para los tests
  - Las credenciales van en `.env`, nunca en el repositorio
  - Los tests usan la implementación falsa y no envían nada de verdad

  **Verificación**
  - Un envío real llega a una bandeja de entrada
  - Los tests pasan sin red

  **Dependencias:** 3, y la decisión de la pregunta abierta 1 · **Alcance:** S

- [ ] **Tarea 12: Alta directa y activación con contraseña**

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

- [ ] **Tarea 13: Prueba de humo de Google**

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

- [ ] **Tarea 14: Aceptar invitación con Google**

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

- [ ] **Tarea 15: Perfil propio**

  Ver y editar nombre, apellidos, teléfono, fecha de nacimiento y foto. Vale para
  los cuatro roles.

  **Aceptación**
  - Cada usuario ve y edita solo su perfil
  - Un intento de editar el perfil de otro deniega, incluso siendo entrenador
  - La foto se sube y se sirve desde el almacenamiento de archivos

  **Verificación**
  - Tests de acceso propio y ajeno
  - Prueba manual de subir foto desde el móvil

  **Dependencias:** 9 · **Alcance:** M

- [ ] **Tarea 16: Listado de clientes**

  Pantalla del entrenador con la lista de sus clientes y búsqueda por nombre.

  **Aceptación**
  - Solo el entrenador accede
  - Búsqueda por nombre y apellidos
  - La lista distingue los tres estados a simple vista: pendiente, activo y
    desactivado. Ver quién no ha activado todavía es información que el entrenador
    necesita para perseguirlo

  **Verificación**
  - Test de denegación para los otros tres roles
  - Prueba manual con al menos diez clientes de prueba

  **Dependencias:** 12 · **Alcance:** M

- [ ] **Tarea 17: Alta, edición y desactivación de cliente**

  **Aceptación**
  - El alta reutiliza el endpoint de la tarea 12, no abre una vía paralela
  - Se puede reenviar el enlace de activación a quien sigue pendiente
  - La desactivación impide entrar pero conserva todo el histórico
  - **No existe borrado duro de clientes**

  **Verificación**
  - Test de que un cliente desactivado no puede iniciar sesión
  - Test de que sus datos siguen existiendo después de desactivarlo
  - Test de que el reenvío invalida el enlace anterior

  **Dependencias:** 16 · **Alcance:** M

- [ ] **Tarea 18: Asignación al nutricionista**

  Pantalla donde el entrenador marca qué clientes ve el nutricionista.

  **Aceptación**
  - Solo el entrenador asigna
  - Quitar una asignación corta el acceso de inmediato
  - El nutricionista ve su lista de asignados y nada más

  **Verificación**
  - Test de que retirar la asignación deniega en la siguiente petición
  - Prueba manual con dos cuentas abiertas a la vez

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

- [ ] **Tarea 20: Recuperación de contraseña**

  **Aceptación**
  - Token de un solo uso que caduca en una hora
  - La respuesta es idéntica exista o no el correo
  - Cambiar la contraseña revoca todos los tokens de refresco de ese usuario

  **Verificación**
  - Tests de token válido, usado, caducado e inventado
  - Test de que las sesiones abiertas se cierran al cambiar la contraseña

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
