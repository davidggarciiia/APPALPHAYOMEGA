import {
  PrescripcionSchema,
  RegistroSchema,
  ResultadoEntrenamientoSchema,
  crearRegistroDeSesionSchema,
} from "@alpha-omega/shared"

const sesionId = "10000000-0000-4000-8000-000000000001"
const ejercicioId = "10000000-0000-4000-8000-000000000002"
const serieId = "10000000-0000-4000-8000-000000000003"
const catalogoId = "10000000-0000-4000-8000-000000000004"

const prescripcionAnterior = {
  nombre: "Fuerza",
  ejercicios: [
    {
      id: ejercicioId,
      ejercicioId: catalogoId,
      nombre: "Remo",
      indicaciones: null,
      series: [{ id: serieId, tipoMedicion: "repeticiones", pesoKg: null, repeticiones: 10 }],
    },
  ],
}

describe("compatibilidad de prescripción y registro", () => {
  it("lee una prescripción y un registro antiguos sin convertir pendientes en omitidas", () => {
    const prescripcion = PrescripcionSchema.parse(prescripcionAnterior)
    expect(prescripcion.ejercicios[0]!.modoRir).toBeUndefined()
    expect(prescripcion.ejercicios[0]!.tipoCarga).toBeUndefined()
    const registro = RegistroSchema.parse({
      notas: null,
      series: [
        { serieId, tipoMedicion: "repeticiones", pesoKg: null, repeticiones: null, hecha: false },
      ],
    })
    expect(registro.series[0]!.omitida).toBeUndefined()
    expect(registro.tiempoActivoSegundos).toBeUndefined()
  })

  it("acepta el modo RIR y el tipo de carga, y distingue omisión de pendiente", () => {
    const prescripcion = PrescripcionSchema.parse({
      ...prescripcionAnterior,
      ejercicios: [
        { ...prescripcionAnterior.ejercicios[0], modoRir: "cadaSerie", tipoCarga: "sinCarga" },
      ],
    })
    expect(prescripcion.ejercicios[0]).toEqual(
      expect.objectContaining({ modoRir: "cadaSerie", tipoCarga: "sinCarga" }),
    )
    const registro = crearRegistroDeSesionSchema(prescripcion).parse({
      notas: null,
      series: [
        {
          serieId,
          tipoMedicion: "repeticiones",
          pesoKg: null,
          repeticiones: null,
          hecha: false,
          omitida: true,
        },
      ],
    })
    expect(registro.series[0]!.omitida).toBe(true)
    expect(
      RegistroSchema.safeParse({ ...registro, series: [{ ...registro.series[0], hecha: true }] })
        .success,
    ).toBe(false)
  })

  it("mantiene el resultado histórico pendiente y admite la omisión explícita", () => {
    const base = {
      sesionId,
      prescripcion: {
        ...prescripcionAnterior,
        ejercicios: [
          {
            ...prescripcionAnterior.ejercicios[0],
            series: [
              { id: serieId, tipoMedicion: "repeticiones", pesoKg: null, repeticiones: 10 },
              {
                id: "10000000-0000-4000-8000-000000000005",
                tipoMedicion: "repeticiones",
                pesoKg: null,
                repeticiones: 10,
              },
            ],
          },
        ],
      },
      revisionPrescripcion: 0,
      enviadoEn: "2026-09-24T12:00:00.000Z",
      notas: null,
      series: [
        {
          serieId,
          hecha: true,
          valores: { tipoMedicion: "repeticiones", pesoKg: null, repeticiones: 10 },
        },
        { serieId: "10000000-0000-4000-8000-000000000005", hecha: false },
      ],
    }
    expect(ResultadoEntrenamientoSchema.parse(base).series[1]).toEqual({
      serieId: "10000000-0000-4000-8000-000000000005",
      hecha: false,
    })
    const omitido = { ...base, series: [base.series[0], { ...base.series[1], omitida: true }] }
    expect(ResultadoEntrenamientoSchema.parse(omitido).series[1]).toEqual({
      serieId: "10000000-0000-4000-8000-000000000005",
      hecha: false,
      omitida: true,
    })
  })

  it("rechaza calibrar o registrar kilos en un ejercicio sin carga externa", () => {
    const ejercicio = { ...prescripcionAnterior.ejercicios[0], tipoCarga: "sinCarga" }
    expect(
      PrescripcionSchema.safeParse({
        ...prescripcionAnterior,
        ejercicios: [{ ...ejercicio, calibrar: true }],
      }).success,
    ).toBe(false)
    expect(
      PrescripcionSchema.safeParse({
        ...prescripcionAnterior,
        ejercicios: [{ ...ejercicio, subidaKg: 2.5 }],
      }).success,
    ).toBe(false)
    const prescripcion = PrescripcionSchema.parse({
      ...prescripcionAnterior,
      ejercicios: [ejercicio],
    })
    expect(
      crearRegistroDeSesionSchema(prescripcion).safeParse({
        notas: null,
        series: [
          { serieId, tipoMedicion: "repeticiones", pesoKg: 10, repeticiones: 10, hecha: true },
        ],
      }).success,
    ).toBe(false)
  })

  it("pide kilos realizados al completar un ejercicio de carga externa en calibración", () => {
    const prescripcion = PrescripcionSchema.parse({
      ...prescripcionAnterior,
      ejercicios: [
        { ...prescripcionAnterior.ejercicios[0], tipoCarga: "conCargaExterna", calibrar: true },
      ],
    })
    expect(
      crearRegistroDeSesionSchema(prescripcion).safeParse({
        notas: null,
        series: [
          { serieId, tipoMedicion: "repeticiones", pesoKg: null, repeticiones: 10, hecha: true },
        ],
      }).success,
    ).toBe(false)
  })

  it("conserva el tiempo activo no negativo en registro y resultado", () => {
    const registro = { notas: null, series: [], tiempoActivoSegundos: 125 }
    expect(RegistroSchema.parse(registro).tiempoActivoSegundos).toBe(125)
    expect(RegistroSchema.safeParse({ ...registro, tiempoActivoSegundos: -1 }).success).toBe(false)
    const resultado = {
      sesionId,
      prescripcion: prescripcionAnterior,
      revisionPrescripcion: 0,
      enviadoEn: "2026-09-24T12:00:00.000Z",
      notas: null,
      series: [
        {
          serieId,
          hecha: true,
          valores: { tipoMedicion: "repeticiones", pesoKg: null, repeticiones: 10 },
        },
      ],
      tiempoActivoSegundos: 125,
    }
    expect(ResultadoEntrenamientoSchema.parse(resultado).tiempoActivoSegundos).toBe(125)
    expect(
      ResultadoEntrenamientoSchema.safeParse({ ...resultado, tiempoActivoSegundos: 1.5 }).success,
    ).toBe(false)
  })
})
