# Pack de Instagram de Alpha & Omega Training

Historias, reels, publicaciones, foto de perfil y destacados con la identidad
de la app: negro y oro (`apps/mobile/src/tema.ts`) y el logo animado de la
pantalla de carga. Todo lo que se mueve lo hace como ese logo: los aros se
trazan, el emblema se llena de oro, una banda de luz lo cruza y el rayo corta
la pantalla entre escena y escena.

Está pensado para alguien que solo usa Instagram. Las piezas salen terminadas;
las que dependen del día (antes y después, huecos de la semana, mito o
realidad, opiniones...) dejan un hueco marcado con esquinas de oro donde se
pone el texto (Aa), una foto (sticker de foto) o un sticker de preguntas,
encuesta o cuenta atrás, con la propia app.

## Qué sale

`node marca/redes/render.cjs` deja en `exportados/` estas carpetas, que son las
que se le pasan:

| Carpeta                  | Qué hay                                                                                                                                                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `00 Como usarlo`         | Tres imágenes con los pasos, en formato historia, para verlas en el móvil.                                                                                                                                                                             |
| `01 Historias`           | Plazas abiertas, quedan 5 a 1 plazas, últimas plazas, reserva, cambio físico, opiniones, nuevo récord, pregúntame, encuesta, cuenta atrás, huecos de la semana, consejo y entreno del día, mito o realidad y un fondo en bucle. Cada una en MP4 y PNG. |
| `02 Reels`               | Intro con el logo y cierre para pegar al principio y al final de los reels, un reel de marca y portadas por tema.                                                                                                                                      |
| `03 Publicaciones`       | Logo, plazas abiertas y reserva en 4:5, portadas de carrusel para cambios físicos y opiniones, y seis frases.                                                                                                                                          |
| `04 Perfil y destacados` | Foto de perfil y seis portadas de destacados.                                                                                                                                                                                                          |

Los vídeos son MP4 H.264 a 30 fotogramas por segundo y 1080 de ancho. No se
guardan en el repositorio: se regeneran con el comando.

## Cómo se genera

Hace falta Playwright con su Chromium y ffmpeg con libx264:

```bash
npm install --global playwright
node marca/redes/render.cjs                     # todo el pack
node marca/redes/render.cjs historia-cambio-fisico   # solo esa pieza
node marca/redes/render.cjs manifiesto --muestra 0,2000,4000
                                                # PNG de esos instantes, para revisar
```

Si ffmpeg no está en el `PATH`: `FFMPEG=/ruta/ffmpeg node marca/redes/render.cjs`.

Cada pieza está en `piezas.json`: de qué página sale, en qué formato, con qué
textos y a qué archivo va. Para cambiar un texto o añadir una variante se toca
ahí y se vuelve a lanzar.

## Cómo está hecho

Hay dos tipos de pieza, y el renderizador sabe mover las dos fotograma a
fotograma:

- **Piezas HTML** (`piezas/`): la intro con el logo, el reel de marca, el cierre,
  el fondo en bucle, la foto de perfil y los destacados. Son animaciones CSS; el
  renderizador las para y las pone en el instante de cada fotograma.
- **Piezas de lienzo** (`lienzo.html` con las plantillas de `editor/`): el resto.
  Se pintan en un canvas en función del instante, con `editor/motor.js` (logo,
  texto en oro, el tajo del rayo, fotos) y las plantillas de
  `editor/plantillas.js` y `editor/historias.js`.

El logo sale de `comun/trazos.js`, copiado de
`apps/mobile/src/componentes/logo/trazos.ts`. Las letras (Anton, Archivo y
Cinzel, licencia OFL) están en `comun/tipos/`.

`editor.html` es un editor en el navegador con las mismas plantillas: se
escribe el texto, se sube una foto y se descarga el vídeo o la imagen. Sirve
para hacer una pieza a medida sin tocar `piezas.json`.
