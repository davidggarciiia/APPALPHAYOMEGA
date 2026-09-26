import { Injectable, Logger, NotFoundException } from "@nestjs/common"
import {
  PrescripcionSchema,
  fechasDelPlan,
  type AsignarPlan,
  type PatronRutina,
  type PlanAsignado,
  type Prescripcion,
  type ResultadoAnulacion,
} from "@alpha-omega/shared"
import type { Prisma } from "@prisma/client"
import { randomUUID } from "node:crypto"

import { AgendaService, CAMPOS_AGENDA, aSesionProgramada } from "../agenda/agenda.service.js"
import { aFechaBD } from "../agenda/fechas-bd.js"
import { CarreraPerdida, conflicto, esViolacionDeUnicidad } from "../comun/conflictos.js"
import { huellaDe } from "../comun/huella.js"
import { PrismaService } from "../prisma/prisma.service.js"

import { noExiste } from "./sesiones.service.js"

/** Hasta 52 semanas de 14 sesiones: la transacción puede tardar más que los 5 s por defecto. */
const TIEMPO_MAXIMO_ASIGNACION_MS = 20_000

@Injectable()
export class PlanesService {
  private readonly registro = new Logger(PlanesService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly agenda: AgendaService,
  ) {}

  /**
   * Asigna un patrón semanal a un cliente durante varias semanas.
   *
   * Todo o nada: plan, sesiones de agenda, prescripciones y referencias en una
   * transacción. Reintentar con el mismo `operacionId` y el mismo contenido
   * devuelve el mismo plan, también si dos peticiones idénticas llegan a la vez.
   */
  async asignar(clienteId: string, datos: AsignarPlan): Promise<PlanAsignado> {
    const huella = huellaDe({
      clienteId,
      nombre: datos.nombre,
      semanaInicial: datos.semanaInicial,
      semanas: datos.semanas,
      patron: datos.patron,
    })

    const previo = await this.leerPlanPorOperacion(datos.operacionId)
    if (previo !== null) {
      return this.repeticion(previo, clienteId, huella)
    }

    await this.exigirClienteAsignable(clienteId)
    const nombres = await this.nombresPublicados(
      datos.patron.sesiones.flatMap((sesion) => sesion.ejercicios.map((e) => e.ejercicioId)),
    )
    const sesiones = fechasDelPlan(datos.semanaInicial, datos.semanas, datos.patron).map(
      (fecha) => ({
        id: randomUUID(),
        fecha: fecha.fecha,
        prescripcion: prescripcionDe(datos.patron, fecha.sesionPatronId, nombres),
      }),
    )
    const planId = randomUUID()

    try {
      await this.prisma.$transaction(
        async (tx) => {
          // Candado sobre el cliente, mismo orden que la baja: una desactivación
          // simultánea espera a que termine esto o lo hace fallar, nunca a medias.
          const { count } = await tx.usuario.updateMany({
            where: { id: clienteId, rol: "cliente", estado: { not: "desactivado" } },
            data: { actualizadoEn: new Date() },
          })
          if (count !== 1) {
            throw conflicto("cliente_no_disponible", "Este cliente está dado de baja")
          }
          await tx.planEntrenamiento.create({
            data: {
              id: planId,
              clienteId,
              operacionId: datos.operacionId,
              huella,
              nombre: datos.nombre,
              semanaInicial: aFechaBD(datos.semanaInicial),
              semanas: datos.semanas,
              patron: datos.patron,
            },
          })
          await this.agenda.programar(tx, clienteId, sesiones)
          await tx.sesionEntrenamiento.createMany({
            data: sesiones.map((sesion) => ({
              id: sesion.id,
              planId,
              nombre: sesion.prescripcion.nombre,
              prescripcion: sesion.prescripcion,
            })),
          })
          await tx.referenciaEjercicio.createMany({
            data: sesiones.flatMap((sesion) => referenciasDe(sesion.id, sesion.prescripcion)),
          })
        },
        { timeout: TIEMPO_MAXIMO_ASIGNACION_MS },
      )
    } catch (error) {
      if (!esViolacionDeUnicidad(error)) {
        throw error
      }
      // La petición gemela confirmó primero con el mismo operacionId.
      const ganador = await this.leerPlanPorOperacion(datos.operacionId)
      if (ganador === null) {
        throw error
      }
      return this.repeticion(ganador, clienteId, huella)
    }

    this.registro.log(`Plan ${planId} asignado con ${String(sesiones.length)} sesiones`)
    return this.planAsignado(planId, datos.operacionId)
  }

  /**
   * Anula una sesión que el cliente no ha empezado ni enviado.
   *
   * Primero se reclama la fila de entrenamiento con una escritura condicional:
   * así un primer guardado de borrador simultáneo o gana él (y esto es 409) o
   * espera y se encuentra la sesión anulada. Nunca se borra algo empezado.
   */
  async anularSesion(id: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await bloquearAgenda(tx, [id])
        const { count } = await tx.sesionEntrenamiento.updateMany({
          where: { id, iniciadaEn: null, enviadoEn: null },
          data: { revisionPrescripcion: { increment: 1 } },
        })
        if (count !== 1) {
          throw new CarreraPerdida()
        }
        await tx.sesionProgramada.delete({ where: { id } })
      })
    } catch (error) {
      if (!(error instanceof CarreraPerdida)) {
        throw error
      }
      const existe = await this.prisma.sesionEntrenamiento.count({ where: { id } })
      if (existe === 0) {
        throw noExiste()
      }
      throw conflicto(
        "sesion_iniciada",
        "El cliente ya ha empezado esta sesión y no se puede anular",
      )
    }
    this.registro.log(`Sesion ${id} anulada`)
  }

  /** Anula lo pendiente de un plan y conserva lo empezado o enviado. */
  async anularPlan(planId: string): Promise<ResultadoAnulacion> {
    const plan = await this.prisma.planEntrenamiento.findUnique({
      where: { id: planId },
      select: { id: true },
    })
    if (plan === null) {
      throw new NotFoundException("Este plan no existe")
    }

    const anuladas = await this.prisma.$transaction(async (tx) => {
      const candidatas = await tx.sesionEntrenamiento.findMany({
        where: { planId, iniciadaEn: null, enviadoEn: null },
        select: { id: true },
      })
      const ids = candidatas.map((sesion) => sesion.id)
      await bloquearAgenda(tx, ids)
      // Reclamarlas bloquea las filas; volver a leer dice cuáles se reclamaron de
      // verdad (una que el cliente empezó entre medias ya no cumple la condición).
      await tx.sesionEntrenamiento.updateMany({
        where: { id: { in: ids }, iniciadaEn: null, enviadoEn: null },
        data: { revisionPrescripcion: { increment: 1 } },
      })
      const reclamadas = await tx.sesionEntrenamiento.findMany({
        where: { id: { in: ids }, iniciadaEn: null, enviadoEn: null },
        select: { id: true },
      })
      const idsReclamados = reclamadas.map((sesion) => sesion.id)
      await tx.sesionProgramada.deleteMany({ where: { id: { in: idsReclamados } } })
      return idsReclamados.length
    })

    const conservadas = await this.prisma.sesionEntrenamiento.count({ where: { planId } })
    this.registro.log(`Plan ${planId}: ${String(anuladas)} sesiones anuladas`)
    return { anuladas, conservadas }
  }

  private async repeticion(
    plan: { id: string; clienteId: string; huella: string; operacionId: string },
    clienteId: string,
    huella: string,
  ): Promise<PlanAsignado> {
    if (plan.clienteId !== clienteId || plan.huella !== huella) {
      throw conflicto(
        "operacion_reutilizada",
        "Esta asignación ya se hizo con otro contenido. Vuelve a revisarla",
      )
    }
    return this.planAsignado(plan.id, plan.operacionId)
  }

  private async leerPlanPorOperacion(
    operacionId: string,
  ): Promise<{ id: string; clienteId: string; huella: string; operacionId: string } | null> {
    return this.prisma.planEntrenamiento.findUnique({
      where: { operacionId },
      select: { id: true, clienteId: true, huella: true, operacionId: true },
    })
  }

  private async planAsignado(planId: string, operacionId: string): Promise<PlanAsignado> {
    const sesiones = await this.prisma.sesionEntrenamiento.findMany({
      where: { planId },
      select: { nombre: true, enviadoEn: true, agenda: { select: CAMPOS_AGENDA } },
      orderBy: [{ agenda: { fechaOriginal: "asc" } }, { id: "asc" }],
    })
    return {
      id: planId,
      operacionId,
      sesiones: sesiones.map((sesion) => ({
        agenda: aSesionProgramada(sesion.agenda),
        nombre: sesion.nombre,
        enviadoEn: sesion.enviadoEn?.toISOString() ?? null,
      })),
    }
  }

  private async exigirClienteAsignable(clienteId: string): Promise<void> {
    const cliente = await this.prisma.usuario.findUnique({
      where: { id: clienteId },
      select: { rol: true, estado: true },
    })
    if (cliente === null || cliente.rol !== "cliente") {
      throw new NotFoundException("Este cliente no existe")
    }
    if (cliente.estado === "desactivado") {
      throw conflicto("cliente_no_disponible", "Este cliente está dado de baja")
    }
  }

  /**
   * Nombre actual de cada ejercicio del patrón. Todos deben existir y estar
   * publicados: un retirado no entra en planes nuevos.
   */
  async nombresPublicados(
    ejercicioIds: readonly string[],
    yaPrescritos: ReadonlySet<string> = new Set(),
  ): Promise<Map<string, string>> {
    const ids = [...new Set(ejercicioIds)]
    const filas = await this.prisma.ejercicio.findMany({
      where: { id: { in: ids } },
      select: { id: true, nombre: true, estado: true },
    })
    const nombres = new Map(
      filas
        .filter((fila) => fila.estado === "publicado" || yaPrescritos.has(fila.id))
        .map((fila) => [fila.id, fila.nombre]),
    )
    const faltan = ids.filter((id) => !nombres.has(id))
    if (faltan.length > 0) {
      throw conflicto(
        "ejercicio_no_disponible",
        "Hay ejercicios retirados o que ya no existen. Cámbialos antes de asignar",
        { ids: faltan },
      )
    }
    return nombres
  }
}

/**
 * Bloquea las filas de agenda antes que las de entrenamiento.
 *
 * Es el orden que sigue el envío (cierra la agenda y luego guarda el resultado).
 * Anular en el orden contrario podría cruzarse con un envío y acabar en un
 * interbloqueo que Postgres resolvería abortando una de las dos.
 */
async function bloquearAgenda(tx: Prisma.TransactionClient, ids: string[]): Promise<void> {
  if (ids.length > 0) {
    await tx.$queryRaw`SELECT "id" FROM "sesiones_programadas" WHERE "id" = ANY(${ids}::text[]) FOR UPDATE`
  }
}

/** La prescripción de una sesión del patrón, con el nombre del catálogo de hoy. */
export function prescripcionDe(
  patron: Pick<PatronRutina, "sesiones">,
  sesionPatronId: string,
  nombres: ReadonlyMap<string, string>,
): Prescripcion {
  const sesion = patron.sesiones.find((s) => s.id === sesionPatronId)
  if (sesion === undefined) {
    throw new Error("La fecha del plan no corresponde a ninguna sesión del patrón")
  }
  return PrescripcionSchema.parse({
    nombre: sesion.nombre,
    ejercicios: sesion.ejercicios.map((ejercicio) => ({
      ...ejercicio,
      nombre: nombres.get(ejercicio.ejercicioId) ?? "",
    })),
  })
}

export function referenciasDe(
  sesionId: string,
  prescripcion: Prescripcion,
): Array<{ sesionId: string; clave: string; ejercicioId: string }> {
  return prescripcion.ejercicios.map((ejercicio) => ({
    sesionId,
    clave: ejercicio.id,
    ejercicioId: ejercicio.ejercicioId,
  }))
}
