import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common"
import {
  lunesDe,
  type CambiarFecha,
  type ListadoCambiosDeFecha,
  type SesionProgramada,
} from "@alpha-omega/shared"
import type { Prisma } from "@prisma/client"

import { CarreraPerdida, conflicto } from "../comun/conflictos.js"
import { AlcanceClienteService } from "../identity/alcance-cliente.service.js"
import type { IdentidadVerificada } from "../identity/peticion.js"
import { PrismaService } from "../prisma/prisma.service.js"

import { aFechaBD, deFechaBD } from "./fechas-bd.js"

type FilaAgenda = {
  id: string
  clienteId: string
  fechaOriginal: Date
  fechaActual: Date
  estado: "abierta" | "cerrada"
  revision: number
}

/** Las columnas públicas de la agenda. Nada de entrenamiento sale de aquí. */
export const CAMPOS_AGENDA = {
  id: true,
  clienteId: true,
  fechaOriginal: true,
  fechaActual: true,
  estado: true,
  revision: true,
} as const

export function aSesionProgramada(fila: FilaAgenda): SesionProgramada {
  return {
    id: fila.id,
    clienteId: fila.clienteId,
    fechaOriginal: deFechaBD(fila.fechaOriginal),
    fechaActual: deFechaBD(fila.fechaActual),
    estado: fila.estado,
    revision: fila.revision,
  }
}

/**
 * Fechas de las sesiones (SPEC-agenda.md).
 *
 * No importa nada de entrenamiento. `entrenamiento` le pide programar y cerrar
 * dentro de sus propias transacciones; su estado de cierre basta para negar un
 * movimiento.
 */
@Injectable()
export class AgendaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alcance: AlcanceClienteService,
  ) {}

  /** Crea sesiones abiertas en fechas concretas, dentro de la transacción de quien asigna. */
  async programar(
    tx: Prisma.TransactionClient,
    clienteId: string,
    sesiones: ReadonlyArray<{ id: string; fecha: string }>,
  ): Promise<void> {
    await tx.sesionProgramada.createMany({
      data: sesiones.map((sesion) => ({
        id: sesion.id,
        clienteId,
        fechaOriginal: aFechaBD(sesion.fecha),
        fechaActual: aFechaBD(sesion.fecha),
      })),
    })
  }

  /**
   * Cierra una sesión abierta. Devuelve `false` si ya estaba cerrada o no existe:
   * quien llama decide si eso es un reintento o un conflicto.
   */
  async cerrar(tx: Prisma.TransactionClient, id: string): Promise<boolean> {
    const { count } = await tx.sesionProgramada.updateMany({
      where: { id, estado: "abierta" },
      data: { estado: "cerrada", revision: { increment: 1 } },
    })
    return count === 1
  }

  /**
   * Mueve una sesión abierta a otro día de su semana.
   *
   * La semana es la de la fecha original, no la actual: mover varias veces no
   * permite ir saltando de semana en semana. El cambio y su registro se guardan
   * juntos, y dos movimientos con la misma revisión no se pisan.
   */
  async cambiarFecha(
    usuario: IdentidadVerificada,
    id: string,
    cambio: CambiarFecha,
  ): Promise<SesionProgramada> {
    const fila = await this.leerAccesible(usuario, id)
    const actual = aSesionProgramada(fila)

    if (lunesDe(cambio.fecha) !== lunesDe(actual.fechaOriginal)) {
      throw new BadRequestException({
        codigo: "fuera_de_semana",
        mensaje: "Solo se puede mover dentro de su semana",
      })
    }
    if (fila.estado === "cerrada") {
      throw conflicto("sesion_cerrada", "Esta sesión ya se ha enviado", { actual })
    }
    if (fila.revision !== cambio.revision) {
      throw conflicto("revision_obsoleta", "La fecha ha cambiado. Vuelve a cargarla", { actual })
    }
    if (cambio.fecha === actual.fechaActual) {
      return actual
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const { count } = await tx.sesionProgramada.updateMany({
          where: { id, revision: cambio.revision, estado: "abierta" },
          data: { fechaActual: aFechaBD(cambio.fecha), revision: { increment: 1 } },
        })
        if (count !== 1) {
          throw new CarreraPerdida()
        }
        await tx.cambioDeFecha.create({
          data: {
            sesionId: id,
            // Válido: el WHERE de la revisión garantiza que nadie la movió entre medias.
            fechaAnterior: fila.fechaActual,
            fechaNueva: aFechaBD(cambio.fecha),
            autorId: usuario.sub,
            cambiadoEn: new Date(),
          },
        })
        return aSesionProgramada(
          await tx.sesionProgramada.findUniqueOrThrow({ where: { id }, select: CAMPOS_AGENDA }),
        )
      })
    } catch (error) {
      if (!(error instanceof CarreraPerdida)) {
        throw error
      }
      const despues = aSesionProgramada(await this.leerAccesible(usuario, id))
      if (despues.estado === "cerrada") {
        throw conflicto("sesion_cerrada", "Esta sesión ya se ha enviado", { actual: despues })
      }
      throw conflicto("revision_obsoleta", "La fecha ha cambiado. Vuelve a cargarla", {
        actual: despues,
      })
    }
  }

  async cambios(usuario: IdentidadVerificada, id: string): Promise<ListadoCambiosDeFecha> {
    await this.leerAccesible(usuario, id)
    const filas = await this.prisma.cambioDeFecha.findMany({
      where: { sesionId: id },
      orderBy: [{ cambiadoEn: "asc" }, { id: "asc" }],
    })
    return {
      cambios: filas.map((fila) => ({
        id: fila.id,
        sesionId: fila.sesionId,
        fechaAnterior: deFechaBD(fila.fechaAnterior),
        fechaNueva: deFechaBD(fila.fechaNueva),
        autorId: fila.autorId,
        cambiadoEn: fila.cambiadoEn.toISOString(),
      })),
    }
  }

  /** Una sesión ajena responde igual que una que no existe: no revela nada. */
  private async leerAccesible(usuario: IdentidadVerificada, id: string): Promise<FilaAgenda> {
    const fila = await this.prisma.sesionProgramada.findUnique({
      where: { id },
      select: CAMPOS_AGENDA,
    })
    if (fila === null || !(await this.alcance.puedeAcceder(usuario, fila.clienteId))) {
      throw new NotFoundException("Esta sesión no existe")
    }
    return fila
  }
}
