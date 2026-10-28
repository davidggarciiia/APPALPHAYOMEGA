import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import { randomUUID } from "node:crypto"
import {
  BloqueSchema,
  PlanAsignadoSchema,
  type AsignarPlan,
  type CambiarBloque,
  type PlanAsignado,
  type PlanVigente,
  type PlanVigenteRespuesta,
} from "@alpha-omega/shared"
import type { PlanEntrenamiento } from "@prisma/client"
import { PrismaService } from "../prisma/prisma.service.js"
import type { IdentidadVerificada } from "../identity/peticion.js"
import { fechaSql, sumarDias } from "../agenda/fechas.js"
import {
  catalogoParaPrescribir,
  conflicto,
  hashPeticion,
  invalida,
  leerDocumento,
  prescripcionConNombres,
} from "./documentos.js"

@Injectable()
export class PlanesService {
  constructor(private readonly prisma: PrismaService) {}

  async asignar(
    identidad: IdentidadVerificada,
    clienteId: string,
    datos: AsignarPlan,
  ): Promise<PlanAsignado> {
    if (identidad.rol !== "entrenador") throw new ForbiddenException()
    const hash = hashPeticion({ clienteId, datos })
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`plan:${identidad.sub}:${datos.operacionId}`}))`
        const anterior = await tx.planEntrenamiento.findUnique({
          where: {
            creadorId_operacionId: { creadorId: identidad.sub, operacionId: datos.operacionId },
          },
        })
        if (anterior) {
          if (anterior.hashPeticion !== hash)
            throw conflicto(
              "operacion_incompatible",
              "Esta operación ya se utilizó con otro contenido",
            )
          // La revisión editable del bloque no cambia el formato de esta respuesta.
          return leerDocumento(anterior.respuesta, PlanAsignadoSchema, 1)
        }
        await tx.$queryRaw`SELECT "id" FROM "usuarios" WHERE "id" = ${clienteId} FOR UPDATE`
        const cliente = await tx.usuario.findUnique({ where: { id: clienteId } })
        if (!cliente || cliente.rol !== "cliente")
          throw new NotFoundException("Cliente no disponible")
        if (cliente.estado === "desactivado")
          throw conflicto(
            "operacion_incompatible",
            "No puedes asignar entrenamientos a una cuenta desactivada",
          )
        const nombres = await catalogoParaPrescribir(
          tx,
          datos.patron.sesiones.flatMap((sesion) => sesion.ejercicios),
        )
        const definiciones = Array.from({ length: datos.semanas }, (_, semana) =>
          datos.patron.sesiones.map((sesion) => ({
            id: randomUUID(),
            fecha: sumarDias(datos.semanaInicial, semana * 7 + sesion.diaSemana - 1),
            prescripcion: prescripcionConNombres(sesion, nombres),
          })),
        ).flat()
        const planId = randomUUID()
        const respuesta = PlanAsignadoSchema.parse({
          id: planId,
          operacionId: datos.operacionId,
          sesiones: definiciones.map((sesion) => ({
            agenda: {
              id: sesion.id,
              clienteId,
              fechaOriginal: sesion.fecha,
              fechaActual: sesion.fecha,
              estado: "abierta",
              revision: 0,
            },
            nombre: sesion.prescripcion.nombre,
            enviadoEn: null,
          })),
        })
        await tx.planEntrenamiento.create({
          data: {
            id: planId,
            clienteId,
            creadorId: identidad.sub,
            operacionId: datos.operacionId,
            hashPeticion: hash,
            nombre: datos.nombre,
            semanaInicial: fechaSql(datos.semanaInicial),
            semanas: datos.semanas,
            patron: datos.patron,
            respuesta,
            ...(datos.bloque && { bloque: datos.bloque }),
          },
        })
        await tx.sesionProgramada.createMany({
          data: definiciones.map((sesion) => ({
            id: sesion.id,
            clienteId,
            fechaOriginal: fechaSql(sesion.fecha),
            fechaActual: fechaSql(sesion.fecha),
          })),
        })
        await tx.sesionEntrenamiento.createMany({
          data: definiciones.map((sesion) => ({
            id: sesion.id,
            clienteId,
            planId,
            prescripcion: sesion.prescripcion,
          })),
        })
        await tx.referenciaEjercicio.createMany({
          data: definiciones.flatMap((sesion) =>
            sesion.prescripcion.ejercicios.map((ejercicio) => ({
              sesionId: sesion.id,
              idPrescrito: ejercicio.id,
              ejercicioId: ejercicio.ejercicioId,
            })),
          ),
        })
        return respuesta
      },
      { timeout: 20000 },
    )
  }

  /** El plan que cubre la semana consultada; si se solapan, el último asignado. */
  async vigente(
    identidad: IdentidadVerificada,
    clienteId: string,
    semana: string,
  ): Promise<PlanVigenteRespuesta> {
    if (identidad.rol === "cliente" && identidad.sub !== clienteId)
      throw new NotFoundException("Plan no disponible")
    const cliente = await this.prisma.usuario.findFirst({
      where: { id: clienteId, rol: "cliente" },
      select: { id: true },
    })
    if (!cliente) throw new NotFoundException("Cliente no disponible")
    const candidatos = await this.prisma.planEntrenamiento.findMany({
      where: {
        clienteId,
        semanaInicial: { lte: fechaSql(semana), gt: fechaSql(sumarDias(semana, -52 * 7)) },
      },
      orderBy: [{ creadoEn: "desc" }, { id: "desc" }],
    })
    const plan = candidatos.find(
      (fila) => sumarDias(fechaDe(fila.semanaInicial), fila.semanas * 7) > semana,
    )
    return { plan: plan ? planVigente(plan) : null }
  }

  async cambiarBloque(
    identidad: IdentidadVerificada,
    planId: string,
    datos: CambiarBloque,
  ): Promise<PlanVigente> {
    if (identidad.rol !== "entrenador") throw new ForbiddenException()
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "planes_entrenamiento" WHERE "id" = ${planId} FOR UPDATE`
      const plan = await tx.planEntrenamiento.findUnique({ where: { id: planId } })
      if (!plan) throw new NotFoundException("Plan no disponible")
      if (plan.version !== datos.version)
        throw conflicto(
          "revision_obsoleta",
          "El plan cambió mientras lo editabas. Vuelve a abrirlo.",
        )
      if (datos.bloque.fases.some((fase) => fase.hasta > plan.semanas))
        throw invalida("Las fases deben caber en las semanas del plan")
      const actualizado = await tx.planEntrenamiento.update({
        where: { id: planId },
        data: { bloque: datos.bloque, version: { increment: 1 } },
      })
      return planVigente(actualizado)
    })
  }
}

function planVigente(fila: PlanEntrenamiento): PlanVigente {
  return {
    id: fila.id,
    nombre: fila.nombre,
    semanaInicial: fechaDe(fila.semanaInicial),
    semanas: fila.semanas,
    version: fila.version,
    bloque: fila.bloque === null ? null : BloqueSchema.parse(fila.bloque),
  }
}

function fechaDe(fecha: Date): string {
  return fecha.toISOString().slice(0, 10)
}
