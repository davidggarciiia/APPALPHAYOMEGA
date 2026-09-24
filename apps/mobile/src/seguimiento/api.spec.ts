import { describe, expect, it, jest } from "@jest/globals"
import {
  CONFIGURACION_SEGUIMIENTO_INICIAL,
  PaginaMedidasSchema,
  PaginaPruebasSchema,
  type Medida,
  type PaginaMedidas,
  type PaginaPruebas,
  type PruebaFisica,
} from "@alpha-omega/shared"
import type { z } from "zod"

import { sumarDias } from "../entrenamiento/fechas"
import { ErrorDeRed } from "../lib/http"
import type { PeticionAutenticada } from "../lib/peticion-autenticada"
import { crearApiSeguimiento } from "./api"
import { HistoricoIncompleto } from "./paginas"

const CLIENTE = "10000000-0000-4000-8000-000000000000"
const RUTA = `/seguimiento/clientes/${CLIENTE}`
const PRUEBA = "50000000-0000-4000-8000-000000000001"

describe("API de seguimiento", () => {
  it("lee y guarda la configuración con la revisión en el cuerpo", async () => {
    const pedir = jest.fn(
      async (_ruta: string, _esquema: unknown, _opciones?: RequestInit) =>
        CONFIGURACION_SEGUIMIENTO_INICIAL,
    )
    const api = crearApiSeguimiento(pedir as unknown as PeticionAutenticada)
    expect(await api.configuracion(CLIENTE)).toEqual(CONFIGURACION_SEGUIMIENTO_INICIAL)
    expect(pedir).toHaveBeenCalledWith(
      `/seguimiento/clientes/${CLIENTE}/configuracion`,
      expect.anything(),
    )
    await api.guardarConfiguracion(CLIENTE, CONFIGURACION_SEGUIMIENTO_INICIAL)
    expect(pedir).toHaveBeenCalledWith(
      `/seguimiento/clientes/${CLIENTE}/configuracion`,
      expect.anything(),
      { method: "PUT", body: expect.any(String) },
    )
    expect(
      JSON.parse(
        (pedir.mock.calls[1] as unknown as [string, unknown, RequestInit])[2].body as string,
      ),
    ).toEqual(CONFIGURACION_SEGUIMIENTO_INICIAL)
  })
})

const uuid = (prefijo: string, n: number): string =>
  `${prefijo}-0000-4000-8000-${n.toString(16).padStart(12, "0")}`

/**
 * Tomas sintéticas en orden cronológico (n = 0 es la más antigua), por parejas
 * del mismo día. En los días pares empata también la creación y decide el ID;
 * en los impares el ID contradice a la creación, que es la que manda.
 */
function cronologia(total: number): Array<{ id: string; fecha: string; creadoEn: string }> {
  return Array.from({ length: total }, (_, n) => {
    const dia = Math.floor(n / 2)
    const fecha = sumarDias("2025-01-01", dia)
    const segunda = n % 2 === 1
    const invertida = dia % 2 === 1 && (segunda || n + 1 < total)
    return {
      id: uuid("40000000", invertida ? (segunda ? n - 1 : n + 1) : n),
      fecha,
      creadoEn: `${fecha}T${invertida && segunda ? "09" : "08"}:00:00.000Z`,
    }
  })
}

function medidas(total: number): Medida[] {
  return cronologia(total).map((toma, n) => ({
    ...toma,
    pesoKg: null,
    cinturaCm: 80 + (n % 20),
    grasaPct: null,
    alturaCm: null,
  }))
}

const NOMBRES = ["Sentadilla", "Flexiones", "Plancha"] as const

/** Tres pruebas distintas que se alternan; la «Flexiones» pautada, con su ID. */
function pruebas(total: number): PruebaFisica[] {
  return cronologia(total).map((toma, n) => {
    const nombre = NOMBRES[n % NOMBRES.length]!
    return {
      ...toma,
      id: toma.id.replace(/^40000000/, "50000000"),
      pruebaId: nombre === "Flexiones" ? PRUEBA : null,
      nombre,
      valor: n,
      unidad: nombre === "Plancha" ? "s" : "reps",
    }
  })
}

/** Responde cada petición con la siguiente respuesta, validada con el esquema pedido. */
function pedirEnOrden(respuestas: unknown[]) {
  return jest.fn(async (_ruta: string, esquema: z.ZodType<unknown>) => {
    const respuesta = respuestas.shift()
    if (respuesta instanceof Error) throw respuesta
    return esquema.parse(respuesta)
  })
}

const api = (pedir: ReturnType<typeof pedirEnOrden>) =>
  crearApiSeguimiento(pedir as unknown as PeticionAutenticada)

const paginaMedidas = (
  filas: Medida[],
  siguienteCursor: string | null,
  fechaNacimiento: string | null = "2000-06-01",
): PaginaMedidas => ({ medidas: filas, fechaNacimiento, siguienteCursor })
const paginaPruebas = (filas: PruebaFisica[], siguienteCursor: string | null): PaginaPruebas => ({
  pruebas: filas,
  siguienteCursor,
})
// Como la API: de la más reciente a la más antigua.
const recientes = <F>(filas: F[]): F[] => [...filas].reverse()
const CURSOR = "eyJ2IjoxLCJoIjoibWVkaWRhcyJ9"

describe("histórico completo de medidas y pruebas", () => {
  it("reúne 500 + 1 medidas en orden cronológico, con la más reciente al final", async () => {
    const todas = medidas(501)
    const pedir = pedirEnOrden([
      paginaMedidas(recientes(todas).slice(0, 500), CURSOR),
      paginaMedidas(recientes(todas).slice(500), null),
    ])

    const resultado = await api(pedir).medidas(CLIENTE)

    expect(pedir).toHaveBeenCalledTimes(2)
    expect(pedir).toHaveBeenNthCalledWith(
      1,
      `${RUTA}/medidas/pagina?limite=500`,
      PaginaMedidasSchema,
    )
    expect(pedir).toHaveBeenNthCalledWith(
      2,
      `${RUTA}/medidas/pagina?limite=500&cursor=${CURSOR}`,
      PaginaMedidasSchema,
    )
    // El formato anterior, sin campos de paginación.
    expect(Object.keys(resultado).sort()).toEqual(["fechaNacimiento", "medidas"])
    expect(resultado.fechaNacimiento).toBe("2000-06-01")
    expect(resultado.medidas.map((m) => m.id)).toEqual(todas.map((m) => m.id))
    expect(new Set(resultado.medidas.map((m) => m.id)).size).toBe(501)
    // La primera toma solo estaba en la segunda página; la última, en la primera.
    expect(resultado.medidas[0]).toEqual(todas[0])
    expect(resultado.medidas.at(-1)).toEqual(todas[500])
  })

  it("reúne 500 + 1 pruebas de nombres distintos, por nombre y en orden cronológico", async () => {
    const todas = pruebas(501)
    const pedir = pedirEnOrden([
      paginaPruebas(recientes(todas).slice(0, 500), CURSOR),
      paginaPruebas(recientes(todas).slice(500), null),
    ])

    const resultado = await api(pedir).pruebas(CLIENTE)

    expect(pedir).toHaveBeenNthCalledWith(
      1,
      `${RUTA}/pruebas/pagina?limite=500`,
      PaginaPruebasSchema,
    )
    expect(pedir).toHaveBeenNthCalledWith(
      2,
      `${RUTA}/pruebas/pagina?limite=500&cursor=${CURSOR}`,
      PaginaPruebasSchema,
    )
    expect(Object.keys(resultado)).toEqual(["pruebas"])
    const esperadas = ["Flexiones", "Plancha", "Sentadilla"].flatMap((nombre) =>
      todas.filter((p) => p.nombre === nombre).map((p) => p.id),
    )
    expect(resultado.pruebas.map((p) => p.id)).toEqual(esperadas)
    for (const nombre of NOMBRES) {
      const suyas = resultado.pruebas.filter((p) => p.nombre === nombre)
      // Cada prueba termina en su resultado más reciente.
      expect(suyas.at(-1)).toEqual(todas.filter((p) => p.nombre === nombre).at(-1))
    }
    // La más antigua, «Sentadilla», solo llegaba en la segunda página.
    expect(resultado.pruebas).toContainEqual(todas[0])
  })

  it("ordena explícitamente, sin duplicados, aunque las páginas lleguen desordenadas", async () => {
    const [a, b, c, d] = medidas(4) as [Medida, Medida, Medida, Medida]
    const cursor = "a/b+c="
    const pedir = pedirEnOrden([paginaMedidas([b, d, a], cursor), paginaMedidas([c, a], null)])

    const resultado = await api(pedir).medidas(CLIENTE)

    expect(resultado.medidas).toEqual([a, b, c, d])
    // El cursor viaja codificado: no puede añadir parámetros a la consulta.
    expect(pedir).toHaveBeenNthCalledWith(
      2,
      `${RUTA}/medidas/pagina?limite=500&cursor=a%2Fb%2Bc%3D`,
      PaginaMedidasSchema,
    )
  })

  it("un histórico vacío es una sola página vacía", async () => {
    const pedir = pedirEnOrden([paginaMedidas([], null, null), paginaPruebas([], null)])
    const seguimiento = api(pedir)

    expect(await seguimiento.medidas(CLIENTE)).toEqual({ medidas: [], fechaNacimiento: null })
    expect(await seguimiento.pruebas(CLIENTE)).toEqual({ pruebas: [] })
    expect(pedir).toHaveBeenCalledTimes(2)
  })

  it("si falla la segunda página no entrega un histórico parcial", async () => {
    const todas = medidas(501)
    const fallo = new ErrorDeRed("Sin conexión")
    const pedir = pedirEnOrden([paginaMedidas(recientes(todas).slice(0, 500), CURSOR), fallo])

    await expect(api(pedir).medidas(CLIENTE)).rejects.toBe(fallo)
    expect(pedir).toHaveBeenCalledTimes(2)

    const pruebasPedidas = pedirEnOrden([paginaPruebas(pruebas(2), CURSOR), fallo])
    await expect(api(pruebasPedidas).pruebas(CLIENTE)).rejects.toBe(fallo)
  })

  it("un cursor repetido detiene el recorrido con error", async () => {
    const [a, b, c] = medidas(3) as [Medida, Medida, Medida]
    const pedir = pedirEnOrden([
      paginaMedidas([c], CURSOR),
      paginaMedidas([b], CURSOR),
      paginaMedidas([a], null),
    ])

    await expect(api(pedir).medidas(CLIENTE)).rejects.toBeInstanceOf(HistoricoIncompleto)
    expect(pedir).toHaveBeenCalledTimes(2)
  })

  it("una página vacía que anuncia más no se da por completa", async () => {
    const pedir = pedirEnOrden([paginaPruebas([], CURSOR), paginaPruebas(pruebas(1), null)])

    await expect(api(pedir).pruebas(CLIENTE)).rejects.toBeInstanceOf(HistoricoIncompleto)
    expect(pedir).toHaveBeenCalledTimes(1)
  })

  it("con 5.000 medidas hace 10 peticiones y conserva todas", async () => {
    const todas = medidas(5000)
    const paginas = Array.from({ length: 10 }, (_, n) =>
      paginaMedidas(
        recientes(todas).slice(n * 500, (n + 1) * 500),
        n < 9 ? `pagina-${n + 1}` : null,
      ),
    )
    const pedir = pedirEnOrden(paginas)

    const inicio = performance.now()
    const resultado = await api(pedir).medidas(CLIENTE)
    const duracion = performance.now() - inicio

    expect(pedir).toHaveBeenCalledTimes(10)
    expect(resultado.medidas.map((m) => m.id)).toEqual(todas.map((m) => m.id))
    // Margen amplio: detecta un recorrido cuadrático, no mide el dispositivo.
    expect(duracion).toBeLessThan(2000)
  })
})
