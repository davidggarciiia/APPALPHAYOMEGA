import { realpathSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { CrearEjercicioSchema } from "@alpha-omega/shared"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"

import { cargarEntornoLocal, leerVariable } from "../config/entorno.js"
import { urlDeConexion } from "../config/postgres.js"

import { carpetaDeMedios, mediosDisponibles } from "./almacen-medios.js"
import { CATALOGO_INICIAL, type EntradaCatalogoInicial } from "./catalogo-inicial.js"
import { normalizarNombre } from "./catalogo-ejercicios.service.js"
import { medioDelIndice } from "./medios.js"

/**
 * Deja una instalación con el catálogo inicial y sus figuras, sin trabajo manual
 * del entrenador. Primero se importan las figuras (`importar-medios.js`) y
 * después:
 *
 *   npm run build --workspace apps/api && node apps/api/dist/catalogo-ejercicios/preparar-catalogo.js --confirmar
 *
 * Sin `--confirmar` no escribe: dice lo que haría. Antes de nada enseña el
 * nombre de la base de datos destino (nunca la URL ni la contraseña).
 *
 * Idempotente y conservador, porque el entrenador puede haber editado todo:
 * - Crea, publicado, cada ejercicio del catálogo que falte por nombre
 *   normalizado (la misma comparación que el catálogo).
 * - No lo crea si su figura ya la tiene otro ejercicio: es el mismo ejercicio
 *   con otro nombre, por ejemplo uno que el entrenador ha renombrado.
 * - A un ejercicio sin figura le asocia la del índice, como hace
 *   `PUT /ejercicios/:id/figura`: solo si el archivo está importado en este
 *   servidor y ningún otro ejercicio la usa.
 * - Nunca cambia un ejercicio ni una figura que ya existan, y nunca borra.
 *
 * Volver a ejecutarlo tras importar una figura que faltaba se la asocia.
 */
export type OpcionesPreparacion = {
  /** Sin esto no escribe nada: calcula y devuelve lo que haría. */
  confirmar: boolean
  /** Una línea por entrada del catálogo con lo que se hace (o se haría) con ella. */
  informar?: (linea: string) => void
}

export type ResumenPreparacion = {
  creados: number
  figurasAsociadas: number
  yaExistian: number
  /** Figuras que no se asocian porque su archivo no está importado en este servidor. */
  figurasSinArchivo: number
}

/** Choque con un índice único: el nombre del ejercicio o su única figura. */
function esRepetido(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002"
}

/** La figura del índice tal como la guarda el catálogo al asociarla. */
function figuraDelIndice(medioId: string): {
  tipo: "figura"
  claveDeObjeto: string
  origen: "licenciado"
  licencia: string
  subidoEn: Date
} {
  const medio = medioDelIndice(medioId)
  if (medio === undefined) throw new Error(`La figura ${medioId} no está en el índice`)
  return {
    tipo: "figura",
    claveDeObjeto: medio.id,
    origen: "licenciado",
    licencia: medio.licencia,
    subidoEn: new Date(),
  }
}

export async function prepararCatalogo(
  prisma: PrismaClient,
  opciones: OpcionesPreparacion,
): Promise<ResumenPreparacion> {
  const informar = opciones.informar ?? ((): void => undefined)

  // Todo se valida antes de escribir nada: o entra el catálogo entero o nada.
  for (const entrada of CATALOGO_INICIAL) {
    const { medioId, ...ficha } = entrada
    figuraDelIndice(medioId)
    CrearEjercicioSchema.parse(ficha)
  }

  const importadas = new Set(mediosDisponibles().map((medio) => medio.id))
  const nombres = CATALOGO_INICIAL.map((entrada) => normalizarNombre(entrada.nombre))
  const existentes = await prisma.ejercicio.findMany({
    where: { nombreNormalizado: { in: nombres } },
    select: { id: true, nombreNormalizado: true, contenidos: { where: { tipo: "figura" } } },
  })
  const porNombre = new Map(existentes.map((fila) => [fila.nombreNormalizado, fila]))
  const enUso = new Map(
    (
      await prisma.contenidoDeEjercicio.findMany({
        where: {
          tipo: "figura",
          claveDeObjeto: { in: CATALOGO_INICIAL.map((entrada) => entrada.medioId) },
        },
        select: { claveDeObjeto: true, ejercicio: { select: { nombre: true } } },
      })
    ).map((contenido) => [contenido.claveDeObjeto, contenido.ejercicio.nombre]),
  )

  const resumen: ResumenPreparacion = {
    creados: 0,
    figurasAsociadas: 0,
    yaExistian: 0,
    figurasSinArchivo: 0,
  }

  for (const entrada of CATALOGO_INICIAL) {
    const nombreNormalizado = normalizarNombre(entrada.nombre)
    const existente = porNombre.get(nombreNormalizado)
    const otro = enUso.get(entrada.medioId)
    const conArchivo = importadas.has(entrada.medioId)

    if (existente === undefined && otro !== undefined) {
      resumen.yaExistian++
      informar(`= ${entrada.nombre}: su figura ya está en «${otro}». No se crea.`)
      continue
    }

    if (existente !== undefined) {
      resumen.yaExistian++
      if (existente.contenidos.length > 0) {
        informar(`= ${entrada.nombre}: ya existe con figura. No se toca.`)
      } else if (otro !== undefined) {
        informar(`= ${entrada.nombre}: ya existe; su figura está en «${otro}». No se toca.`)
      } else if (!conArchivo) {
        resumen.figurasSinArchivo++
        informar(`! ${entrada.nombre}: ya existe; falta importar ${entrada.medioId}.`)
      } else if (!opciones.confirmar || (await asociarFigura(prisma, existente.id, entrada))) {
        resumen.figurasAsociadas++
        informar(`+ ${entrada.nombre}: ya existía; se le asocia ${entrada.medioId}.`)
      } else {
        informar(`= ${entrada.nombre}: le acaban de poner otra figura. No se toca.`)
      }
      continue
    }

    if (opciones.confirmar && !(await crearEjercicio(prisma, entrada, conArchivo))) {
      resumen.yaExistian++
      informar(`= ${entrada.nombre}: lo acaban de crear desde la app. No se toca.`)
      continue
    }
    resumen.creados++
    if (conArchivo) {
      resumen.figurasAsociadas++
      informar(`+ ${entrada.nombre}: se crea con ${entrada.medioId}.`)
    } else {
      resumen.figurasSinArchivo++
      informar(`+ ${entrada.nombre}: se crea sin figura; falta importar ${entrada.medioId}.`)
    }
  }

  return resumen
}

/**
 * Crea el ejercicio, publicado, con su figura en la misma escritura. Falso si
 * el nombre ya existe: lo han creado desde la app entre la lectura y ahora.
 */
async function crearEjercicio(
  prisma: PrismaClient,
  entrada: EntradaCatalogoInicial,
  conFigura: boolean,
): Promise<boolean> {
  try {
    await prisma.ejercicio.create({
      data: {
        nombre: entrada.nombre,
        nombreNormalizado: normalizarNombre(entrada.nombre),
        grupoPrincipal: entrada.grupoPrincipal,
        instrucciones: entrada.instrucciones,
        pasos: entrada.pasos,
        evita: entrada.evita,
        consejos: entrada.consejos,
        estado: "publicado",
        gruposSecundarios: { create: entrada.gruposSecundarios.map((grupo) => ({ grupo })) },
        ...(conFigura && { contenidos: { create: figuraDelIndice(entrada.medioId) } }),
      },
    })
    return true
  } catch (error) {
    if (esRepetido(error)) return false
    throw error
  }
}

/** Nunca sustituye: si el entrenador acaba de poner una figura, gana la suya. */
async function asociarFigura(
  prisma: PrismaClient,
  ejercicioId: string,
  entrada: EntradaCatalogoInicial,
): Promise<boolean> {
  try {
    await prisma.contenidoDeEjercicio.create({
      data: { ejercicioId, ...figuraDelIndice(entrada.medioId) },
    })
    return true
  } catch (error) {
    if (esRepetido(error)) return false
    throw error
  }
}

async function principal(): Promise<void> {
  cargarEntornoLocal()
  const confirmar = process.argv.includes("--confirmar")
  console.log(`Base de datos destino: ${leerVariable("POSTGRES_DB")}`)
  console.log(
    confirmar
      ? "Modo escritura: se crean los ejercicios que falten y se asocian sus figuras."
      : "Simulación: no se escribe nada. Añade --confirmar para aplicarlo.",
  )
  if (carpetaDeMedios() === null) {
    console.warn(
      "Falta MEDIOS_DIR: los ejercicios se crearían sin figura. Importa antes las figuras " +
        "(importar-medios.js) y vuelve a ejecutar esto para asociarlas.",
    )
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg(urlDeConexion()) })
  try {
    const resumen = await prepararCatalogo(prisma, {
      confirmar,
      informar: (linea) => console.log(linea),
    })
    console.log(
      `${confirmar ? "Hecho" : "Se haría"}: ${String(resumen.creados)} creados, ` +
        `${String(resumen.figurasAsociadas)} figuras asociadas, ` +
        `${String(resumen.yaExistian)} ya existían, ` +
        `${String(resumen.figurasSinArchivo)} figuras sin importar.`,
    )
  } finally {
    await prisma.$disconnect()
  }
}

/** Solo se ejecuta como script: la prueba importa `prepararCatalogo` sin lanzarlo. */
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
    console.error(error)
    process.exitCode = 1
  })
}
