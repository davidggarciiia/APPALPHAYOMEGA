"""
Separa el logo en las dos capas que anima la pantalla de carga.

    anillo   el aro grueso exterior. Gira mientras se espera: al girar, sus
             brillos metalicos recorren el circulo.
    emblema  todo lo demas: los aros finos, omega, alfa, el rayo y TRAINING.

El rayo toca el aro grueso por dentro pero no lo cruza, asi que un corte
circular entre ambos los separa limpios, y las puntas siguen tocando el aro
aunque este gire.

El fondo negro se convierte en transparencia: la opacidad sale del canal mas
brillante y el color se divide por ella. Sobre negro el resultado es identico al
original, y sobre el fondo de la app no deja un cuadrado.

Las dos capas comparten centro y tamano, y ese centro es el del aro, medido
ajustando un circulo a su borde. Si no coincidiera, el aro bailaria al girar.

Uso, con Pillow y numpy instalados:

    python3 capas.py
"""

from pathlib import Path

import numpy as np
from PIL import Image

AQUI = Path(__file__).parent

# Medidas en pixeles del original de 1254 x 1254.
CENTRO = (619.34, 615.96)  # centro del aro grueso, ajustado a su borde exterior
MEDIO_LADO = 600  # el aro mide 589 de radio; el resto es su halo
CORTE = 558.5  # entre las puntas del rayo (557) y el borde interior del aro (560)

# Tamano en pantalla, en puntos. Debe coincidir con TAMANO en pantalla-de-carga.tsx.
TAMANO = 216


def capas(lado: int) -> tuple[Image.Image, Image.Image]:
    original = Image.open(AQUI / "original.webp").convert("RGB")
    cx, cy = CENTRO
    caja = (cx - MEDIO_LADO, cy - MEDIO_LADO, cx + MEDIO_LADO, cy + MEDIO_LADO)
    # Primero se recorta a escala real con el centro exacto y despues se reduce,
    # para que la reduccion filtre bien y no aparezcan dientes.
    recorte = original.transform(
        (2 * MEDIO_LADO, 2 * MEDIO_LADO), Image.Transform.EXTENT, caja, Image.Resampling.BICUBIC
    )
    rgb = np.asarray(recorte.resize((lado, lado), Image.Resampling.LANCZOS)).astype(float)

    alfa = rgb.max(axis=2) / 255
    alfa[alfa < 5 / 255] = 0  # ruido de compresion del fondo negro
    color = np.clip(rgb / np.maximum(alfa, 1e-6)[..., None], 0, 255)

    escala = lado / (2 * MEDIO_LADO)
    y, x = np.mgrid[0:lado, 0:lado] + 0.5
    radio = np.hypot(x - lado / 2, y - lado / 2)
    # Transicion de un pixel: las dos capas suman exactamente el original.
    en_anillo = np.clip(radio - (CORTE * escala - 0.5), 0, 1)

    def imagen(mascara: np.ndarray) -> Image.Image:
        rgba = np.dstack([color, alfa * mascara * 255]).round().astype(np.uint8)
        return Image.fromarray(rgba, "RGBA")

    return imagen(en_anillo), imagen(1 - en_anillo)


for densidad in (1, 2, 3):
    anillo, emblema = capas(TAMANO * densidad)
    sufijo = "" if densidad == 1 else f"@{densidad}x"
    anillo.save(AQUI / f"anillo{sufijo}.png", optimize=True)
    emblema.save(AQUI / f"emblema{sufijo}.png", optimize=True)
