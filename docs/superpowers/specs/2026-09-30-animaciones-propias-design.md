# Animaciones 3D propias de ejercicios

David autorizó crear las animaciones con «hazlas tú» después de la propuesta de
usar un personaje propio, cámara fija, movimientos en bucle y MP4, empezando por
press inclinado con mancuernas, remo sentado en polea y dead bug. Se preparan esas
tres muestras. David confirmó después «Las 3 muestras primero»; las otras 75
animaciones sin figura quedan fuera de esta entrega de evaluación.

## Diseño acordado

Blender 5.2, ya instalado, genera un maniquí original mediante geometría propia.
No se reutilizan modelos, movimientos ni materiales de Vital o MoveKit. Un rig
procedimental conserva la longitud de las extremidades mediante cinemática inversa
de dos segmentos. Las tres escenas tienen banco, polea o colchoneta según corresponda.
Fondo claro, cuerpo neutro y acentos verde azulado; cámara fija en tres cuartos.

Cada ejercicio tiene un ciclo de seis segundos con retorno al inicio, renderizado
a 24 fotogramas por segundo en 720×720. Se conserva la escena `.blend`, el código,
un póster y el MP4 H.264 sin sonido. Los archivos producidos viven en la carpeta
de artefactos de este chat; el código reproducible vive en `tools/animaciones-propias`.

Las pruebas numéricas comprueban continuidad del bucle, longitudes de brazos y
piernas, posiciones de apoyo y alternancia contralateral del dead bug. Se revisan
imágenes de varias fases y vídeos reproducibles. Estas comprobaciones no equivalen
a una validación técnica profesional. Las muestras se entregan para revisión y
no sustituyen las figuras ni se asocian automáticamente al catálogo del entrenador.

La ampliación al resto reutilizará el personaje y equipo, pero requerirá definir
y revisar la trayectoria específica de cada ejercicio; no se asignará un mismo
movimiento genérico a ejercicios distintos.
