import { desdePrescripcion } from "../registro-modelo"
import { PrescripcionSchema } from "@alpha-omega/shared"
import { iniciarTramo, pausarTramo, duracionDeSesion } from "./tiempo"

const base = desdePrescripcion(
  PrescripcionSchema.parse({
    nombre: "Prueba",
    ejercicios: [
      {
        id: "00000000-0000-4000-8000-000000000001",
        ejercicioId: "00000000-0000-4000-8000-000000000002",
        nombre: "Sentadilla",
        indicaciones: null,
        series: [
          {
            id: "00000000-0000-4000-8000-000000000003",
            tipoMedicion: "repeticiones",
            pesoKg: null,
            repeticiones: 10,
          },
        ],
      },
    ],
  }),
)
const t0 = "2026-09-24T10:00:00.000Z"

it("solo acumula tiempo activo entre inicio y pausa y conserva el descanso por hora absoluta", () => {
  const activa = iniciarTramo({ ...base, inicio: t0 }, t0)
  expect(duracionDeSesion(activa, Date.parse(t0) + 90_000)).toEqual({ segundos: 90, legado: false })
  const pausada = pausarTramo(activa, "2026-09-24T10:01:30.000Z")
  expect(duracionDeSesion(pausada, Date.parse(t0) + 3_600_000)).toEqual({
    segundos: 90,
    legado: false,
  })
  const reanudada = iniciarTramo(pausada, "2026-09-24T11:00:00.000Z")
  expect(duracionDeSesion(reanudada, Date.parse("2026-09-24T11:00:30.000Z"))).toEqual({
    segundos: 120,
    legado: false,
  })
})

it("identifica el tiempo de un borrador antiguo como transcurrido", () => {
  expect(duracionDeSesion({ ...base, inicio: t0 }, Date.parse(t0) + 120_000)).toEqual({
    segundos: 120,
    legado: true,
  })
  expect(duracionDeSesion({ ...base, inicio: t0 }, Date.parse(t0) + 10 * 3_600_000)).toEqual({
    segundos: 36_000,
    legado: true,
  })
})

it("muestra como máximo cuatro horas del tramo abierto sin perder el acumulado", () => {
  const activa = iniciarTramo({ ...base, tiempoActivoSegundos: 120 }, t0)
  expect(duracionDeSesion(activa, Date.parse(t0) + 10 * 3_600_000)).toEqual({
    segundos: 14_520,
    legado: false,
  })
})

it("al pausar un tramo de diez horas suma solo cuatro al tiempo ya acumulado", () => {
  const activa = iniciarTramo({ ...base, tiempoActivoSegundos: 120 }, t0)
  const pausada = pausarTramo(activa, "2026-09-24T20:00:00.000Z")
  expect(pausada.tiempoActivoSegundos).toBe(14_520)
  expect(pausada.tramoActivoDesde).toBeNull()
})

it("reanudar tras un tramo limitado permite acumular el nuevo tramo", () => {
  const activa = iniciarTramo({ ...base, tiempoActivoSegundos: 120 }, t0)
  const pausada = pausarTramo(activa, "2026-09-24T20:00:00.000Z")
  const reanudada = iniciarTramo(pausada, "2026-09-24T21:00:00.000Z")
  expect(duracionDeSesion(reanudada, Date.parse("2026-09-24T21:00:30.000Z"))).toEqual({
    segundos: 14_550,
    legado: false,
  })
  expect(pausarTramo(reanudada, "2026-09-24T21:00:30.000Z").tiempoActivoSegundos).toBe(14_550)
})
