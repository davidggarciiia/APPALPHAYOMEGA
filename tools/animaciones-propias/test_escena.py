"""Tests sobre la geometría real evaluada por Blender, sin renderizar."""

from pathlib import Path
import sys
import unittest

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from escena import preparar_estudio
from poses import pose


def minimo_z(objeto):
    evaluado = objeto.evaluated_get(bpy.context.evaluated_depsgraph_get())
    malla = evaluado.to_mesh()
    try:
        return min((evaluado.matrix_world @ vertice.co).z for vertice in malla.vertices)
    finally:
        evaluado.to_mesh_clear()


class ContactosTest(unittest.TestCase):
    def test_zapatillas_apoyadas_en_suelo(self):
        escena, personaje, _equipo = preparar_estudio("press-inclinado")
        personaje.actualizar(pose("press-inclinado", 0), "press-inclinado", 1)
        escena.frame_set(1)
        bpy.context.view_layer.update()
        for zapatilla in personaje.pies.values():
            self.assertAlmostEqual(minimo_z(zapatilla), 0.0, delta=.004)

    def test_cabeza_y_pelvis_apoyadas_en_colchoneta(self):
        escena, personaje, _equipo = preparar_estudio("dead-bug")
        personaje.actualizar(pose("dead-bug", .25), "dead-bug", 1)
        escena.frame_set(1)
        bpy.context.view_layer.update()
        for objeto in (personaje.cabeza, personaje.pelvis):
            self.assertAlmostEqual(minimo_z(objeto), .034, delta=.005)
        # La espalda debe tocar la superficie, con margen de deformación del acolchado.
        self.assertLessEqual(minimo_z(personaje.cuerpo), .044)
        self.assertGreaterEqual(minimo_z(personaje.cuerpo), .009)


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(ContactosTest)
    resultado = unittest.TextTestRunner(verbosity=2).run(suite)
    if not resultado.wasSuccessful():
        raise SystemExit(1)
