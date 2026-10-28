import { Injectable, NotFoundException } from "@nestjs/common"
import {
  DocumentoDietaSchema,
  EleccionDeComidaSchema,
  ZONA_AGENDA,
  type Comida,
  type ComidaRegistrada,
  type ConsultarPeriodo,
  type ListadoComidasRegistradas,
  type RegistrarComida,
} from "@alpha-omega/shared"
import type { ComidaRegistrada as FilaComida } from "@prisma/client"

import { fechaSql } from "../agenda/fechas.js"
import { conflicto, invalida } from "../entrenamiento/documentos.js"
import { PrismaService } from "../prisma/prisma.service.js"
import { ConsentimientoService } from "../identity/consentimiento.service.js"

const fecha = (valor: Date): string => valor.toISOString().slice(0, 10)
const hoy = (): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_AGENDA }).format(new Date())

/** Comprueba que lo elegido existe en esa comida de la dieta. */
function comprobarEleccion(comida: Comida, datos: RegistrarComida): void {
  const eleccion = datos.eleccion
  if (eleccion.tipo === "hecha") return
  if (eleccion.tipo === "alternativa") {
    const existe =
      comida.forma === "alternativas" &&
      comida.grupos.some((g) => g.alternativas.some((a) => a.id === eleccion.alternativaId))
    if (!existe) throw invalida("Esa opción no está en esta comida")
    return
  }
  if (comida.forma !== "intercambio") throw invalida("Esta comida no se arma por intercambios")
  const columnas = eleccion.elegidos.map((e) => e.columna)
  if (new Set(columnas).size !== columnas.length || columnas.length !== comida.columnas.length)
    throw invalida("Elige un alimento por cada columna")
  const valido = eleccion.elegidos.every((elegido) =>
    comida.columnas.some(
      (columna) =>
        columna.nombre === elegido.columna &&
        columna.alimentos.some((alimento) => alimento.nombre === elegido.alimento),
    ),
  )
  if (!valido) throw invalida("Ese alimento no está en esta comida")
}

/**
 * Las comidas que el cliente marca como hechas, con lo que eligió. Se registran
 * contra la dieta publicada que tenía delante: si cambió, se rechaza.
 */
@Injectable()
export class ComidasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly consentimiento: ConsentimientoService,
  ) {}

  async registrar(
    clienteId: string,
    dia: string,
    comidaId: string,
    datos: RegistrarComida,
  ): Promise<ComidaRegistrada> {
    if (dia > hoy()) throw invalida("No puedes marcar una comida de un día que aún no ha llegado")
    return this.prisma.$transaction(async (tx) => {
      // Publicar una dieta bloquea esta misma fila antes de archivar la vigente.
      await tx.$queryRaw`SELECT "id" FROM "usuarios" WHERE "id" = ${clienteId} FOR UPDATE`
      await this.consentimiento.exigirVigente(clienteId, clienteId, tx)
      const dieta = await tx.dieta.findFirst({ where: { clienteId, estado: "publicada" } })
      if (!dieta) throw new NotFoundException("No tienes una dieta publicada")
      if (dieta.id !== datos.dietaId)
        throw conflicto("revision_obsoleta", "Tu dieta ha cambiado. Vuelve a abrirla.")
      const documento = DocumentoDietaSchema.parse(dieta.documento)
      if (documento.registroComidas === false)
        throw conflicto("operacion_incompatible", "Tu pauta no permite registrar comidas")
      const indice = (new Date(`${dia}T00:00:00Z`).getUTCDay() + 6) % 7
      const tipo = documento.tiposDeDia.find((t) => t.id === documento.semana[indice])
      const comida = tipo?.comidas.find((c) => c.id === comidaId)
      if (!comida) throw invalida("Esa comida no toca ese día")
      comprobarEleccion(comida, datos)
      const fila = await tx.comidaRegistrada.upsert({
        where: { clienteId_fecha_comidaId: { clienteId, fecha: fechaSql(dia), comidaId } },
        create: {
          clienteId,
          fecha: fechaSql(dia),
          comidaId,
          dietaId: dieta.id,
          eleccion: datos.eleccion,
        },
        update: { dietaId: dieta.id, eleccion: datos.eleccion },
      })
      return registrada(fila)
    })
  }

  async quitar(clienteId: string, dia: string, comidaId: string): Promise<void> {
    await this.prisma.comidaRegistrada.deleteMany({
      where: { clienteId, fecha: fechaSql(dia), comidaId },
    })
  }

  async listar(clienteId: string, periodo: ConsultarPeriodo): Promise<ListadoComidasRegistradas> {
    const filas = await this.prisma.comidaRegistrada.findMany({
      where: {
        clienteId,
        fecha: { gte: fechaSql(periodo.desde), lte: fechaSql(periodo.hasta) },
      },
      orderBy: [{ fecha: "asc" }, { registradaEn: "asc" }],
      take: 1000,
    })
    return { comidas: filas.map(registrada) }
  }
}

function registrada(fila: FilaComida): ComidaRegistrada {
  return {
    fecha: fecha(fila.fecha),
    comidaId: fila.comidaId,
    dietaId: fila.dietaId,
    eleccion: EleccionDeComidaSchema.parse(fila.eleccion),
    registradaEn: fila.registradaEn.toISOString(),
  }
}
