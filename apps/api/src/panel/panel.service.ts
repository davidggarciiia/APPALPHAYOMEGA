import { ForbiddenException, Injectable } from "@nestjs/common"
import { Prisma } from "@prisma/client"
import {
  aInstante,
  mesDeFecha,
  sumarMeses,
  MAXIMO_ACTIVIDAD,
  MAXIMO_HOY,
  MAXIMO_POR_REVISAR,
  PanelHoySchema,
  SintomaDeMolestiaSchema,
  VERSION_CONSENTIMIENTO,
  ZONA_AGENDA,
  nivelDeMolestia,
  type ActividadDelPanel,
  type ClienteDelPanel,
  type EstadoEntrenoDeHoy,
  type PanelHoy,
} from "@alpha-omega/shared"
import { z } from "zod"

import { lunesDeSemana, sumarDias } from "../agenda/fechas.js"
import type { IdentidadVerificada } from "../identity/peticion.js"
import { PrismaService } from "../prisma/prisma.service.js"
import { resumirSemana } from "./semana.js"

/** Un cliente que sigue en la cartera: las bajas no piden nada al entrenador. */
const VIGENTE = {
  rol: "cliente",
  estado: { not: "desactivado" },
} as const satisfies Prisma.UsuarioWhereInput
const NOMBRE = { select: { id: true, nombre: true, apellidos: true } } as const

const Sintomas = z.array(SintomaDeMolestiaSchema).catch([])

type Persona = { id: string; nombre: string; apellidos: string | null }

/** Una sesión con lo justo para el panel: el nombre y el esfuerzo salen del JSON en la base. */
type FilaSesion = {
  id: string
  fecha: string
  enviadoEn: Date | null
  iniciada: boolean
  sesion: string
  esfuerzo: number | null
  clienteId: string
  nombre: string
  apellidos: string | null
  /** Filas que cumplen la condición antes del LIMIT. */
  total: number
}

type FilaSemana = {
  clienteId: string
  nombre: string
  apellidos: string | null
  programadas: number
  enviadas: number
  restantes: number
  hoy: number
  hoyEnviadas: number
  hoyEnCurso: number
}

type FilaComentario = {
  id: string
  sesionId: string
  creadaEn: Date
  sesion: string
  clienteId: string
  nombre: string
  apellidos: string | null
  total: number
}

function cliente(persona: Persona): ClienteDelPanel {
  return { id: persona.id, nombre: [persona.nombre, persona.apellidos].filter(Boolean).join(" ") }
}

function deFila(fila: { clienteId: string; nombre: string; apellidos: string | null }): Persona {
  return { id: fila.clienteId, nombre: fila.nombre, apellidos: fila.apellidos }
}

function estadoDe(fila: FilaSesion): EstadoEntrenoDeHoy {
  if (fila.enviadoEn !== null) return "enviada"
  return fila.iniciada ? "enCurso" : "pendiente"
}

/** Hoy en la zona de la agenda, la misma que usan la semana del cliente y sus registros. */
export function hoyEnAgenda(ahora: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_AGENDA }).format(ahora)
}

/**
 * Panel «Hoy» del entrenador: cartera, sesiones de hoy, lo pendiente de revisar,
 * la semana y la actividad reciente, en una respuesta.
 *
 * Premisa: el negocio tiene un único entrenador. `AlcanceClienteService` ya da
 * al rol `entrenador` acceso a todos los clientes y el modelo no tiene una
 * relación entrenador–cliente, así que el panel agrega toda la cartera. Lo único
 * propio de cada entrenador es su lectura de novedades: un comentario que ha
 * leído uno sigue sin leer para otro. Si llegan varios entrenadores con carteras
 * separadas, hará falta esa relación y filtrar aquí por ella.
 *
 * Consentimiento: como el resto de la API, el consentimiento de salud frena las
 * escrituras, no la lectura de lo ya guardado (SPEC-seguimiento-corporal). El
 * panel no enseña más que las rutas que ya ve el entrenador y se queda en lo
 * mínimo: de una medida dice que existe, no sus valores. `sinConsentimiento`
 * avisa de a quién no se le podrá guardar nada nuevo.
 *
 * Cada bloque es una consulta agregada o una lista con límite, todas en
 * paralelo: el número de consultas no crece con la cartera.
 */
@Injectable()
export class PanelService {
  constructor(private readonly prisma: PrismaService) {}

  async hoy(actor: IdentidadVerificada, ahora = new Date()): Promise<PanelHoy> {
    if (actor.rol !== "entrenador") throw new ForbiddenException()
    const hoy = hoyEnAgenda(ahora)
    const lunes = lunesDeSemana(hoy)
    const domingo = sumarDias(lunes, 6)
    const [
      clientes,
      sinConsentimiento,
      semana,
      sesionesDeHoy,
      enviadas,
      molestias,
      molestiasAbiertas,
      fotos,
      fotosRecibidas,
      comentarios,
      actividad,
    ] = await Promise.all([
      this.prisma.usuario.groupBy({
        by: ["estado"],
        where: { rol: "cliente" },
        _count: { _all: true },
      }),
      this.prisma.usuario.count({
        where: {
          ...VIGENTE,
          consentimientosSalud: { none: { version: VERSION_CONSENTIMIENTO, retiradoEn: null } },
        },
      }),
      this.semana(hoy, lunes, domingo),
      this.sesiones(
        Prisma.sql`sp."fechaActual" = ${hoy}::date`,
        Prisma.sql`u."nombre", u."apellidos" NULLS FIRST, se."id"`,
        MAXIMO_HOY,
      ),
      this.sesiones(
        Prisma.sql`se."enviadoEn" IS NOT NULL AND se."revisadaEn" IS NULL`,
        Prisma.sql`se."enviadoEn" DESC, se."id"`,
        MAXIMO_POR_REVISAR,
      ),
      this.prisma.molestia.findMany({
        where: { estado: "abierta", cliente: VIGENTE },
        include: { cliente: NOMBRE },
        orderBy: [{ creadaEn: "desc" }, { id: "asc" }],
        take: MAXIMO_POR_REVISAR,
      }),
      this.prisma.molestia.count({ where: { estado: "abierta", cliente: VIGENTE } }),
      this.prisma.solicitudFotos.findMany({
        where: { estado: "recibida", cliente: VIGENTE },
        select: {
          id: true,
          creadaEn: true,
          recibidaEn: true,
          cliente: NOMBRE,
          _count: { select: { medios: { where: { estado: "disponible" } } } },
        },
        orderBy: [{ recibidaEn: "desc" }, { id: "desc" }],
        take: MAXIMO_POR_REVISAR,
      }),
      this.prisma.solicitudFotos.count({ where: { estado: "recibida", cliente: VIGENTE } }),
      this.comentariosSinLeer(actor.sub),
      this.actividad(),
    ])

    const porEstado = new Map(clientes.map((fila) => [fila.estado, fila._count._all]))
    const activos = porEstado.get("activo") ?? 0
    const pendientes = porEstado.get("pendiente") ?? 0
    const bajas = porEstado.get("desactivado") ?? 0
    const resumen = resumirSemana(
      semana.map((fila) => ({
        cliente: cliente(deFila(fila)),
        programadas: fila.programadas,
        enviadas: fila.enviadas,
        restantes: fila.restantes,
      })),
      lunes,
      domingo,
    )

    return PanelHoySchema.parse({
      fecha: hoy,
      clientes: {
        activos,
        pendientes,
        bajas,
        total: activos + pendientes + bajas,
        sinConsentimiento,
      },
      hoy: {
        total: semana.reduce((suma, fila) => suma + fila.hoy, 0),
        enviadas: semana.reduce((suma, fila) => suma + fila.hoyEnviadas, 0),
        enCurso: semana.reduce((suma, fila) => suma + fila.hoyEnCurso, 0),
        sesiones: sesionesDeHoy.map((fila) => ({
          sesionId: fila.id,
          cliente: cliente(deFila(fila)),
          sesion: fila.sesion,
          estado: estadoDe(fila),
          enviadoEn: fila.enviadoEn?.toISOString() ?? null,
        })),
      },
      porRevisar: {
        entrenamientos: {
          total: enviadas[0]?.total ?? 0,
          elementos: enviadas.map((fila) => ({
            sesionId: fila.id,
            cliente: cliente(deFila(fila)),
            sesion: fila.sesion,
            fecha: fila.fecha,
            enviadoEn: fila.enviadoEn?.toISOString(),
            esfuerzo: fila.esfuerzo,
          })),
        },
        molestias: {
          total: molestiasAbiertas,
          elementos: molestias.map((fila) => ({
            id: fila.id,
            sesionId: fila.sesionId,
            cliente: cliente(fila.cliente),
            zona: fila.zona,
            intensidad: fila.intensidad,
            nivel: nivelDeMolestia(fila.intensidad, Sintomas.parse(fila.sintomas)),
            ejercicio: fila.ejercicio,
            creadaEn: fila.creadaEn.toISOString(),
          })),
        },
        fotos: {
          total: fotosRecibidas,
          elementos: fotos.map((fila) => ({
            solicitudId: fila.id,
            cliente: cliente(fila.cliente),
            fotos: fila._count.medios,
            recibidaEn: (fila.recibidaEn ?? fila.creadaEn).toISOString(),
          })),
        },
        comentarios: {
          total: comentarios[0]?.total ?? 0,
          elementos: comentarios.map((fila) => ({
            novedadId: fila.id,
            sesionId: fila.sesionId,
            cliente: cliente(deFila(fila)),
            sesion: fila.sesion,
            creadaEn: fila.creadaEn.toISOString(),
          })),
        },
      },
      semana: resumen,
      actividad,
      ...(await this.agendaYNegocio(hoy)),
    })
  }

  /** Citas de hoy en la agenda, «Lo quiero» sin activar y cobros del negocio. */
  private async agendaYNegocio(hoy: string): Promise<Pick<PanelHoy, "agenda" | "negocio">> {
    const desde = aInstante(hoy, 0, ZONA_AGENDA) ?? new Date(`${hoy}T00:00:00Z`)
    const manana = sumarDias(hoy, 1)
    const hasta = aInstante(manana, 0, ZONA_AGENDA) ?? new Date(`${manana}T00:00:00Z`)
    const mes = mesDeFecha(hoy)
    const inicioMes = aInstante(mes, 0, ZONA_AGENDA) ?? new Date(`${mes}T00:00:00Z`)
    const siguiente = sumarMeses(mes, 1)
    const finMes = aInstante(siguiente, 0, ZONA_AGENDA) ?? new Date(`${siguiente}T00:00:00Z`)
    const deHoy = { estado: "confirmada", inicio: { gte: desde, lt: hasta } } as const
    const [citas, totalCitas, solicitudes, pendientes, cobrado] = await Promise.all([
      this.prisma.reserva.findMany({
        where: deHoy,
        include: { cliente: NOMBRE, servicio: { select: { nombre: true } } },
        orderBy: [{ inicio: "asc" }, { id: "asc" }],
        take: MAXIMO_HOY,
      }),
      this.prisma.reserva.count({ where: deHoy }),
      this.prisma.solicitudProducto.count({ where: { estado: "pendiente" } }),
      this.prisma.cobro.aggregate({
        where: { estado: "pendiente" },
        _count: { _all: true },
        _sum: { importeCentimos: true },
      }),
      this.prisma.cobro.aggregate({
        where: { estado: "cobrado", cobradoEn: { gte: inicioMes, lt: finMes } },
        _sum: { importeCentimos: true },
      }),
    ])
    return {
      agenda: {
        total: totalCitas,
        citas: citas.map((fila) => ({
          reservaId: fila.id,
          cliente: cliente(fila.cliente),
          servicio: fila.servicio.nombre,
          inicio: fila.inicio.toISOString(),
          fin: fila.fin.toISOString(),
          personas: fila.personas,
        })),
      },
      negocio: {
        solicitudesPendientes: solicitudes,
        cobrosPendientes: pendientes._count._all,
        pendienteCentimos: pendientes._sum.importeCentimos ?? 0,
        cobradoMesCentimos: cobrado._sum.importeCentimos ?? 0,
      },
    }
  }

  /**
   * Una fila por cliente con sesiones esta semana: lo que tocaba de lunes a hoy,
   * lo enviado de eso, lo que queda hasta el domingo y el estado de hoy.
   */
  private semana(hoy: string, lunes: string, domingo: string): Promise<FilaSemana[]> {
    return this.prisma.$queryRaw<FilaSemana[]>`
      SELECT u."id" AS "clienteId", u."nombre", u."apellidos",
        (count(*) FILTER (WHERE sp."fechaActual" <= ${hoy}::date))::int AS "programadas",
        (count(se."enviadoEn") FILTER (WHERE sp."fechaActual" <= ${hoy}::date))::int AS "enviadas",
        (count(*) FILTER (WHERE sp."fechaActual" > ${hoy}::date))::int AS "restantes",
        (count(*) FILTER (WHERE sp."fechaActual" = ${hoy}::date))::int AS "hoy",
        (count(se."enviadoEn") FILTER (WHERE sp."fechaActual" = ${hoy}::date))::int AS "hoyEnviadas",
        (count(*) FILTER (
          WHERE sp."fechaActual" = ${hoy}::date AND se."enviadoEn" IS NULL AND se."iniciada"
        ))::int AS "hoyEnCurso"
      FROM "sesiones_programadas" sp
      JOIN "usuarios" u ON u."id" = sp."clienteId"
      LEFT JOIN "sesiones_entrenamiento" se ON se."id" = sp."id"
      WHERE u."rol" = 'cliente' AND u."estado" <> 'desactivado'
        AND sp."fechaActual" BETWEEN ${lunes}::date AND ${domingo}::date
      GROUP BY u."id"
    `
  }

  /** Sesiones de clientes vigentes que cumplen `condicion`, con el total antes del límite. */
  private sesiones(
    condicion: Prisma.Sql,
    orden: Prisma.Sql,
    limite: number,
  ): Promise<FilaSesion[]> {
    return this.prisma.$queryRaw<FilaSesion[]>`
      SELECT se."id", to_char(sp."fechaActual", 'YYYY-MM-DD') AS "fecha",
        se."enviadoEn", se."iniciada",
        COALESCE(se."prescripcion"->>'nombre', 'Sesión') AS "sesion",
        CASE WHEN jsonb_typeof(se."resultado"->'cierre'->'esfuerzo') = 'number'
          THEN (se."resultado"->'cierre'->>'esfuerzo')::int END AS "esfuerzo",
        u."id" AS "clienteId", u."nombre", u."apellidos",
        (count(*) OVER ())::int AS "total"
      FROM "sesiones_entrenamiento" se
      JOIN "sesiones_programadas" sp ON sp."id" = se."id"
      JOIN "usuarios" u ON u."id" = se."clienteId"
      WHERE u."rol" = 'cliente' AND u."estado" <> 'desactivado' AND ${condicion}
      ORDER BY ${orden}
      LIMIT ${limite}
    `
  }

  /** Comentarios de clientes que este entrenador no ha leído. */
  private comentariosSinLeer(entrenadorId: string): Promise<FilaComentario[]> {
    return this.prisma.$queryRaw<FilaComentario[]>`
      SELECT n."id", n."sesionId", n."creadaEn",
        COALESCE(se."prescripcion"->>'nombre', 'Sesión') AS "sesion",
        u."id" AS "clienteId", u."nombre", u."apellidos",
        (count(*) OVER ())::int AS "total"
      FROM "novedades_entrenamiento" n
      JOIN "sesiones_entrenamiento" se ON se."id" = n."sesionId"
      JOIN "usuarios" u ON u."id" = n."clienteId"
      WHERE u."rol" = 'cliente' AND u."estado" <> 'desactivado'
        AND n."audiencia" = 'entrenador' AND n."tipo" = 'comentario'
        AND NOT EXISTS (
          SELECT 1 FROM "lecturas_novedades" l
          WHERE l."novedadId" = n."id" AND l."usuarioId" = ${entrenadorId}
        )
      ORDER BY n."creadaEn" DESC, n."id"
      LIMIT ${MAXIMO_POR_REVISAR}
    `
  }

  /**
   * Los últimos envíos, molestias, fotos recibidas y medidas apuntadas por los
   * propios clientes: diez de cada, mezclados por fecha y recortados a diez.
   */
  private async actividad(): Promise<ActividadDelPanel[]> {
    const [envios, molestias, fotos, medidas] = await Promise.all([
      this.sesiones(
        Prisma.sql`se."enviadoEn" IS NOT NULL`,
        Prisma.sql`se."enviadoEn" DESC, se."id"`,
        MAXIMO_ACTIVIDAD,
      ),
      this.prisma.molestia.findMany({
        where: { cliente: VIGENTE },
        include: { cliente: NOMBRE },
        orderBy: [{ creadaEn: "desc" }, { id: "asc" }],
        take: MAXIMO_ACTIVIDAD,
      }),
      this.prisma.solicitudFotos.findMany({
        where: { recibidaEn: { not: null }, cliente: VIGENTE },
        select: {
          id: true,
          recibidaEn: true,
          cliente: NOMBRE,
          _count: { select: { medios: { where: { estado: "disponible" } } } },
        },
        orderBy: [{ recibidaEn: "desc" }, { id: "desc" }],
        take: MAXIMO_ACTIVIDAD,
      }),
      this.prisma.medidaCorporal.findMany({
        where: { cliente: VIGENTE, autor: { rol: "cliente" } },
        select: { id: true, creadoEn: true, cliente: NOMBRE },
        orderBy: [{ creadoEn: "desc" }, { id: "asc" }],
        take: MAXIMO_ACTIVIDAD,
      }),
    ])
    const eventos: ActividadDelPanel[] = [
      ...envios.flatMap((fila): ActividadDelPanel[] =>
        fila.enviadoEn
          ? [
              {
                tipo: "envio",
                id: fila.id,
                cliente: cliente(deFila(fila)),
                fecha: fila.enviadoEn.toISOString(),
                sesionId: fila.id,
                sesion: fila.sesion,
              },
            ]
          : [],
      ),
      ...molestias.map((fila): ActividadDelPanel => ({
        tipo: "molestia",
        id: fila.id,
        cliente: cliente(fila.cliente),
        fecha: fila.creadaEn.toISOString(),
        sesionId: fila.sesionId,
        zona: fila.zona,
        nivel: nivelDeMolestia(fila.intensidad, Sintomas.parse(fila.sintomas)),
      })),
      ...fotos.flatMap((fila): ActividadDelPanel[] =>
        fila.recibidaEn
          ? [
              {
                tipo: "fotos",
                id: fila.id,
                cliente: cliente(fila.cliente),
                fecha: fila.recibidaEn.toISOString(),
                fotos: fila._count.medios,
              },
            ]
          : [],
      ),
      ...medidas.map((fila): ActividadDelPanel => ({
        tipo: "medida",
        id: fila.id,
        cliente: cliente(fila.cliente),
        fecha: fila.creadoEn.toISOString(),
      })),
    ]
    return eventos
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || a.id.localeCompare(b.id))
      .slice(0, MAXIMO_ACTIVIDAD)
  }
}
