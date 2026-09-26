import { PrescripcionSchema, crearRegistroDeSesionSchema } from "@alpha-omega/shared"

import {
  aRegistro,
  entradasDesdeRegistro,
  leerEntero,
  leerPeso,
  motivoParaNoMarcar,
  recuento,
  serieRegistrada,
} from "./valores"

const id = (n: number): string => `1111111${String(n)}-1111-4111-8111-111111111111`
const conCarga = { id: id(1), tipoMedicion: "repeticiones", pesoKg: 40, repeticiones: 10 } as const
const sinCarga = { id: id(2), tipoMedicion: "tiempo", pesoKg: null, segundos: 45 } as const
const prescripcion = PrescripcionSchema.parse({
  nombre: "Torso",
  ejercicios: [
    { id: id(3), ejercicioId: id(3), nombre: "Press", indicaciones: null, series: [conCarga] },
    { id: id(4), ejercicioId: id(4), nombre: "Plancha", indicaciones: null, series: [sinCarga] },
  ],
})

describe("Lectura de los campos de una serie", () => {
  it("el peso admite coma, punto, cero y vacío, que no es cero", () => {
    expect(leerPeso("42,5")).toEqual({ ok: true, valor: 42.5 })
    expect(leerPeso(" 42.5 ")).toEqual({ ok: true, valor: 42.5 })
    expect(leerPeso("0")).toEqual({ ok: true, valor: 0 })
    expect(leerPeso("")).toEqual({ ok: true, valor: null })
    for (const invalido of ["-1", "abc", "42,555", "1001", "4,2,1"]) {
      expect(leerPeso(invalido).ok).toBe(false)
    }
  })

  it("repeticiones y segundos son enteros positivos", () => {
    expect(leerEntero("12", "repeticiones")).toEqual({ ok: true, valor: 12 })
    expect(leerEntero("", "tiempo")).toEqual({ ok: true, valor: null })
    for (const invalido of ["0", "2,5", "-3", "x"]) {
      expect(leerEntero(invalido, "repeticiones").ok).toBe(false)
    }
  })
})

describe("Marcar una serie como hecha", () => {
  it("sin escribir nada no se puede marcar: el objetivo no es un valor", () => {
    expect(motivoParaNoMarcar(conCarga, { peso: "", valor: "", hecha: false })).not.toBeNull()
  })

  it("exige el peso solo si la serie prescribe carga", () => {
    expect(motivoParaNoMarcar(conCarga, { peso: "", valor: "8", hecha: false })).toMatch(/peso/)
    expect(motivoParaNoMarcar(conCarga, { peso: "0", valor: "8", hecha: false })).toBeNull()
    expect(motivoParaNoMarcar(sinCarga, { peso: "", valor: "30", hecha: false })).toBeNull()
  })

  it("una serie marcada que deja de ser válida no cuenta como hecha", () => {
    expect(serieRegistrada(conCarga, { peso: "40", valor: "", hecha: true })).toEqual({
      serieId: conCarga.id,
      tipoMedicion: "repeticiones",
      pesoKg: 40,
      repeticiones: null,
      hecha: false,
    })
  })
})

describe("Registro de la sesión", () => {
  it("conserva valores distintos del objetivo y lo que no se marcó", () => {
    const registro = aRegistro(
      prescripcion,
      {
        [conCarga.id]: { peso: "37,5", valor: "12", hecha: true },
        [sinCarga.id]: { peso: "", valor: "50", hecha: false },
      },
      "  ",
    )
    expect(registro).toEqual({
      notas: null,
      series: [
        {
          serieId: conCarga.id,
          tipoMedicion: "repeticiones",
          pesoKg: 37.5,
          repeticiones: 12,
          hecha: true,
        },
        { serieId: sinCarga.id, tipoMedicion: "tiempo", pesoKg: null, segundos: 50, hecha: false },
      ],
    })
    // Y es exactamente lo que el servidor acepta para esta prescripción.
    expect(crearRegistroDeSesionSchema(prescripcion).safeParse(registro).success).toBe(true)
    expect(recuento(prescripcion, entradasDesdeRegistro(registro))).toEqual({ hechas: 1, total: 2 })
  })

  it("vuelve a las entradas de pantalla con coma decimal", () => {
    const entradas = entradasDesdeRegistro({
      notas: null,
      series: [
        {
          serieId: conCarga.id,
          tipoMedicion: "repeticiones",
          pesoKg: 42.5,
          repeticiones: 8,
          hecha: true,
        },
      ],
    })
    expect(entradas[conCarga.id]).toEqual({ peso: "42,5", valor: "8", hecha: true })
  })
})
