import { realpathSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"

import { cargarEntornoLocal, leerVariable } from "../config/entorno.js"
import { urlDeConexion } from "../config/postgres.js"
import { CATALOGO_DATASET, type EntradaDataset } from "./catalogo-dataset.js"
import { prepararAmpliacion, type ResumenAmpliacion } from "./preparar-ampliacion.js"

export type OpcionesDataset = {
  confirmar: boolean
  entradas?: readonly EntradaDataset[]
  informar?: (linea: string) => void
}

/** Fichas por transacción: cada lote cabe de sobra en el plazo de la ampliación. */
const LOTE = 100

/**
 * Instala la biblioteca ampliada con las mismas garantías que la ampliación:
 * simulación por defecto, la ficha existente gana siempre y repetir no cambia
 * nada. Va por lotes, así que un fallo deja instalados los lotes anteriores y
 * basta repetir la orden para completar el resto.
 */
export async function prepararDataset(
  prisma: PrismaClient,
  opciones: OpcionesDataset,
): Promise<ResumenAmpliacion> {
  const entradas = (opciones.entradas ?? CATALOGO_DATASET).map(
    ({ origen: _origen, ...entrada }) => entrada,
  )
  const total: ResumenAmpliacion = { creados: 0, yaExistian: 0 }
  for (let inicio = 0; inicio < entradas.length; inicio += LOTE) {
    const resumen = await prepararAmpliacion(prisma, {
      confirmar: opciones.confirmar,
      entradas: entradas.slice(inicio, inicio + LOTE),
      ...(opciones.informar ? { informar: opciones.informar } : {}),
    })
    total.creados += resumen.creados
    total.yaExistian += resumen.yaExistian
  }
  return total
}

async function principal(): Promise<void> {
  cargarEntornoLocal()
  const confirmar = process.argv.includes("--confirmar")
  const detalle = process.argv.includes("--detalle")
  console.log(`Base de datos destino: ${leerVariable("POSTGRES_DB")}`)
  console.log(
    confirmar ? "Carga de la biblioteca ampliada autorizada." : "Simulación: no se escribe nada.",
  )
  const prisma = new PrismaClient({ adapter: new PrismaPg(urlDeConexion()) })
  try {
    const resumen = await prepararDataset(prisma, {
      confirmar,
      ...(detalle ? { informar: (linea: string) => console.log(linea) } : {}),
    })
    console.log(
      `${confirmar ? "Hecho" : "Se haría"}: ${resumen.creados} creados, ` +
        `${resumen.yaExistian} ya existían. Las fichas nuevas no incluyen figuras.`,
    )
  } finally {
    await prisma.$disconnect()
  }
}

function ejecutadoComoScript(): boolean {
  const script = process.argv[1]
  if (script === undefined) return false
  try {
    return realpathSync.native(script) === realpathSync.native(fileURLToPath(import.meta.url))
  } catch {
    return false
  }
}

if (ejecutadoComoScript()) {
  principal().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "No se pudo cargar la biblioteca")
    process.exitCode = 1
  })
}
