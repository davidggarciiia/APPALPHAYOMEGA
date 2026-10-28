# Bibliotecas de figuras animadas para ejercicios

Investigación del 2026-09-18, siguiendo `source-driven-development` de Agent Skills.
David acepta valorar un pago único, probando primero. La investigación no implica
compra ni selección definitiva de proveedor.

Actualización: David pidió una búsqueda gratuita con un agente mientras Codex
seguía el plan. Se contrastaron las opciones siguientes con fuentes del proveedor.

## Instalación comprobada el 30-09-2026

La base local `alpha_omega` contiene **130 ejercicios publicados**: las 56 fichas
previas y 74 nuevas. La ampliación añade 36 fichas de fuerza/core de la rutina y
variantes explícitas, 2 alternativas, 8 básicos, 20 de movilidad/activación y
8 estiramientos. Incluye instrucciones propias, tres pasos y un error a evitar;
no modifica ni prescribe series, cargas o repeticiones de la rutina.

Se importaron y comprobaron **52 MP4 y 52 pósteres JPG** en el `MEDIOS_DIR` local.
Los vídeos usan H.264 sin audio, miden 720×720 o 720×398 y suman 11.147.183 bytes.
Las 52 figuras siguen asociadas al catálogo inicial. Las fichas nuevas son
textuales: no se les ha asignado un clip de otro movimiento.

La repetición de la simulación del cargador dio cero altas. Se compararon las
56 fichas anteriores, incluidas sus relaciones y fechas, sin diferencias.
El cargador tiene simulación por defecto, validación de nombres y alias,
transacción y protección ante cargas simultáneas.

La exportación MP4 de [flexiones de Miraj Studios en LottieFiles](https://lottiefiles.com/free-animation/push-ups-X6F71qOwYF)
solicita crear una cuenta. No se instaló esa pieza. La prensa inclinada reutiliza
la ficha previa «Prensa de piernas», cuyo clip `vital-0074` muestra esa máquina.
Las indicaciones ambiguas sobre tríceps por encima de la cabeza tienen variantes
con material concreto; no se han vinculado automáticamente a la rutina.

Quedan fuera los ejercicios que requieren representar psoas o aductores como
grupo principal, porque esos grupos no existen en el contrato muscular actual.
También queda la discrepancia previa de `vital-0080`: su clip muestra mancuernas,
mientras la ficha se llama «Press de hombros sentado en máquina». La ampliación
conserva esa ficha y su asociación; no debe tomarse como demostración exacta de
la variante en máquina.

La compilación y la comprobación de tipos fueron correctas. Pasaron 140 pruebas
del catálogo y medios, y posteriormente las 9 pruebas de la ampliación final,
incluidos rechazo de alias iniciales y unicidad de cargas simultáneas. Astra
revisó el contenido y el cargador, y se corrigieron sus hallazgos antes de cargar.

## Decisión vigente (2026-09-24, iteración 3)

David fijó tres criterios: **solo material gratuito**, prima la calidad visual y
da igual que una comparativa la publique un competidor. Con esos criterios:

| Fuente                    | Uso en la app                                                                                                                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vital, paquete Free50** | Las 50 animaciones 3D de gimnasio. El EULA 2026.1 permite usarlas en apps móviles, alojarlas nosotros, «Store the Assets offline inside your application» y transcodificarlas |
| **MoveKit, muestra**      | Dominadas y aperturas con mancuernas. Solo por streaming: su licencia no menciona copias en el dispositivo                                                                    |
| **Vídeos del entrenador** | El resto de ejercicios, más adelante, en el hueco de vídeo de la ficha                                                                                                        |
| RepDB Free                | Descartado: a David no le gusta su estilo plano. El muñeco «classic» y la animación son de pago, y `premium-samples/` es solo para evaluación                                 |

- Quedan sin figura gratuita el press de banca, los remos, el curl de bíceps y
  los abdominales.
- La verificación completa está en [la entrega archivada de Fable](../tasks/planes%20antiguos/2026-09-24/iteracion-3/entrega-fable.md), tarea F01:
  citas de las licencias, SHA-256 de las descargas, formatos, pruebas de
  codificación a 720p y propuesta de contrato para C05.
- El informe externo `compass_artifact_*.md` recomendaba RepDB Free; esta decisión
  lo sustituye por el criterio de calidad.
- Las secciones siguientes conservan la investigación del 18-09 como histórico.

## Cómo funciona en la app (implementado en la iteración 3)

**Los MP4 no entran en el repositorio.** El EULA de Vital prohíbe redistribuir
los originales. El índice (`apps/api/src/catalogo-ejercicios/medios.ts`) solo
guarda nuestros identificadores (`vital-0051` … `vital-0100`, `movekit-pull-ups`,
`movekit-dumbbell-chest-fly`), el nombre en español, la licencia y si admite
copia en el dispositivo.

Para tener figuras en un servidor:

1. Descargar los paquetes gratuitos (Vital Free50 y la muestra de MoveKit) y
   descomprimirlos fuera del repositorio.
2. Fijar en `.env` una carpeta privada, fuera del repo y de cualquier ruta
   pública: `MEDIOS_DIR=/ruta/privada/alpha-omega-medios`.
3. Con ffmpeg instalado:

   ```bash
   npm run build --workspace apps/api
   node apps/api/dist/catalogo-ejercicios/importar-medios.js --vital <carpeta con 0051.mp4…> --movekit <carpeta con pull-ups.mp4>
   ```

   Pasa cada clip a 720 px, H.264 con `faststart` y sin audio, y genera un
   póster JPG. Los 52 clips ocupan unos 12 MB en total (de 76 a 640 KB cada uno).
   `--forzar` vuelve a importar los que ya existen.

Sin `MEDIOS_DIR` el catálogo funciona igual: el índice sale vacío y el
entrenador no ve figuras que elegir.

| Ruta                                | Quién                | Qué hace                                                          |
| ----------------------------------- | -------------------- | ----------------------------------------------------------------- |
| `GET /ejercicios/medios`            | entrenador           | Figuras importadas en este servidor                               |
| `PUT /ejercicios/:id/figura`        | entrenador           | `{ medioId }` asocia una del índice; `{ medioId: null }` la quita |
| `GET /ejercicios/:id/figura`        | cliente y entrenador | El MP4, con rangos y `Cache-Control: private`                     |
| `GET /ejercicios/:id/figura/poster` | cliente y entrenador | El póster JPG                                                     |

Nutricionista y empleado no acceden: el catálogo autoriza por rol.

**Sin conexión.** En Android e iOS el reproductor guarda en caché los clips de
Vital cuando se ven con conexión (`useCaching`); los de MoveKit no, porque su
licencia no habla de copias en el dispositivo. Esa caché es del sistema y puede
vaciarse si falta espacio: no es una descarga garantizada, y la app lo dice.
La ficha de texto del ejercicio sí se guarda cifrada por cuenta al abrir «Ver
técnica». En web no hay caché de vídeo: se descarga cada vez. La prueba en modo
avión con un móvil real está pendiente (F10).

## Opciones gratuitas

| Opción                                                                               | Qué permite probar                                                                                                                                                    | Límites para esta app                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Vital, paquete gratuito](https://vitalanimations.com/free-pack)                     | MP4 3D de 1080p y JSON. El [README oficial](https://github.com/exercisedb-pro/exercisedb-dataset) extiende a la muestra la licencia comercial de los paquetes de pago | Cantidad no confirmada. La FAQ permite autoalojamiento; falta inspeccionar el EULA de la descarga y confirmar empaquetado offline y atribución. Los 1.500+ ejercicios no son gratuitos                                                                                 |
| [LottieFiles: flexiones](https://lottiefiles.com/free-animation/push-ups-X6F71qOwYF) | Piezas sueltas de personajes bajo [Lottie Simple License](https://lottiefiles.com/page/license), con uso comercial y atribución opcional                              | No es un catálogo uniforme. Hay que comprobar autoría y licencia de cada pieza, conservar la licencia y respetar sus condiciones al distribuirla                                                                                                                       |
| [Mixamo](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html)                 | Personajes y movimientos 3D gratuitos para proyectos comerciales con cuenta Adobe                                                                                     | Requiere preparar/renderizar los clips y verificar los movimientos disponibles. No se ha acreditado cobertura suficiente de gimnasio                                                                                                                                   |
| [WorkoutX](https://workoutxapp.com/docs.html)                                        | API freemium: 1.400+ GIFs, 500 peticiones/mes, 30/min, 10 resultados por petición; 180px con marca de agua                                                            | Su [guía](https://workoutxapp.com/blog/exercise-gif-api-licensing-guide.html) incluye uso comercial en Free. Los [términos](https://workoutxapp.com/terms.html) limitan extracción y caché masiva; no se ha confirmado permiso de autoalojamiento u offline permanente |

No se ha verificado una biblioteca completa, gratuita, descargable y sin límites
para este uso comercial. Vital es el primer candidato gratuito para una muestra
de muñecos 3D; WorkoutX puede servir para explorar un catálogo amplio online.
No se han creado cuentas ni incorporado estos medios a la app.

Se descarta el paquete gratis de [Vector Fitness Exercises](https://vectorfitexercises.com/for-content-creators):
sus 305 MP4 permiten contenido social, pero prohíben integrarlos en apps/productos.
[RepDB](https://github.com/RepDB/exercise-dataset) ofrece ilustraciones gratuitas;
sus animaciones son de pago y la muestra animada se limita a evaluación.
La licencia del código de una API no acredita por sí sola los derechos de sus GIFs.

## Candidatos

| Biblioteca                                          | Contenido y precio publicado                                                                                                                                                                                  | Encaje                                                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| [GymVisual](https://gymvisual.com/16-animated-gifs) | 6.554 productos GIF; incluye variantes, no necesariamente ejercicios distintos. [Tarifa](https://gymvisual.com/content/6-price-rules): 3,60 USD por GIF, o 0,90 USD/unidad comprando al menos 10 en un pedido | Candidato por cobertura y selección de un lote pequeño                                       |
| [MoveKit](https://movekit.com/free-sample)          | 412 ejercicios en MP4; dos muestras gratuitas con metadatos. La página de muestras publica packs de 149 a 299 USD; el importe se localiza según moneda                                                        | Primera evaluación por disponer de archivos completos y condiciones publicadas               |
| [Vital Animations](https://vitalanimations.com/)    | Publicita 400 animaciones de gimnasio por 49 USD y colección de 1.500+ por 199 USD, pago único, MP4 y JSON                                                                                                    | Alternativa de menor precio; no se ha probado su muestra ni contrastado un contrato completo |

Los precios se consultaron en esa fecha y no son una oferta de compra. MoveKit
mostró también GBP y CHF según la página; el importe final depende del checkout.

## Licencia y entrega

[GymVisual permite uso en apps Android/iOS](https://gymvisual.com/content/9-license)
con licencia comercial perpetua de pago único para los archivos comprados.
Sus vistas previas no tienen ese permiso. Conservaremos los medios bajo acceso
de la app, sin ofrecer una biblioteca descargable de archivos originales.

[MoveKit permite integrar y modificar los clips en productos propios](https://movekit.com/license),
con licencia comercial perpetua y entrega a usuarios autorizados. Prohíbe
redistribuir los originales como otra biblioteca y exponer descargas públicas.
La [página de muestras](https://movekit.com/free-sample) extiende expresamente la
licencia a sus dos clips gratuitos. Antes de contratar se debe concretar el
tratamiento de copias privadas sin conexión, que no se describe expresamente.

La cuenta compradora será la del titular de la app, según las decisiones del
proyecto. Se conservarán proveedor, identificador, versión de licencia y factura.

## Evaluación de la muestra de MoveKit

Descargada desde el enlace oficial a la carpeta temporal, fuera del repositorio.
El ZIP contiene dos MP4, dos pósteres, JSON, CSV y `LICENSE.txt`. Se comprobaron
los nombres, los tamaños y las referencias del JSON al contenido del archivo:

| Ejercicio                | Archivo                  | Tamaño del MP4  | Duración declarada por el proveedor |
| ------------------------ | ------------------------ | --------------- | ----------------------------------- |
| Dominadas                | `pull-ups.mp4`           | 3.200.261 bytes | 7,47 s                              |
| Aperturas con mancuernas | `dumbbell-chest-fly.mp4` | 4.806.510 bytes | 9,87 s                              |

Los textos vienen en inglés. El mapeo al catálogo español será explícito; por
ejemplo, `Trapezius` no se añadirá automáticamente a nuestro vocabulario de grupos.
Esta inspección del paquete no equivale a una prueba de reproducción en móvil.

## Encaje técnico y siguiente prueba

Stack leído en `apps/mobile/package.json`: Expo 57, React Native 0.86.3 y React 19.2.3.
Para MP4 se puede usar [expo-video de SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/video/);
para GIF/WebP animado, [expo-image](https://docs.expo.dev/versions/latest/sdk/image/).
Son reproductores; el catálogo de animaciones procede del proveedor.

La caché de `expo-video` puede reproducirse sin conexión, pero el sistema puede
eliminarla. No basta para prometer disponibilidad offline. La prueba de integración
debe cubrir repetición, pausa al salir, retorno, cierre/reapertura y modo avión.

Recomendación actual: contrastar la muestra gratuita de Vital con las dos de
MoveKit y comparar el listado necesario con GymVisual antes de comprar. La integración
de medios se añadirá al plan de catálogo una vez elegido el enfoque; los contratos
de entrenamiento y el trabajo de Codex pueden avanzar de forma independiente.
