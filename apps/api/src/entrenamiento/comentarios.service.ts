import { Injectable } from "@nestjs/common"
import {
  ResultadoEntrenamientoSchema,
  type ComentarSesion,
  type ComentarioSesion,
  type ListadoComentarios,
} from "@alpha-omega/shared"
import type { ComentarioSesion as FilaComentario, Usuario } from "@prisma/client"

import type { IdentidadVerificada } from "../identity/peticion.js"
import { PrismaService } from "../prisma/prisma.service.js"
import { conflicto, esCodigoPrisma, invalida, leerDocumento } from "./documentos.js"
import { SesionesService } from "./sesiones.service.js"
import { registrarNovedad } from "./novedades.js"
import { nombreDeAutor } from "./nombre-autor.js"

type ConAutor = FilaComentario & { autor: Pick<Usuario, "id" | "nombre" | "apellidos" | "rol"> }

function aComentario(fila: ConAutor): ComentarioSesion {
  return {
    id: fila.id,
    sesionId: fila.sesionId,
    ejercicioPrescritoId: fila.ejercicioPrescritoId,
    ejercicio: fila.ejercicio,
    texto: fila.texto,
    autor: {
      id: fila.autor.id,
      nombre: nombreDeAutor(fila.autor),
      rol: fila.autor.rol === "entrenador" ? "entrenador" : "cliente",
    },
    creadoEn: fila.creadoEn.toISOString(),
  }
}

const CON_AUTOR = {
  autor: { select: { id: true, nombre: true, apellidos: true, rol: true } },
} as const

/**
 * «Comentario sobre la sesión»: el entrenador comenta una sesión enviada o uno
 * de sus ejercicios y el cliente puede contestar. El acceso es el de la sesión.
 */
@Injectable()
export class ComentariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sesiones: SesionesService,
  ) {}

  async comentar(
    identidad: IdentidadVerificada,
    sesionId: string,
    datos: ComentarSesion,
  ): Promise<ComentarioSesion> {
    const fila = await this.sesiones.fila(this.prisma, identidad, sesionId)
    if (fila.resultado === null)
      throw conflicto("operacion_incompatible", "Solo se comentan sesiones enviadas")
    const resultado = leerDocumento(fila.resultado, ResultadoEntrenamientoSchema, fila.version)
    const ejercicio =
      datos.ejercicioPrescritoId === null
        ? null
        : resultado.prescripcion.ejercicios.find((e) => e.id === datos.ejercicioPrescritoId)
    if (datos.ejercicioPrescritoId !== null && !ejercicio)
      throw invalida("Ese ejercicio no está en esta sesión")
    const recuperar = async (): Promise<ComentarioSesion | null> => {
      const anterior = await this.prisma.comentarioSesion.findUnique({
        where: { autorId_operacionId: { autorId: identidad.sub, operacionId: datos.operacionId } },
        include: CON_AUTOR,
      })
      if (anterior) {
        if (
          anterior.sesionId !== sesionId ||
          anterior.texto !== datos.texto ||
          anterior.ejercicioPrescritoId !== datos.ejercicioPrescritoId
        )
          throw conflicto(
            "operacion_incompatible",
            "Esta operación ya se utilizó con otro contenido",
          )
        return aComentario(anterior)
      }
      return null
    }
    const anterior = await recuperar()
    if (anterior) return anterior
    try {
      const creado = await this.prisma.$transaction(async (tx) => {
        const comentario = await tx.comentarioSesion.create({
          data: {
            sesionId,
            clienteId: fila.clienteId,
            autorId: identidad.sub,
            operacionId: datos.operacionId,
            ejercicioPrescritoId: datos.ejercicioPrescritoId,
            ejercicio: ejercicio?.nombre ?? null,
            texto: datos.texto,
          },
          include: CON_AUTOR,
        })
        await registrarNovedad(tx, {
          sesionId,
          clienteId: fila.clienteId,
          autorId: identidad.sub,
          audiencia: identidad.rol === "cliente" ? "entrenador" : "cliente",
          tipo: "comentario",
        })
        return comentario
      })
      return aComentario(creado)
    } catch (error) {
      if (esCodigoPrisma(error, "P2002")) {
        const ganadora = await recuperar()
        if (ganadora) return ganadora
        throw conflicto("operacion_incompatible", "Esta operación ya se utilizó con otro contenido")
      }
      throw error
    }
  }

  async listar(identidad: IdentidadVerificada, sesionId: string): Promise<ListadoComentarios> {
    await this.sesiones.fila(this.prisma, identidad, sesionId)
    const filas = await this.prisma.comentarioSesion.findMany({
      where: { sesionId },
      include: CON_AUTOR,
      orderBy: [{ creadoEn: "asc" }, { id: "asc" }],
      take: 200,
    })
    return { comentarios: filas.map(aComentario) }
  }
}
