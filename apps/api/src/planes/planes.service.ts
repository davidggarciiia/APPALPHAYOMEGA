import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import { Prisma, type Producto as FilaProducto } from "@prisma/client"
import {
  hoyEnZona,
  mesDeFecha,
  ProductoSchema,
  SolicitudProductoSchema,
  sumarMeses,
  ZONA_AGENDA,
  type ActivacionProducto,
  type ActivarProducto,
  type ActivarSolicitud,
  type CambiosProducto,
  type EstadoSolicitud,
  type ListadoProductos,
  type ListadoSolicitudes,
  type PedirProducto,
  type Producto,
  type SolicitudProducto,
} from "@alpha-omega/shared"

import { fechaSql } from "../agenda/fechas.js"
import { conflicto } from "../entrenamiento/documentos.js"
import type { IdentidadVerificada } from "../identity/peticion.js"
import { PrismaService } from "../prisma/prisma.service.js"
import { CobrosService } from "./cobros.service.js"
import { SaldoService } from "./saldo.service.js"

type Tx = Prisma.TransactionClient

const conRelaciones = {
  producto: { select: { id: true, nombre: true, tipo: true } },
  cliente: { select: { id: true, nombre: true, apellidos: true } },
} as const
type FilaSolicitud = Prisma.SolicitudProductoGetPayload<{ include: typeof conRelaciones }>

function productoPublico(fila: FilaProducto): Producto {
  return ProductoSchema.parse({
    id: fila.id,
    codigo: fila.codigo,
    tipo: fila.tipo,
    clase: fila.clase,
    nombre: fila.nombre,
    descripcion: fila.descripcion,
    precioCentimos: fila.precioCentimos,
    sesionesPorMes: fila.sesionesPorMes,
    clasesPorSemana: fila.clasesPorSemana,
    meses: fila.meses,
    sesiones: fila.sesiones,
    validezDias: fila.validezDias,
    regalo: fila.regalo,
    visibleParaCliente: fila.visibleParaCliente,
    activo: fila.activo,
  })
}

function solicitudPublica(fila: FilaSolicitud): SolicitudProducto {
  return SolicitudProductoSchema.parse({
    id: fila.id,
    producto: fila.producto,
    cliente: fila.cliente,
    precioCentimos: fila.precioCentimos,
    estado: fila.estado,
    creadaEn: fila.creadaEn.toISOString(),
    resueltaEn: fila.resueltaEn?.toISOString() ?? null,
  })
}

const fecha = (valor: Date): string => valor.toISOString().slice(0, 10)

/**
 * Catálogo, «Lo quiero» y activaciones (SPEC-planes.md). Activar crea en una sola
 * operación el saldo (suscripción o bono) y su cobro.
 */
@Injectable()
export class PlanesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly saldo: SaldoService,
    private readonly cobros: CobrosService,
  ) {}

  async productos(actor: IdentidadVerificada): Promise<ListadoProductos> {
    const filas = await this.prisma.producto.findMany({
      where: actor.rol === "cliente" ? { activo: true, visibleParaCliente: true } : {},
      orderBy: [{ orden: "asc" }, { nombre: "asc" }],
    })
    return { productos: filas.map(productoPublico) }
  }

  async cambiarProducto(id: string, cambios: CambiosProducto): Promise<Producto> {
    try {
      return productoPublico(await this.prisma.producto.update({ where: { id }, data: cambios }))
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025")
        throw new NotFoundException("Producto no disponible")
      throw error
    }
  }

  async misSolicitudes(clienteId: string): Promise<ListadoSolicitudes> {
    const filas = await this.prisma.solicitudProducto.findMany({
      where: { clienteId },
      orderBy: [{ creadaEn: "desc" }, { id: "asc" }],
      take: 50,
      include: conRelaciones,
    })
    return { solicitudes: filas.map(solicitudPublica) }
  }

  /**
   * «Lo quiero». Solo productos activos y visibles. Repetir la misma operación, o
   * pedir un producto que ya está pendiente, devuelve la solicitud existente.
   */
  async pedir(clienteId: string, datos: PedirProducto): Promise<SolicitudProducto> {
    const previa = await this.prisma.solicitudProducto.findUnique({
      where: { clienteId_operacionId: { clienteId, operacionId: datos.operacionId } },
      include: conRelaciones,
    })
    if (previa) {
      if (previa.producto.id !== datos.productoId)
        throw conflicto("operacion_incompatible", "Esa operación ya se usó para otro producto")
      return solicitudPublica(previa)
    }
    const producto = await this.prisma.producto.findFirst({
      where: { id: datos.productoId, activo: true, visibleParaCliente: true },
    })
    if (!producto) throw new NotFoundException("Producto no disponible")
    const pendiente = await this.prisma.solicitudProducto.findFirst({
      where: { clienteId, productoId: producto.id, estado: "pendiente" },
      include: conRelaciones,
    })
    if (pendiente) return solicitudPublica(pendiente)
    try {
      const fila = await this.prisma.solicitudProducto.create({
        data: {
          clienteId,
          productoId: producto.id,
          precioCentimos: producto.precioCentimos,
          operacionId: datos.operacionId,
        },
        include: conRelaciones,
      })
      return solicitudPublica(fila)
    } catch (error) {
      // Dos peticiones a la vez: la segunda lee lo que creó la primera.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const creada = await this.prisma.solicitudProducto.findFirst({
          where: {
            clienteId,
            OR: [
              { operacionId: datos.operacionId },
              { productoId: producto.id, estado: "pendiente" },
            ],
          },
          include: conRelaciones,
        })
        if (creada) return solicitudPublica(creada)
      }
      throw error
    }
  }

  async anular(clienteId: string, id: string): Promise<SolicitudProducto> {
    return this.resolver(id, "anulada", clienteId)
  }

  async solicitudes(estado: EstadoSolicitud | undefined): Promise<ListadoSolicitudes> {
    const filas = await this.prisma.solicitudProducto.findMany({
      where: estado ? { estado } : {},
      orderBy: [{ creadaEn: estado === "pendiente" ? "asc" : "desc" }, { id: "asc" }],
      take: 100,
      include: conRelaciones,
    })
    return { solicitudes: filas.map(solicitudPublica) }
  }

  async rechazar(actor: IdentidadVerificada, id: string): Promise<SolicitudProducto> {
    return this.resolver(id, "rechazada", null, actor.sub)
  }

  async activarSolicitud(
    actor: IdentidadVerificada,
    id: string,
    datos: ActivarSolicitud,
  ): Promise<ActivacionProducto> {
    return this.prisma.$transaction(async (tx) => {
      const filas = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "solicitudes_producto" WHERE "id" = ${id} FOR UPDATE`
      if (filas.length !== 1) throw new NotFoundException("Solicitud no disponible")
      const solicitud = await tx.solicitudProducto.findUniqueOrThrow({
        where: { id },
        include: { producto: true },
      })
      if (solicitud.estado !== "pendiente")
        throw conflicto("estado_incompatible", "Esa solicitud ya no está pendiente")
      await this.saldo.bloquearCliente(tx, solicitud.clienteId)
      await this.conceder(tx, solicitud.clienteId, solicitud.producto, datos.mesInicio, actor.sub)
      const cobro = await this.cobros.crear(tx, {
        clienteId: solicitud.clienteId,
        concepto: solicitud.producto.nombre,
        importeCentimos: datos.importeCentimos,
        origenTipo: "producto",
        origenId: `solicitud:${id}`,
        cobrado: datos.cobrado,
        autorId: actor.sub,
      })
      await tx.solicitudProducto.update({
        where: { id },
        data: { estado: "activada", resueltaEn: new Date(), resueltaPorId: actor.sub },
      })
      return {
        solicitudId: id,
        saldo: await this.saldo.resumen(solicitud.clienteId, undefined, tx),
        cobro,
      }
    })
  }

  /** Activar sin solicitud. El id de operación hace que repetirla no duplique nada. */
  async activarProducto(
    actor: IdentidadVerificada,
    clienteId: string,
    datos: ActivarProducto,
  ): Promise<ActivacionProducto> {
    const origenId = `activacion:${datos.operacionId}`
    const repetir = async (tx: Tx): Promise<ActivacionProducto | null> => {
      const previo = await this.cobros.deOrigen(tx, "producto", origenId)
      if (!previo) return null
      if (previo.cliente.id !== clienteId)
        throw conflicto("operacion_incompatible", "Esa operación ya se usó con otro cliente")
      return {
        solicitudId: null,
        saldo: await this.saldo.resumen(clienteId, undefined, tx),
        cobro: previo,
      }
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const previo = await repetir(tx)
        if (previo) return previo
        await this.saldo.bloquearCliente(tx, clienteId)
        const producto = await tx.producto.findFirst({
          where: { id: datos.productoId, activo: true },
        })
        if (!producto) throw new NotFoundException("Producto no disponible")
        await this.conceder(tx, clienteId, producto, datos.mesInicio, actor.sub)
        const cobro = await this.cobros.crear(tx, {
          clienteId,
          concepto: producto.nombre,
          importeCentimos: datos.importeCentimos,
          origenTipo: "producto",
          origenId,
          cobrado: datos.cobrado,
          autorId: actor.sub,
        })
        return {
          solicitudId: null,
          saldo: await this.saldo.resumen(clienteId, undefined, tx),
          cobro,
        }
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const previo = await repetir(this.prisma)
        if (previo) return previo
      }
      throw error
    }
  }

  /**
   * Crea lo que da un producto. Un plan no se solapa con otro de la misma clase
   * que dé saldo: empieza cuando acaba el anterior.
   */
  private async conceder(
    tx: Tx,
    clienteId: string,
    producto: FilaProducto,
    mesInicio: "actual" | "siguiente",
    autorId: string,
  ): Promise<void> {
    if (producto.tipo === "matricula" || producto.clase === null) return
    if (producto.tipo === "bono") {
      await tx.bono.create({
        data: {
          clienteId,
          productoId: producto.id,
          nombre: producto.nombre,
          clase: producto.clase,
          sesiones: producto.sesiones ?? 1,
          validezDias: producto.validezDias ?? 365,
          suelta: (producto.sesiones ?? 1) === 1,
          creadoPorId: autorId,
        },
      })
      return
    }
    const actual = mesDeFecha(hoyEnZona(ZONA_AGENDA))
    let inicio = mesInicio === "actual" ? actual : sumarMeses(actual, 1)
    const danSaldo = (producto.sesionesPorMes ?? 0) > 0 || (producto.clasesPorSemana ?? 0) > 0
    if (danSaldo) {
      const previas = await tx.suscripcion.findMany({
        where: {
          clienteId,
          clase: producto.clase,
          OR: [{ sesionesPorMes: { gt: 0 } }, { clasesPorSemana: { gt: 0 } }],
        },
      })
      for (const previa of previas) {
        const fin = sumarMeses(fecha(previa.mesInicio), previa.meses - 1)
        if (fin >= inicio) inicio = sumarMeses(fin, 1)
      }
    }
    await tx.suscripcion.create({
      data: {
        clienteId,
        productoId: producto.id,
        nombre: producto.nombre,
        clase: producto.clase,
        sesionesPorMes: producto.sesionesPorMes ?? 0,
        clasesPorSemana: producto.clasesPorSemana,
        mesInicio: fechaSql(inicio),
        meses: producto.meses ?? 1,
        creadaPorId: autorId,
      },
    })
  }

  private async resolver(
    id: string,
    estado: "anulada" | "rechazada",
    clienteId: string | null,
    autorId?: string,
  ): Promise<SolicitudProducto> {
    const fila = await this.prisma.solicitudProducto.findUnique({
      where: { id },
      include: conRelaciones,
    })
    if (!fila || (clienteId !== null && fila.clienteId !== clienteId))
      throw new NotFoundException("Solicitud no disponible")
    if (fila.estado === estado) return solicitudPublica(fila)
    const cambio = await this.prisma.solicitudProducto.updateMany({
      where: { id, estado: "pendiente" },
      data: { estado, resueltaEn: new Date(), resueltaPorId: autorId ?? clienteId },
    })
    if (cambio.count === 0)
      throw conflicto("estado_incompatible", "Esa solicitud ya no está pendiente")
    const nueva = await this.prisma.solicitudProducto.findUniqueOrThrow({
      where: { id },
      include: conRelaciones,
    })
    return solicitudPublica(nueva)
  }

  /** Para rutas que un cliente solo puede usar sobre sí mismo. */
  exigirCliente(actor: IdentidadVerificada): string {
    if (actor.rol !== "cliente") throw new ForbiddenException()
    return actor.sub
  }
}
