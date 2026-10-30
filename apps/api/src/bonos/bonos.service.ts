import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import type { MovimientoBono as FilaMovimiento, Prisma } from "@prisma/client"
import {
  MovimientoBonoSchema,
  SaldoBonosSchema,
  type AjustarBono,
  type CambiarSeguimientoActivo,
  type CargarBono,
  type ConsultarMovimientosBono,
  type ListadoMovimientosBono,
  type MovimientoBono,
  type SaldoBonos,
  type ServicioConBono,
} from "@alpha-omega/shared"
import { AlcanceClienteService } from "../identity/alcance-cliente.service.js"
import type { IdentidadVerificada } from "../identity/peticion.js"
import { PrismaService } from "../prisma/prisma.service.js"
import { conflicto, esCodigoPrisma } from "../entrenamiento/documentos.js"
import { mesBono } from "./mes-bono.js"

type ApunteManual = {
  operacionId: string
  servicio: ServicioConBono
  tipo: "carga" | "ajuste"
  cantidad: number
  nota: string | null
}

function publica(fila: FilaMovimiento): MovimientoBono {
  return MovimientoBonoSchema.parse({ ...fila, creadoEn: fila.creadoEn.toISOString() })
}

@Injectable()
export class BonosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alcance: AlcanceClienteService,
  ) {}

  private async cliente(
    tx: Prisma.TransactionClient,
    actor: IdentidadVerificada,
    clienteId: string,
    escritura = false,
  ): Promise<void> {
    if (actor.rol !== "cliente" && actor.rol !== "entrenador") throw new ForbiddenException()
    if (!(await this.alcance.puedeAcceder(actor, clienteId)))
      throw new NotFoundException("Bonos no disponibles")
    // Todas las escrituras y la concesión mensual comparten este bloqueo.
    await tx.$queryRaw`SELECT "id" FROM "usuarios" WHERE "id" = ${clienteId} FOR UPDATE`
    const cliente = await tx.usuario.findFirst({
      where: { id: clienteId, rol: "cliente" },
      select: { estado: true },
    })
    if (!cliente) throw new NotFoundException("Cliente no disponible")
    if (escritura && cliente.estado === "desactivado")
      throw conflicto("estado_incompatible", "El cliente está dado de baja")
  }

  private async cupo(tx: Prisma.TransactionClient, clienteId: string, mes: string) {
    const seguimiento = await tx.seguimientoBonos.findUnique({ where: { clienteId } })
    if (seguimiento?.activo) {
      const carga = await tx.movimientoBono.findFirst({
        where: { clienteId, servicio: "seguimiento", tipo: "carga", mes },
        select: { id: true },
      })
      if (!carga)
        await tx.movimientoBono.create({
          data: {
            clienteId,
            autorId: seguimiento.autorId,
            servicio: "seguimiento",
            tipo: "carga",
            cantidad: 120,
            mes,
            nota: "Cupo mensual de seguimiento",
          },
        })
    }
    return seguimiento
  }

  private async saldoActual(
    tx: Prisma.TransactionClient,
    clienteId: string,
    mes: string,
  ): Promise<SaldoBonos> {
    const seguimiento = await this.cupo(tx, clienteId, mes)
    const sumas = await tx.movimientoBono.groupBy({
      by: ["servicio"],
      where: {
        clienteId,
        OR: [{ servicio: "entrenoPersonal" }, { servicio: "seguimiento", mes }],
      },
      _sum: { cantidad: true },
    })
    const suma = (servicio: "entrenoPersonal" | "seguimiento") =>
      sumas.find((s) => s.servicio === servicio)?._sum.cantidad ?? 0
    return SaldoBonosSchema.parse({
      clienteId,
      saldos: [{ servicio: "entrenoPersonal", creditos: suma("entrenoPersonal") }],
      seguimiento: {
        activo: seguimiento?.activo ?? false,
        mes,
        minutosDisponibles: seguimiento?.activo ? suma("seguimiento") : 0,
      },
    })
  }

  async saldo(actor: IdentidadVerificada, clienteId: string): Promise<SaldoBonos> {
    return this.prisma.$transaction(async (tx) => {
      await this.cliente(tx, actor, clienteId)
      return this.saldoActual(tx, clienteId, mesBono(new Date()))
    })
  }

  cargar(
    actor: IdentidadVerificada,
    clienteId: string,
    datos: CargarBono,
  ): Promise<MovimientoBono> {
    return this.anotar(actor, clienteId, {
      operacionId: datos.operacionId,
      servicio: datos.servicio,
      tipo: "carga",
      cantidad: datos.creditos,
      nota: datos.nota ?? null,
    })
  }

  ajustar(
    actor: IdentidadVerificada,
    clienteId: string,
    datos: AjustarBono,
  ): Promise<MovimientoBono> {
    return this.anotar(actor, clienteId, {
      operacionId: datos.operacionId,
      servicio: datos.servicio,
      tipo: "ajuste",
      cantidad: datos.creditos,
      nota: datos.motivo,
    })
  }

  private repetir(fila: FilaMovimiento, clienteId: string, datos: ApunteManual): MovimientoBono {
    if (
      fila.clienteId !== clienteId ||
      fila.servicio !== datos.servicio ||
      fila.tipo !== datos.tipo ||
      fila.cantidad !== datos.cantidad ||
      fila.nota !== datos.nota
    )
      throw conflicto("operacion_incompatible", "Esta operación ya se usó con otros datos")
    return publica(fila)
  }

  private async anotar(
    actor: IdentidadVerificada,
    clienteId: string,
    datos: ApunteManual,
  ): Promise<MovimientoBono> {
    if (actor.rol !== "entrenador") throw new ForbiddenException()
    const clave = { autorId: actor.sub, operacionId: datos.operacionId }
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.cliente(tx, actor, clienteId, true)
        const anterior = await tx.movimientoBono.findUnique({
          where: { autorId_operacionId: clave },
        })
        if (anterior) return this.repetir(anterior, clienteId, datos)
        const suma = await tx.movimientoBono.aggregate({
          where: { clienteId, servicio: datos.servicio },
          _sum: { cantidad: true },
        })
        if ((suma._sum.cantidad ?? 0) + datos.cantidad < 0)
          throw conflicto(
            "estado_incompatible",
            "El ajuste dejaría el saldo sin créditos suficientes",
          )
        return publica(
          await tx.movimientoBono.create({ data: { ...datos, clienteId, autorId: actor.sub } }),
        )
      })
    } catch (error) {
      // La misma clave puede competir entre dos clientes, con bloqueos distintos.
      if (esCodigoPrisma(error, "P2002")) {
        const anterior = await this.prisma.movimientoBono.findUnique({
          where: { autorId_operacionId: clave },
        })
        if (anterior) return this.repetir(anterior, clienteId, datos)
      }
      throw error
    }
  }

  async cambiarSeguimiento(
    actor: IdentidadVerificada,
    clienteId: string,
    datos: CambiarSeguimientoActivo,
  ): Promise<SaldoBonos> {
    if (actor.rol !== "entrenador") throw new ForbiddenException()
    return this.prisma.$transaction(async (tx) => {
      await this.cliente(tx, actor, clienteId, true)
      await tx.seguimientoBonos.upsert({
        where: { clienteId },
        create: { clienteId, activo: datos.activo, autorId: actor.sub },
        update: { activo: datos.activo, autorId: actor.sub },
      })
      return this.saldoActual(tx, clienteId, mesBono(new Date()))
    })
  }

  async movimientos(
    actor: IdentidadVerificada,
    clienteId: string,
    consulta: ConsultarMovimientosBono,
  ): Promise<ListadoMovimientosBono> {
    return this.prisma.$transaction(async (tx) => {
      await this.cliente(tx, actor, clienteId)
      await this.cupo(tx, clienteId, mesBono(new Date()))
      const where = { clienteId }
      const filas = await tx.movimientoBono.findMany({
        where,
        orderBy: [{ creadoEn: "desc" }, { id: "desc" }],
        take: consulta.limite,
        skip: consulta.desplazamiento,
      })
      const total = await tx.movimientoBono.count({ where })
      return { movimientos: filas.map(publica), total }
    })
  }
}
