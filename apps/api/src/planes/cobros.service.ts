import { Injectable, NotFoundException } from "@nestjs/common"
import type { OrigenCobro, Prisma } from "@prisma/client"
import {
  aInstante,
  CobroSchema,
  sumarMeses,
  ZONA_AGENDA,
  type Cobro,
  type ConsultarCobros,
  type ListadoCobros,
  type ResumenCobros,
} from "@alpha-omega/shared"

import { conflicto } from "../entrenamiento/documentos.js"
import { PrismaService } from "../prisma/prisma.service.js"

type Tx = Prisma.TransactionClient

const conCliente = { cliente: { select: { id: true, nombre: true, apellidos: true } } } as const
type FilaCobro = Prisma.CobroGetPayload<{ include: typeof conCliente }>

export function cobroPublico(fila: FilaCobro): Cobro {
  return CobroSchema.parse({
    id: fila.id,
    cliente: fila.cliente,
    concepto: fila.concepto,
    importeCentimos: fila.importeCentimos,
    estado: fila.estado,
    origenTipo: fila.origenTipo,
    cobradoEn: fila.cobradoEn?.toISOString() ?? null,
    creadoEn: fila.creadoEn.toISOString(),
  })
}

/**
 * Cobros en efectivo (SPEC-planes.md, «Cobros»). La app registra el importe y la
 * fecha; no emite facturas. Nacen al activar un producto o al reservar una
 * sesión en grupo, y ninguno se borra.
 */
@Injectable()
export class CobrosService {
  constructor(private readonly prisma: PrismaService) {}

  /** Dentro de la transacción de quien lo origina. Mismo origen, mismo cobro. */
  async crear(
    tx: Tx,
    datos: {
      clienteId: string
      concepto: string
      importeCentimos: number
      origenTipo: OrigenCobro
      origenId: string
      cobrado: boolean
      autorId: string
    },
  ): Promise<Cobro> {
    const fila = await tx.cobro.create({
      data: {
        clienteId: datos.clienteId,
        concepto: datos.concepto.slice(0, 120),
        importeCentimos: datos.importeCentimos,
        estado: datos.cobrado ? "cobrado" : "pendiente",
        cobradoEn: datos.cobrado ? new Date() : null,
        origenTipo: datos.origenTipo,
        origenId: datos.origenId,
        autorId: datos.autorId,
      },
      include: conCliente,
    })
    return cobroPublico(fila)
  }

  async deOrigen(tx: Tx, origenTipo: OrigenCobro, origenId: string): Promise<Cobro | null> {
    const fila = await tx.cobro.findUnique({
      where: { origenTipo_origenId: { origenTipo, origenId } },
      include: conCliente,
    })
    return fila ? cobroPublico(fila) : null
  }

  /** Cancelar una sesión en grupo anula su cobro si seguía pendiente. */
  async anularDeOrigen(
    tx: Tx,
    origenTipo: OrigenCobro,
    origenId: string,
    autorId: string,
  ): Promise<void> {
    await tx.cobro.updateMany({
      where: { origenTipo, origenId, estado: "pendiente" },
      data: { estado: "anulado", anuladoPorId: autorId },
    })
  }

  async listar(consulta: ConsultarCobros): Promise<ListadoCobros> {
    const filas = await this.prisma.cobro.findMany({
      where: {
        ...(consulta.estado ? { estado: consulta.estado } : {}),
        ...(consulta.clienteId ? { clienteId: consulta.clienteId } : {}),
      },
      orderBy: [{ creadoEn: "desc" }, { id: "asc" }],
      take: consulta.limite,
      include: conCliente,
    })
    return { cobros: filas.map(cobroPublico) }
  }

  async cobrar(id: string): Promise<Cobro> {
    return this.cambiar(id, "pendiente", { estado: "cobrado", cobradoEn: new Date() })
  }

  async anular(id: string, autorId: string): Promise<Cobro> {
    return this.cambiar(id, "pendiente", { estado: "anulado", anuladoPorId: autorId })
  }

  async resumen(mes: string): Promise<ResumenCobros> {
    const desde = aInstante(mes, 0, ZONA_AGENDA) ?? new Date(`${mes}T00:00:00Z`)
    const hasta =
      aInstante(sumarMeses(mes, 1), 0, ZONA_AGENDA) ?? new Date(`${sumarMeses(mes, 1)}T00:00:00Z`)
    const [cobrados, pendientes] = await Promise.all([
      this.prisma.cobro.findMany({
        where: { estado: "cobrado", cobradoEn: { gte: desde, lt: hasta } },
        orderBy: [{ cobradoEn: "desc" }, { id: "asc" }],
        include: conCliente,
      }),
      this.prisma.cobro.findMany({
        where: { estado: "pendiente" },
        orderBy: [{ creadoEn: "asc" }, { id: "asc" }],
        include: conCliente,
      }),
    ])
    const suma = (filas: FilaCobro[]): number => filas.reduce((t, f) => t + f.importeCentimos, 0)
    return {
      mes,
      cobradoCentimos: suma(cobrados),
      cobrados: cobrados.map(cobroPublico),
      pendienteCentimos: suma(pendientes),
      pendientes: pendientes.map(cobroPublico),
    }
  }

  /** Solo un cobro pendiente cambia de estado; repetir la misma acción no hace nada nuevo. */
  private async cambiar(
    id: string,
    desde: "pendiente",
    datos: Prisma.CobroUpdateManyMutationInput & { estado: "cobrado" | "anulado" },
  ): Promise<Cobro> {
    const cambio = await this.prisma.cobro.updateMany({ where: { id, estado: desde }, data: datos })
    const fila = await this.prisma.cobro.findUnique({ where: { id }, include: conCliente })
    if (!fila) throw new NotFoundException("Cobro no disponible")
    if (cambio.count === 0 && fila.estado !== datos.estado)
      throw conflicto("estado_incompatible", "Ese cobro ya no está pendiente")
    return cobroPublico(fila)
  }
}
