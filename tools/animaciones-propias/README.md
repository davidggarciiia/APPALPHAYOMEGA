# Tres muestras de animaciones originales

David confirmó producir primero estas tres muestras para evaluar el estilo:

- Press inclinado con mancuernas.
- Remo sentado en polea.
- Dead bug con extensión contralateral alterna.

El personaje, el equipo y las trayectorias se construyen mediante geometría y
cinemática propias. No se han reutilizado modelos, vídeos o animaciones de terceros.
Las muestras todavía requieren revisión técnica del entrenador. No se asignan al
catálogo de la app durante esta evaluación.

## Archivos y formato

`poses.py` calcula las articulaciones sin depender de Blender. `escena.py` construye
el maniquí, el equipo y el estudio. `renderizar.py` genera cada escena en un proceso
Blender independiente y codifica el resultado con ffmpeg.

Cada ejercicio produce una escena editable `.blend`, cuatro imágenes de control,
144 PNG intermedios, un póster JPG y un MP4 H.264 de 720 × 720, 24 fps y seis segundos,
sin audio. El manifiesto agregado conserva los resultados de las tres escenas,
incluso al renderizar después una de ellas por separado.

## Reproducir en PowerShell

Blender 5.2, ffmpeg y ffprobe deben estar instalados. Los controles y la verificación
usan Python con Pillow. En el equipo actual ya estaban disponibles.

```powershell
$blenderPrograma = 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe'
$pythonPrograma = 'C:\Users\david\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
$salidaMuestras = 'C:\Users\david\.codex\visualizations\2026\09\30\01a0f3d7-6334-7b02-8ed4-76d6555369ff\animaciones-propias'
$env:BLENDER_USER_RESOURCES = Join-Path $salidaMuestras 'config'
$env:PYTHONIOENCODING = 'utf-8'

# Primero, las cuatro fases de cada ejercicio.
& $blenderPrograma --background --factory-startup --gpu-backend opengl --python-exit-code 1 --python tools/animaciones-propias/renderizar.py -- --salida $salidaMuestras --muestras
& $pythonPrograma tools/animaciones-propias/verificar.py $salidaMuestras --controles

# Después, los ciclos completos y los pósteres.
& $blenderPrograma --background --factory-startup --gpu-backend opengl --python-exit-code 1 --python tools/animaciones-propias/renderizar.py -- --salida $salidaMuestras
& $pythonPrograma tools/animaciones-propias/contactos.py $salidaMuestras
& $pythonPrograma tools/animaciones-propias/contactos.py $salidaMuestras --videos
& $pythonPrograma tools/animaciones-propias/verificar.py $salidaMuestras

# Pruebas geométricas y de apoyo sobre la malla realmente evaluada.
& $pythonPrograma -m unittest discover -s tools/animaciones-propias -p test_poses.py
& $blenderPrograma --background --factory-startup --python-exit-code 1 --python tools/animaciones-propias/test_escena.py
```

Para regenerar solo un ejercicio, añadir `--ejercicio press-inclinado`,
`--ejercicio remo-polea` o `--ejercicio dead-bug` después de `--salida` y su ruta.
Ejecutar desde la raíz del repositorio.

## Verificación

Las cinco pruebas del movimiento comprueban cierre exacto del ciclo, longitudes
constantes de brazos y piernas, apoyos estables, alternancia contralateral y ausencia
de saltos. Las dos pruebas de escena miden vértices de las mallas evaluadas para
comprobar el contacto de zapatillas, cabeza y pelvis con sus superficies de apoyo.

`verificar.py` comprueba formato, dimensiones, duración, número de fotogramas y
ausencia de audio. Decodifica el vídeo entero con ffmpeg y mide un rincón fijo del
suelo en los 144 fotogramas para detectar pérdidas de iluminación. Guarda la
evidencia en `verificacion.json`; estas comprobaciones no sustituyen la revisión
profesional de la técnica.

Verificación final del 30 de septiembre de 2026: las cinco pruebas de poses y las
dos de geometría evaluada pasan; render, extracción de contactos y verificación de
los tres vídeos terminaron con código 0. Se decodificaron los 432 fotogramas y se
revisaron visualmente cinco fases por vídeo, incluido el último fotograma. Astra
revisó de forma independiente código y contactos finales sin bloqueos pendientes.

| Muestra         |   Tamaño MP4 | Brillo del rincón en los 144 fotogramas |
| --------------- | -----------: | --------------------------------------: |
| Press inclinado | 88.746 bytes |                           202,86–202,86 |
| Remo sentado    | 83.471 bytes |                           205,02–205,27 |
| Dead bug        | 84.607 bytes |                           230,25–230,50 |

Los valores de brillo se expresan en escala de grises de 0 a 255 y sirven para
detectar el fallo de iluminación investigado, no para valorar la técnica deportiva.

## Iluminación del equipo de render

Un A/B sobre el mismo fotograma de dead bug, con la misma escena y proceso,
reprodujo una pérdida de iluminación en una de cuatro repeticiones con sombras
AREA activadas. Las cuatro repeticiones sin sombras conservaron la iluminación.
La GPU real era Intel Iris Xe con OpenGL y controlador 30.0.100.9864. Los registros
y ocho PNG están en `diagnostico-astra` junto a las muestras.

Se conservan las luces y el sombreado de las superficies, con sombras proyectadas
desactivadas para estas muestras. Una prueba con Cycles CPU produjo una imagen
correcta, aunque requirió más tiempo de render. No se cambió el controlador ni la
configuración guardada del usuario.
