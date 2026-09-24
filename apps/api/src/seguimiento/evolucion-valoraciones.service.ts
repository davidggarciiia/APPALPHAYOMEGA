import { Injectable, NotFoundException } from "@nestjs/common"
import {
  DocumentoPublicoSchema,
  EvolucionSchema,
  type ConsultarEvolucion,
  type DefinicionCorporal,
  type DefinicionPrueba,
  type Evolucion,
  type PuntoEvolucion,
  type SerieEvolucion,
} from "@alpha-omega/shared"
import type { Prisma } from "@prisma/client"

import { fechaSql } from "../agenda/fechas.js"
import type { IdentidadVerificada } from "../identity/peticion.js"
import { PrismaService } from "../prisma/prisma.service.js"

const dia = (valor: Date): string => valor.toISOString().slice(0, 10)

/** Orden de presentación: visita por bloques y después el histórico. */
const RANGO = {
  medidas: 0,
  pliegues: 1,
  bioimpedancia: 2,
  pruebas: 3,
  medida: 4,
  dia: 5,
  prueba: 6,
} as const

type Serie = Omit<SerieEvolucion, "puntos"> & { rango: number }
type Acumulada = { rango: number; serie: Omit<SerieEvolucion, "puntos">; puntos: PuntoEvolucion[] }

/** Campos del histórico `MedidaCorporal`, cada uno su propia serie. */
const CAMPOS_MEDIDA = [
  { campo: "pesoKg", nombre: "Peso", unidad: "kg" },
  { campo: "cinturaCm", nombre: "Cintura", unidad: "cm" },
  { campo: "grasaPct", nombre: "Grasa corporal", unidad: "%" },
  { campo: "alturaCm", nombre: "Altura", unidad: "cm" },
] as const

const METODO_MAX = 400

/** Une lo que distingue la medición; `null` si no consta nada. */
function metodo(partes: (string | null)[]): string | null {
  const texto = partes.filter((parte) => parte !== null && parte !== "").join(" · ")
  if (texto === "") return null
  return texto.length <= METODO_MAX ? texto : `${texto.slice(0, METODO_MAX - 1)}…`
}

const metodoCorporal = (d: DefinicionCorporal) =>
  metodo([d.zona, d.lateralidad, d.instrumento, d.protocolo])

const metodoPrueba = (d: DefinicionPrueba, completo: boolean) =>
  metodo([
    completo ? null : "Protocolo incompleto",
    d.variante,
    d.duracionPrescritaS === null ? null : `${d.duracionPrescritaS} s`,
    d.instrumento,
    d.protocolo,
  ])

/** El autor del registro decide su procedencia: el propio cliente o su equipo. */
const origenDe = (autorId: string, clienteId: string) =>
  autorId === clienteId ? ("autorregistro" as const) : ("historico" as const)

/**
 * Reúne puntos por clave de serie. Una serie solo junta datos de la misma
 * identidad (definición y versión, o campo y procedencia del histórico); nunca
 * agrupa por coincidencia de fecha.
 */
class Series {
  private readonly series = new Map<string, Acumulada>()

  constructor(private readonly consulta: ConsultarEvolucion) {}

  anadir({ rango, ...serie }: Serie, punto: PuntoEvolucion): void {
    const { desde, hasta } = this.consulta
    if ((desde && punto.fecha < desde) || (hasta && punto.fecha > hasta)) return
    const actual = this.series.get(serie.clave)
    if (!actual) {
      this.series.set(serie.clave, { rango, serie, puntos: [punto] })
      return
    }
    // Renombrar conserva la identidad: se muestra el nombre más reciente.
    actual.serie.nombre = serie.nombre
    actual.puntos.push(punto)
  }

  evolucion(): Evolucion {
    const series = [...this.series.values()]
      .sort((a, b) => a.rango - b.rango)
      .map(({ serie, puntos }) => ({
        ...serie,
        // Orden estable: en la misma fecha se conserva el orden de llegada.
        puntos: [...puntos].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0)),
      }))
    return EvolucionSchema.parse({ series })
  }
}

/**
 * Evolución de un cliente: la publicación vigente de cada visita más el
 * histórico (`MedidaCorporal`, `PruebaFisica` y peso del registro diario).
 * Una corrección sustituye el punto de su visita; los borradores no cuentan
 * nunca. El nutricionista solo recibe datos corporales y peso, sin pruebas.
 */
@Injectable()
export class EvolucionValoracionesService {
  constructor(private readonly prisma: PrismaService) {}

  async evolucion(
    actor: IdentidadVerificada,
    clienteId: string,
    consulta: ConsultarEvolucion,
  ): Promise<Evolucion> {
    const cliente = await this.prisma.usuario.findFirst({
      where: { id: clienteId, rol: "cliente" },
      select: { id: true },
    })
    if (!cliente) throw new NotFoundException("Cliente no disponible")
    const conPruebas = actor.rol === "cliente" || actor.rol === "entrenador"
    const periodo: Prisma.DateTimeFilter = {
      ...(consulta.desde && { gte: fechaSql(consulta.desde) }),
      ...(consulta.hasta && { lte: fechaSql(consulta.hasta) }),
    }
    const [publicaciones, medidas, pruebas, dias] = await Promise.all([
      // Una sola versión por visita: la que nadie ha sustituido.
      this.prisma.publicacionValoracion.findMany({
        where: { valoracion: { clienteId }, sustituidaPor: null },
        select: {
          id: true,
          valoracionId: true,
          numero: true,
          fechaToma: true,
          documento: true,
        },
        orderBy: [{ fechaToma: "asc" }, { valoracion: { creadaEn: "asc" } }, { id: "asc" }],
      }),
      this.prisma.medidaCorporal.findMany({
        where: { clienteId, fecha: periodo },
        orderBy: [{ fecha: "asc" }, { creadoEn: "asc" }],
      }),
      conPruebas
        ? this.prisma.pruebaFisica.findMany({
            where: { clienteId, fecha: periodo },
            orderBy: [{ fecha: "asc" }, { creadoEn: "asc" }],
          })
        : Promise.resolve([]),
      this.prisma.diaSeguimiento.findMany({
        where: { clienteId, fecha: periodo, pesoKg: { not: null } },
        select: { fecha: true, pesoKg: true },
        orderBy: { fecha: "asc" },
      }),
    ])

    const series = new Series(consulta)
    const deHistorico = { publicacionId: null, valoracionId: null, corregido: false }

    for (const fila of publicaciones) {
      const documento = DocumentoPublicoSchema.parse(fila.documento)
      const fechaToma = dia(fila.fechaToma)
      const deVisita = {
        publicacionId: fila.id,
        valoracionId: fila.valoracionId,
        corregido: fila.numero > 1,
      }
      const corporales = new Map(documento.definiciones.corporales.map((d) => [d.id, d]))
      for (const r of documento.corporales) {
        const d = corporales.get(r.definicionId)
        if (!d || r.estado !== "registrado") continue
        series.anadir(
          {
            clave: `c:${d.id}:${d.version}`,
            nombre: d.nombre,
            unidad: d.unidad,
            bloque: d.bloque,
            origen: "valoracion",
            metodo: metodoCorporal(d),
            clasificada: true,
            rango: RANGO[d.bloque],
          },
          { fecha: fechaToma, valor: r.valor, ...deVisita },
        )
      }
      // El porcentaje que calculó el profesional: una serie por método, aparte de la báscula.
      const grasa = documento.grasaPorPliegues
      if (grasa)
        series.anadir(
          {
            clave: `g:pliegues:${grasa.metodo}`,
            nombre: "Grasa por pliegues",
            unidad: "%",
            bloque: "pliegues",
            origen: "valoracion",
            metodo: grasa.metodo,
            clasificada: true,
            rango: RANGO.pliegues,
          },
          { fecha: grasa.fecha, valor: grasa.valorPct, ...deVisita },
        )
      if (!conPruebas) continue
      const definiciones = new Map(documento.definiciones.pruebas.map((d) => [d.id, d]))
      for (const r of documento.pruebas) {
        const d = definiciones.get(r.definicionId)
        if (!d || r.estado !== "registrado") continue
        for (const m of d.metricas) {
          // Solo las métricas recogidas: una opcional ausente no es un cero.
          if (!Object.prototype.hasOwnProperty.call(r.valores, m.clave)) continue
          series.anadir(
            {
              // Un protocolo incompleto no se compara con uno completo.
              clave: `p:${d.id}:${d.version}:${m.clave}${r.protocoloCompleto ? "" : ":incompleto"}`,
              nombre: m.principal ? d.nombre : `${d.nombre} · ${m.nombre}`,
              unidad: m.unidad,
              bloque: "pruebas",
              origen: "valoracion",
              metodo: metodoPrueba(d, r.protocoloCompleto),
              clasificada: true,
              rango: RANGO.pruebas,
            },
            { fecha: r.fecha ?? fechaToma, valor: r.valores[m.clave]!, ...deVisita },
          )
        }
      }
    }

    for (const fila of medidas) {
      const origen = origenDe(fila.autorId, clienteId)
      for (const { campo, nombre, unidad } of CAMPOS_MEDIDA) {
        const valor = fila[campo]
        if (valor === null) continue
        series.anadir(
          {
            clave: `h:medida:${campo}:${origen}`,
            nombre,
            unidad,
            bloque: null,
            origen,
            metodo: null,
            clasificada: false,
            rango: RANGO.medida,
          },
          { fecha: dia(fila.fecha), valor: Number(valor), ...deHistorico },
        )
      }
    }

    for (const fila of dias)
      series.anadir(
        {
          clave: "h:dia:pesoKg",
          nombre: "Peso en ayunas",
          unidad: "kg",
          bloque: null,
          origen: "autorregistro",
          metodo: null,
          clasificada: false,
          rango: RANGO.dia,
        },
        { fecha: dia(fila.fecha), valor: Number(fila.pesoKg), ...deHistorico },
      )

    // Sin identificador de prescripción solo se reconocen por nombre y unidad exactos.
    for (const fila of pruebas) {
      const origen = origenDe(fila.autorId, clienteId)
      const identidad =
        fila.pruebaId === null
          ? `h:prueba-libre:${fila.nombre}|${fila.unidad}`
          : `h:prueba:${fila.pruebaId}:${fila.unidad}`
      series.anadir(
        {
          clave: `${identidad}:${origen}`,
          nombre: fila.nombre,
          unidad: fila.unidad,
          bloque: null,
          origen,
          metodo: null,
          clasificada: false,
          rango: RANGO.prueba,
        },
        { fecha: dia(fila.fecha), valor: Number(fila.valor), ...deHistorico },
      )
    }

    return series.evolucion()
  }
}
