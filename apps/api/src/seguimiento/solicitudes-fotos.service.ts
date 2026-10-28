import { Injectable, NotFoundException } from "@nestjs/common"
import {
  SolicitudFotosSchema,
  type CrearSolicitudFotos,
  type ListadoSolicitudesFotos,
  type SolicitudFotos,
} from "@alpha-omega/shared"
import type { Prisma } from "@prisma/client"

import { fechaSql } from "../agenda/fechas.js"
import { conflicto, esCodigoPrisma } from "../entrenamiento/documentos.js"
import type { IdentidadVerificada } from "../identity/peticion.js"
import { medioPublico } from "../medios/medios.service.js"
import { PrismaService } from "../prisma/prisma.service.js"

const AUTOR = { select: { id: true, nombre: true, apellidos: true } } as const
const INCLUIR = {
  autor: AUTOR,
  medios: {
    where: { estado: { not: "pendiente" } },
    include: { autor: AUTOR },
    orderBy: { creadoEn: "asc" },
  },
} satisfies Prisma.SolicitudFotosInclude

type Fila = Prisma.SolicitudFotosGetPayload<{ include: typeof INCLUIR }>

function solicitud(fila: Fila): SolicitudFotos {
  return SolicitudFotosSchema.parse({
    id: fila.id,
    clienteId: fila.clienteId,
    autor: {
      id: fila.autor.id,
      nombre: [fila.autor.nombre, fila.autor.apellidos].filter(Boolean).join(" "),
    },
    vistas: fila.vistas,
    fechaLimite: fila.fechaLimite?.toISOString().slice(0, 10) ?? null,
    mensaje: fila.mensaje,
    estado: fila.estado,
    creadaEn: fila.creadaEn.toISOString(),
    recibidaEn: fila.recibidaEn?.toISOString() ?? null,
    revisadaEn: fila.revisadaEn?.toISOString() ?? null,
    medios: fila.medios.map(medioPublico),
  })
}

/**
 * Fotos que el entrenador pide al cliente. El cliente las aporta con el flujo
 * de medios; que lleguen las marca «recibidas», y solo una acción explícita del
 * entrenador las marca «revisadas».
 */
@Injectable()
export class SolicitudesFotosService {
  constructor(private readonly prisma: PrismaService) {}

  private async clienteActivo(clienteId: string): Promise<void> {
    const cliente = await this.prisma.usuario.findFirst({
      where: { id: clienteId, rol: "cliente" },
      select: { estado: true },
    })
    if (!cliente) throw new NotFoundException("Cliente no disponible")
    if (cliente.estado === "desactivado")
      throw conflicto("operacion_incompatible", "Este cliente está dado de baja")
  }

  async crear(
    actor: IdentidadVerificada,
    clienteId: string,
    datos: CrearSolicitudFotos,
  ): Promise<SolicitudFotos> {
    await this.clienteActivo(clienteId)
    const repetida = async (): Promise<SolicitudFotos | null> => {
      const previa = await this.prisma.solicitudFotos.findUnique({
        where: { autorId_operacionId: { autorId: actor.sub, operacionId: datos.operacionId } },
        include: INCLUIR,
      })
      if (!previa) return null
      const igual =
        previa.clienteId === clienteId &&
        previa.vistas.join(",") === datos.vistas.join(",") &&
        (previa.fechaLimite?.toISOString().slice(0, 10) ?? null) === datos.fechaLimite &&
        previa.mensaje === datos.mensaje
      if (!igual)
        throw conflicto("operacion_incompatible", "Esta operación ya se utilizó con otro contenido")
      return solicitud(previa)
    }
    const antes = await repetida()
    if (antes) return antes
    try {
      return solicitud(
        await this.prisma.solicitudFotos.create({
          data: {
            clienteId,
            autorId: actor.sub,
            operacionId: datos.operacionId,
            vistas: datos.vistas,
            fechaLimite: datos.fechaLimite ? fechaSql(datos.fechaLimite) : null,
            mensaje: datos.mensaje,
          },
          include: INCLUIR,
        }),
      )
    } catch (error) {
      if (esCodigoPrisma(error, "P2002")) {
        const ganadora = await repetida()
        if (ganadora) return ganadora
      }
      throw error
    }
  }

  async listar(clienteId: string): Promise<ListadoSolicitudesFotos> {
    const filas = await this.prisma.solicitudFotos.findMany({
      where: { clienteId },
      include: INCLUIR,
      orderBy: [{ creadaEn: "desc" }, { id: "desc" }],
      take: 50,
    })
    return { solicitudes: filas.map(solicitud) }
  }

  /** «Revisada» solo por acción explícita, y solo si hay algo recibido. */
  async revisar(clienteId: string, id: string, operacionId: string): Promise<SolicitudFotos> {
    return this.prisma.$transaction(async (tx) => {
      // Mismo candado que la confirmación, antes de leer fotos o decidir estado.
      await tx.solicitudFotos.updateMany({ where: { id, clienteId }, data: { clienteId } })
      const fila = await tx.solicitudFotos.findFirst({ where: { id, clienteId }, include: INCLUIR })
      if (!fila) throw new NotFoundException("Solicitud no disponible")
      if (fila.revisionOperacionId === operacionId) return solicitud(fila)
      if (fila.estado === "revisada")
        throw conflicto("estado_incompatible", "Esta solicitud ya está revisada")
      if (fila.estado !== "recibida")
        throw conflicto("estado_incompatible", "Aún no ha llegado ninguna foto de esta solicitud")
      await tx.solicitudFotos.updateMany({
        where: { id, estado: "recibida" },
        data: { estado: "revisada", revisadaEn: new Date(), revisionOperacionId: operacionId },
      })
      return solicitud(
        await tx.solicitudFotos.findUniqueOrThrow({ where: { id }, include: INCLUIR }),
      )
    })
  }
}
