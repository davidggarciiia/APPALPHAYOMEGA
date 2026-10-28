"""Personaje, equipo y estudio originales. No contiene assets de terceros."""

import math

import bpy
from mathutils import Euler, Vector


def material(nombre, color, metal=0.0, rugosidad=0.45):
    resultado = bpy.data.materials.new(nombre)
    resultado.diffuse_color = (*color, 1)
    resultado.use_nodes = True
    shader = resultado.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Metallic"].default_value = metal
    shader.inputs["Roughness"].default_value = rugosidad
    return resultado


def suavizar(objeto):
    for poligono in objeto.data.polygons:
        poligono.use_smooth = True


def esfera(nombre, posicion, escala, color):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=20, location=posicion)
    objeto = bpy.context.object
    objeto.name = nombre
    objeto.scale = escala
    objeto.data.materials.append(color)
    suavizar(objeto)
    return objeto


def caja(nombre, posicion, dimensiones, color, bisel=0.02):
    bpy.ops.mesh.primitive_cube_add(size=1, location=posicion)
    objeto = bpy.context.object
    objeto.name = nombre
    objeto.dimensions = dimensiones
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    objeto.data.materials.append(color)
    if bisel:
        modificador = objeto.modifiers.new("Bordes suaves", "BEVEL")
        modificador.width = bisel
        modificador.segments = 4
        objeto.modifiers.new("Normales de superficie", "WEIGHTED_NORMAL")
    return objeto


def barra(nombre, inicio, fin, radio, color):
    a, b = Vector(inicio), Vector(fin)
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=radio, depth=(b - a).length,
                                       location=(a + b) * 0.5)
    objeto = bpy.context.object
    objeto.name = nombre
    objeto.rotation_mode = "QUATERNION"
    objeto.rotation_quaternion = (b - a).to_track_quat("Z", "Y")
    objeto.data.materials.append(color)
    modificador = objeto.modifiers.new("Cantos", "BEVEL")
    modificador.width = min(0.008, radio / 3)
    modificador.segments = 3
    suavizar(objeto)
    return objeto


def malla_perfil(nombre, anillos, color, segmentos=32):
    vertices, caras = [], []
    for z, rx, ry in anillos:
        for i in range(segmentos):
            angulo = 2 * math.pi * i / segmentos
            vertices.append((rx * math.cos(angulo), ry * math.sin(angulo), z))
    for j in range(len(anillos) - 1):
        for i in range(segmentos):
            siguiente = (i + 1) % segmentos
            caras.append((j * segmentos + i, j * segmentos + siguiente,
                          (j + 1) * segmentos + siguiente, (j + 1) * segmentos + i))
    caras.append(tuple(reversed(range(segmentos))))
    caras.append(tuple((len(anillos) - 1) * segmentos + i for i in range(segmentos)))
    malla = bpy.data.meshes.new(nombre)
    malla.from_pydata(vertices, [], caras)
    malla.update()
    objeto = bpy.data.objects.new(nombre, malla)
    bpy.context.collection.objects.link(objeto)
    objeto.data.materials.append(color)
    suavizar(objeto)
    modificador = objeto.modifiers.new("Continuidad orgánica", "SUBSURF")
    modificador.levels = 1
    modificador.render_levels = 1
    return objeto


def segmento(nombre, radio, color):
    return malla_perfil(nombre, [(0, radio * .55, radio * .55),
                                (.07, radio * .85, radio * .85),
                                (.25, radio * 1.06, radio),
                                (.60, radio, radio * .95),
                                (.93, radio * .65, radio * .65),
                                (1, radio * .50, radio * .50)], color, 24)


def entre(objeto, inicio, fin):
    a, b = Vector(inicio), Vector(fin)
    objeto.location = a
    objeto.rotation_mode = "QUATERNION"
    objeto.rotation_quaternion = (b - a).to_track_quat("Z", "Y")
    objeto.scale.z = (b - a).length


def clave(objeto, fotograma):
    objeto.keyframe_insert("location", frame=fotograma)
    objeto.keyframe_insert("rotation_quaternion" if objeto.rotation_mode == "QUATERNION"
                          else "rotation_euler", frame=fotograma)
    objeto.keyframe_insert("scale", frame=fotograma)


class Personaje:
    def __init__(self, colores):
        self.cuerpo = malla_perfil("Tronco original", [(-.10, .13, .095),
                                                      (0, .145, .105),
                                                      (.16, .125, .085),
                                                      (.32, .185, .115),
                                                      (.45, .21, .12),
                                                      (.51, .175, .10),
                                                      (.54, .13, .065)], colores["piel"])
        self.pelvis = esfera("Pelvis", (0, 0, 0), (.16, .11, .12), colores["acento"])
        self.cabeza = esfera("Cabeza", (0, 0, 0), (.103, .095, .137), colores["piel"])
        self.nariz = esfera("Nariz", (0, 0, 0), (.022, .032, .033), colores["piel"])
        self.cuello = segmento("Cuello", .047, colores["piel"])
        self.orejas = {s: esfera(f"Oreja {s}", (0, 0, 0), (.018, .028, .033), colores["piel"])
                       for s in ("l", "r")}
        self.segmentos, self.articulaciones, self.manos, self.pies = {}, {}, {}, {}
        for lado in ("l", "r"):
            for a, b, radio in (("shoulder", "elbow", .057), ("elbow", "wrist", .046),
                                ("hip", "knee", .092), ("knee", "ankle", .065)):
                self.segmentos[(lado, a, b)] = segmento(f"{lado} {a}-{b}", radio, colores["piel"])
            for articulacion, radio in (("shoulder", .071), ("elbow", .041), ("wrist", .030),
                                        ("hip", .075), ("knee", .060), ("ankle", .034)):
                self.articulaciones[(lado, articulacion)] = esfera(
                    f"{lado} {articulacion}", (0, 0, 0), (radio,) * 3, colores["piel"])
            self.manos[lado] = esfera(f"Mano {lado}", (0, 0, 0), (.042, .032, .067), colores["piel"])
            self.pies[lado] = esfera(f"Zapatilla {lado}", (0, 0, 0), (.065, .135, .045), colores["zapato"])

    def actualizar(self, puntos, ejercicio, fotograma):
        pelvis, pecho, cabeza = (Vector(puntos[n]) for n in ("pelvis", "chest", "head"))
        eje = (pecho - pelvis).normalized()
        giro = Euler((-math.atan2(eje.y, eje.z), 0, 0)).to_quaternion()
        frente = giro @ Vector((0, -1, 0))
        self.cuerpo.location = pelvis
        self.cuerpo.rotation_mode = "QUATERNION"
        self.cuerpo.rotation_quaternion = giro
        self.cuerpo.scale.z = (pecho - pelvis).length / .51
        for objeto, posicion in ((self.pelvis, pelvis), (self.cabeza, cabeza),
                                  (self.nariz, cabeza + frente * .092 + eje * .003)):
            objeto.location = posicion
            objeto.rotation_mode = "QUATERNION"
            objeto.rotation_quaternion = giro
            clave(objeto, fotograma)
        entre(self.cuello, pecho + eje * .025, cabeza - eje * .115)
        clave(self.cuerpo, fotograma)
        clave(self.cuello, fotograma)
        for lado, signo in (("l", -1), ("r", 1)):
            oreja = self.orejas[lado]
            oreja.location = cabeza + Vector((signo * .103, 0, 0))
            oreja.rotation_mode = "QUATERNION"
            oreja.rotation_quaternion = giro
            clave(oreja, fotograma)
        for (lado, a, b), objeto in self.segmentos.items():
            entre(objeto, puntos[f"{lado}_{a}"], puntos[f"{lado}_{b}"])
            clave(objeto, fotograma)
        for (lado, nombre), objeto in self.articulaciones.items():
            objeto.location = puntos[f"{lado}_{nombre}"]
            clave(objeto, fotograma)
        centros_mano = {}
        for lado in ("l", "r"):
            codo, muneca = (Vector(puntos[f"{lado}_{n}"]) for n in ("elbow", "wrist"))
            direccion = (muneca - codo).normalized()
            centro = muneca + direccion * .035
            mano = self.manos[lado]
            mano.location = centro
            mano.rotation_mode = "QUATERNION"
            mano.rotation_quaternion = direccion.to_track_quat("Z", "Y")
            clave(mano, fotograma)
            centros_mano[lado] = centro
            pie = self.pies[lado]
            pie.rotation_mode = "QUATERNION"
            if ejercicio == "dead-bug":
                abajo = Vector(puntos[f"{lado}_ankle"]) - Vector(puntos[f"{lado}_knee"])
                giro_pie = Euler((math.atan2(abajo.y, -abajo.z), 0, 0)).to_quaternion()
            else:
                giro_pie = Euler((0, 0, 0)).to_quaternion()
            pie.rotation_quaternion = giro_pie
            altura_calzado = {"press-inclinado": -.055, "remo-polea": -.041, "dead-bug": -.038}[ejercicio]
            pie.location = Vector(puntos[f"{lado}_ankle"]) + giro_pie @ Vector((0, -.06, altura_calzado))
            clave(pie, fotograma)
        return centros_mano


class Equipo:
    def __init__(self, ejercicio, colores):
        self.ejercicio = ejercicio
        self.mancuernas = {}
        self.agarre = None
        self.cable = None
        self.cable_vertical = None
        self.placas = []
        self.distancia_inicial = None
        if ejercicio == "press-inclinado":
            respaldo = caja("Respaldo inclinado", (0, .38, .675), (.40, .95, .065), colores["tapizado"])
            respaldo.rotation_euler.x = math.radians(30)
            caja("Asiento", (0, -.15, .47), (.40, .35, .075), colores["tapizado"])
            caja("Base banco", (0, .15, .05), (.34, 1.04, .07), colores["metal"])
            barra("Soporte banco", (0, .12, .09), (0, .12, .53), .045, colores["metal"])
            barra("Apoyo respaldo", (0, .42, .08), (0, .55, .72), .035, colores["metal"])
            for lado in ("l", "r"):
                bpy.ops.object.empty_add(type="PLAIN_AXES")
                padre = bpy.context.object
                padre.name = f"Mancuerna {lado}"
                mango = barra(f"Mango {lado}", (-.095, 0, 0), (.095, 0, 0), .016, colores["cromo"])
                mango.parent = padre
                for signo in (-1, 1):
                    disco = barra(f"Disco {lado} {signo}", (signo * .078, 0, 0),
                                  (signo * .13, 0, 0), .084, colores["metal"])
                    disco.parent = padre
                self.mancuernas[lado] = padre
        elif ejercicio == "remo-polea":
            caja("Asiento remo", (0, .03, .475), (.42, .42, .075), colores["tapizado"])
            barra("Columna asiento", (0, .03, .06), (0, .03, .46), .045, colores["metal"])
            caja("Base asiento", (0, .03, .04), (.52, .63, .065), colores["metal"])
            for signo in (-1, 1):
                caja(f"Apoyo pie {signo}", (signo * .16, -.74, .022), (.18, .27, .044), colores["metal"])
                barra(f"Guía de carga {signo}", (signo * .23, -1.38, .06),
                      (signo * .23, -1.38, 1.2), .022, colores["cromo"])
            caja("Base polea", (0, -1.38, .06), (.63, .42, .085), colores["metal"])
            caja("Travesaño polea", (0, -1.38, 1.21), (.57, .25, .05), colores["metal"])
            for i in range(8):
                placa = caja(f"Placa de carga {i}", (0, -1.38, .15 + i * .047),
                             (.35, .24, .038), colores["metal"], .008)
                self.placas.append((placa, placa.location.z))
            barra("Polea", (-.03, -1.25, 1.00), (.03, -1.25, 1.00), .09, colores["metal"])
            barra("Retorno de cable", (-.03, -1.38, 1.20), (.03, -1.38, 1.20), .07, colores["metal"])
            barra("Tramo fijo", (0, -1.25, 1.00), (0, -1.38, 1.20), .004, colores["metal"])
            self.agarre = segmento("Agarre doble", .016, colores["cromo"])
            self.cable = segmento("Cable de resistencia", .004, colores["metal"])
            self.cable_vertical = segmento("Cable hacia carga", .004, colores["metal"])
        else:
            caja("Colchoneta", (0, .22, .017), (.73, 2.3, .034), colores["tapizado"], .014)

    def actualizar(self, manos, fotograma):
        for lado, padre in self.mancuernas.items():
            padre.location = manos[lado]
            clave(padre, fotograma)
        if self.agarre:
            entre(self.agarre, manos["l"], manos["r"])
            clave(self.agarre, fotograma)
            centro = (manos["l"] + manos["r"]) * .5
            entre(self.cable, (0, -1.25, 1.00), centro)
            clave(self.cable, fotograma)
            distancia = (centro - Vector((0, -1.25, 1.00))).length
            if self.distancia_inicial is None:
                self.distancia_inicial = distancia
            elevacion = distancia - self.distancia_inicial
            for placa, altura in self.placas:
                placa.location.z = altura + elevacion
                clave(placa, fotograma)
            entre(self.cable_vertical, (0, -1.38, 1.20),
                  (0, -1.38, self.placas[-1][1] + .025 + elevacion))
            clave(self.cable_vertical, fotograma)


def preparar_estudio(ejercicio, resolucion=720):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    colores = {
        "piel": material("Maniquí · porcelana mate", (.64, .69, .71), rugosidad=.38),
        "acento": material("Short · verde petróleo", (.025, .17, .19), rugosidad=.65),
        "zapato": material("Calzado · grafito", (.14, .18, .19), rugosidad=.68),
        "tapizado": material("Equipo · verde suave", (.035, .25, .27), rugosidad=.72),
        "metal": material("Equipo · grafito", (.065, .09, .10), metal=.55, rugosidad=.35),
        "cromo": material("Equipo · acero", (.40, .48, .50), metal=.85, rugosidad=.27),
        "fondo": material("Estudio · papel", (.79, .83, .84), rugosidad=.8),
    }
    bpy.ops.mesh.primitive_plane_add(size=200)
    suelo = bpy.context.object
    suelo.name = "Suelo del estudio"
    suelo.data.materials.append(colores["fondo"])
    escena = bpy.context.scene
    escena.render.engine = "BLENDER_EEVEE"
    escena.eevee.taa_render_samples = 16
    escena.render.resolution_x = resolucion
    escena.render.resolution_y = resolucion
    escena.render.resolution_percentage = 100
    escena.render.fps = 24
    escena.render.image_settings.file_format = "PNG"
    escena.render.image_settings.color_mode = "RGB"
    escena.render.film_transparent = False
    escena.world.color = (.65, .65, .65)
    escena.world.use_nodes = True
    escena.world.node_tree.nodes.get("Background").inputs["Color"].default_value = (.70, .77, .80, 1)
    escena.world.node_tree.nodes.get("Background").inputs["Strength"].default_value = .35
    escena.view_settings.view_transform = "AgX"
    for nombre, posicion, potencia, tamano in (("Principal", (2, -3, 5), 750, 4),
                                              ("Relleno", (-3, -1, 3), 450, 3),
                                              ("Contorno", (0, 3, 4), 650, 3)):
        bpy.ops.object.light_add(type="AREA", location=posicion)
        luz = bpy.context.object
        luz.name = nombre
        luz.data.energy = potencia
        # El A/B en Iris Xe/OpenGL pierde toda la luz al evaluar sombras AREA.
        # Estas muestras usan iluminación difusa estable, sin sombras proyectadas.
        luz.data.use_shadow = False
        luz.data.shape = "DISK"
        luz.data.size = tamano
        luz.rotation_euler = (Vector((0, 0, .6)) - luz.location).to_track_quat("-Z", "Y").to_euler()
    if ejercicio == "dead-bug":
        posicion, objetivo, escala = (3.0, -3.0, 3.5), (0, .15, .32), 2.65
    elif ejercicio == "remo-polea":
        posicion, objetivo, escala = (3.5, -3.2, 2.8), (0, -.37, .73), 3.05
    else:
        posicion, objetivo, escala = (3.3, -4.1, 2.9), (0, .13, .81), 2.4
    bpy.ops.object.camera_add(location=posicion)
    camara = bpy.context.object
    camara.name = "Cámara fija · tres cuartos"
    camara.rotation_euler = (Vector(objetivo) - camara.location).to_track_quat("-Z", "Y").to_euler()
    camara.data.type = "ORTHO"
    camara.data.ortho_scale = escala
    camara.data.lens = 50
    escena.camera = camara
    return escena, Personaje(colores), Equipo(ejercicio, colores)
