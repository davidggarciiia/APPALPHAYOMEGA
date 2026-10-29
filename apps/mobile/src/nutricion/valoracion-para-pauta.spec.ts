import { describe, expect, it, jest } from "@jest/globals"
import {
  proyeccionCorporal,
  type PublicacionValoracion,
  type ResumenValoracion,
  type ValoracionProfesional,
} from "@alpha-omega/shared"
import type { z } from "zod"

import type { PeticionAutenticada } from "../lib/peticion-autenticada"
import { crearConsultaValoracionParaPauta } from "./valoracion-para-pauta"

const CLIENTE = "10000000-0000-4000-8000-000000000001"
const uuid = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`

function publicacion(
  n: number,
  fechaToma: string,
  publicadaEn = `${fechaToma}T10:00:00.000Z`,
): PublicacionValoracion {
  return {
    id: uuid(n + 100),
    valoracionId: uuid(n),
    numero: 1,
    sustituyeId: null,
    tipo: "revision",
    fechaToma,
    publicadaEn,
    autor: { id: uuid(900), nombre: "Profesional de prueba" },
    documento: {
      definiciones: { corporales: [], pruebas: [] },
      bloques: ["medidas"],
      corporales: [],
      pruebas: [],
      grasaPorPliegues: null,
      destacados: [],
      conclusion: null,
    },
  }
}

function resumen(
  p: PublicacionValoracion,
  estado: ResumenValoracion["estado"] = "publicada",
  fechaToma = p.fechaToma,
): ResumenValoracion {
  return {
    id: p.valoracionId,
    tipo: p.tipo,
    estado,
    fechaToma,
    publicadaEn: p.publicadaEn,
    numeroPublicacion: p.numero,
  }
}

function profesional(p: PublicacionValoracion, fechaBorrador?: string): ValoracionProfesional {
  const documento = { ...p.documento, notasInternas: "No se usa en dieta" }
  return {
    id: p.valoracionId,
    clienteId: CLIENTE,
    tipo: p.tipo,
    anteriorId: null,
    estado: fechaBorrador ? "corrigiendo" : "publicada",
    creadaEn: p.publicadaEn,
    publicacion: p,
    documentoVigente: documento,
    borrador: fechaBorrador
      ? {
          id: uuid(500),
          revision: 1,
          fechaToma: fechaBorrador,
          corrigePublicacionId: p.id,
          documento,
          creadoEn: p.publicadaEn,
          actualizadoEn: p.publicadaEn,
        }
      : null,
  }
}

function transporte(paginas: unknown[], detalles: Record<string, unknown>) {
  let n = 0
  return jest.fn(async (ruta: string, esquema: z.ZodType<unknown>) => {
    const respuesta = ruta.includes("?") ? paginas[n++] : detalles[ruta.split("/").at(-1)!]
    if (respuesta instanceof Error) throw respuesta
    return esquema.parse(respuesta)
  })
}

describe("valoración publicada para la pauta", () => {
  it("recorre el historial y elige por fecha de toma, sin confundir creación o publicación", async () => {
    const antigua = publicacion(1, "2026-09-01", "2026-10-25T10:00:00.000Z")
    const reciente = publicacion(2, "2026-10-20")
    const sinEstado = ({ estado: _estado, ...fila }: ResumenValoracion) => fila
    const pedir = transporte(
      [
        { total: 2, valoraciones: [sinEstado(resumen(antigua))] },
        { total: 2, valoraciones: [sinEstado(resumen(reciente))] },
      ],
      { [reciente.valoracionId]: proyeccionCorporal(reciente) },
    )
    expect(await crearConsultaValoracionParaPauta(pedir as PeticionAutenticada)(CLIENTE)).toEqual(
      proyeccionCorporal(reciente),
    )
    expect(pedir.mock.calls.map(([ruta]) => ruta)).toEqual([
      `/seguimiento/clientes/${CLIENTE}/valoraciones?limite=50&desplazamiento=0`,
      `/seguimiento/clientes/${CLIENTE}/valoraciones?limite=50&desplazamiento=1`,
      `/seguimiento/clientes/${CLIENTE}/valoraciones/${reciente.valoracionId}`,
    ])
  })

  it("omite borradores y compara la publicación real de las correcciones", async () => {
    const antigua = publicacion(1, "2026-09-01")
    const reciente = publicacion(2, "2026-10-20")
    const muyAntigua = publicacion(3, "2026-08-01")
    const pedir = transporte(
      [
        {
          total: 4,
          valoraciones: [
            {
              ...resumen(antigua),
              id: uuid(4),
              estado: "borrador",
              publicadaEn: null,
              numeroPublicacion: null,
              fechaToma: "2026-12-01",
            },
            resumen(antigua, "corrigiendo", "2026-12-01"),
            resumen(reciente),
            resumen(muyAntigua),
          ],
        },
      ],
      {
        [antigua.valoracionId]: profesional(antigua, "2026-12-01"),
        [reciente.valoracionId]: profesional(reciente),
      },
    )
    expect(await crearConsultaValoracionParaPauta(pedir as PeticionAutenticada)(CLIENTE)).toEqual(
      proyeccionCorporal(reciente),
    )
    expect(pedir).toHaveBeenCalledTimes(3)
  })

  it("una corrección puede ocultar una publicación más reciente que su fecha de borrador", async () => {
    const antigua = publicacion(1, "2026-09-01")
    const reciente = publicacion(2, "2026-10-20")
    const pedir = transporte(
      [
        {
          total: 2,
          valoraciones: [resumen(antigua), resumen(reciente, "corrigiendo", "2026-01-01")],
        },
      ],
      {
        [antigua.valoracionId]: profesional(antigua),
        [reciente.valoracionId]: profesional(reciente, "2026-01-01"),
      },
    )
    expect(await crearConsultaValoracionParaPauta(pedir as PeticionAutenticada)(CLIENTE)).toEqual(
      proyeccionCorporal(reciente),
    )
  })

  it("devuelve ausencia confirmada si no hay publicaciones, sin leer borradores", async () => {
    const pedir = transporte(
      [
        {
          total: 1,
          valoraciones: [
            {
              id: uuid(1),
              tipo: "inicial",
              estado: "borrador",
              fechaToma: "2026-10-20",
              publicadaEn: null,
              numeroPublicacion: null,
            },
          ],
        },
      ],
      {},
    )
    expect(await crearConsultaValoracionParaPauta(pedir as PeticionAutenticada)(CLIENTE)).toBeNull()
    expect(pedir).toHaveBeenCalledTimes(1)
  })

  it.each(["pagina", "detalle"])(
    "propaga un fallo en %s sin convertirlo en ausencia",
    async (fallo) => {
      const p = publicacion(1, "2026-10-20")
      const error = new Error("sin conexión")
      const pedir = transporte(
        fallo === "pagina" ? [error] : [{ total: 1, valoraciones: [resumen(p)] }],
        { [p.valoracionId]: error },
      )
      await expect(
        crearConsultaValoracionParaPauta(pedir as PeticionAutenticada)(CLIENTE),
      ).rejects.toThrow("sin conexión")
    },
  )

  it("rechaza una página vacía que anuncia más resultados", async () => {
    const pedir = transporte([{ total: 2, valoraciones: [] }], {})
    await expect(
      crearConsultaValoracionParaPauta(pedir as PeticionAutenticada)(CLIENTE),
    ).rejects.toThrow(/historial/i)
  })
})
