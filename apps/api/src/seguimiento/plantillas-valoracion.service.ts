import { Injectable } from "@nestjs/common"
import {
  PlantillaValoracionSchema,
  versionarDefinicionCorporal,
  versionarDefinicionPrueba,
  type DefinicionCorporal,
  type DefinicionPrueba,
  type GuardarPlantillaValoracion,
  type PlantillaValoracion,
} from "@alpha-omega/shared"
import type { Prisma } from "@prisma/client"

import { conflicto, esCodigoPrisma, invalida } from "../entrenamiento/documentos.js"
import { PrismaService } from "../prisma/prisma.service.js"

type Cliente = Prisma.TransactionClient | PrismaService

/** Sin plantilla guardada no se inventa ningún protocolo: empieza vacía. */
const VACIA: PlantillaValoracion = { revision: 0, corporales: [], pruebas: [] }

function leerFila(fila: { revision: number; documento: unknown }): PlantillaValoracion {
  return PlantillaValoracionSchema.parse({ ...(fila.documento as object), revision: fila.revision })
}

/**
 * Comprueba que cada definición conserva su identidad: renombrar o desactivar
 * mantiene la versión y cambiar cómo se mide la sube. Quitar una definición no
 * se admite: se desactiva, para que su identidad no se reutilice con otro
 * significado.
 */
function problemasDeVersion(anterior: PlantillaValoracion, nueva: PlantillaValoracion): string[] {
  const problemas: string[] = []
  const revisar = <T extends DefinicionCorporal | DefinicionPrueba>(
    antes: T[],
    despues: T[],
    versionar: (a: T, n: T) => T,
  ) => {
    const nuevas = new Map(despues.map((d) => [d.id, d]))
    for (const previa of antes) {
      const actual = nuevas.get(previa.id)
      if (!actual) {
        problemas.push(`«${previa.nombre}» no se puede quitar: desactívala`)
        continue
      }
      const esperada = versionar(previa, actual).version
      if (actual.version !== esperada)
        problemas.push(`«${actual.nombre}» debe tener la versión ${esperada}`)
    }
    const previas = new Set(antes.map((d) => d.id))
    for (const d of despues)
      if (!previas.has(d.id) && d.version !== 1)
        problemas.push(`«${d.nombre}» es nueva y empieza en la versión 1`)
  }
  revisar(anterior.corporales, nueva.corporales, versionarDefinicionCorporal)
  revisar(anterior.pruebas, nueva.pruebas, versionarDefinicionPrueba)
  const cruzadas = [
    ...nueva.corporales.filter((c) => anterior.pruebas.some((p) => p.id === c.id)),
    ...nueva.pruebas.filter((p) => anterior.corporales.some((c) => c.id === p.id)),
  ]
  for (const d of cruzadas) problemas.push(`«${d.nombre}» no puede cambiar de tipo`)
  return problemas
}

/** Plantilla de valoración de cada cliente. Solo la edita su entrenador. */
@Injectable()
export class PlantillasValoracionService {
  constructor(private readonly prisma: PrismaService) {}

  async leer(clienteId: string, cliente: Cliente = this.prisma): Promise<PlantillaValoracion> {
    const fila = await cliente.plantillaValoracion.findUnique({ where: { clienteId } })
    return fila === null ? VACIA : leerFila(fila)
  }

  async guardar(
    clienteId: string,
    datos: GuardarPlantillaValoracion,
  ): Promise<PlantillaValoracion> {
    const { revision, ...documento } = datos
    const obsoleta = () =>
      conflicto("revision_obsoleta", "La plantilla ha cambiado. Recarga antes de guardar.")
    try {
      return await this.prisma.$transaction(async (tx) => {
        const actual = await this.leer(clienteId, tx)
        if (actual.revision !== revision) throw obsoleta()
        const problemas = problemasDeVersion(actual, datos)
        if (problemas.length > 0) throw invalida(problemas.join(". "))
        const fila =
          revision === 0
            ? await tx.plantillaValoracion.create({ data: { clienteId, revision: 1, documento } })
            : await tx.plantillaValoracion.update({
                where: { clienteId, revision },
                data: { revision: { increment: 1 }, documento },
              })
        return leerFila(fila)
      })
    } catch (error) {
      if (esCodigoPrisma(error, "P2002") || esCodigoPrisma(error, "P2025")) throw obsoleta()
      throw error
    }
  }
}
