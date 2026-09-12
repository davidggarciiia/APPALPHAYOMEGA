# ADR 0003: Qué avisos de `npm audit` se aceptan y por qué

- **Fecha:** 2026-09-12
- **Estado:** aceptado
- **Sustituye parcialmente a:** [ADR 0001](0001-prisma-7-y-avisos-del-cli.md), que cubría dos de estos seis

## Contexto

Tras montar la app Expo, `npm audit` pasó de 4 avisos a 25. Los 25 se reducen a
**cinco paquetes con aviso propio**; el resto son sus cadenas de dependencias.

Aceptar veinticinco avisos a ojo en una app que guarda datos de salud no es
defendible. Cada uno se evaluó por separado contra este código concreto, y cada
veredicto tranquilizador pasó después por dos revisores cuyo encargo era
refutarlo. Ninguna refutación prosperó.

La pregunta en cada caso no fue "¿es grave el fallo?" sino "¿puede alguien llegar
hasta él desde aquí?".

## Veredictos

| Paquete                | Llega por                                 | Veredicto                        |
| ---------------------- | ----------------------------------------- | -------------------------------- |
| `decode-uri-component` | `expo-router` → `query-string`            | Código muerto en el binario      |
| `image-size`           | `react-native` → `metro`                  | Solo al construir                |
| `uuid`                 | `expo` → `@expo/config-plugins` → `xcode` | Solo al construir                |
| `deepmerge-ts`         | `prisma` (CLI) → `@prisma/config`         | Solo al construir                |
| `mysql2`               | `prisma` (CLI)                            | No se ejecuta: usamos PostgreSQL |

### El único que merecía investigarse en serio

`decode-uri-component` era distinto de los otros cuatro. Sí viaja dentro del
binario que se instala en el móvil del cliente, y la app declara el esquema
`alphaomega`, así que cualquiera puede lanzarle un enlace profundo con
percent-encoding malformado sin haber iniciado sesión. Entrada controlada por un
atacante, sin autenticación, contra datos de salud. El peor caso posible.

La investigación siguió la cadena entera y encontró que muere antes de llegar:

- El código caro de `decode-uri-component` solo se alcanza desde
  `queryString.parse()`.
- `expo-router` llama a `parse()` en exactamente dos sitios. Uno está
  **comentado** en su fork; el otro es la copia original de react-navigation,
  que el sistema de enlaces **no cablea**.
- El camino real del enlace profundo termina en `parseQueryParams`, que usa
  `URLSearchParams` nativo del motor JavaScript.

Es decir: el módulo está empaquetado, pero es código muerto. Expo lo sustituyó a
propósito y dejó la versión vieja comentada al lado.

**Esto deja de valer** si una versión futura de `expo-router` vuelve a cablear la
copia original, o si este proyecto importa `expo-router/build/react-navigation/core`
directamente. Hay que revisarlo al subir de SDK.

## Por qué no se arregla ninguno

No es pereza. En los cinco casos el arreglo hace más daño que el fallo:

- `decode-uri-component`: forzar la versión 0.4 cambiaría el formato de módulo
  y puede romper el empaquetado. `query-string@7` lo consume con `require()`.
- `image-size`: el aviso afecta a **todas** las versiones publicadas. No hay
  destino al que apuntar.
- `mysql2`: Prisma lo fija con versión exacta. Forzar otra lo rompe.
- `uuid` y `deepmerge-ts`: cambiarían dependencias internas de la cadena de
  compilación a cambio de nada.

Los avisos **no se silencian**. Quien ejecute `npm audit` los seguirá viendo y
encontrará este documento.

## Lo que sí se arregló

**Dos React Native en el árbol.** No es un aviso de seguridad, apareció en la
misma revisión. `apps/mobile` declara la 0.86.3, que es la que fija el SDK 57 de
Expo, pero npm instalaba además una 0.87.1 en la raíz al resolver por su cuenta
la veintena de dependencias de pares con comodín de los paquetes de Expo.

No llegaba al binario, porque `metro.config.js` tiene
`disableHierarchicalLookup` activado y busca primero en `apps/mobile`. Pero esa
línea era lo único que lo impedía: quitarla convertía el problema en un fallo de
ejecución inmediato.

Arreglado fijando hacia abajo en los `overrides` de la raíz, a la versión que el
SDK dicta. **No hacia arriba**: la 0.87.1 es la intrusa, no la buena.

**`multer`.** Venía en 2.2.0 con cuatro avisos de denegación de servicio, y viaja
al servidor dentro del adaptador de Express de NestJS. Se forzó a 2.3.0, que los
corrige. Ese sí se arregló porque tenía arreglo.

## Cuándo revisar esto

- Al subir el SDK de Expo, sobre todo en un salto mayor.
- Al subir Prisma a la 8 estable.
- Antes de publicar en tiendas.
- Si el proyecto empieza a leer parámetros de rutas dinámicas en la app, cosa que
  ocurrirá con las dieciséis pantallas del mapa de capacidades.
