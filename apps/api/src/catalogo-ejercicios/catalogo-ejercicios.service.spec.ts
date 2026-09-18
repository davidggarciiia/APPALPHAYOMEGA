import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common"
import { BuscarEjerciciosSchema, type CrearEjercicio } from "@alpha-omega/shared"
import { Prisma } from "@prisma/client"

import type { PrismaService } from "../prisma/prisma.service.js"

import { CatalogoEjerciciosService, normalizarNombre } from "./catalogo-ejercicios.service.js"

const FICHA: CrearEjercicio = {
  nombre: "Press de banca",
  grupoPrincipal: "pecho",
  gruposSecundarios: ["triceps"],
  instrucciones: "Baja controlando y sube sin bloquear.",
}

/**
 * Un Prisma que falla como se le diga.
 *
 * Las reglas del catalogo contra una base de verdad estan en
 * test/catalogo-ejercicios.e2e-spec.ts. Aqui solo interesa lo que esa suite no
 * puede provocar: que la base conteste con un error que no es ni un nombre
 * repetido ni una fila que falta.
 */
function prismaQueFalla(error: unknown): PrismaService {
  const fallar = (): Promise<never> => Promise.reject(error)

  return { ejercicio: { create: fallar, update: fallar } } as unknown as PrismaService
}

/** Cualquier consulta es un fallo del test: la regla tiene que cortar antes. */
const PRISMA_INTOCABLE = new Proxy(
  {},
  {
    get: (_objeto, propiedad) => {
      throw new Error(`No se esperaba tocar prisma.${String(propiedad)}`)
    },
  },
) as PrismaService

describe("normalizarNombre", () => {
  it.each([
    ["Press de banca", "press de banca"],
    ["  PRESS   de\tBanca ", "press de banca"],
    ["Sentadilla BÚLGARA", "sentadilla búlgara"],
  ])("%j se compara como %j", (nombre, esperado) => {
    expect(normalizarNombre(nombre)).toBe(esperado)
  })

  it("no pliega acentos: son nombres distintos", () => {
    expect(normalizarNombre("Sentadilla búlgara")).not.toBe(normalizarNombre("Sentadilla bulgara"))
  })
})

describe("CatalogoEjerciciosService", () => {
  it("deniega al cliente los estados no publicados sin llegar a consultar", async () => {
    const servicio = new CatalogoEjerciciosService(PRISMA_INTOCABLE)

    for (const estado of ["retirado", "todos"] as const) {
      await expect(
        servicio.buscar("cliente", BuscarEjerciciosSchema.parse({ estado })),
      ).rejects.toBeInstanceOf(ForbiddenException)
    }
  })

  it("traduce el nombre repetido a 409 y la fila que falta a 404", async () => {
    const repetido = new CatalogoEjerciciosService(prismaQueFalla({ code: "P2002" }))
    const ausente = new CatalogoEjerciciosService(prismaQueFalla({ code: "P2025" }))

    await expect(repetido.crear(FICHA)).rejects.toBeInstanceOf(ConflictException)
    await expect(repetido.editar("un-id", FICHA)).rejects.toBeInstanceOf(ConflictException)
    await expect(ausente.editar("un-id", FICHA)).rejects.toBeInstanceOf(NotFoundException)
  })

  it("no disfraza de 409 ni de 404 un fallo de la base que no conoce", async () => {
    const caida = new Error("connection terminated")
    const servicio = new CatalogoEjerciciosService(prismaQueFalla(caida))

    await expect(servicio.crear(FICHA)).rejects.toBe(caida)
    await expect(servicio.editar("un-id", FICHA)).rejects.toBe(caida)
  })
})

describe("Modelo del catalogo", () => {
  /**
   * Criterio 18 de la spec. Es lo que mantiene el modulo fuera del alcance del
   * consentimiento aplazado: quien anada una columna con el id de un cliente se
   * entera por este test y no por una conversacion sobre el RGPD.
   */
  it("ninguna tabla del modulo referencia a un usuario", () => {
    const tablas = Prisma.dmmf.datamodel.models.filter((modelo) =>
      ["Ejercicio", "GrupoSecundarioDeEjercicio"].includes(modelo.name),
    )
    expect(tablas.map((tabla) => tabla.name).sort()).toEqual([
      "Ejercicio",
      "GrupoSecundarioDeEjercicio",
    ])

    const sospechosos = tablas.flatMap((tabla) =>
      tabla.fields
        .filter((campo) => campo.type === "Usuario" || /usuario|cliente/i.test(campo.name))
        .map((campo) => `${tabla.name}.${campo.name}`),
    )
    expect(sospechosos).toEqual([])
  })
})
