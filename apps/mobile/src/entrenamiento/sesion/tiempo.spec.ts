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
})
