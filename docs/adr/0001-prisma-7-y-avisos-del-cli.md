# ADR 0001: Prisma 7.10 y los avisos de seguridad de su CLI

- **Fecha:** 2026-09-12
- **Estado:** aceptado
- **Contexto:** tarea 2 del plan de `identity`

## Contexto

Al instalar Prisma aparecieron dos problemas encadenados.

El primero: el tag `latest` del paquete `prisma` apunta hoy a una _release
candidate_ de la versión 8, mientras que `@prisma/client` sigue en la 7.10.0
estable. Como el cliente declara el CLI en `peerDependencies` con comodín
(`"prisma": "*"`), npm resuelve ese comodín contra `latest` y mete la RC en el
árbol. Resultado: CLI de la 8 en pruebas contra cliente de la 7.

El segundo: `npm audit` reporta cuatro avisos de severidad alta, todos dentro de
la cadena de dependencias del CLI.

| Aviso          | Llega por        | Qué es                                        |
| -------------- | ---------------- | --------------------------------------------- |
| `mysql2` (dos) | `prisma`         | Fuga de credenciales y bomba de descompresión |
| `deepmerge-ts` | `@prisma/config` | Agotamiento de pila con grafos recursivos     |

## Decisión

Fijar `prisma` en `^7.10.0` como devDependency **de la raíz** del monorepo, no del
workspace de la API. Aceptar los cuatro avisos sin silenciarlos.

Se probó antes la vía de `overrides` en la raíz. Funcionaba para la versión, pero
npm dejaba de instalar las dependencias propias del CLI y `@prisma/config` no
llegaba a aparecer, con lo que el binario no arrancaba. Por eso se descartó.

## Razón

Sobre la versión: subir el CLI a la raíz hace que el comodín del cliente se
satisfaga con el paquete ya presente en lugar de ir a buscar `latest`. Es la
solución que no pelea con el gestor de paquetes.

Sobre los avisos, los cuatro viven en una herramienta de desarrollo:

- `mysql2` viene dentro del CLI para dar soporte a MySQL. Este proyecto usa
  PostgreSQL, así que ese código no se ejecuta nunca.
- `deepmerge-ts` lo usa `@prisma/config` para leer configuración local.
- **Ninguno de los dos viaja al servidor desplegado.** El CLI es una herramienta
  que corre en la máquina de desarrollo para generar migraciones y el cliente. Lo
  que se despliega es `@prisma/client`, que no depende de ninguno de ellos.
- El arreglo que propone `npm audit fix --force` es instalar `prisma@6.19.3`, un
  salto de versión mayor hacia atrás que rompería el esquema.

## Consecuencias

- `npm audit` va a seguir avisando. No se silencia. Quien lo ejecute encuentra
  este documento y sabe por qué siguen ahí.
- Hay que revisarlo cuando Prisma 8 sea estable, momento en el que probablemente
  desaparezcan solos.
- Si algún día el proyecto necesitara MySQL, esta decisión deja de valer.
