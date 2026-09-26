import { Injectable, Logger } from "@nestjs/common"
import {
  PrescripcionSchema,
  type CambiarPrescripcion,
  type SesionEntrenador,
} from "@alpha-omega/shared"

import { CarreraPerdida, conflicto } from "../comun/conflictos.js"
import { PrismaService } from "../prisma/prisma.service.js"

import { PlanesService, referenciasDe } from "./planes.service.js"
import { SesionesService, noExiste } from "./sesiones.service.js"

/**
 * Ajuste del entrenador sobre una sesión concreta todavía no iniciada.
 *
 * Compite con el primer guardado del borrador por la misma fila: gana quien
 * escribe antes y el otro recibe 409. Nunca se mezclan objetivos viejos y nuevos.
 */
@Injectable()
export class PrescripcionesService {
  private readonly registro = new Logger(PrescripcionesService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly planes: PlanesService,
    private readonly sesiones: SesionesService,
  ) {}

  async ajustar(id: string, cambio: CambiarPrescripcion): Promise<SesionEntrenador> {
    const fila = await this.prisma.sesionEntrenamiento.findUnique({
      where: { id },
      select: { prescripcion: true, revisionPrescripcion: true, iniciadaEn: true, enviadoEn: true },
    })
    if (fila === null) {
      throw noExiste()
    }
    if (fila.enviadoEn !== null || fila.iniciadaEn !== null) {
      throw this.iniciada()
    }
    if (fila.revisionPrescripcion !== cambio.revisionPrescripcion) {
      throw this.cambiada()
    }

    // Un ejercicio retirado que ya estaba en la sesión puede quedarse; uno nuevo no.
    const yaPrescritos = new Set(
      PrescripcionSchema.parse(fila.prescripcion).ejercicios.map((e) => e.ejercicioId),
    )
    const nombres = await this.planes.nombresPublicados(
      cambio.ejercicios.map((ejercicio) => ejercicio.ejercicioId),
      yaPrescritos,
    )
    const prescripcion = PrescripcionSchema.parse({
      nombre: cambio.nombre,
      ejercicios: cambio.ejercicios.map((ejercicio) => ({
        ...ejercicio,
        nombre: nombres.get(ejercicio.ejercicioId) ?? "",
      })),
    })

    try {
      await this.prisma.$transaction(async (tx) => {
        const { count } = await tx.sesionEntrenamiento.updateMany({
          where: {
            id,
            revisionPrescripcion: cambio.revisionPrescripcion,
            iniciadaEn: null,
            enviadoEn: null,
          },
          data: {
            prescripcion,
            nombre: prescripcion.nombre,
            revisionPrescripcion: { increment: 1 },
          },
        })
        if (count !== 1) {
          throw new CarreraPerdida()
        }
        await tx.referenciaEjercicio.deleteMany({ where: { sesionId: id } })
        await tx.referenciaEjercicio.createMany({ data: referenciasDe(id, prescripcion) })
      })
    } catch (error) {
      if (!(error instanceof CarreraPerdida)) {
        throw error
      }
      const despues = await this.prisma.sesionEntrenamiento.findUnique({
        where: { id },
        select: { iniciadaEn: true, enviadoEn: true },
      })
      if (despues === null) {
        throw noExiste()
      }
      throw despues.iniciadaEn !== null || despues.enviadoEn !== null
        ? this.iniciada()
        : this.cambiada()
    }

    this.registro.log(`Sesion ${id} ajustada`)
    return this.sesiones.paraEntrenador(id)
  }

  private iniciada(): Error {
    return conflicto(
      "sesion_iniciada",
      "El cliente ya ha empezado esta sesión. Queda en modo consulta",
    )
  }

  private cambiada(): Error {
    return conflicto("prescripcion_cambiada", "La sesión ha cambiado. Vuelve a cargarla")
  }
}
