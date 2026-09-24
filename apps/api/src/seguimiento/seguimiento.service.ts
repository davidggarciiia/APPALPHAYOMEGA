import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common"
import {
  ZONA_AGENDA,
  type CambiarDia,
  type ConsultarPeriodo,
  type DiaDeSeguimiento,
  type ListadoDias,
  type ListadoMedidas,
  type ListadoPruebas,
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

  private async cliente(clienteId: string): Promise<{ fechaNacimiento: Date | null }> {
    const cliente = await this.prisma.usuario.findFirst({
      where: { id: clienteId, rol: "cliente" },
      select: { fechaNacimiento: true },
    })
    if (!cliente) throw new NotFoundException("Cliente no disponible")
    return cliente
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
    const { operacionId, fecha: dia, ...valores } = datos
    const anterior = await this.prisma.pruebaFisica.findUnique({
      where: { autorId_operacionId: { autorId: identidad.sub, operacionId } },
    })
    if (anterior) {
      const igual =
        anterior.clienteId === clienteId &&
        fecha(anterior.fecha) === dia &&
        anterior.nombre === valores.nombre &&
        Number(anterior.valor) === valores.valor &&
        anterior.unidad === valores.unidad
      if (!igual)
        throw conflicto("operacion_incompatible", "Esta operación ya se utilizó con otro contenido")
      return prueba(anterior)
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

function diaPublico(fila: DiaSeguimiento): DiaDeSeguimiento {
  return {
    fecha: fecha(fila.fecha),
    pesoKg: numero(fila.pesoKg),
    pasos: fila.pasos,
    suenoMin: fila.suenoMin,
    creatina: fila.creatina,
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
    fecha: fecha(fila.fecha),
    nombre: fila.nombre,
    valor: Number(fila.valor),
    unidad: fila.unidad,
    creadoEn: fila.creadoEn.toISOString(),
  }
}
