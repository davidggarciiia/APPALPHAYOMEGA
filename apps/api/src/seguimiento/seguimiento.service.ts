import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common"
import {
  CONFIGURACION_SEGUIMIENTO_INICIAL,
  ConfiguracionSeguimientoSchema,
  ZONA_AGENDA,
  type CambiarDia,
  type ConfiguracionSeguimiento,
  type ConsultarPaginaSeguimiento,
  type ConsultarPeriodo,
  type DiaDeSeguimiento,
  type ListadoDias,
  type ListadoMedidas,
  type ListadoPruebas,
  type GuardarConfiguracionSeguimiento,
  type Medida,
  type PaginaMedidas,
  type PaginaPruebas,
  type PruebaFisica,
  type RegistrarMedida,
  type RegistrarPrueba,
} from "@alpha-omega/shared"
import type { DiaSeguimiento, MedidaCorporal, PruebaFisica as FilaPrueba } from "@prisma/client"
import { Prisma } from "@prisma/client"
import { z } from "zod"

import { fechaSql } from "../agenda/fechas.js"
import { conflicto, esCodigoPrisma, invalida } from "../entrenamiento/documentos.js"
import { ConsentimientoService } from "../identity/consentimiento.service.js"
import type { IdentidadVerificada } from "../identity/peticion.js"
import { PrismaService } from "../prisma/prisma.service.js"
import {
  LIMITE_LISTADO_ANTERIOR,
  anterioresA,
  cortarPagina,
  leerCursor,
  ordenReciente,
} from "./paginacion-seguimiento.js"

const numero = (valor: Prisma.Decimal | null): number | null =>
  valor === null ? null : Number(valor)
const fecha = (valor: Date): string => valor.toISOString().slice(0, 10)

/** Hoy en la zona de la agenda: nadie apunta el peso de mañana. */
function hoy(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_AGENDA }).format(new Date())
}

/**
 * Registro diario, medidas y pruebas de un cliente. Quién puede tocar a quién
 * lo deciden `@Roles` y `AlcanceClienteGuard` en el controlador.
 */
@Injectable()
export class SeguimientoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly consentimiento: ConsentimientoService,
  ) {}

  private async cliente(
    clienteId: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<{ fechaNacimiento: Date | null; estado: string }> {
    const cliente = await tx.usuario.findFirst({
      where: { id: clienteId, rol: "cliente" },
      select: { fechaNacimiento: true, estado: true },
    })
    if (!cliente) throw new NotFoundException("Cliente no disponible")
    return cliente
  }

  async configuracion(
    clienteId: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<ConfiguracionSeguimiento> {
    await this.cliente(clienteId, tx)
    const fila = await tx.configuracionSeguimiento.findUnique({ where: { clienteId } })
    return fila === null
      ? CONFIGURACION_SEGUIMIENTO_INICIAL
      : ConfiguracionSeguimientoSchema.parse({
          ...(fila.documento as object),
          revision: fila.revision,
        })
  }

  async guardarConfiguracion(
    clienteId: string,
    datos: GuardarConfiguracionSeguimiento,
  ): Promise<ConfiguracionSeguimiento> {
    const cliente = await this.cliente(clienteId)
    if (cliente.estado === "desactivado")
      throw conflicto("operacion_incompatible", "Este cliente está dado de baja")
    const { revision, ...documento } = datos
    const obsoleta = () =>
      conflicto("revision_obsoleta", "El seguimiento ha cambiado. Recarga antes de guardar.")
    try {
      const fila =
        revision === 0
          ? await this.prisma.configuracionSeguimiento.create({
              data: { clienteId, revision: 1, documento },
            })
          : await this.prisma.configuracionSeguimiento.update({
              where: { clienteId, revision },
              data: { revision: { increment: 1 }, documento },
            })
      return ConfiguracionSeguimientoSchema.parse({
        ...(fila.documento as object),
        revision: fila.revision,
      })
    } catch (error) {
      if (esCodigoPrisma(error, "P2002") || esCodigoPrisma(error, "P2025")) throw obsoleta()
      throw error
    }
  }

  private comprobarFecha(dia: string): void {
    if (dia > hoy()) throw invalida("No puedes apuntar un día que aún no ha llegado")
  }

  async cambiarDia(clienteId: string, dia: string, cambio: CambiarDia): Promise<DiaDeSeguimiento> {
    this.comprobarFecha(dia)
    return this.prisma.$transaction(async (tx) => {
      await this.cliente(clienteId, tx)
      await this.consentimiento.exigirVigente(clienteId, clienteId, tx)
      const fila = await tx.diaSeguimiento.upsert({
        where: { clienteId_fecha: { clienteId, fecha: fechaSql(dia) } },
        create: { clienteId, fecha: fechaSql(dia), ...cambio },
        update: cambio,
      })
      return diaPublico(fila)
    })
  }

  async dias(clienteId: string, periodo: ConsultarPeriodo): Promise<ListadoDias> {
    await this.cliente(clienteId)
    const filas = await this.prisma.diaSeguimiento.findMany({
      where: { clienteId, fecha: { gte: fechaSql(periodo.desde), lte: fechaSql(periodo.hasta) } },
      orderBy: { fecha: "asc" },
    })
    return { dias: filas.map(diaPublico) }
  }

  async registrarMedida(
    identidad: IdentidadVerificada,
    clienteId: string,
    datos: RegistrarMedida,
  ): Promise<Medida> {
    this.comprobarFecha(datos.fecha)
    const { operacionId, fecha: dia, ...valores } = datos
    const repetida = async (
      tx: Prisma.TransactionClient | PrismaService,
    ): Promise<Medida | null> => {
      const anterior = await tx.medidaCorporal.findUnique({
        where: { autorId_operacionId: { autorId: identidad.sub, operacionId } },
      })
      if (anterior) {
        const igual =
          anterior.clienteId === clienteId &&
          fecha(anterior.fecha) === dia &&
          numero(anterior.pesoKg) === valores.pesoKg &&
          numero(anterior.cinturaCm) === valores.cinturaCm &&
          numero(anterior.grasaPct) === valores.grasaPct &&
          anterior.alturaCm === valores.alturaCm
        if (!igual)
          throw conflicto(
            "operacion_incompatible",
            "Esta operación ya se utilizó con otro contenido",
          )
        return medida(anterior)
      }
      return null
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.cliente(clienteId, tx)
        await this.consentimiento.exigirVigente(clienteId, identidad.sub, tx)
        const anterior = await repetida(tx)
        if (anterior) return anterior
        const fila = await tx.medidaCorporal.create({
          data: {
            clienteId,
            autorId: identidad.sub,
            operacionId,
            fecha: fechaSql(dia),
            ...valores,
          },
        })
        return medida(fila)
      })
    } catch (error) {
      if (esCodigoPrisma(error, "P2002")) {
        const anterior = await repetida(this.prisma)
        if (anterior) return anterior
        throw conflicto("operacion_incompatible", "Esta operación ya se utilizó con otro contenido")
      }
      throw error
    }
  }

  /** Ruta anterior: las 500 más recientes, en el orden ascendente que esperaba. */
  async medidas(clienteId: string): Promise<ListadoMedidas> {
    const cliente = await this.cliente(clienteId)
    const filas = await this.prisma.medidaCorporal.findMany({
      where: { clienteId },
      orderBy: ordenReciente(),
      take: LIMITE_LISTADO_ANTERIOR,
    })
    return {
      medidas: filas.reverse().map(medida),
      fechaNacimiento: cliente.fechaNacimiento ? fecha(cliente.fechaNacimiento) : null,
    }
  }

  async paginaMedidas(
    clienteId: string,
    consulta: ConsultarPaginaSeguimiento,
  ): Promise<PaginaMedidas> {
    const desde = consulta.cursor === undefined ? undefined : leerCursor("medidas", consulta.cursor)
    const cliente = await this.cliente(clienteId)
    const pagina = cortarPagina(
      "medidas",
      await this.prisma.medidaCorporal.findMany({
        where: { clienteId, ...anterioresA(desde) },
        orderBy: ordenReciente(),
        take: consulta.limite + 1,
      }),
      consulta.limite,
    )
    return {
      medidas: pagina.filas.map(medida),
      fechaNacimiento: cliente.fechaNacimiento ? fecha(cliente.fechaNacimiento) : null,
      siguienteCursor: pagina.siguienteCursor,
    }
  }

  async registrarPrueba(
    identidad: IdentidadVerificada,
    clienteId: string,
    datos: RegistrarPrueba,
  ): Promise<PruebaFisica> {
    this.comprobarFecha(datos.fecha)
    const { operacionId, fecha: dia } = datos
    // La columna Decimal(8,2) y el replay usan la misma precisión.
    const valor = new Prisma.Decimal(datos.valor)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
      .toNumber()
    const repetida = async (
      tx: Prisma.TransactionClient | PrismaService,
    ): Promise<PruebaFisica | null> => {
      const anterior = await tx.pruebaFisica.findUnique({
        where: { autorId_operacionId: { autorId: identidad.sub, operacionId } },
      })
      if (anterior) {
        const igual =
          anterior.clienteId === clienteId &&
          fecha(anterior.fecha) === dia &&
          Number(anterior.valor) === valor &&
          ("pruebaId" in datos
            ? anterior.pruebaId === datos.pruebaId
            : anterior.pruebaId === null &&
              anterior.nombre === datos.nombre &&
              anterior.unidad === datos.unidad)
        if (!igual)
          throw conflicto(
            "operacion_incompatible",
            "Esta operación ya se utilizó con otro contenido",
          )
        return prueba(anterior)
      }
      return null
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.cliente(clienteId, tx)
        await this.consentimiento.exigirVigente(clienteId, identidad.sub, tx)
        const anterior = await repetida(tx)
        if (anterior) return anterior
        if (identidad.rol === "cliente" && !("pruebaId" in datos))
          throw new BadRequestException("Elige una prueba prescrita por tu entrenador")
        let valores: { pruebaId: string | null; nombre: string; unidad: string; valor: number }
        if ("pruebaId" in datos) {
          const configuracion = await this.configuracion(clienteId, tx)
          const prescrita = configuracion.pruebasPrescritas.find((p) => p.id === datos.pruebaId)
          if (!prescrita)
            throw new BadRequestException("La prueba no está prescrita para este cliente")
          valores = {
            pruebaId: prescrita.id,
            nombre: prescrita.nombre,
            unidad: prescrita.unidad,
            valor,
          }
        } else {
          valores = { pruebaId: null, nombre: datos.nombre, unidad: datos.unidad, valor }
        }
        const fila = await tx.pruebaFisica.create({
          data: {
            clienteId,
            autorId: identidad.sub,
            operacionId,
            fecha: fechaSql(dia),
            ...valores,
          },
        })
        return prueba(fila)
      })
    } catch (error) {
      if (esCodigoPrisma(error, "P2002")) {
        const anterior = await repetida(this.prisma)
        if (anterior) return anterior
        throw conflicto("operacion_incompatible", "Esta operación ya se utilizó con otro contenido")
      }
      throw error
    }
  }

  /** Ruta anterior: las 500 más recientes, agrupadas por nombre como esperaba. */
  async pruebas(clienteId: string): Promise<ListadoPruebas> {
    await this.cliente(clienteId)
    const recientes = await this.prisma.pruebaFisica.findMany({
      where: { clienteId },
      orderBy: ordenReciente(),
      take: LIMITE_LISTADO_ANTERIOR,
      select: { id: true },
    })
    const filas = await this.prisma.pruebaFisica.findMany({
      where: { clienteId, id: { in: recientes.map((fila) => fila.id) } },
      orderBy: [{ nombre: "asc" }, { fecha: "asc" }, { creadoEn: "asc" }, { id: "asc" }],
    })
    return { pruebas: filas.map(prueba) }
  }

  /** Por fecha, no por nombre: agrupar corresponde a quien presenta el histórico. */
  async paginaPruebas(
    clienteId: string,
    consulta: ConsultarPaginaSeguimiento,
  ): Promise<PaginaPruebas> {
    const desde = consulta.cursor === undefined ? undefined : leerCursor("pruebas", consulta.cursor)
    await this.cliente(clienteId)
    const pagina = cortarPagina(
      "pruebas",
      await this.prisma.pruebaFisica.findMany({
        where: { clienteId, ...anterioresA(desde) },
        orderBy: ordenReciente(),
        take: consulta.limite + 1,
      }),
      consulta.limite,
    )
    return { pruebas: pagina.filas.map(prueba), siguienteCursor: pagina.siguienteCursor }
  }
}

const SuplementosGuardados = z.array(z.string()).catch([])

function diaPublico(fila: DiaSeguimiento): DiaDeSeguimiento {
  return {
    fecha: fecha(fila.fecha),
    pesoKg: numero(fila.pesoKg),
    pasos: fila.pasos,
    suenoMin: fila.suenoMin,
    creatina: fila.creatina,
    suplementos: SuplementosGuardados.parse(fila.suplementos),
  }
}

function medida(fila: MedidaCorporal): Medida {
  return {
    id: fila.id,
    fecha: fecha(fila.fecha),
    pesoKg: numero(fila.pesoKg),
    cinturaCm: numero(fila.cinturaCm),
    grasaPct: numero(fila.grasaPct),
    alturaCm: fila.alturaCm,
    creadoEn: fila.creadoEn.toISOString(),
  }
}

function prueba(fila: FilaPrueba): PruebaFisica {
  return {
    id: fila.id,
    pruebaId: fila.pruebaId,
    fecha: fecha(fila.fecha),
    nombre: fila.nombre,
    valor: Number(fila.valor),
    unidad: fila.unidad,
    creadoEn: fila.creadoEn.toISOString(),
  }
}
