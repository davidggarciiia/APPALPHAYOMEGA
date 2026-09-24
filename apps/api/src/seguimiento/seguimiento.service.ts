import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common"
import {
  CONFIGURACION_SEGUIMIENTO_INICIAL,
  ConfiguracionSeguimientoSchema,
  ZONA_AGENDA,
  type CambiarDia,
  type ConfiguracionSeguimiento,
  type ConsultarPeriodo,
  type DiaDeSeguimiento,
  type ListadoDias,
  type ListadoMedidas,
  type ListadoPruebas,
  type GuardarConfiguracionSeguimiento,
  type Medida,
  type PruebaFisica,
  type RegistrarMedida,
  type RegistrarPrueba,
} from "@alpha-omega/shared"
import type {
  DiaSeguimiento,
  MedidaCorporal,
  Prisma,
  PruebaFisica as FilaPrueba,
} from "@prisma/client"
import { z } from "zod"

import { fechaSql } from "../agenda/fechas.js"
import { conflicto } from "../entrenamiento/documentos.js"
import type { IdentidadVerificada } from "../identity/peticion.js"
import { PrismaService } from "../prisma/prisma.service.js"

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
  constructor(private readonly prisma: PrismaService) {}

  private async cliente(
    clienteId: string,
  ): Promise<{ fechaNacimiento: Date | null; estado: string }> {
    const cliente = await this.prisma.usuario.findFirst({
      where: { id: clienteId, rol: "cliente" },
      select: { fechaNacimiento: true, estado: true },
    })
    if (!cliente) throw new NotFoundException("Cliente no disponible")
    return cliente
  }

  async configuracion(clienteId: string): Promise<ConfiguracionSeguimiento> {
    await this.cliente(clienteId)
    const fila = await this.prisma.configuracionSeguimiento.findUnique({ where: { clienteId } })
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
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error.code === "P2002" || error.code === "P2025")
      )
        throw obsoleta()
      throw error
    }
  }

  private comprobarFecha(dia: string): void {
    if (dia > hoy())
      throw new BadRequestException({
        statusCode: 400,
        codigo: "solicitud_invalida",
        message: "No puedes apuntar un día que aún no ha llegado",
      })
  }

  async cambiarDia(clienteId: string, dia: string, cambio: CambiarDia): Promise<DiaDeSeguimiento> {
    this.comprobarFecha(dia)
    await this.cliente(clienteId)
    const fila = await this.prisma.diaSeguimiento.upsert({
      where: { clienteId_fecha: { clienteId, fecha: fechaSql(dia) } },
      create: { clienteId, fecha: fechaSql(dia), ...cambio },
      update: cambio,
    })
    return diaPublico(fila)
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
    await this.cliente(clienteId)
    const { operacionId, fecha: dia, ...valores } = datos
    const anterior = await this.prisma.medidaCorporal.findUnique({
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
        throw conflicto("operacion_incompatible", "Esta operación ya se utilizó con otro contenido")
      return medida(anterior)
    }
    const fila = await this.prisma.medidaCorporal.create({
      data: { clienteId, autorId: identidad.sub, operacionId, fecha: fechaSql(dia), ...valores },
    })
    return medida(fila)
  }

  async medidas(clienteId: string): Promise<ListadoMedidas> {
    const cliente = await this.cliente(clienteId)
    const filas = await this.prisma.medidaCorporal.findMany({
      where: { clienteId },
      orderBy: [{ fecha: "asc" }, { creadoEn: "asc" }],
      take: 500,
    })
    return {
      medidas: filas.map(medida),
      fechaNacimiento: cliente.fechaNacimiento ? fecha(cliente.fechaNacimiento) : null,
    }
  }

  async registrarPrueba(
    identidad: IdentidadVerificada,
    clienteId: string,
    datos: RegistrarPrueba,
  ): Promise<PruebaFisica> {
    this.comprobarFecha(datos.fecha)
    await this.cliente(clienteId)
    const { operacionId, fecha: dia } = datos
    const anterior = await this.prisma.pruebaFisica.findUnique({
      where: { autorId_operacionId: { autorId: identidad.sub, operacionId } },
    })
    if (anterior) {
      const igual =
        anterior.clienteId === clienteId &&
        fecha(anterior.fecha) === dia &&
        Number(anterior.valor) === datos.valor &&
        ("pruebaId" in datos
          ? anterior.pruebaId === datos.pruebaId
          : anterior.pruebaId === null &&
            anterior.nombre === datos.nombre &&
            anterior.unidad === datos.unidad)
      if (!igual)
        throw conflicto("operacion_incompatible", "Esta operación ya se utilizó con otro contenido")
      return prueba(anterior)
    }
    if (identidad.rol === "cliente" && !("pruebaId" in datos))
      throw new BadRequestException("Elige una prueba prescrita por tu entrenador")
    let valores: { pruebaId: string | null; nombre: string; unidad: string; valor: number }
    if ("pruebaId" in datos) {
      const configuracion = await this.configuracion(clienteId)
      const prescrita = configuracion.pruebasPrescritas.find((p) => p.id === datos.pruebaId)
      if (!prescrita) throw new BadRequestException("La prueba no está prescrita para este cliente")
      valores = {
        pruebaId: prescrita.id,
        nombre: prescrita.nombre,
        unidad: prescrita.unidad,
        valor: datos.valor,
      }
    } else {
      valores = { pruebaId: null, nombre: datos.nombre, unidad: datos.unidad, valor: datos.valor }
    }
    const fila = await this.prisma.pruebaFisica.create({
      data: { clienteId, autorId: identidad.sub, operacionId, fecha: fechaSql(dia), ...valores },
    })
    return prueba(fila)
  }

  async pruebas(clienteId: string): Promise<ListadoPruebas> {
    await this.cliente(clienteId)
    const filas = await this.prisma.pruebaFisica.findMany({
      where: { clienteId },
      orderBy: [{ nombre: "asc" }, { fecha: "asc" }],
      take: 500,
    })
    return { pruebas: filas.map(prueba) }
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
