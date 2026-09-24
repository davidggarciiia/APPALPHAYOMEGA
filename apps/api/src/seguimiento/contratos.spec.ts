import {
  ConfiguracionSeguimientoSchema,
  GuardarConfiguracionSeguimientoSchema,
  RegistrarPruebaSchema,
} from "@alpha-omega/shared"

const uuid = "00000000-0000-4000-8000-000000000001"

describe("configuración de seguimiento", () => {
  const configuracion = {
    revision: 0,
    indicadores: ["peso", "pasos", "sueno", "cintura", "fuerza", "pruebas"],
    registrosSolicitados: [
      { indicador: "peso", frecuencia: "diaria", diaSemana: null },
      { indicador: "cintura", frecuencia: "semanal", diaSemana: 1 },
    ],
    objetivoPeso: { direccion: "bajar", rangoKg: { minimo: 80, maximo: 85 } },
    pruebasPrescritas: [{ id: uuid, nombre: "Flexiones seguidas", unidad: "reps" }],
  }

  it("acepta indicadores ordenados, frecuencias y objetivo con rango", () => {
    expect(ConfiguracionSeguimientoSchema.parse(configuracion)).toEqual(configuracion)
    expect(GuardarConfiguracionSeguimientoSchema.parse(configuracion)).toEqual(configuracion)
  })

  it("rechaza duplicados, día incoherente y rango invertido", () => {
    expect(
      GuardarConfiguracionSeguimientoSchema.safeParse({
        ...configuracion,
        indicadores: ["peso", "peso"],
      }).success,
    ).toBe(false)
    expect(
      GuardarConfiguracionSeguimientoSchema.safeParse({
        ...configuracion,
        registrosSolicitados: [{ indicador: "peso", frecuencia: "semanal", diaSemana: null }],
      }).success,
    ).toBe(false)
    expect(
      GuardarConfiguracionSeguimientoSchema.safeParse({
        ...configuracion,
        objetivoPeso: { direccion: "bajar", rangoKg: { minimo: 90, maximo: 80 } },
      }).success,
    ).toBe(false)
  })

  it("admite una prueba prescrita por id y conserva la petición heredada", () => {
    const base = { operacionId: uuid, fecha: "2026-09-24", valor: 32 }
    expect(RegistrarPruebaSchema.safeParse({ ...base, pruebaId: uuid }).success).toBe(true)
    expect(
      RegistrarPruebaSchema.safeParse({ ...base, nombre: "Flexiones", unidad: "reps" }).success,
    ).toBe(true)
    expect(RegistrarPruebaSchema.safeParse(base).success).toBe(false)
  })
})
