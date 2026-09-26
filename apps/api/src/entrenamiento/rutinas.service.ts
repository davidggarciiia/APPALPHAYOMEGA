import { Injectable, NotFoundException } from "@nestjs/common"
import {
  PatronRutinaSchema,
  type EditarRutina,
  type GuardarRutina,
  type ListadoRutinas,
  type PatronRutina,
  type RutinaGuardada,
} from "@alpha-omega/shared"

import { conflicto } from "../comun/conflictos.js"
import { PrismaService } from "../prisma/prisma.service.js"

function aRutina(fila: {
  id: string
  nombre: string
  patron: unknown
  revision: number
}): RutinaGuardada {
  return {
    id: fila.id,
    nombre: fila.nombre,
    patron: PatronRutinaSchema.parse(fila.patron),
    revision: fila.revision,
  }
}

/**
 * La biblioteca de rutinas del entrenador.
 *
 * Una rutina es una estructura de sesiones, ejercicios y objetivos. No conoce
 * a ningún cliente: elegirla en el editor crea una copia, y editarla después no
 * cambia nada de lo que ya se asignó.
 */
@Injectable()
export class RutinasService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(): Promise<ListadoRutinas> {
    const filas = await this.prisma.rutinaGuardada.findMany({
      orderBy: [{ nombre: "asc" }, { id: "asc" }],
    })
    return { rutinas: filas.map(aRutina), total: filas.length }
  }

  async leer(id: string): Promise<RutinaGuardada> {
    return aRutina(await this.buscar(id))
  }

  async crear(datos: GuardarRutina): Promise<RutinaGuardada> {
    await this.exigirEjercicios(datos.patron)
    const fila = await this.prisma.rutinaGuardada.create({
      data: { nombre: datos.nombre, patron: datos.patron },
    })
    return aRutina(fila)
  }

  /** Revisión optimista: dos ediciones de la misma versión no se pisan. */
  async editar(id: string, datos: EditarRutina): Promise<RutinaGuardada> {
    await this.buscar(id)
    await this.exigirEjercicios(datos.patron)
    const { count } = await this.prisma.rutinaGuardada.updateMany({
      where: { id, revision: datos.revision },
      data: { nombre: datos.nombre, patron: datos.patron, revision: { increment: 1 } },
    })
    if (count !== 1) {
      throw conflicto(
        "rutina_cambiada",
        "La rutina ha cambiado mientras la editabas. Vuelve a cargarla",
      )
    }
    return this.leer(id)
  }

  private async buscar(
    id: string,
  ): Promise<{ id: string; nombre: string; patron: unknown; revision: number }> {
    const fila = await this.prisma.rutinaGuardada.findUnique({ where: { id } })
    if (fila === null) {
      throw new NotFoundException("Esta rutina no existe")
    }
    return fila
  }

  /**
   * Los ejercicios tienen que existir. Retirados sí se admiten: la rutina se
   * sigue pudiendo consultar, y es al asignarla cuando se exige cambiarlos.
   */
  private async exigirEjercicios(patron: PatronRutina): Promise<void> {
    const ids = [...new Set(patron.sesiones.flatMap((s) => s.ejercicios.map((e) => e.ejercicioId)))]
    const existentes = await this.prisma.ejercicio.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    })
    const conocidos = new Set(existentes.map((e) => e.id))
    const faltan = ids.filter((id) => !conocidos.has(id))
    if (faltan.length > 0) {
      throw conflicto("ejercicio_no_disponible", "Hay ejercicios que ya no existen", {
        ids: faltan,
      })
    }
  }
}
