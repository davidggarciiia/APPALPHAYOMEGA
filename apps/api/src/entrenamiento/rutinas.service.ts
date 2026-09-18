import { Injectable, NotFoundException } from "@nestjs/common"
import {
  RutinaGuardadaSchema,
  PatronRutinaSchema,
  type ConsultarRutinas,
  type EditarRutina,
  type GuardarRutina,
  type ListadoRutinas,
  type RutinaGuardada,
} from "@alpha-omega/shared"
import type { RutinaGuardada as FilaRutina } from "@prisma/client"
import { PrismaService } from "../prisma/prisma.service.js"
import { catalogoParaPrescribir, conflicto, leerDocumento } from "./documentos.js"

@Injectable()
export class RutinasService {
  constructor(private readonly prisma: PrismaService) {}
  private publica(fila: FilaRutina): RutinaGuardada {
    return RutinaGuardadaSchema.parse({
      id: fila.id,
      nombre: fila.nombre,
      revision: fila.revision,
      patron: leerDocumento(fila.patron, PatronRutinaSchema, fila.version),
    })
  }
  async listar(consulta: ConsultarRutinas): Promise<ListadoRutinas> {
    const where = { nombre: { contains: consulta.buscar, mode: "insensitive" as const } }
    const [filas, total] = await this.prisma.$transaction([
      this.prisma.rutinaGuardada.findMany({
        where,
        orderBy: [{ nombre: "asc" }, { id: "asc" }],
        skip: consulta.desplazamiento,
        take: consulta.limite,
      }),
      this.prisma.rutinaGuardada.count({ where }),
    ])
    return { rutinas: filas.map((fila) => this.publica(fila)), total }
  }
  async leer(id: string): Promise<RutinaGuardada> {
    const fila = await this.prisma.rutinaGuardada.findUnique({ where: { id } })
    if (!fila) throw new NotFoundException("Rutina no disponible")
    return this.publica(fila)
  }
  async guardar(creadorId: string, datos: GuardarRutina): Promise<RutinaGuardada> {
    return this.prisma.$transaction(async (tx) => {
      await catalogoParaPrescribir(
        tx,
        datos.patron.sesiones.flatMap((sesion) => sesion.ejercicios),
      )
      return this.publica(
        await tx.rutinaGuardada.create({
          data: { creadorId, nombre: datos.nombre, patron: datos.patron },
        }),
      )
    })
  }
  async editar(id: string, datos: EditarRutina): Promise<RutinaGuardada> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "rutinas_guardadas" WHERE "id" = ${id} FOR UPDATE`
      const fila = await tx.rutinaGuardada.findUnique({ where: { id } })
      if (!fila) throw new NotFoundException("Rutina no disponible")
      this.publica(fila)
      if (fila.revision !== datos.revision)
        throw conflicto("revision_obsoleta", "La rutina ha cambiado. Recarga antes de guardar.")
      await catalogoParaPrescribir(
        tx,
        datos.patron.sesiones.flatMap((sesion) => sesion.ejercicios),
      )
      return this.publica(
        await tx.rutinaGuardada.update({
          where: { id },
          data: { nombre: datos.nombre, patron: datos.patron, revision: { increment: 1 } },
        }),
      )
    })
  }
}
