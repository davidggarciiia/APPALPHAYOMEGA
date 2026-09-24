import { randomUUID } from "node:crypto"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
  CrearEjercicioSchema,
  EjercicioSchema,
  GRUPOS_MUSCULARES,
  type CrearEjercicio,
  type Ejercicio,
} from "@alpha-omega/shared"
import request from "supertest"

import { normalizarNombre } from "../src/catalogo-ejercicios/catalogo-ejercicios.service.js"
import {
  CATALOGO_INICIAL,
  type EntradaCatalogoInicial,
} from "../src/catalogo-ejercicios/catalogo-inicial.js"
import { MEDIOS, medioDelIndice } from "../src/catalogo-ejercicios/medios.js"
import {
  prepararCatalogo,
  type ResumenPreparacion,
} from "../src/catalogo-ejercicios/preparar-catalogo.js"

import { entornoEntrenamiento } from "./entrenamiento-ayuda.js"

type Entorno = Awaited<ReturnType<typeof entornoEntrenamiento>>

/** Nombres de cada entrada y sus equivalentes: todos identifican ya el ejercicio. */
const nombresDe = (entrada: EntradaCatalogoInicial): string[] =>
  [entrada.nombre, ...(entrada.equivalentes ?? [])].map(normalizarNombre)
const NOMBRES = CATALOGO_INICIAL.flatMap(nombresDe)
/** La entrada con un nombre equivalente que usa la prueba. */
const CON_EQUIVALENTE = CATALOGO_INICIAL.find((entrada) => entrada.equivalentes?.length)
const FIGURAS = CATALOGO_INICIAL.map((entrada) => entrada.medioId)

/** La parte de la entrada que viaja por el contrato del catálogo. */
function ficha(entrada: EntradaCatalogoInicial): CrearEjercicio {
  return {
    nombre: entrada.nombre,
    grupoPrincipal: entrada.grupoPrincipal,
    gruposSecundarios: [...entrada.gruposSecundarios],
    instrucciones: entrada.instrucciones,
    pasos: [...entrada.pasos],
    evita: entrada.evita,
    consejos: entrada.consejos.map((consejo) => ({ ...consejo })),
  }
}

describe("Catálogo inicial", () => {
  describe("los datos", () => {
    it("trae un ejercicio por cada figura del índice, sin repetir figura ni nombre", () => {
      expect(CATALOGO_INICIAL).toHaveLength(52)
      expect([...FIGURAS].sort()).toEqual(MEDIOS.map((medio) => medio.id).sort())
      // Dos nombres que solo cambian en mayúsculas o espacios son el mismo ejercicio,
      // y un equivalente no puede repetir el nombre de otra entrada.
      expect(new Set(NOMBRES).size).toBe(NOMBRES.length)
      // Solo equivalencias claras: hoy las dos que usan los ejercicios de David.
      expect(CATALOGO_INICIAL.flatMap((entrada) => entrada.equivalentes ?? [])).toEqual([
        "Peso muerto rumano",
        "Sentadilla goblet",
      ])
      for (const entrada of CATALOGO_INICIAL) {
        expect(entrada.nombre).toBe(medioDelIndice(entrada.medioId)?.nombre)
      }
    })

    it.each(CATALOGO_INICIAL.map((entrada) => [entrada.nombre, entrada] as const))(
      "«%s» cumple el contrato y los límites de la ficha",
      (_nombre, entrada) => {
        expect(CrearEjercicioSchema.safeParse(ficha(entrada)).error?.issues).toBeUndefined()
        expect(GRUPOS_MUSCULARES).toContain(entrada.grupoPrincipal)
        expect(entrada.gruposSecundarios.length).toBeLessThanOrEqual(3)
        expect(entrada.instrucciones.length).toBeLessThanOrEqual(4000)
        expect(entrada.pasos.length).toBeGreaterThanOrEqual(3)
        expect(entrada.pasos.length).toBeLessThanOrEqual(5)
        expect(entrada.evita.trim()).not.toBe("")
        expect(entrada.evita.length).toBeLessThanOrEqual(500)
        expect(entrada.consejos.length).toBeLessThanOrEqual(2)
        // Sin cifras: las series, las repeticiones y las cargas las pone el entrenador.
        const textos = [
          entrada.instrucciones,
          ...entrada.pasos,
          entrada.evita,
          ...entrada.consejos.flatMap((consejo) => [consejo.titulo, consejo.texto]),
        ]
        for (const texto of textos) expect(texto).not.toMatch(/\d/)
      },
    )
  })

  describe("preparar la base", () => {
    let entorno: Entorno
    let carpeta: string
    const anterior = process.env.MEDIOS_DIR
    /** Lo que existía antes de la prueba: no se borra al terminar. */
    const previos = new Set<string>()
    const contenidosPrevios = new Set<string>()
    /** Lo que crea la prueba, por id: es lo único que se borra al terminar. */
    const creados = new Set<string>()
    let faltaban: number
    let simulacion: ResumenPreparacion
    /** El ejercicio que el entrenador ya tenía, con el nombre de una entrada y otra figura. */
    let propio: Ejercicio
    /** El que tenía con un nombre equivalente al de una entrada y sin figura. */
    let equivalente: Ejercicio
    let elegidas: {
      propio: EntradaCatalogoInicial
      figuraAjena: EntradaCatalogoInicial
      sinArchivo: EntradaCatalogoInicial
      renombrada: EntradaCatalogoInicial
    }

    function importar(medioId: string): void {
      writeFileSync(join(carpeta, "figuras", `${medioId}.mp4`), "video-de-prueba")
      writeFileSync(join(carpeta, "figuras", `${medioId}.jpg`), "poster-de-prueba")
    }

    /** Los ejercicios del catálogo inicial que hay en la base: por nombre o por figura. */
    async function instantanea(): Promise<unknown[]> {
      return entorno.prisma.ejercicio.findMany({
        where: {
          OR: [
            { nombreNormalizado: { in: NOMBRES } },
            { contenidos: { some: { tipo: "figura", claveDeObjeto: { in: FIGURAS } } } },
          ],
        },
        include: {
          gruposSecundarios: { orderBy: { grupo: "asc" } },
          contenidos: { orderBy: { id: "asc" } },
        },
        orderBy: { id: "asc" },
      })
    }

    async function figurasDelCatalogo(): Promise<number> {
      return entorno.prisma.contenidoDeEjercicio.count({
        where: { tipo: "figura", ejercicio: { nombreNormalizado: { in: NOMBRES } } },
      })
    }

    /** Ejecuta de verdad y apunta lo nuevo antes de comprobar nada, para poder limpiarlo. */
    async function preparar(): Promise<ResumenPreparacion> {
      const resumen = await prepararCatalogo(entorno.prisma, { confirmar: true })
      const filas = await entorno.prisma.ejercicio.findMany({
        where: { nombreNormalizado: { in: NOMBRES } },
        select: { id: true },
      })
      for (const fila of filas) if (!previos.has(fila.id)) creados.add(fila.id)
      return resumen
    }

    async function leer(id: string): Promise<Ejercicio> {
      const respuesta = await request(entorno.app.getHttpServer())
        .get(`/ejercicios/${id}`)
        .set(entorno.como("entrenador"))
        .expect(200)
      return EjercicioSchema.parse(respuesta.body)
    }

    async function idPorNombre(entrada: EntradaCatalogoInicial): Promise<string | undefined> {
      const fila = await entorno.prisma.ejercicio.findUnique({
        where: { nombreNormalizado: normalizarNombre(entrada.nombre) },
        select: { id: true },
      })
      return fila?.id
    }

    beforeAll(async () => {
      carpeta = mkdtempSync(join(tmpdir(), "ao-catalogo-inicial-"))
      mkdirSync(join(carpeta, "figuras"))
      process.env.MEDIOS_DIR = carpeta
      entorno = await entornoEntrenamiento("catalogo-inicial")
      const { prisma } = entorno

      // La base de pruebas es compartida: lo que ya estaba se respeta y no se borra.
      const existentes = await prisma.ejercicio.findMany({
        where: {
          OR: [
            { nombreNormalizado: { in: NOMBRES } },
            { contenidos: { some: { tipo: "figura", claveDeObjeto: { in: FIGURAS } } } },
          ],
        },
        select: { id: true, nombreNormalizado: true, contenidos: { select: { id: true } } },
      })
      for (const fila of existentes) {
        previos.add(fila.id)
        for (const contenido of fila.contenidos) contenidosPrevios.add(contenido.id)
      }
      const enUso = new Set(
        (
          await prisma.contenidoDeEjercicio.findMany({
            where: { tipo: "figura", claveDeObjeto: { in: FIGURAS } },
            select: { claveDeObjeto: true },
          })
        ).map((contenido) => contenido.claveDeObjeto),
      )
      const nombresPrevios = new Set(existentes.map((fila) => fila.nombreNormalizado))
      const libres = CATALOGO_INICIAL.filter(
        (entrada) =>
          entrada !== CON_EQUIVALENTE &&
          !nombresDe(entrada).some((nombre) => nombresPrevios.has(nombre)) &&
          !enUso.has(entrada.medioId),
      )
      const [propia, figuraAjena, sinArchivo, renombrada] = libres
      if (
        propia === undefined ||
        figuraAjena === undefined ||
        sinArchivo === undefined ||
        renombrada === undefined
      ) {
        throw new Error("La base de pruebas ya tiene casi todo el catálogo inicial")
      }
      elegidas = { propio: propia, figuraAjena, sinArchivo, renombrada }

      // Todas las figuras importadas menos una, para ver qué pasa con la que falta.
      for (const medio of MEDIOS) if (medio.id !== sinArchivo.medioId) importar(medio.id)

      // El entrenador ya tenía un ejercicio con el nombre de una entrada (escrito a
      // su manera), su propia ficha y otra figura del índice.
      const servidor = entorno.app.getHttpServer()
      const alta = await request(servidor)
        .post("/ejercicios")
        .set(entorno.como("entrenador"))
        .send({
          nombre: `  ${propia.nombre.toUpperCase()}  `,
          grupoPrincipal: "abdomen",
          gruposSecundarios: [],
          instrucciones: "Versión del entrenador.",
          pasos: ["Paso del entrenador."],
          evita: "Lo que dice el entrenador.",
        })
        .expect(201)
      const creado = EjercicioSchema.parse(alta.body)
      creados.add(creado.id)
      const conFigura = await request(servidor)
        .put(`/ejercicios/${creado.id}/figura`)
        .set(entorno.como("entrenador"))
        .send({ medioId: figuraAjena.medioId })
        .expect(200)
      propio = EjercicioSchema.parse(conFigura.body)

      enUso.add(figuraAjena.medioId)
      nombresPrevios.add(normalizarNombre(propia.nombre))

      // Y otro con un nombre equivalente al de una entrada («Sentadilla goblet»), sin figura.
      const nombreEquivalente = CON_EQUIVALENTE?.equivalentes?.[0]
      if (
        CON_EQUIVALENTE === undefined ||
        nombreEquivalente === undefined ||
        nombresDe(CON_EQUIVALENTE).some((nombre) => nombresPrevios.has(nombre)) ||
        enUso.has(CON_EQUIVALENTE.medioId)
      )
        throw new Error("La base de pruebas ya tiene el ejercicio con nombre equivalente")
      const altaEquivalente = await request(servidor)
        .post("/ejercicios")
        .set(entorno.como("entrenador"))
        .send({
          nombre: nombreEquivalente,
          grupoPrincipal: "gluteos",
          gruposSecundarios: [],
          instrucciones: "La del entrenador.",
          pasos: [],
          evita: "",
        })
        .expect(201)
      equivalente = EjercicioSchema.parse(altaEquivalente.body)
      creados.add(equivalente.id)
      nombresPrevios.add(normalizarNombre(nombreEquivalente))

      faltaban = CATALOGO_INICIAL.filter(
        (entrada) =>
          !nombresDe(entrada).some((nombre) => nombresPrevios.has(nombre)) &&
          !enUso.has(entrada.medioId),
      ).length
    })

    afterAll(async () => {
      const { prisma } = entorno
      try {
        // Solo lo que creó la prueba: sus ejercicios y las figuras que añadió.
        await prisma.contenidoDeEjercicio.deleteMany({
          where: {
            OR: [
              { ejercicioId: { in: [...creados] } },
              { ejercicioId: { in: [...previos] }, id: { notIn: [...contenidosPrevios] } },
            ],
          },
        })
        await prisma.ejercicio.deleteMany({ where: { id: { in: [...creados] } } })
      } finally {
        await entorno.cerrar()
        rmSync(carpeta, { recursive: true, force: true })
        if (anterior === undefined) delete process.env.MEDIOS_DIR
        else process.env.MEDIOS_DIR = anterior
      }
    })

    it("sin confirmar solo cuenta lo que haría y no escribe nada", async () => {
      const antes = await instantanea()

      simulacion = await prepararCatalogo(entorno.prisma, { confirmar: false })

      expect(await instantanea()).toEqual(antes)
      expect(simulacion.creados).toBe(faltaban)
      expect(simulacion.creados + simulacion.yaExistian).toBe(CATALOGO_INICIAL.length)
    })

    it("la primera ejecución crea los que faltan, publicados, con su ficha y su figura", async () => {
      const figurasAntes = await figurasDelCatalogo()

      const resumen = await preparar()

      expect(resumen).toEqual(simulacion)
      expect(resumen.creados).toBe(faltaban)
      expect(resumen.figurasSinArchivo).toBeGreaterThanOrEqual(1)
      expect(resumen.figurasAsociadas).toBe((await figurasDelCatalogo()) - figurasAntes)

      const nuevos = await entorno.prisma.ejercicio.findMany({
        where: {
          id: { in: [...creados].filter((id) => id !== propio.id && id !== equivalente.id) },
        },
        include: { gruposSecundarios: true, contenidos: true },
      })
      expect(nuevos).toHaveLength(faltaban)
      for (const fila of nuevos) {
        const entrada = CATALOGO_INICIAL.find(
          (candidata) => normalizarNombre(candidata.nombre) === fila.nombreNormalizado,
        )
        if (entrada === undefined) throw new Error(`«${fila.nombre}» no es del catálogo inicial`)
        const medio = medioDelIndice(entrada.medioId)
        expect(fila).toMatchObject({
          nombre: entrada.nombre,
          estado: "publicado",
          grupoPrincipal: entrada.grupoPrincipal,
          instrucciones: entrada.instrucciones,
          pasos: entrada.pasos,
          evita: entrada.evita,
          consejos: entrada.consejos,
        })
        expect(fila.gruposSecundarios.map((secundario) => secundario.grupo).sort()).toEqual(
          [...entrada.gruposSecundarios].sort(),
        )
        const figuras = fila.contenidos.map((contenido) => ({
          tipo: contenido.tipo,
          claveDeObjeto: contenido.claveDeObjeto,
          origen: contenido.origen,
          licencia: contenido.licencia,
        }))
        expect(figuras).toEqual(
          entrada === elegidas.sinArchivo
            ? []
            : [
                {
                  tipo: "figura",
                  claveDeObjeto: entrada.medioId,
                  origen: "licenciado",
                  licencia: medio?.licencia,
                },
              ],
        )
      }

      // Cada entrada queda cubierta: por su nombre o porque su figura ya la usa otro.
      const cubiertas = await entorno.prisma.ejercicio.findMany({
        where: {
          OR: [
            { nombreNormalizado: { in: NOMBRES } },
            { contenidos: { some: { tipo: "figura", claveDeObjeto: { in: FIGURAS } } } },
          ],
        },
        select: { nombreNormalizado: true, contenidos: { select: { claveDeObjeto: true } } },
      })
      const nombres = new Set(cubiertas.map((fila) => fila.nombreNormalizado))
      const figuras = new Set(
        cubiertas.flatMap((fila) => fila.contenidos.map((contenido) => contenido.claveDeObjeto)),
      )
      for (const entrada of CATALOGO_INICIAL) {
        expect(nombres.has(normalizarNombre(entrada.nombre)) || figuras.has(entrada.medioId)).toBe(
          true,
        )
      }
      // Su figura ya estaba en otro ejercicio: no se duplica el ejercicio.
      expect(await idPorNombre(elegidas.figuraAjena)).toBeUndefined()
    })

    it("reconoce un ejercicio del entrenador por un nombre equivalente: le pone la figura sin duplicarlo", async () => {
      const conFigura = await leer(equivalente.id)
      expect(conFigura).toEqual({
        ...equivalente,
        figura: expect.objectContaining({ medioId: CON_EQUIVALENTE!.medioId }),
      })
      expect(conFigura.nombre).toBe(equivalente.nombre)
      expect(conFigura.instrucciones).toBe("La del entrenador.")
      expect(await idPorNombre(CON_EQUIVALENTE!)).toBeUndefined()
    })

    it("respeta el ejercicio que el entrenador ya tenía: su ficha y su figura propia", async () => {
      expect(await leer(propio.id)).toEqual(propio)
      expect(propio.figura?.medioId).toBe(elegidas.figuraAjena.medioId)
    })

    it("el entrenador ve la figura asociada en la ficha y recibe su póster", async () => {
      const entrada = elegidas.renombrada
      const medio = medioDelIndice(entrada.medioId)
      const id = await idPorNombre(entrada)
      if (id === undefined || medio === undefined) throw new Error("Falta el ejercicio creado")

      const ejercicio = await leer(id)

      expect(ejercicio).toMatchObject({ ...ficha(entrada), estado: "publicado", video: null })
      expect(ejercicio.figura).toEqual({
        medioId: medio.id,
        version: medio.version,
        origen: "licenciado",
        licencia: medio.licencia,
        sinConexion: medio.sinConexion,
      })
      const poster = await request(entorno.app.getHttpServer())
        .get(`/ejercicios/${id}/figura/poster`)
        .set(entorno.como("entrenador"))
        .expect(200)
      expect(poster.headers["content-type"]).toMatch(/^image\/jpeg/)

      // La figura cuyo archivo no está importado no se asocia: la ficha no promete
      // un vídeo que el servidor no puede servir.
      const sinArchivo = await idPorNombre(elegidas.sinArchivo)
      if (sinArchivo === undefined) throw new Error("Falta el ejercicio sin archivo")
      expect((await leer(sinArchivo)).figura).toBeNull()
    })

    it("la segunda ejecución no crea ni cambia nada", async () => {
      const antes = await instantanea()

      const resumen = await preparar()

      expect(resumen).toEqual({
        creados: 0,
        figurasAsociadas: 0,
        yaExistian: CATALOGO_INICIAL.length,
        figurasSinArchivo: 1,
      })
      expect(await instantanea()).toEqual(antes)
    })

    it("un ejercicio del catálogo que el entrenador renombra no se vuelve a crear", async () => {
      const entrada = elegidas.renombrada
      const id = await idPorNombre(entrada)
      if (id === undefined) throw new Error("Falta el ejercicio creado")
      await request(entorno.app.getHttpServer())
        .patch(`/ejercicios/${id}`)
        .set(entorno.como("entrenador"))
        .send({ ...ficha(entrada), nombre: `Renombrado por el entrenador ${randomUUID()}` })
        .expect(200)

      const resumen = await preparar()

      expect(resumen.creados).toBe(0)
      expect(await idPorNombre(entrada)).toBeUndefined()
    })

    it("si la figura que faltaba se importa después, la siguiente ejecución la asocia", async () => {
      importar(elegidas.sinArchivo.medioId)

      const resumen = await preparar()

      expect(resumen).toEqual({
        creados: 0,
        figurasAsociadas: 1,
        yaExistian: CATALOGO_INICIAL.length,
        figurasSinArchivo: 0,
      })
      const id = await idPorNombre(elegidas.sinArchivo)
      if (id === undefined) throw new Error("Falta el ejercicio sin archivo")
      expect((await leer(id)).figura?.medioId).toBe(elegidas.sinArchivo.medioId)
    })
  })
})
