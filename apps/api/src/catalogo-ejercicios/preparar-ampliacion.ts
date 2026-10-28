import { realpathSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { CrearEjercicioSchema } from "@alpha-omega/shared"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import { z } from "zod"

import { cargarEntornoLocal, leerVariable } from "../config/entorno.js"
import { urlDeConexion } from "../config/postgres.js"
import { normalizarNombre } from "./catalogo-ejercicios.service.js"
import { CATALOGO_AMPLIADO, type EntradaCatalogoAmpliado } from "./catalogo-ampliado.js"
import { CATALOGO_INICIAL } from "./catalogo-inicial.js"

export type OpcionesAmpliacion = {
  confirmar: boolean
  entradas?: readonly EntradaCatalogoAmpliado[]
  informar?: (linea: string) => void
}

export type ResumenAmpliacion = { creados: number; yaExistian: number }

const Equivalentes = z.array(z.string().trim().min(1).max(120)).default([])

/** Valida todo antes de abrir una transacción o escribir una sola ficha. */
function validar(entradas: readonly EntradaCatalogoAmpliado[]) {
  const nombres = new Set<string>()
  const nombresIniciales = new Set(
    CATALOGO_INICIAL.flatMap((entrada) =>
      [entrada.nombre, ...(entrada.equivalentes ?? [])].map(normalizarNombre),
    ),
  )
  return entradas.map(({ categoria: _categoria, equivalentes, ...entrada }) => {
    const ficha = CrearEjercicioSchema.parse(entrada)
    const identificadores = [ficha.nombre, ...Equivalentes.parse(equivalentes)].map(
      normalizarNombre,
    )
    for (const nombre of identificadores) {
      if (nombresIniciales.has(nombre)) {
        throw new Error(`Nombre o equivalencia ya definido en el catálogo inicial: ${nombre}`)
      }
      if (nombres.has(nombre)) throw new Error(`Nombre o equivalencia repetido: ${nombre}`)
      nombres.add(nombre)
    }
    return { ficha, identificadores }
  })
}

/**
 * Instala fichas textuales sin figuras. La ficha existente gana siempre, aunque
 * esté retirada o editada. Una equivalencia ambigua aborta la carga completa.
 * Repetir la instalación no cambia datos ni fechas del catálogo anterior.
 */
export async function prepararAmpliacion(
  prisma: PrismaClient,
  opciones: OpcionesAmpliacion,
): Promise<ResumenAmpliacion> {
  const entradas = validar(opciones.entradas ?? CATALOGO_AMPLIADO)
  const nombres = entradas.flatMap((entrada) => entrada.identificadores)

  for (let intento = 0; ; intento++) {
    try {
      const resultado = await prisma.$transaction(
        async (tx) => {
          const existentes = await tx.ejercicio.findMany({
            where: { nombreNormalizado: { in: nombres } },
            select: { id: true, nombre: true, nombreNormalizado: true },
          })
          const porNombre = new Map(existentes.map((fila) => [fila.nombreNormalizado, fila]))
          // Resolver TODAS las equivalencias antes de crear: nunca hay una carga parcial.
          const plan = entradas.map((entrada) => {
            const coincidencias = new Map(
              entrada.identificadores.flatMap((nombre) => {
                const fila = porNombre.get(nombre)
                return fila === undefined ? [] : [[fila.id, fila] as const]
              }),
            )
            if (coincidencias.size > 1) {
              throw new Error(`Equivalencia ambigua para «${entrada.ficha.nombre}»`)
            }
            return { ...entrada, existente: coincidencias.values().next().value }
          })
          const resumen: ResumenAmpliacion = { creados: 0, yaExistian: 0 }
          const lineas: string[] = []
          for (const { ficha, existente } of plan) {
            if (existente !== undefined) {
              resumen.yaExistian++
              lineas.push(`= ${ficha.nombre}: ya existe como «${existente.nombre}». Se conserva.`)
              continue
            }
            if (opciones.confirmar) {
              await tx.ejercicio.create({
                data: {
                  nombre: ficha.nombre,
                  nombreNormalizado: normalizarNombre(ficha.nombre),
                  grupoPrincipal: ficha.grupoPrincipal,
                  instrucciones: ficha.instrucciones,
                  pasos: ficha.pasos,
                  evita: ficha.evita,
                  consejos: ficha.consejos,
                  estado: "publicado",
                  gruposSecundarios: {
                    create: ficha.gruposSecundarios.map((grupo) => ({ grupo })),
                  },
                },
              })
            }
            resumen.creados++
            lineas.push(
              `+ ${ficha.nombre}: ${opciones.confirmar ? "creado" : "se crearía"} sin figura.`,
            )
          }
          return { resumen, lineas }
        },
        { isolationLevel: "Serializable", maxWait: 10000, timeout: 30000 },
      )
      // Informar después de confirmar la transacción: no anunciar filas revertidas.
      for (const linea of resultado.lineas) opciones.informar?.(linea)
      return resultado.resumen
    } catch (error) {
      const codigo =
        typeof error === "object" && error !== null && "code" in error ? error.code : undefined
      // Si la app u otra instalación creó una ficha durante la carga, repetir
      // desde una lectura nueva; nunca sustituir la ficha que acaba de crear.
      if (intento < 2 && (codigo === "P2002" || codigo === "P2034")) continue
      throw error
    }
  }
}

async function principal(): Promise<void> {
  cargarEntornoLocal()
  const confirmar = process.argv.includes("--confirmar")
  console.log(`Base de datos destino: ${leerVariable("POSTGRES_DB")}`)
  console.log(
    confirmar ? "Carga de fichas textuales autorizada." : "Simulación: no se escribe nada.",
  )
  const prisma = new PrismaClient({ adapter: new PrismaPg(urlDeConexion()) })
  try {
    const resumen = await prepararAmpliacion(prisma, {
      confirmar,
      informar: (linea) => console.log(linea),
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
    console.error(error instanceof Error ? error.message : "No se pudo cargar el catálogo")
    process.exitCode = 1
  })
}
