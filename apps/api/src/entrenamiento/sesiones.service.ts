import { Injectable, NotFoundException } from "@nestjs/common"
import {
  BorradorSchema,
  PrescripcionSchema,
  RegistroSchema,
  ResultadoEntrenamientoSchema,
  sumarDias,
  type Borrador,
  type ConsultarPanel,
  type ConsultarSesiones,
  type ListadoEjercicios,
  type ListadoPlanes,
  type ListadoSesiones,
  type PanelSemanal,
  type ResultadoEntrenamiento,
  type SesionCliente,
  type SesionEntrenador,
} from "@alpha-omega/shared"

import { CAMPOS_AGENDA, aSesionProgramada } from "../agenda/agenda.service.js"
import { aFechaBD, deFechaBD } from "../agenda/fechas-bd.js"
import { aEjercicio } from "../catalogo-ejercicios/catalogo-ejercicios.service.js"
import { AlcanceClienteService } from "../identity/alcance-cliente.service.js"
import type { IdentidadVerificada } from "../identity/peticion.js"
import { PrismaService } from "../prisma/prisma.service.js"

/**
 * Lo que puede ver el entrenador de una sesión.
 *
 * `select` explícito a propósito: el borrador, su revisión y su operación no se
 * cargan siquiera. Lo que no sale de la base no puede colarse en una respuesta.
 */
const CAMPOS_PUBLICOS = {
  id: true,
  nombre: true,
  prescripcion: true,
  revisionPrescripcion: true,
  iniciadaEn: true,
  enviadoEn: true,
  agenda: { select: CAMPOS_AGENDA },
} as const

/** Lo que ve el propio cliente: lo público más su borrador. */
const CAMPOS_PRIVADOS = {
  ...CAMPOS_PUBLICOS,
  borrador: true,
  revisionBorrador: true,
  borradorActualizadoEn: true,
} as const

export function noExiste(): NotFoundException {
  return new NotFoundException("Esta sesión no existe")
}

/**
 * Lecturas de entrenamiento con dos caras: la del cliente dueño y la del
 * entrenador. Nutricionista y empleado no llegan (los controladores no los
 * declaran) y otro cliente recibe lo mismo que si la sesión no existiera.
 */
@Injectable()
export class SesionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alcance: AlcanceClienteService,
  ) {}

  /** Semanas de un cliente. Sin valores, notas ni borradores: solo planificación. */
  async deCliente(clienteId: string, consulta: ConsultarSesiones): Promise<ListadoSesiones> {
    await this.exigirCliente(clienteId)
    const filas = await this.prisma.sesionProgramada.findMany({
      where: {
        clienteId,
        fechaActual: {
          gte: aFechaBD(consulta.semana),
          lte: aFechaBD(sumarDias(consulta.semana, consulta.semanas * 7 - 1)),
        },
      },
      select: { ...CAMPOS_AGENDA, entrenamiento: { select: { nombre: true, enviadoEn: true } } },
      orderBy: [{ fechaActual: "asc" }, { creadoEn: "asc" }, { id: "asc" }],
    })
    const sesiones = filas.flatMap((fila) =>
      fila.entrenamiento === null
        ? []
        : [
            {
              agenda: aSesionProgramada(fila),
              nombre: fila.entrenamiento.nombre,
              enviadoEn: fila.entrenamiento.enviadoEn?.toISOString() ?? null,
            },
          ],
    )
    return { sesiones, total: sesiones.length }
  }

  /**
   * El panel del entrenador: la semana de todos sus clientes, o de uno.
   *
   * El resumen de series sale de columnas que solo se escriben al enviar, así
   * que un borrador en curso no deja rastro aquí.
   */
  async panel(consulta: ConsultarPanel): Promise<PanelSemanal> {
    const filas = await this.prisma.sesionProgramada.findMany({
      where: {
        ...(consulta.clienteId !== undefined && { clienteId: consulta.clienteId }),
        fechaActual: {
          gte: aFechaBD(consulta.semana),
          lte: aFechaBD(sumarDias(consulta.semana, 6)),
        },
      },
      select: {
        ...CAMPOS_AGENDA,
        cliente: { select: { id: true, nombre: true, apellidos: true } },
        entrenamiento: {
          select: { nombre: true, enviadoEn: true, seriesHechas: true, seriesPrescritas: true },
        },
      },
      orderBy: [{ fechaActual: "asc" }, { creadoEn: "asc" }, { id: "asc" }],
    })
    return {
      semana: consulta.semana,
      sesiones: filas.flatMap((fila) => {
        const entrenamiento = fila.entrenamiento
        if (entrenamiento === null) {
          return []
        }
        const enviada =
          entrenamiento.enviadoEn !== null &&
          entrenamiento.seriesHechas !== null &&
          entrenamiento.seriesPrescritas !== null
        return [
          {
            agenda: aSesionProgramada(fila),
            nombre: entrenamiento.nombre,
            enviadoEn: enviada ? (entrenamiento.enviadoEn?.toISOString() ?? null) : null,
            cliente: fila.cliente,
            ejecucion: enviada
              ? {
                  seriesHechas: entrenamiento.seriesHechas ?? 0,
                  seriesPrescritas: entrenamiento.seriesPrescritas ?? 0,
                }
              : null,
          },
        ]
      }),
    }
  }

  async leer(usuario: IdentidadVerificada, id: string): Promise<SesionCliente | SesionEntrenador> {
    const propietario = await this.propietarioAccesible(usuario, id)

    if (usuario.rol === "cliente" && usuario.sub === propietario) {
      const fila = await this.prisma.sesionEntrenamiento.findUnique({
        where: { id },
        select: CAMPOS_PRIVADOS,
      })
      if (fila === null) {
        throw noExiste()
      }
      return { ...this.publica(fila), borrador: aBorrador(fila) }
    }

    const fila = await this.prisma.sesionEntrenamiento.findUnique({
      where: { id },
      select: CAMPOS_PUBLICOS,
    })
    if (fila === null) {
      throw noExiste()
    }
    return this.publica(fila)
  }

  /** La vista del entrenador de una sesión, para devolverla tras un ajuste. */
  async paraEntrenador(id: string): Promise<SesionEntrenador> {
    const fila = await this.prisma.sesionEntrenamiento.findUnique({
      where: { id },
      select: CAMPOS_PUBLICOS,
    })
    if (fila === null) {
      throw noExiste()
    }
    return this.publica(fila)
  }

  /**
   * Las fichas de los ejercicios de una sesión, retirados incluidos.
   *
   * El cliente las descarga junto a la sesión para leer las instrucciones en la
   * sala sin cobertura.
   */
  async ejercicios(usuario: IdentidadVerificada, id: string): Promise<ListadoEjercicios> {
    await this.propietarioAccesible(usuario, id)
    const referencias = await this.prisma.referenciaEjercicio.findMany({
      where: { sesionId: id },
      select: {
        ejercicio: { include: { gruposSecundarios: { select: { grupo: true } } } },
      },
    })
    const unicos = new Map(referencias.map((r) => [r.ejercicio.id, r.ejercicio]))
    const ejercicios = [...unicos.values()].map(aEjercicio)
    return { ejercicios, total: ejercicios.length }
  }

  async resultado(usuario: IdentidadVerificada, id: string): Promise<ResultadoEntrenamiento> {
    await this.propietarioAccesible(usuario, id)
    const fila = await this.prisma.sesionEntrenamiento.findUnique({
      where: { id },
      select: { resultado: true },
    })
    if (fila === null || fila.resultado === null) {
      throw new NotFoundException("Esta sesión todavía no se ha enviado")
    }
    return ResultadoEntrenamientoSchema.parse(fila.resultado)
  }

  async planes(clienteId: string): Promise<ListadoPlanes> {
    await this.exigirCliente(clienteId)
    const planes = await this.prisma.planEntrenamiento.findMany({
      where: { clienteId },
      select: {
        id: true,
        nombre: true,
        semanaInicial: true,
        semanas: true,
        creadoEn: true,
        sesiones: { select: { iniciadaEn: true, enviadoEn: true } },
      },
      orderBy: [{ creadoEn: "desc" }, { id: "asc" }],
    })
    return {
      planes: planes.map((plan) => ({
        id: plan.id,
        nombre: plan.nombre,
        semanaInicial: deFechaBD(plan.semanaInicial),
        semanas: plan.semanas,
        creadoEn: plan.creadoEn.toISOString(),
        sesionesTotales: plan.sesiones.length,
        sesionesSinIniciar: plan.sesiones.filter(
          (s) => s.iniciadaEn === null && s.enviadoEn === null,
        ).length,
        sesionesEnviadas: plan.sesiones.filter((s) => s.enviadoEn !== null).length,
      })),
    }
  }

  /** 404 si no existe o no es un cliente, igual para el entrenador. */
  async exigirCliente(clienteId: string): Promise<void> {
    const cliente = await this.prisma.usuario.findUnique({
      where: { id: clienteId },
      select: { rol: true },
    })
    if (cliente === null || cliente.rol !== "cliente") {
      throw new NotFoundException("Este cliente no existe")
    }
  }

  /** Devuelve el cliente dueño si quien pregunta puede verla; si no, 404. */
  private async propietarioAccesible(usuario: IdentidadVerificada, id: string): Promise<string> {
    const agenda = await this.prisma.sesionProgramada.findUnique({
      where: { id },
      select: { clienteId: true },
    })
    if (agenda === null || !(await this.alcance.puedeAcceder(usuario, agenda.clienteId))) {
      throw noExiste()
    }
    return agenda.clienteId
  }

  private publica(fila: {
    prescripcion: unknown
    revisionPrescripcion: number
    iniciadaEn: Date | null
    enviadoEn: Date | null
    agenda: Parameters<typeof aSesionProgramada>[0]
  }): SesionEntrenador {
    const agenda = aSesionProgramada(fila.agenda)
    return {
      agenda,
      prescripcion: PrescripcionSchema.parse(fila.prescripcion),
      revisionPrescripcion: fila.revisionPrescripcion,
      // Un bit inevitable: el entrenador sabe si la sesión se empezó (la spec le
      // deja ajustar solo las no iniciadas), nunca qué contiene.
      permiteAjuste:
        agenda.estado === "abierta" && fila.iniciadaEn === null && fila.enviadoEn === null,
      enviadoEn: fila.enviadoEn?.toISOString() ?? null,
    }
  }
}

export function aBorrador(fila: {
  borrador: unknown
  revisionBorrador: number
  revisionPrescripcion: number
  borradorActualizadoEn: Date | null
}): Borrador | null {
  if (fila.borrador === null || fila.borradorActualizadoEn === null) {
    return null
  }
  return BorradorSchema.parse({
    revision: fila.revisionBorrador,
    revisionPrescripcion: fila.revisionPrescripcion,
    registro: RegistroSchema.parse(fila.borrador),
    actualizadoEn: fila.borradorActualizadoEn.toISOString(),
  })
}
