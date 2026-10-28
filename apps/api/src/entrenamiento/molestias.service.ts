import { Injectable, NotFoundException } from "@nestjs/common"
import {
  MolestiaSchema,
  PrescripcionSchema,
  SintomaDeMolestiaSchema,
  nivelDeMolestia,
  type AtenderMolestia,
  type ConsultarMolestias,
  type ListadoMolestias,
  type Molestia,
  type RegistrarMolestia,
} from "@alpha-omega/shared"
import type { Molestia as FilaMolestia } from "@prisma/client"
import { z } from "zod"

import type { IdentidadVerificada } from "../identity/peticion.js"
import { PrismaService } from "../prisma/prisma.service.js"
import { conflicto, esCodigoPrisma, invalida, leerDocumento } from "./documentos.js"
import { ConsentimientoService } from "../identity/consentimiento.service.js"
import { SesionesService } from "./sesiones.service.js"
import { registrarNovedad } from "./novedades.js"

const Sintomas = z.array(SintomaDeMolestiaSchema).catch([])

function aMolestia(fila: FilaMolestia): Molestia {
  const sintomas = Sintomas.parse(fila.sintomas)
  return MolestiaSchema.parse({
    id: fila.id,
    sesionId: fila.sesionId,
    clienteId: fila.clienteId,
    ejercicioPrescritoId: fila.ejercicioPrescritoId,
    ejercicio: fila.ejercicio,
    serie: fila.serie,
    zona: fila.zona,
    intensidad: fila.intensidad,
    sintomas,
    nivel: nivelDeMolestia(fila.intensidad, sintomas),
    nota: fila.nota,
    creadaEn: fila.creadaEn.toISOString(),
    estado: fila.estado,
    respuesta: fila.respuesta,
    atendidaEn: fila.atendidaEn?.toISOString() ?? null,
  })
}

/**
 * Molestias avisadas durante el entrenamiento. El cliente avisa en su sesión;
 * el entrenador las lee y responde. Nadie más: el nutricionista y el empleado
 * quedan fuera por el cierre por defecto de los roles.
 */
@Injectable()
export class MolestiasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sesiones: SesionesService,
    private readonly consentimiento: ConsentimientoService,
  ) {}

  async registrar(
    identidad: IdentidadVerificada,
    sesionId: string,
    datos: RegistrarMolestia,
  ): Promise<Molestia> {
    const fila = await this.sesiones.fila(this.prisma, identidad, sesionId, true)
    const recuperar = async (): Promise<Molestia | null> => {
      const repetida = await this.prisma.molestia.findUnique({
        where: {
          clienteId_operacionId: { clienteId: fila.clienteId, operacionId: datos.operacionId },
        },
      })
      if (repetida) {
        if (
          repetida.sesionId !== sesionId ||
          repetida.intensidad !== datos.intensidad ||
          repetida.ejercicioPrescritoId !== datos.ejercicioPrescritoId ||
          repetida.serie !== datos.serie ||
          repetida.zona !== datos.zona ||
          repetida.nota !== datos.nota ||
          JSON.stringify(Sintomas.parse(repetida.sintomas)) !== JSON.stringify(datos.sintomas)
        )
          throw conflicto("operacion_incompatible", "La operación ya se utilizó con otro contenido")
        return aMolestia(repetida)
      }
      return null
    }
    const repetida = await recuperar()
    if (repetida) return repetida
    const prescripcion = leerDocumento(fila.prescripcion, PrescripcionSchema, fila.version)
    const ejercicio =
      datos.ejercicioPrescritoId === null
        ? null
        : prescripcion.ejercicios.find((e) => e.id === datos.ejercicioPrescritoId)
    if (ejercicio === undefined) throw invalida("Ese ejercicio no está en la sesión")
    if (datos.serie !== null && (ejercicio === null || datos.serie > ejercicio.series.length))
      throw invalida("Esa serie no está en el ejercicio")
    try {
      const creada = await this.prisma.$transaction(async (tx) => {
        await this.consentimiento.exigirVigente(fila.clienteId, identidad.sub, tx)
        const molestia = await tx.molestia.create({
          data: {
            clienteId: fila.clienteId,
            sesionId,
            operacionId: datos.operacionId,
            ejercicioPrescritoId: datos.ejercicioPrescritoId,
            ejercicio: ejercicio?.nombre ?? null,
            serie: datos.serie,
            zona: datos.zona,
            intensidad: datos.intensidad,
            sintomas: datos.sintomas,
            nota: datos.nota,
          },
        })
        await registrarNovedad(tx, {
          sesionId,
          clienteId: fila.clienteId,
          autorId: identidad.sub,
          audiencia: "entrenador",
          tipo: "molestia",
        })
        return molestia
      })
      return aMolestia(creada)
    } catch (error) {
      if (esCodigoPrisma(error, "P2002")) {
        const ganadora = await recuperar()
        if (ganadora) return ganadora
        throw conflicto("operacion_incompatible", "La operación ya se utilizó con otro contenido")
      }
      throw error
    }
  }

  async listar(
    identidad: IdentidadVerificada,
    clienteId: string,
    consulta: ConsultarMolestias,
  ): Promise<ListadoMolestias> {
    this.sesiones.comprobarAcceso(identidad, clienteId)
    const donde = {
      clienteId,
      ...(consulta.estado !== "todas" && { estado: consulta.estado }),
    }
    const [filas, total] = await Promise.all([
      this.prisma.molestia.findMany({
        where: donde,
        orderBy: [{ creadaEn: "desc" }, { id: "asc" }],
        skip: consulta.desplazamiento,
        take: consulta.limite,
      }),
      this.prisma.molestia.count({ where: donde }),
    ])
    return { molestias: filas.map(aMolestia), total }
  }

  async atender(
    identidad: IdentidadVerificada,
    id: string,
    datos: AtenderMolestia,
  ): Promise<Molestia> {
    const fila = await this.prisma.molestia.findUnique({ where: { id } })
    if (!fila) throw new NotFoundException("Esa molestia no existe")
    if (fila.estado === "atendida") {
      if (fila.respuesta === datos.respuesta) return aMolestia(fila)
      throw conflicto("operacion_incompatible", "Esta molestia ya tiene respuesta")
    }
    const cambiada = await this.prisma.$transaction(async (tx) => {
      const cambio = await tx.molestia.updateMany({
        where: { id, estado: "abierta" },
        data: {
          estado: "atendida",
          respuesta: datos.respuesta,
          atendidaEn: new Date(),
          atendidaPorId: identidad.sub,
        },
      })
      if (cambio.count === 0) return null
      await registrarNovedad(tx, {
        sesionId: fila.sesionId,
        clienteId: fila.clienteId,
        autorId: identidad.sub,
        audiencia: "cliente",
        tipo: "molestia_atendida",
      })
      return tx.molestia.findUniqueOrThrow({ where: { id } })
    })
    if (cambiada) return aMolestia(cambiada)
    const actual = await this.prisma.molestia.findUnique({ where: { id } })
    if (!actual) throw new NotFoundException("Esa molestia no existe")
    if (actual.estado === "atendida" && actual.respuesta === datos.respuesta)
      return aMolestia(actual)
    throw conflicto("operacion_incompatible", "Esta molestia ya tiene respuesta")
  }
}
