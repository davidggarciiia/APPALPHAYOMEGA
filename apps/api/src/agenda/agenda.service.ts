import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import type { Prisma } from "@prisma/client"
import {
  CambioDeFechaSchema,
  type CambiarFecha,
  type ConsultarCambios,
  type ListadoCambios,
  type SesionProgramada,
} from "@alpha-omega/shared"
import type { IdentidadVerificada } from "../identity/peticion.js"
import { PrismaService } from "../prisma/prisma.service.js"
import { agendaPublica, fechaSql, lunesDeSemana } from "./fechas.js"
import { registrarNovedad } from "../entrenamiento/novedades.js"
import { conflicto, invalida } from "../entrenamiento/documentos.js"

@Injectable()
export class AgendaService {
  constructor(private readonly prisma: PrismaService) {}

  private async fila(tx: Prisma.TransactionClient, actor: IdentidadVerificada, id: string) {
    if (actor.rol !== "cliente" && actor.rol !== "entrenador") throw new ForbiddenException()
    const fila = await tx.sesionProgramada.findFirst({
      where: { id, ...(actor.rol === "cliente" ? { clienteId: actor.sub } : {}) },
    })
    if (!fila) throw new NotFoundException("Sesión no disponible")
    return fila
  }

  async mover(
    actor: IdentidadVerificada,
    id: string,
    datos: CambiarFecha,
  ): Promise<SesionProgramada> {
    return this.prisma.$transaction(async (tx) => {
      await this.fila(tx, actor, id)
      // Enviar ya toma entrenamiento antes de cerrar agenda. Compartir ese orden
      // evita el ciclo con el FK de la novedad que se crea al mover.
      await tx.$queryRaw`SELECT "id" FROM "sesiones_entrenamiento" WHERE "id" = ${id} FOR UPDATE`
      await tx.$queryRaw`SELECT "id" FROM "sesiones_programadas" WHERE "id" = ${id} FOR UPDATE`
      const fila = await this.fila(tx, actor, id)
      if (fila.estado !== "abierta")
        throw conflicto(
          "operacion_incompatible",
          "El entrenamiento ya está enviado y no puede cambiarse de día",
        )
      if (fila.revision !== datos.revision)
        throw conflicto(
          "revision_obsoleta",
          "La fecha ha cambiado. Actualiza la sesión antes de moverla.",
        )
      if (
        lunesDeSemana(datos.fecha) !== lunesDeSemana(fila.fechaOriginal.toISOString().slice(0, 10))
      )
        throw invalida("Elige un día de la misma semana que la fecha original")
      if (fila.fechaActual.toISOString().slice(0, 10) === datos.fecha) return agendaPublica(fila)
      const nueva = await tx.sesionProgramada.update({
        where: { id },
        data: { fechaActual: fechaSql(datos.fecha), revision: { increment: 1 } },
      })
      await tx.cambioDeFecha.create({
        data: {
          sesionId: id,
          fechaAnterior: fila.fechaActual,
          fechaNueva: nueva.fechaActual,
          autorId: actor.sub,
        },
      })
      await registrarNovedad(tx, {
        sesionId: id,
        clienteId: fila.clienteId,
        autorId: actor.sub,
        audiencia: actor.rol === "cliente" ? "entrenador" : "cliente",
        tipo: "fecha_cambiada",
      })
      return agendaPublica(nueva)
    })
  }

  async cambios(
    actor: IdentidadVerificada,
    id: string,
    consulta: ConsultarCambios,
  ): Promise<ListadoCambios> {
    await this.fila(this.prisma, actor, id)
    const [filas, total] = await this.prisma.$transaction([
      this.prisma.cambioDeFecha.findMany({
        where: { sesionId: id },
        orderBy: [{ cambiadoEn: "desc" }, { id: "asc" }],
        take: consulta.limite,
        skip: consulta.desplazamiento,
      }),
      this.prisma.cambioDeFecha.count({ where: { sesionId: id } }),
    ])
    return {
      total,
      cambios: filas.map((fila) =>
        CambioDeFechaSchema.parse({
          ...fila,
          fechaAnterior: fila.fechaAnterior.toISOString().slice(0, 10),
          fechaNueva: fila.fechaNueva.toISOString().slice(0, 10),
          cambiadoEn: fila.cambiadoEn.toISOString(),
        }),
      ),
    }
  }

  /** Se usa exclusivamente dentro de la transacción que registra el resultado. */
  async cerrar(tx: Prisma.TransactionClient, id: string): Promise<void> {
    const cambio = await tx.sesionProgramada.updateMany({
      where: { id, estado: "abierta" },
      data: { estado: "cerrada", revision: { increment: 1 } },
    })
    if (cambio.count !== 1) throw conflicto("operacion_incompatible", "Esta sesión ya está cerrada")
  }
}
