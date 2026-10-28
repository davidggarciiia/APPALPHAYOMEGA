# Animaciones propias: implementación

> **For agentic workers:** Usar subagent-driven-development para revisión independiente. Pasos con casillas para registrar evidencia.

**Goal:** Crear y entregar las tres muestras 3D originales, reproducibles y visualmente comprobadas que David confirmó.

**Architecture:** Cinemática pura separada de Blender, constructor de escena reusable y un CLI de render. PNG intermedios y ffmpeg para MP4/poster. Ninguna modificación del catálogo actual durante la evaluación.

**Tech Stack:** Blender 5.2, Python estándar, ffmpeg y ffprobe instalados.

## Tarea 1: Movimiento

Archivos: `tools/animaciones-propias/poses.py` y `test_poses.py`.

- [x] Escribir pruebas antes del motor: loop `pose(0)==pose(1)`, longitudes de segmentos constantes, pies del press/remo estables, manos sin saltos, extensión contralateral de dead bug.
- [x] Ejecutar `python -m unittest discover -s tools/animaciones-propias -p test_poses.py` con el Python incluido en Codex y comprobar el fallo de la funcionalidad ausente.
- [x] Implementar cinemática inversa de dos segmentos, poses y ciclos específicos para las tres muestras. Cada pose devuelve articulaciones mundiales; sin dependencia de Blender.
- [x] Ejecutar las pruebas y corregir todas las infracciones geométricas.

## Tarea 2: Escena y render

Archivos: `tools/animaciones-propias/escena.py` y `renderizar.py`.

- [x] Construir geometría, luces, cámara y equipo originales. Asociar cada segmento a sus extremos calculados, conservando continuidad de orientación.
- [x] Renderizar primero un fotograma de cada escena con `blender --background --factory-startup --python-exit-code 1 --python tools/animaciones-propias/renderizar.py -- --muestras`.
- [x] Revisar visualmente las tres poses y corregir cámara, penetraciones, apoyos, materiales y trayectoria.
- [x] Renderizar ciclos de seis segundos, codificar MP4 H.264, 24 fps, y generar póster JPG. Conservar `.blend` y fotogramas de control.

## Tarea 3: Verificación y entrega

- [x] Revisar clips en fases de principio, mitad y final, más una lámina de contactos. Consultar ffprobe y decodificar los MP4 con ffmpeg, verificando 720×720, 24 fps, seis segundos y sin audio.
- [x] Solicitar revisión independiente del movimiento y código, corregir problemas concretos y repetir solo comprobaciones afectadas.
- [x] Documentar comandos y resultados en `tools/animaciones-propias/README.md`. Entregar los vídeos locales mediante Markdown, diferenciando muestras de validación profesional e instalación en la app.

Sin commits o compras; conservar los cambios anteriores del usuario.

## Evidencia durante la ejecución

Las cinco pruebas de poses fallaron inicialmente por funcionalidad ausente y pasan
después de implementar el motor. Las dos pruebas de contacto sobre mallas evaluadas
reprodujeron los apoyos demasiado altos de cabeza/pelvis y zapatillas; pasan tras
corregir las alturas.

La revisión independiente de Astra detectó los apoyos, la iluminación intermitente
y la pérdida de entradas del manifiesto al regenerar una escena. Se corrigieron
los tres problemas. Un A/B de ocho renders del mismo fotograma, GPU y escena acotó
el fallo de iluminación a las sombras AREA de EEVEE sobre Intel Iris Xe/OpenGL:
una de cuatro imágenes con sombras perdió la luz; las cuatro sin sombras fueron
estables. Las muestras conservan luces y sombreado superficial con sombras
proyectadas desactivadas. `verificar.py --controles` reprodujo el fallo luminoso
antes de la corrección.

## Resultado final

El render de las tres escenas terminó con código 0. `verificar.py` terminó con
código 0 y confirmó 432 fotogramas decodificados en total, tres MP4 H.264 de
720×720, 24 fps y seis segundos, sin audio. La iluminación del rincón fijo permaneció
estable en cada vídeo. `contactos.py --videos` extrajo cinco fases de cada MP4,
incluido el último fotograma; la revisión visual propia e independiente no detectó
saltos ni penetraciones evidentes. La diferencia media entre los PNG primero y
último quedó por debajo de 0,02 unidades por canal sobre una escala de 255.

Se conservaron los tres pósteres, los tres `.blend`, los manifiestos individuales,
el agregado con tres entradas y `verificacion.json` en la carpeta de artefactos.
Las cinco pruebas de poses y las dos de geometría real pasan. Las muestras quedan
pendientes de revisión técnica del entrenador antes de asociarlas al catálogo.
