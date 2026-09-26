"""
Redibuja el logo en vectores a partir de original.webp.

La forma sale del original; el color no, porque lo pone la app. Las piezas:

    aros     tres elipses: en el original salen algo mas anchas que altas.
             Medidas ajustando una elipse a los pixeles de cada aro.
    emblema  omega, alfa y el rayo, calcados con potrace.
    letras   TRAINING, calcado igual, una pieza por letra.

Las espigas del rayo son triangulos de bordes rectos, pero en el original tienen
destellos de luz pegados al borde y las cruzan los aros finos, asi que calcadas
salen con bultos. Se rehacen con sus bordes, medidos fila a fila con precision
de subpixel (donde el brillo cae a la mitad) y ajustados a una recta
descartando las filas que tocan un destello.

El resultado se escribe en src/componentes/logo/trazos.ts, que no se edita a
mano. Uso, con Pillow, numpy y potracer instalados:

    python3 assets/logo/vectorizar.py
"""

import json
from pathlib import Path

import numpy as np
import potrace
from PIL import Image, ImageDraw

AQUI = Path(__file__).parent
ORIGINAL = AQUI / "original.webp"
SALIDA = AQUI.parent.parent / "src" / "componentes" / "logo" / "trazos.ts"

CX, CY = 619.34, 615.96  # centro del aro grueso: origen de coordenadas del SVG
UMBRAL = 115  # canal mas brillante, 0-255: mitad del dorado liso
AUMENTO = 3  # se calca a 3x para que las curvas salgan finas
RADIO_LIMPIO = 470  # por dentro no hay aros: solo emblema

AROS = [
    # (nombre, centro x, centro y, semieje horizontal, semieje vertical, grosor)
    ("grueso", 619.79, 616.25, 577.12, 573.38, 27.0),
    ("finoExterior", 619.77, 615.58, 521.99, 517.20, 6.3),
    ("finoInterior", 620.01, 615.98, 490.98, 486.90, 6.3),
]

ESPIGAS = [
    # (borde izquierdo x = a*y + b, borde derecho, fila donde empieza, fila donde acaba)
    ((-0.5857, 779.68), (-0.4625, 771.65), None, 427.0),  # arriba: del aro grueso a la Z
    ((-0.5452, 988.16), (-0.6577, 1116.99), 908.7, None),  # abajo: de TRAINING al aro grueso
]
# Donde la espiga de arriba cruza el arco del omega, el calco tambien sale
# mordido. Ahi se rehace el arco con sus bordes, medidos igual que los de las
# espigas a los dos lados del cruce: y = a*x^2 + b*x + c, con error de 0,2 px.
ARCO_OMEGA = ((1.473067e-03, -1.838913, 917.852), (1.852336e-03, -2.302199, 1093.632))
CRUCE = (335.0, 395.0)  # filas del cruce
# Borde interior del aro grueso, mas 2 px: la punta se mete debajo del aro y no
# queda rendija.
_, EX, EY, EA, EB, EG = AROS[0]
ARO_INTERIOR = (EX, EY, EA - EG / 2 + 2, EB - EG / 2 + 2)


def fila_en_aro(a: float, b: float, arriba: bool) -> float:
    ex, ey, ea, eb = ARO_INTERIOR
    ys = np.linspace(0, 1254, 125401)
    dentro = ((a * ys + b - ex) / ea) ** 2 + ((ys - ey) / eb) ** 2 <= 1
    return float(ys[dentro].min() if arriba else ys[dentro].max())


original = Image.open(ORIGINAL).convert("RGB")
lado = original.size[0] * AUMENTO
grande = np.asarray(original.resize((lado, lado), Image.Resampling.BICUBIC)).astype(float)
y, x = (np.mgrid[0:lado, 0:lado] + 0.5) / AUMENTO
r = np.hypot(x - CX, y - CY)
mascara = (grande.max(axis=2) > UMBRAL) & (r < RADIO_LIMPIO)
del grande, r

for (ai, bi), (ad, bd), desde, hasta in ESPIGAS:
    arriba = desde is None
    extremos = [fila_en_aro(ai, bi, arriba), fila_en_aro(ad, bd, arriba)]
    y0 = min(extremos) if arriba else desde
    y1 = hasta if arriba else max(extremos)
    # Se borra lo calcado alrededor de la espiga y se pinta el poligono.
    cerca = (x > ai * y + bi - 10) & (x < ad * y + bd + 10) & (y >= y0 - 10) & (y <= y1)
    mascara[cerca] = False
    if arriba:
        superior, inferior = ARCO_OMEGA
        cruce = (x > ai * y + bi - 14) & (x < ad * y + bd + 14) & (y > CRUCE[0]) & (y < CRUCE[1])
        mascara[cruce] = False
        mascara[cruce & (y >= np.polyval(superior, x)) & (y <= np.polyval(inferior, x))] = True
    lienzo = Image.fromarray(mascara)
    esquinas = [(ai * y0 + bi, y0), (ad * y0 + bd, y0), (ad * y1 + bd, y1), (ai * y1 + bi, y1)]
    ImageDraw.Draw(lienzo).polygon([(px * AUMENTO, py * AUMENTO) for px, py in esquinas], fill=1)
    mascara = np.array(lienzo)
del x, y

# potrace calca lo negro: se le pasa la mascara invertida.
trazo = potrace.Bitmap(~mascara).trace(turdsize=20, alphamax=1.0, opticurve=True, opttolerance=0.2)


def p(pt) -> np.ndarray:
    return np.array([pt.x / AUMENTO - CX, pt.y / AUMENTO - CY])


def bezier(p0, c1, c2, p3, n=40):
    t = np.linspace(0, 1, n)[:, None]
    return (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * c1 + 3 * (1 - t) * t**2 * c2 + t**3 * p3


piezas = []
for curva in trazo.curves:
    inicio = actual = p(curva.start_point)
    d = [f"M{inicio[0]:.1f} {inicio[1]:.1f}"]
    puntos = [inicio]
    for s in curva.segments:
        fin = p(s.end_point)
        if s.is_corner:
            c = p(s.c)
            d.append(f"L{c[0]:.1f} {c[1]:.1f}L{fin[0]:.1f} {fin[1]:.1f}")
            puntos += [c, fin]
        else:
            c1, c2 = p(s.c1), p(s.c2)
            d.append(f"C{c1[0]:.1f} {c1[1]:.1f} {c2[0]:.1f} {c2[1]:.1f} {fin[0]:.1f} {fin[1]:.1f}")
            puntos += list(bezier(actual, c1, c2, fin)[1:])
        actual = fin
    d.append("Z")
    pts = np.array(puntos + [inicio])
    caja = [float(v) for v in (*pts.min(axis=0), *pts.max(axis=0))]
    tipo = "letra" if caja[1] + CY > 838 and caja[3] + CY < 905 else "emblema"
    largo = float(np.hypot(*np.diff(pts, axis=0).T).sum())
    piezas.append({"tipo": tipo, "d": "".join(d), "largo": round(largo, 1), "caja": caja})


def perimetro(a: float, b: float) -> float:
    h = ((a - b) / (a + b)) ** 2
    return float(np.pi * (a + b) * (1 + 3 * h / (10 + np.sqrt(4 - 3 * h))))


aros = []
for nombre, ex, ey, a, b, grosor in AROS:
    cx, cy = ex - CX, ey - CY
    # Empieza arriba y va en el sentido de las agujas del reloj.
    d = (
        f"M{cx:.2f} {cy - b:.2f}"
        f"A{a:.2f} {b:.2f} 0 1 1 {cx:.2f} {cy + b:.2f}"
        f"A{a:.2f} {b:.2f} 0 1 1 {cx:.2f} {cy - b:.2f}Z"
    )
    aros.append({"nombre": nombre, "d": d, "largo": round(perimetro(a, b), 1), "grosor": grosor})

# Con el oro plano, donde la espiga de arriba cruza el arco del omega las dos
# piezas se funden y deja de verse que el rayo pasa por encima. En el original
# se ve por el canto; aqui se marca con los dos bordes de la espiga dentro del
# arco, que la app pinta como un filo fino mas oscuro.
def corte(a: float, b: float, borde) -> tuple[float, float]:
    ys = np.linspace(300, 420, 120001)
    ys = ys[np.argmin(np.abs(ys - np.polyval(borde, a * ys + b)))]
    return a * ys + b, ys


(ai, bi), (ad, bd), _, _ = ESPIGAS[0]
cantos = []
for a, b in ((ai, bi), (ad, bd)):
    (x0, y0), (x1, y1) = corte(a, b, ARCO_OMEGA[0]), corte(a, b, ARCO_OMEGA[1])
    cantos.append(f"M{x0 - CX:.1f} {y0 - CY:.1f}L{x1 - CX:.1f} {y1 - CY:.1f}")



def dentro(a: list[float], b: list[float]) -> bool:
    return a[0] >= b[0] and a[1] >= b[1] and a[2] <= b[2] and a[3] <= b[3]


# Cada hueco (el de la R, el de la A, el del emblema) va con la pieza que lo
# contiene, para rellenarlos juntos con la regla par-impar.
def agrupar(lista: list[dict]) -> list[dict]:
    grupos: list[dict] = []
    for pieza in sorted(lista, key=lambda q: q["caja"][0] - q["caja"][2]):
        madre = next((g for g in grupos if dentro(pieza["caja"], g["caja"])), None)
        if madre:
            madre["d"] += pieza["d"]
        else:
            grupos.append(dict(pieza))
    return sorted(grupos, key=lambda g: g["caja"][0])


emblema = [q for q in piezas if q["tipo"] == "emblema"]
letras = agrupar([q for q in piezas if q["tipo"] == "letra"])
assert len(letras) == 8, "TRAINING tiene 8 letras"


def lista(valores) -> str:
    return "[\n" + "".join(f"  {v},\n" for v in valores) + "]"


def trazo(d: str, largo: float, **extra) -> str:
    campos = [f"d: {json.dumps(d)}", f"largo: {largo}"] + [f"{k}: {json.dumps(v)}" for k, v in extra.items()]
    return "{ " + ", ".join(campos) + " }"


SALIDA.parent.mkdir(parents=True, exist_ok=True)
SALIDA.write_text(
    f"""/**
 * Generado por assets/logo/vectorizar.py a partir de assets/logo/original.webp.
 * No se edita a mano: se vuelve a generar.
 *
 * Coordenadas en un lienzo de 1200 x 1200 con el origen en el centro del aro
 * grueso. `largo` es la longitud del trazado, para dibujarlo poco a poco.
 */

export type Trazo = {{ readonly d: string; readonly largo: number }}

/** Los tres aros, del grueso al fino interior. Empiezan arriba, en el sentido del reloj. */
export const AROS: readonly (Trazo & {{ readonly nombre: string; readonly grosor: number }})[] = {lista(trazo(a["d"], a["largo"], nombre=a["nombre"], grosor=a["grosor"]) for a in aros)}

/** El contorno de omega, alfa y el rayo, pieza a pieza. */
export const CONTORNOS: readonly Trazo[] = {lista(trazo(q["d"], q["largo"]) for q in emblema)}

/** El relleno de omega, alfa y el rayo, con sus huecos. Regla par-impar. */
export const RELLENOS: readonly string[] = {lista(json.dumps(g["d"]) for g in agrupar(emblema))}

/** TRAINING, una letra por elemento, de izquierda a derecha. Regla par-impar. */
export const LETRAS: readonly string[] = {lista(json.dumps(g["d"]) for g in letras)}

/** Los bordes del rayo donde pasa por encima del arco del omega. */
export const CANTOS: readonly string[] = {lista(json.dumps(c) for c in cantos)}
"""
)
print(len(piezas), "piezas ->", SALIDA)
