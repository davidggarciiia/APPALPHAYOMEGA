"""Lámina de revisión de los doce fotogramas de control; requiere Pillow."""

import argparse
from io import BytesIO
from pathlib import Path
import subprocess

from PIL import Image, ImageDraw, ImageFont


def principal():
    parser = argparse.ArgumentParser()
    parser.add_argument("carpeta", type=Path)
    parser.add_argument("--videos", action="store_true", help="Revisar los MP4 finales, incluido el último fotograma")
    opciones = parser.parse_args()
    nombres = (("press-inclinado", "Press inclinado"), ("remo-polea", "Remo en polea"),
               ("dead-bug", "Dead bug"))
    fuente = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 22)
    pequena = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 16)
    fases = (1, 37, 73, 109, 144) if opciones.videos else (1, 37, 73, 109)
    lamina = Image.new("RGB", (1080, 64 + len(fases) * 380), "#f7f9f9")
    dibujo = ImageDraw.Draw(lamina)
    for columna, (identificador, nombre) in enumerate(nombres):
        dibujo.text((columna * 360 + 20, 16), nombre, font=fuente, fill="#173e44")
        for fila, fotograma in enumerate(fases):
            if opciones.videos:
                video = opciones.carpeta / identificador / f"{identificador}.mp4"
                resultado = subprocess.run(["ffmpeg", "-v", "error", "-ss", str((fotograma - 1) / 24),
                                           "-i", str(video), "-frames:v", "1", "-f", "image2pipe",
                                           "-vcodec", "png", "-"], check=True, capture_output=True)
                imagen = Image.open(BytesIO(resultado.stdout))
            else:
                imagen = Image.open(opciones.carpeta / identificador / f"control-{fotograma:03d}.png")
            imagen = imagen.convert("RGB").resize((360, 360), Image.Resampling.LANCZOS)
            y = 64 + fila * 380
            lamina.paste(imagen, (columna * 360, y))
            dibujo.text((columna * 360 + 16, y + 356), f"{(fotograma - 1) / 24:g} s",
                        font=pequena, fill="#50636a")
    destino = opciones.carpeta / ("contactos-videos.png" if opciones.videos else "contactos.png")
    lamina.save(destino)
    print(destino)


if __name__ == "__main__":
    principal()
