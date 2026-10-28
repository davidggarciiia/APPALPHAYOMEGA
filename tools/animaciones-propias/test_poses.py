import math
import unittest

from poses import movimientos, pose


def distancia(a, b):
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


class MovimientoTest(unittest.TestCase):
    def test_las_tres_muestras_tienen_movimiento_y_bucle_continuo(self):
        self.assertEqual(set(movimientos()), {"press-inclinado", "remo-polea", "dead-bug"})
        for nombre in movimientos():
            inicio, fin = pose(nombre, 0), pose(nombre, 1)
            for articulacion in inicio:
                self.assertLess(distancia(inicio[articulacion], fin[articulacion]), 1e-9)
            self.assertGreater(distancia(inicio["l_wrist"], pose(nombre, 0.25)["l_wrist"]), 0.2)

    def test_longitudes_de_brazos_y_piernas_constantes(self):
        for nombre in movimientos():
            for fotograma in range(145):
                puntos = pose(nombre, fotograma / 144)
                for lado in ("l", "r"):
                    for a, b, longitud in (("shoulder", "elbow", 0.30),
                                           ("elbow", "wrist", 0.275),
                                           ("hip", "knee", 0.425),
                                           ("knee", "ankle", 0.435)):
                        self.assertAlmostEqual(distancia(puntos[f"{lado}_{a}"], puntos[f"{lado}_{b}"]), longitud, places=6)

    def test_pies_y_tronco_estables_en_press_y_remo(self):
        for nombre in ("press-inclinado", "remo-polea"):
            inicio = pose(nombre, 0)
            for fotograma in range(145):
                puntos = pose(nombre, fotograma / 144)
                for articulacion in ("l_ankle", "r_ankle", "pelvis", "chest", "head"):
                    self.assertLess(distancia(inicio[articulacion], puntos[articulacion]), 1e-9)

    def test_dead_bug_alterna_brazo_y_pierna_contrarios(self):
        inicio, primera, segunda = (pose("dead-bug", t) for t in (0, 0.25, 0.75))
        self.assertGreater(distancia(inicio["l_wrist"], primera["l_wrist"]), 0.5)
        self.assertGreater(distancia(inicio["r_ankle"], primera["r_ankle"]), 0.4)
        self.assertLess(distancia(inicio["r_wrist"], primera["r_wrist"]), 1e-9)
        self.assertLess(distancia(inicio["l_ankle"], primera["l_ankle"]), 1e-9)
        self.assertGreater(distancia(inicio["r_wrist"], segunda["r_wrist"]), 0.5)
        self.assertGreater(distancia(inicio["l_ankle"], segunda["l_ankle"]), 0.4)
        for fase in (primera, segunda):
            self.assertLess(distancia(fase["pelvis"], inicio["pelvis"]), 1e-9)
            self.assertLess(distancia(fase["chest"], inicio["chest"]), 1e-9)

    def test_sin_saltos_entre_fotogramas(self):
        for nombre in movimientos():
            anterior = pose(nombre, 0)
            for fotograma in range(1, 145):
                actual = pose(nombre, fotograma / 144)
                for articulacion in anterior:
                    self.assertLess(distancia(anterior[articulacion], actual[articulacion]), 0.055)
                anterior = actual


if __name__ == "__main__":
    unittest.main()
