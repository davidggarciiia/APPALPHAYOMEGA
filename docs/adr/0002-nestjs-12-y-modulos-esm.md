# ADR 0002: NestJS 12 obliga a que la API sea ESM

- **Fecha:** 2026-09-12
- **Estado:** aceptado
- **Contexto:** tarea 3 del plan de `identity`

## Contexto

NestJS 12 se publicó el 27 de agosto de 2026 y sus paquetes declaran
`"type": "module"`. Son solo ESM: no hay salida CommonJS.

La primera configuración de la API era CommonJS y los tests fallaban antes de
ejecutar nada, porque Jest intentaba cargar NestJS con `require()` y se
encontraba sintaxis de módulos. Jest solo puede hacer ese puente de forma nativa
en Node 24.9 o superior, y la máquina de desarrollo tiene Node 22.

Se evaluaron tres salidas: bajar a NestJS 11, que es CommonJS y lleva veinte
meses estable; mantener la 12 e instalar Node 24; o mantener la 12 y cambiar Jest
por un ejecutor que entienda ESM de forma nativa.

## Decisión

Mantener NestJS 12 y convertir `apps/api` a ESM. Sin cambiar la versión de Node
y sin cambiar de ejecutor de tests.

## Consecuencias

Cuatro cosas cambian para siempre en este workspace.

**Los imports relativos llevan `.js`**, aunque el fichero de origen sea `.ts`.
Con `moduleResolution: NodeNext` la extensión describe lo que existirá después de
compilar, no lo que hay ahora. Se escribe `from "./salud.service.js"` apuntando a
`salud.service.ts`. Es la regla que más sorprende al llegar.

**Jest necesita tres ajustes** que están comentados en `jest.config.mjs`:
tratar los `.ts` como ESM, decirle a ts-jest que compile a módulos, y un mapeo
que quite el `.js` de los imports para que encuentre el fichero `.ts` real.
Además se ejecuta con `--experimental-vm-modules`, que es como Node habilita
módulos ESM dentro del entorno aislado de Jest.

**`process.loadEnvFile()` no sirve dentro de Jest.** Escribe en el proceso real,
y Jest ejecuta cada test en un contexto aislado con su propio objeto `process`.
Las variables se cargaban y el test no las veía. Por eso
`apps/api/src/config/postgres.ts` lee y asigna el fichero a mano en lugar de usar
esa función. Son quince líneas y funcionan en los tres puntos de entrada.

**`isolatedModules: true`** en el tsconfig, exigido por ts-jest al compilar con
NodeNext. Implica que cada fichero se transpila sin ver el resto del programa, lo
que prohíbe algunos usos de `const enum` y obliga a marcar los reexportes de tipos
con `export type`.

## Lo que se descartó y por qué

**Bajar a NestJS 11** era la opción con menos fricción y estuvo elegida durante
un momento. Se descartó por decisión del autor: empezar un proyecto de años una
versión mayor por detrás obliga a una migración futura sobre código ya escrito.

**Instalar Node 24** habría permitido que Jest cargara ESM con `require()`, pero
eso es un puente de interoperabilidad, no una solución: el código seguiría siendo
CommonJS hablando con librerías ESM. Convertir la API a ESM es ir en la dirección
a la que se mueve todo el ecosistema.

**Cambiar a otro ejecutor de tests** contradice `SPEC.md`, que fija Jest en los
dos lados precisamente para aprender una sola herramienta, y Expo lo trae de
fábrica en la app móvil.

## Nota para la app móvil

Esta decisión afecta solo a `apps/api`. Expo y Metro tienen su propio sistema de
módulos y la tarea 4 no hereda ninguna de estas reglas.
