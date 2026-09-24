import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import {
  ListadoNovedadesSchema,
  PrescripcionSchema,
  type ConsultarNovedades,
  type ListadoNovedades,
  type MarcarNovedadesLeidas,
  type NovedadesLeidas,
  type SesionEntrenador,
} from "@alpha-omega/shared"

import type { IdentidadVerificada } from "../identity/peticion.js"
import { PrismaService } from "../prisma/prisma.service.js"
import { conflicto, leerDocumento } from "./documentos.js"
import { registrarNovedad } from "./novedades.js"
import { SesionesService } from "./sesiones.service.js"

@Injectable()
export class NovedadesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sesiones: SesionesService,
  ) {}

  async revisar(identidad: IdentidadVerificada, sesionId: string): Promise<SesionEntrenador> {
    if (identidad.rol !== "entrenador") throw new ForbiddenException()
    return this.prisma.$transaction(async (tx) => {
      const fila = await this.sesiones.bloquear(tx, identidad, sesionId)
      if (fila.resultado === null)
        throw conflicto("operacion_incompatible", "Solo se revisan sesiones enviadas")
      if (fila.revisadaEn !== null) return this.sesiones.publica(fila)
      const revisadaEn = new Date()
      const actualizada = await tx.sesionEntrenamiento.update({
        where: { id: sesionId },
        data: { revisadaEn, revisadaPorId: identidad.sub },
        include: { agenda: true },
      })
      await registrarNovedad(tx, {
        sesionId,
        clienteId: fila.clienteId,
        autorId: identidad.sub,
        audiencia: "cliente",
        tipo: "sesion_revisada",
      })
      return this.sesiones.publica(actualizada)
    })
  }

  async listar(
    identidad: IdentidadVerificada,
    clienteId: string,
    consulta: ConsultarNovedades,
  ): Promise<ListadoNovedades> {
    this.sesiones.comprobarAcceso(identidad, clienteId)
    const cliente = await this.prisma.usuario.findFirst({
      where: { id: clienteId, rol: "cliente" },
      select: { id: true },
    })
    if (!cliente) throw new NotFoundException("Cliente no disponible")
    const donde = { clienteId, audiencia: identidad.rol }
    const [filas, total, sinLeer] = await Promise.all([
      this.prisma.novedadEntrenamiento.findMany({
        where: donde,
        include: {
          autor: { select: { id: true, nombre: true, rol: true } },
          sesion: { select: { prescripcion: true, version: true } },
          lecturas: { where: { usuarioId: identidad.sub }, select: { leidaEn: true } },
        },
        orderBy: [{ creadaEn: "desc" }, { id: "asc" }],
        skip: consulta.desplazamiento,
        take: consulta.limite,
      }),
      this.prisma.novedadEntrenamiento.count({ where: donde }),
      this.prisma.novedadEntrenamiento.count({
        where: { ...donde, lecturas: { none: { usuarioId: identidad.sub } } },
      }),
    ])
    return ListadoNovedadesSchema.parse({
      total,
      sinLeer,
      novedades: filas.map((fila) => ({
        id: fila.id,
        sesionId: fila.sesionId,
        clienteId: fila.clienteId,
        tipo: fila.tipo,
        sesionNombre: leerDocumento(
          fila.sesion.prescripcion,
          PrescripcionSchema,
          fila.sesion.version,
        ).nombre,
        autor: fila.autor,
        creadaEn: fila.creadaEn.toISOString(),
        leidaEn: fila.lecturas[0]?.leidaEn.toISOString() ?? null,
      })),
    })
  }

  async marcarLeidas(
    identidad: IdentidadVerificada,
    sesionId: string,
    datos: MarcarNovedadesLeidas,
  ): Promise<NovedadesLeidas> {
    await this.sesiones.fila(this.prisma, identidad, sesionId)
    const disponibles = await this.prisma.novedadEntrenamiento.findMany({
      where: { id: { in: datos.novedadIds }, sesionId, audiencia: identidad.rol },
      select: { id: true },
    })
    if (disponibles.length !== datos.novedadIds.length)
      throw new NotFoundException("Novedad no disponible")
    await this.prisma.lecturaNovedad.createMany({
      data: datos.novedadIds.map((novedadId) => ({ novedadId, usuarioId: identidad.sub })),
      skipDuplicates: true,
    })
    return { leidas: datos.novedadIds.length }
  }
}
