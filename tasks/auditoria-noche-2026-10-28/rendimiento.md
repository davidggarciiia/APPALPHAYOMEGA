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

(Pendiente: arranque medido en navegador, revisión de pantallas, latencia de API.)
