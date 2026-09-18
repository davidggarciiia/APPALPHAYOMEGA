# Bibliotecas de figuras animadas para ejercicios

Investigación del 2026-09-18, siguiendo `source-driven-development` de Agent Skills.
David acepta valorar un pago único, probando primero. La investigación no implica
compra ni selección definitiva de proveedor.

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

Recomendación: evaluar visualmente las dos muestras de MoveKit y comparar el
listado de ejercicios necesarios con GymVisual antes de comprar. La integración
de medios se añadirá al plan de catálogo una vez elegido el enfoque; los contratos
de entrenamiento y el trabajo de Codex pueden avanzar de forma independiente.
