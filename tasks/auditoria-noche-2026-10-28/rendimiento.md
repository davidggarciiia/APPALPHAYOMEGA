# Auditoría de rendimiento — 28-10-2026 (EN CURSO)

> Borrador guardado a medida que se mide. Rama `mejoras/base-2026-10-28` (HEAD 5a7dd67).
> MEDIDO = ejecutado esta noche; ESTIMADO = cálculo a partir de medidas.

## Bundle web (MEDIDO)

`npx expo export --platform web --source-maps` desde `apps/mobile` → `build/rendimiento-2026-10-28/web`
(1235 módulos, 7 s con caché caliente; 2 min en frío).

| Recurso                                               |       Bruto |     gzip -9 |   brotli 11 |
| ----------------------------------------------------- | ----------: | ----------: | ----------: |
| JS (1 único `entry-*.js`, sin troceo)                 | 3 109 346 B |   732 422 B |   515 876 B |
| Fuentes TTF (4)                                       |   522 820 B |   204 966 B |   173 479 B |
| `marca.png`                                           |   465 854 B |   459 439 B |           — |
| `logotipo.png` + `emblema.png` + `entrenamiento.webp` |   110 412 B |           — |           — |
| Total sin `.map`                                      | 4 229 922 B | 1 518 474 B | 1 268 653 B |

Composición del JS (source-map-explorer 2.5.3, bytes minificados):

| Paquete                                |      KB |    % |
| -------------------------------------- | ------: | ---: |
| zod                                    | 1 043.7 | 34.4 |
| código de la app (`apps/mobile`)       |   581.1 | 19.1 |
| expo-router (incluye react-navigation) |   429.8 | 14.2 |
| react-native-web                       |   275.7 |  9.1 |
| react-dom                              |   174.7 |  5.8 |
| `packages/shared`                      |    61.0 |  2.0 |
| react-hook-form                        |    48.2 |  1.6 |
| react-native-svg                       |    46.1 |  1.5 |
| expo-video                             |    12.2 |  0.4 |

zod va **duplicado**: copia CJS (546 KB: `packages/shared/dist` es CommonJS y hace `require("zod")` → `index.cjs`)

- copia ESM (497 KB: la app hace `import { z } from "zod"` → `index.js`). Cada copia arrastra los 64 idiomas
  (`export * as locales` en `zod/v4/core/index.js:11` y `zod/v4/classic/external.js:13`): 580 KB de locales en total.

Experimentos (sin tocar el repo; config de Metro alternativa vía `EXPO_OVERRIDE_METRO_CONFIG` en %TEMP%):

| Variante                                                           |          JS bruto |            gzip |           brotli |
| ------------------------------------------------------------------ | ----------------: | --------------: | ---------------: |
| Actual                                                             |         3 109 346 |         732 422 |          515 876 |
| Tree shaking de Expo solo por env (`EXPO_UNSTABLE_TREE_SHAKING=1`) |         3 116 537 |               — | — (sin ganancia) |
| zod en una sola copia ESM                                          | 2 545 028 (−18 %) | 632 027 (−14 %) |   493 005 (−4 %) |
| + locales de zod reducidos a `en`                                  | 2 250 414 (−28 %) | 591 350 (−19 %) |  461 103 (−11 %) |
| zod ESM + rutas asíncronas: JS necesario para `/login`             | 2 207 444 (−29 %) | 548 601 (−25 %) |  440 671 (−15 %) |

## Bundle nativo Android (MEDIDO, re-verificado en la reanudación)

Cifras web re-verificadas con un recálculo de gzip/brotli sobre `build/rendimiento-2026-10-28/web*`: coinciden con la tabla anterior.

`npx expo export --platform android --source-maps` (Hermes) y `--no-bytecode` (para analizar composición):

| Artefacto                                                   |     Bytes |
| ----------------------------------------------------------- | --------: |
| `entry-*.hbc` (bytecode Hermes, lo que viaja en el APK/IPA) | 4 571 732 |
| `entry-*.js` minificado (mismo grafo, sin bytecode)         | 3 871 698 |

Composición del JS nativo (source-map-explorer 2.5.3 con --no-border-checks; 5,35 % sin mapear):

| Paquete               |      KB |    % |
| --------------------- | ------: | ---: |
| zod                   | 1 037,4 | 27,4 |
| apps/mobile           |   570,2 | 15,1 |
| react-native          |   565,6 | 15,0 |
| expo-router           |   443,6 | 11,7 |
| react-native-svg      |   102,0 |  2,7 |
| react-native-worklets |    96,7 |  2,6 |
| react-hook-form       |    92,6 |  2,4 |
| @expo/ui              |    65,1 |  1,7 |
| packages/shared       |    60,9 |  1,6 |

zod también va DUPLICADO en nativo: 556 470 B en `.cjs` + 508 660 B en ESM = 1 065 130 B, de los que 591 814 B son los 64 idiomas (128 ficheros `locales/*`) que nadie activa (no hay ningun `z.config(z.locales.xx())` en `apps/mobile` ni `packages/shared`; zod usa `en` por defecto, que es la unica que se queda en la variante reducida).
