"""Ejecutar con Blender --background --python renderizar.py -- --salida ..."""

import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from escena import preparar_estudio
from poses import movimientos, pose

NOMBRES = {"press-inclinado": "Press inclinado con mancuernas",
           "remo-polea": "Remo sentado en polea", "dead-bug": "Dead bug"}
FOTOGRAMAS = 144


def argumentos():
    parser = argparse.ArgumentParser()
    parser.add_argument("--salida", type=Path, required=True)
    parser.add_argument("--ejercicio", choices=movimientos())
    parser.add_argument("--muestras", action="store_true", help="Solo cuatro fases PNG por escena")
    parser.add_argument("--resolucion", type=int, default=720)
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1:])


def preparar_animacion(nombre, resolucion):
    escena, personaje, equipo = preparar_estudio(nombre, resolucion)
    escena.frame_start, escena.frame_end = 1, FOTOGRAMAS
    for indice in range(FOTOGRAMAS + 1):
        puntos = pose(nombre, indice / FOTOGRAMAS)
        manos = personaje.actualizar(puntos, nombre, indice + 1)
        equipo.actualizar(manos, indice + 1)
    escena.frame_set(1)
    return escena


def convertir(nombre, carpeta):
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("ffmpeg no está en PATH")
    video, poster = carpeta / f"{nombre}.mp4", carpeta / f"{nombre}.jpg"
    subprocess.run([ffmpeg, "-v", "error", "-y", "-framerate", "24", "-i",
                    str(carpeta / "fotogramas" / "%04d.png"), "-c:v", "libx264",
                    "-profile:v", "main", "-pix_fmt", "yuv420p", "-crf", "21",
                    "-preset", "slow", "-movflags", "+faststart", "-an", str(video)], check=True)
    subprocess.run([ffmpeg, "-v", "error", "-y", "-i", str(carpeta / "control-037.png"),
                    "-frames:v", "1", "-q:v", "3", str(poster)], check=True)
    return video, poster


def guardar_resumen(salida):
    resultados = []
    for nombre in movimientos():
        manifiesto = salida / nombre / "manifest.json"
        if manifiesto.exists():
            resultados.append(json.loads(manifiesto.read_text(encoding="utf-8")))
    (salida / "manifest.json").write_text(json.dumps(resultados, ensure_ascii=False, indent=2), encoding="utf-8")


def principal():
    opciones = argumentos()
    opciones.salida.mkdir(parents=True, exist_ok=True)
    # Guardar la escena sin escribir miniaturas en carpetas ajenas al artefacto.
    rutas = bpy.context.preferences.filepaths
    tipos = rutas.bl_rna.properties["file_preview_type"].enum_items.keys()
    if "NONE" in tipos:
        rutas.file_preview_type = "NONE"
    rutas.save_version = 0
    if opciones.ejercicio is None:
        # Backend explícito para reproducir el render comprobado en este equipo.
        # Cada escena se aísla y conserva los resultados de las demás.
        for nombre in movimientos():
            comando = [bpy.app.binary_path, "--background", "--factory-startup", "--gpu-backend", "opengl", "--python-exit-code", "1",
                       "--python", str(Path(__file__).resolve()), "--", "--salida", str(opciones.salida),
                       "--ejercicio", nombre, "--resolucion", str(opciones.resolucion)]
            if opciones.muestras:
                comando.append("--muestras")
            subprocess.run(comando, check=True)
        guardar_resumen(opciones.salida)
        return
    nombre = opciones.ejercicio
    inicio = time.monotonic()
    carpeta = opciones.salida / nombre
    carpeta.mkdir(parents=True, exist_ok=True)
    escena = preparar_animacion(nombre, opciones.resolucion)
    bpy.ops.wm.save_as_mainfile(filepath=str(carpeta / f"{nombre}.blend"))
    # El primer render tras reconstruir el estudio prepara shaders y luces.
    bpy.ops.render.render(write_still=False)
    for fotograma in (1, 37, 73, 109):
        escena.frame_set(fotograma)
        escena.render.filepath = str(carpeta / f"control-{fotograma:03d}.png")
        bpy.ops.render.render(write_still=True)
    resultado = {"id": nombre, "nombre": NOMBRES[nombre], "origen": "geometría y movimiento originales",
                 "revisionTecnica": "muestra pendiente de revisión del entrenador",
                 "resolucion": opciones.resolucion, "fps": 24, "duracion": 6}
    if not opciones.muestras:
        fotogramas = carpeta / "fotogramas"
        fotogramas.mkdir(exist_ok=True)
        escena.render.filepath = str(fotogramas / "") + os.sep
        bpy.ops.render.render(animation=True)
        video, poster = convertir(nombre, carpeta)
        resultado.update(video=str(video), poster=str(poster))
    resultado["segundosDeProduccion"] = round(time.monotonic() - inicio, 1)
    (carpeta / "manifest.json").write_text(json.dumps(resultado, ensure_ascii=False, indent=2), encoding="utf-8")
    print("MUESTRA_COMPLETA " + json.dumps(resultado, ensure_ascii=False), flush=True)
    guardar_resumen(opciones.salida)


if __name__ == "__main__":
    principal()
