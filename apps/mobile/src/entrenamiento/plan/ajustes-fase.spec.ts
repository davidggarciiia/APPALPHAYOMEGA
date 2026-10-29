import type { AjustesDeFase, EjercicioPrescrito } from "@alpha-omega/shared"
import { cargaSugeridaDeFase, textoDeAjustes } from "./ajustes-fase"

const descarga: AjustesDeFase = {
  rirCompuestos: { min: 3, max: 4 },
  rirAccesorios: { min: 3, max: 4 },
  factorSeries: 0.5,
  factorCarga: 0.875,
}
const ejercicio: EjercicioPrescrito = {
  id: "10000000-0000-4000-8000-000000000001",
  ejercicioId: "10000000-0000-4000-8000-000000000002",
  nombre: "Press banca",
  indicaciones: null,
  calibrar: true,
  subidaKg: 2.5,
  series: [
    {
      id: "10000000-0000-4000-8000-000000000003",
      tipoMedicion: "repeticiones",
      repeticiones: 8,
      pesoKg: null,
    },
  ],
}

it("resume lo que cambia, incluida la conservación de series compuestas", () => {
  expect(textoDeAjustes(descarga)).toBe(
    "RIR 3–4 · −50 % series accesorios (compuestos igual) · 87,5 % de carga",
  )
  expect(textoDeAjustes({ rirAccesorios: { min: 1, max: 1 } })).toBe("RIR 1 accesorios")
  expect(textoDeAjustes(undefined)).toBeNull()
  expect(textoDeAjustes({})).toBeNull()
})

it("sugiere desde la última carga con el paso del ejercicio, sin tocar la prescripción", () => {
  const anterior = { tipoMedicion: "repeticiones" as const, pesoKg: 60, repeticiones: 8 }
  expect(cargaSugeridaDeFase(ejercicio, descarga.factorCarga, anterior)).toBe(52.5)
  expect(
    cargaSugeridaDeFase({ ...ejercicio, subidaKg: undefined }, 0.875, { ...anterior, pesoKg: 61 }),
  ).toBe(53.5)
  expect(ejercicio.series[0]!.pesoKg).toBeNull()
  expect(cargaSugeridaDeFase(ejercicio, undefined, anterior)).toBeNull()
  expect(cargaSugeridaDeFase(ejercicio, 1, anterior)).toBeNull()
  expect(cargaSugeridaDeFase(ejercicio, 0.875)).toBeNull()
  expect(cargaSugeridaDeFase(ejercicio, 0.875, { ...anterior, pesoKg: null })).toBeNull()
  expect(cargaSugeridaDeFase({ ...ejercicio, tipoCarga: "sinCarga" }, 0.875, anterior)).toBeNull()
})
