import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import { randomUUID } from "node:crypto"
import { PlanAsignadoSchema, type AsignarPlan, type PlanAsignado } from "@alpha-omega/shared"
import { PrismaService } from "../prisma/prisma.service.js"
import type { IdentidadVerificada } from "../identity/peticion.js"
import { fechaSql, sumarDias } from "../agenda/fechas.js"
import {
  catalogoParaPrescribir,
  conflicto,
  hashPeticion,
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
          return leerDocumento(anterior.respuesta, PlanAsignadoSchema, anterior.version)
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
}
