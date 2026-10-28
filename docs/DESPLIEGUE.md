# Despliegue en producción

> Guía para poner en marcha la API, la base de datos, las fotos privadas y las
> figuras de los ejercicios en un servidor, y para compilar la app. Lo que no se
> resuelve con código (dominio, cuentas de tienda, revisión legal, proveedor)
> está en [PENDIENTE-PARA-PRODUCCION.md](PENDIENTE-PARA-PRODUCCION.md). Léelo
> antes de invitar a un cliente real.

## Qué hace falta

| Pieza                     | Requisito                                                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Servidor de la API        | Node.js 22 o superior (`engines` de `package.json`), detrás de HTTPS                                                       |
| Base de datos             | PostgreSQL 17, en la Unión Europea, con copias diarias cifradas                                                            |
| Fotos privadas            | Un bucket compatible con S3 en la UE, **privado**, con cifrado en reposo ([ADR 0005](adr/0005-almacenamiento-de-fotos.md)) |
| Correo                    | Resend con el dominio verificado (punto 1 de PENDIENTE)                                                                    |
| Figuras de los ejercicios | Los paquetes gratuitos de Vital Free50 y MoveKit ([animaciones-ejercicios.md](animaciones-ejercicios.md))                  |

Todas las cuentas se abren **a nombre del entrenador** (punto 5 de PENDIENTE).

## Variables de entorno del servidor

En el servidor no hay `.env`: las variables se definen en el propio servicio.
`.env.example` documenta todas. Estas son las que cambian respecto a desarrollo:

| Variable                                       | Producción                                                                                                                      |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                     | `production`                                                                                                                    |
| `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_*` | Los de la base gestionada. La contraseña solo aquí                                                                              |
| `PGSSLMODE`                                    | `verify-full`, obligatorio de forma explícita en producción; verifica el certificado y el nombre del servidor                   |
| `PGSSLROOTCERT`                                | Solo si el proveedor usa una CA propia: ruta absoluta a su certificado PEM en el servidor                                       |
| `PG_CONNECT_TIMEOUT_MS`, `PG_QUERY_TIMEOUT_MS` | Opcionales. Plazo de conexión (10 000) y de consulta (30 000); ver «Plazos de la base» más abajo                                |
| `PG_IDLE_TIMEOUT_MS`, `PG_POOL_MAX`            | Opcionales. Inactividad de una conexión (30 000) y tamaño del pool (10). Ajustar al límite de conexiones del plan contratado    |
| `SALUD_PLAZO_MS`                               | Opcional. Plazo de la sonda `/salud` antes de responder 503 (3 000)                                                             |
| `JWT_SECRET`                                   | Nuevo, aleatorio y de al menos 32 caracteres (`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`) |
| `CORS_ORIGENES`                                | Vacío si solo se usa la app nativa. Con la versión web, su dirección `https://…`                                                |
| `RESEND_API_KEY`, `CORREO_REMITENTE`           | Clave de Resend y remitente del dominio verificado                                                                              |
| `CORREO_PLAZO_MS`                              | Opcional. Plazo máximo de un envío antes de darlo por fallido (15 000)                                                          |
| `ACTIVACION_URL_BASE`                          | `https://alphayomegatraining.com/activar`, obligatorio en producción (punto 1b de PENDIENTE)                                    |
| `RECUPERACION_URL_BASE`                        | `https://alphayomegatraining.com/restablecer`, obligatorio en producción (punto 1b de PENDIENTE)                                |
| `ALMACEN`                                      | `s3`. Con `NODE_ENV=production` se rechazan tanto la ausencia como `local`                                                      |
| `S3_BUCKET`, `S3_REGION`                       | Bucket privado y su región de la UE                                                                                             |
| `S3_ENDPOINT`, `S3_FORZAR_RUTA`                | Solo para compatibles distintos de AWS; `S3_FORZAR_RUTA=true` si el proveedor pide rutas `endpoint/bucket`                      |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`     | Una clave con permiso solo sobre ese bucket (leer, escribir y borrar objetos). Sin ellas, credenciales de la máquina            |
| `MEDIOS_DIR`                                   | Carpeta privada del servidor con las figuras importadas, fuera de cualquier ruta pública                                        |
| `API_PORT`                                     | El puerto interno detrás del proxy HTTPS                                                                                        |

`ALMACEN=local` solo tiene sentido en desarrollo. Guarda las fotos en el disco
del servidor, así que se pierden al reinstalarlo y no tienen copia.

Las bases de activación y recuperación no admiten query, fragmentos ni credenciales.
La API rechaza también un secreto JWT corto y el remitente de pruebas de Resend
en producción, y exige la clave del correo al arrancar. Estas guardas no verifican
DNS, entrega de correo, asociación del dominio con la app ni permisos del bucket:
esas comprobaciones se hacen en la instalación real.

La misma configuración TLS se usa en API, seed, importadores y migraciones.
Para el adaptador `pg` se usa `sslmode=verify-full`; para el motor nativo de
Prisma Migrate se traduce a `sslmode=require&sslaccept=strict`, los parámetros
admitidos por ese motor. La CA de `PGSSLROOTCERT` se pasa como `sslrootcert` al
adaptador y como `sslcert` al motor de migraciones. No se desactiva la verificación
de certificados.
Si la CA del proveedor no está en el almacén de confianza, despliega su PEM y
configura `PGSSLROOTCERT`; un error de certificado debe corregirse con el nombre
o la CA adecuados. Desarrollo y pruebas locales siguen usando `disable` por
defecto. Referencias: [TLS de Prisma](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql)
y [modos TLS de PostgreSQL](https://www.postgresql.org/docs/current/libpq-ssl.html).

### Plazos de la base

La API abre el pool con plazos para que una base que no responde no retenga
peticiones: `PG_CONNECT_TIMEOUT_MS` limita la conexión; `PG_QUERY_TIMEOUT_MS`
fija el `statement_timeout` que aplica el servidor (cancela la consulta y libera
la conexión) y el cliente añade un respaldo 5 s superior por si el servidor ya no
contesta. `/salud` tiene su propio plazo (`SALUD_PLAZO_MS`) y responde 503 aunque la
consulta no vuelva. Un valor que no sea un entero positivo impide arrancar.

- Los scripts de carga (seed, catálogo) y las migraciones **no** aplican estos plazos
  a propósito: sus consultas largas son esperadas.
- `statement_timeout` viaja como parámetro de arranque de la conexión. Un pooler
  externo en modo transacción (p. ej. PgBouncer) puede rechazarlo salvo que lo
  permita en `ignore_startup_parameters`. Es una inferencia sobre el proveedor, no
  una prueba: se ensaya con el proveedor elegido antes de publicar.
- Los valores por defecto son holgados y no están medidos en el alojamiento real;
  hay que ajustarlos tras la prueba de capacidad (ver PENDIENTE-PARA-PRODUCCION).

### El bucket de fotos

- Sin acceso público ni listado público. La API solo entrega enlaces firmados
  de 15 minutos para subir y de 5 minutos para ver. No guarda ninguna URL.
- La subida firma el tipo y el tamaño declarados. Al confirmarla, la API
  vuelve a leer el objeto, comprueba el formato real y quita los metadatos
  (ubicación, cámara) antes de darla por buena.
- Si se usa la versión web, el bucket necesita CORS para ese origen con `PUT`
  y `GET` y la cabecera `Content-Type`. La app nativa no lo necesita.
- Las subidas que nunca se confirman las borra la propia API
  (`limpieza-medios.ts`).
- La confirmación escribe una clave nueva por intento; ningún enlace de subida
  apunta a la foto final. Aplicar `20260924210000_intentos_foto` antes de iniciar
  esta versión. Las copias fallidas quedan registradas para reintento, y los
  temporales se eliminan al confirmar y después de caducar el enlace.
- Mantener activa la limpieza (`MEDIOS_LIMPIEZA_MINUTOS`, 60 por defecto).
  Ensayar con el proveedor real el PUT repetido, la respuesta perdida, el
  borrado fallido y la escritura tardía. La retención/ciclo de vida del bucket
  sigue pendiente de configuración: **no** aplicar una regla de expiración al
  prefijo general `clientes/`, que también contiene las fotos confirmadas.
  Véanse los límites y la transición de enlaces antiguos en el ADR 0005.

## Primera instalación

Desde una copia limpia del repositorio, en el servidor o en la máquina que
construye:

Usar Node compatible con `engines` de la raíz (22.22.3+, 24.15+ o 26+) y
npm 10.9.4. `npm ci` aplica el parche de compatibilidad de Expo antes de
compilar y genera Prisma; no omitir sus scripts sin ejecutar después
`npm run prepare`. Ver [parches de dependencias](../patches/README.md).

```bash
npm ci
npm run build:shared
npx prisma generate
npm run build --workspace apps/api
```

### 1. Base de datos

```bash
npx prisma migrate deploy
```

Solo `migrate deploy`. **Nunca** `migrate dev`, `migrate reset` ni `db:reset`
contra producción, porque borran o reescriben datos. Todas las migraciones son
aditivas. Los scripts disponibles en `apps/api/prisma/rollback/` solo se aplican
a mano tras una copia de seguridad. No hay que retirar la tabla `intentos_foto`
al revertir una versión: conserva la información necesaria para limpiar copias
fallidas y operaciones de almacenamiento que puedan terminar tarde.

### 2. Cuenta del entrenador

```bash
npm run seed --workspace apps/api
```

Crea **solo** la cuenta del entrenador con `SEED_ENTRENADOR_EMAIL` y
`SEED_ENTRENADOR_PASSWORD`. Si ya existe no la toca. Después, quita
`SEED_ENTRENADOR_PASSWORD` del entorno y cambia la contraseña con «He olvidado
mi contraseña». El resto de cuentas nace por invitación desde la app.
El seed valida el correo y exige la misma contraseña de al menos diez caracteres
que la activación. Si ese correo pertenece a otro rol, aborta sin modificarlo.

### 3. Figuras y catálogo inicial

Las figuras no están en el repositorio: la licencia de Vital no deja
redistribuirlas. En cada servidor:

```bash
node apps/api/dist/catalogo-ejercicios/importar-medios.js --vital <carpeta Free50> --movekit <carpeta muestra>
node apps/api/dist/catalogo-ejercicios/preparar-catalogo.js
node apps/api/dist/catalogo-ejercicios/preparar-catalogo.js --confirmar
```

- El importador deja en `MEDIOS_DIR/figuras` cada clip a 720 px, sin audio y
  con su póster. Son unos 12 MB en total.
- `preparar-catalogo` sin `--confirmar` solo muestra la base destino y lo que
  haría. Con `--confirmar` crea los 52 ejercicios que falten, publicados y con
  su figura. No cambia ni borra lo que ya exista, y se puede repetir sin
  problema.
- Los textos son contenido inicial: el entrenador los edita desde la app.

### 4. Arrancar la API

```bash
node apps/api/dist/main.js
```

Con un gestor de procesos (systemd, el del proveedor o un contenedor) que la
reinicie si cae y le envíe `SIGTERM` para pararla. La API cierra la conexión
con la base y la limpieza de fotos antes de salir. Detrás de un proxy HTTPS.
`GET /salud` sirve de comprobación de vida.

Configura `API_PROXIES_CONFIABLES` con las direcciones IP o redes CIDR del proxy
que conecta con la API. Por ejemplo, `127.0.0.1/32,::1/128` si el proxy corre en
la misma máquina. Sin la variable se ignora `X-Forwarded-For`. La lista permite
que el límite de login distinga clientes detrás del proxy; no admite `true`,
número de saltos ni redes universales. Incluye solo los proxies de la instalación
y haz que sobrescriban la cabecera recibida del exterior. Limita el acceso al
puerto de la API a esos proxies.

La API añade `nosniff`, bloqueo de marcos, política de referencia, CSP restrictiva
y `Cache-Control: no-store` por defecto, también en errores de entrada. Los medios
conservan su política de caché explícita. HSTS se emite solo cuando la petición
llega por HTTPS o lo indica el proxy de confianza. Comprueba estas cabeceras
desde la URL pública, junto con la redirección de HTTP a HTTPS del proxy.

## Actualizar una instalación

1. Copia de seguridad de la base.
2. `npm ci`, `npm run build:shared`, `npx prisma generate` y el build de la API.
3. `npx prisma migrate deploy`.
4. Reiniciar la API.
5. `preparar-catalogo.js` solo si el catálogo inicial ha cambiado. Lo que ya
   exista no se toca.

## La app

La dirección de la API se fija en tiempo de compilación por perfil en
`apps/mobile/eas.json` (`EXPO_PUBLIC_API_URL`). Una compilación de release se
niega a arrancar con una dirección sin `https` o de una red privada.

```bash
cd apps/mobile
npx eas build --profile production --platform all
```

Necesita las cuentas de Apple y Google del entrenador (punto 2 de PENDIENTE).
Los textos de permisos de cámara y fotos están en `app.json`. Antes de enviar a
revisión hay que probar en un teléfono real lo que no cubren las pruebas
automáticas: cámara, galería, permisos denegados y subidas con mala cobertura
(`tasks/todo.md`, Q03).

## Copias de seguridad y datos de salud

- Base: copia diaria cifrada, en la UE, con restauración probada al menos una
  vez antes de tener clientes.
- Fotos: activa el versionado del bucket o una réplica en la UE, según el
  proveedor.
- Nunca copies datos reales, fotos o contraseñas a entornos de prueba, logs ni
  servicios externos. Las pruebas usan datos sintéticos y una base propia.

## Herramientas de recorridos y reversión

Los scripts históricos `tasks/iteracion-3/recorrido-f09.mjs` y `recorrido-n12.mjs`
modifican y limpian sus cuentas sintéticas. Solo admiten bases cuyo nombre contiene
`_e2e_`, `_manual_`, `_test` (al final o seguido de `_`) o `_review_`, y abortan
si `NODE_ENV=production`. La API del recorrido debe apuntar a esa misma base.
Sus selfchecks, que no abren conexiones, se ejecutan con:

```bash
node --test tasks/iteracion-3/recorridos.spec.mjs
```

Los SQL de `prisma/rollback` no son un procedimiento de recuperación de una
instalación con clientes: varios eliminan registros o columnas y algunos solo
tienen una advertencia escrita. Conserva las migraciones aditivas y revierte el
binario cuando sea compatible; una reversión de datos necesita una migración
compensatoria revisada, copia previa y ensayo en una base desechable.

No hay una configuración de CI ni un servicio de alertas incluido en el repositorio.
Antes del lanzamiento, conecta los checks de calidad y las sondas a la plataforma
elegida y verifica alertas de disponibilidad, fallos y latencia. La existencia de
`GET /salud` por sí sola no acredita esa monitorización ni una restauración real.
