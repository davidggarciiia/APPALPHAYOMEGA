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

| Variable                                       | Producción                                                                                                           |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                     | `production`                                                                                                         |
| `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_*` | Los de la base gestionada. La contraseña solo aquí                                                                   |
| `JWT_SECRET`                                   | Nuevo, aleatorio y largo (`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`)          |
| `CORS_ORIGENES`                                | Vacío si solo se usa la app nativa. Con la versión web, su dirección `https://…`                                     |
| `RESEND_API_KEY`, `CORREO_REMITENTE`           | Clave de Resend y remitente del dominio verificado                                                                   |
| `ACTIVACION_URL_BASE`                          | El enlace universal del dominio, no `alphaomega://` (punto 1b de PENDIENTE)                                          |
| `ALMACEN`                                      | `s3`. Es obligatoria con `NODE_ENV=production`: la API no arranca sin decidirlo                                      |
| `S3_BUCKET`, `S3_REGION`                       | Bucket privado y su región de la UE                                                                                  |
| `S3_ENDPOINT`, `S3_FORZAR_RUTA`                | Solo para compatibles distintos de AWS; `S3_FORZAR_RUTA=true` si el proveedor pide rutas `endpoint/bucket`           |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`     | Una clave con permiso solo sobre ese bucket (leer, escribir y borrar objetos). Sin ellas, credenciales de la máquina |
| `MEDIOS_DIR`                                   | Carpeta privada del servidor con las figuras importadas, fuera de cualquier ruta pública                             |
| `API_PORT`                                     | El puerto interno detrás del proxy HTTPS                                                                             |

`ALMACEN=local` solo tiene sentido en desarrollo. Guarda las fotos en el disco
del servidor, así que se pierden al reinstalarlo y no tienen copia.

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

## Primera instalación

Desde una copia limpia del repositorio, en el servidor o en la máquina que
construye:

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
aditivas. Cada una tiene su SQL de marcha atrás en `apps/api/prisma/rollback/`,
que solo se aplica a mano tras una copia de seguridad.

### 2. Cuenta del entrenador

```bash
npm run seed --workspace apps/api
```

Crea **solo** la cuenta del entrenador con `SEED_ENTRENADOR_EMAIL` y
`SEED_ENTRENADOR_PASSWORD`. Si ya existe no la toca. Después, quita
`SEED_ENTRENADOR_PASSWORD` del entorno y cambia la contraseña con «He olvidado
mi contraseña». El resto de cuentas nace por invitación desde la app.

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
