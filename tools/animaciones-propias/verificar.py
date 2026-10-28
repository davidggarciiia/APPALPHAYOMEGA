"""Verifica metadatos, decodificación y luz de las tres muestras exportadas."""

import argparse
import json
from pathlib import Path
import subprocess

from PIL import Image, ImageStat

from poses import movimientos


def luz_estable(valores, etiqueta):
    """Un rincón fijo del suelo revela el fallo de luces entre renders de EEVEE."""
    minimo, maximo = min(valores), max(valores)
    if minimo < 170 or maximo - minimo > 15:
        raise ValueError(f"{etiqueta}: iluminación inestable ({minimo:.1f}–{maximo:.1f})")
    return {"minimo": round(minimo, 2), "maximo": round(maximo, 2)}


def controles(carpeta):
    archivos = sorted(carpeta.glob("control-*.png"))
    if len(archivos) != 4:
        raise ValueError(f"{carpeta.name}: se esperaban cuatro imágenes de control")
    valores = []
    for archivo in archivos:
        with Image.open(archivo) as imagen:
            valores.append(ImageStat.Stat(imagen.convert("L").crop((0, 0, 16, 16))).mean[0])
    return luz_estable(valores, carpeta.name)


def video(carpeta):
    archivo = carpeta / f"{carpeta.name}.mp4"
    proceso = subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format",
                              "-of", "json", str(archivo)], check=True, capture_output=True, text=True)
    metadatos = json.loads(proceso.stdout)
    streams = metadatos["streams"]
    if len(streams) != 1 or streams[0]["codec_type"] != "video":
        raise ValueError(f"{archivo.name}: se esperaba un único stream de vídeo sin audio")
    stream = streams[0]
    esperado = {"codec_name": "h264", "width": 720, "height": 720,
                "pix_fmt": "yuv420p", "r_frame_rate": "24/1", "nb_frames": "144"}
    for clave, valor in esperado.items():
        if stream.get(clave) != valor:
            raise ValueError(f"{archivo.name}: {clave}={stream.get(clave)}, esperado {valor}")
    if abs(float(metadatos["format"]["duration"]) - 6) > .02:
        raise ValueError(f"{archivo.name}: duración distinta de seis segundos")
    # Decodifica todos los fotogramas y falla ante cualquier error del decodificador.
    proceso = subprocess.run(["ffmpeg", "-v", "error", "-xerror", "-i", str(archivo),
                              "-vf", "crop=16:16:0:0,format=gray", "-f", "rawvideo", "-"],
                             check=True, capture_output=True)
    datos = proceso.stdout
    if len(datos) != 144 * 16 * 16:
        raise ValueError(f"{archivo.name}: no se decodificaron los 144 fotogramas")
    valores = [sum(datos[i:i + 256]) / 256 for i in range(0, len(datos), 256)]
    return {"archivo": str(archivo), "bytes": archivo.stat().st_size,
            "codec": "h264", "resolucion": [720, 720], "fps": 24, "duracion": 6,
            "fotogramasDecodificados": 144, "audio": False,
            "luzTodosLosFotogramas": luz_estable(valores, archivo.name)}


def principal():
    parser = argparse.ArgumentParser()
    parser.add_argument("salida", type=Path)
    parser.add_argument("--controles", action="store_true")
    opciones = parser.parse_args()
    resultados = []
    for nombre in movimientos():
        carpeta = opciones.salida / nombre
        resultado = {"id": nombre, "luzControles": controles(carpeta)}
        if not opciones.controles:
            resultado.update(video(carpeta))
        resultados.append(resultado)
    if not opciones.controles:
        (opciones.salida / "verificacion.json").write_text(
            json.dumps(resultados, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(resultados, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    principal()
