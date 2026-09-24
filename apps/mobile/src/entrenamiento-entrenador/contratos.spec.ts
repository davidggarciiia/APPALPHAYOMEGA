import {
  ListadoAnterioresSchema,
  ListadoResultadosSchema,
  PrescripcionSchema,
  RegistroSchema,
  ResultadoEntrenamientoSchema,
  SeriePrescritaDistanciaSchema,
  SeriePrescritaSchema,
  ValoresEjecutadosDistanciaSchema,
  ValoresEjecutadosSchema,
  crearRegistroDeSesionSchema,
  mantieneUnidadYCarga,
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

describe("Distancia en metros en la lectura del entrenador (D01, aún sin publicar)", () => {
  const otraSerieId = "10000000-0000-4000-8000-000000000006"
  const enviadoEn = "2026-09-24T12:00:00.000Z"
  const agenda = {
    id: sesionId,
    clienteId: "10000000-0000-4000-8000-000000000007",
    fechaOriginal: "2026-09-24",
    fechaActual: "2026-09-24",
    estado: "cerrada",
    revision: 1,
  }
  // Enviado antes del RIR y del cronómetro: sin `rir`, `checkin` ni tiempo activo.
  const historico = {
    sesionId,
    prescripcion: {
      ...prescripcionAnterior,
      ejercicios: [
        {
          ...prescripcionAnterior.ejercicios[0],
          series: [
            { id: serieId, tipoMedicion: "repeticiones", pesoKg: 20, repeticiones: 10 },
            { id: otraSerieId, tipoMedicion: "tiempo", pesoKg: null, segundos: 30 },
          ],
        },
      ],
    },
    revisionPrescripcion: 0,
    enviadoEn,
    notas: null,
    series: [
      {
        serieId,
        hecha: true,
        valores: { tipoMedicion: "repeticiones", pesoKg: 20, repeticiones: 10 },
      },
      {
        serieId: otraSerieId,
        hecha: true,
        valores: { tipoMedicion: "tiempo", pesoKg: 5, segundos: 30 },
      },
    ],
  }
  const objetivo = SeriePrescritaDistanciaSchema.parse({
    id: serieId,
    tipoMedicion: "distancia",
    pesoKg: 32,
    metros: 20,
  })
  const hecho = ValoresEjecutadosDistanciaSchema.parse({
    tipoMedicion: "distancia",
    pesoKg: 34,
    metros: 18,
    rir: null,
  })

  it("un resultado histórico se lee igual en la sesión y en la ficha, sin campos añadidos", () => {
    const leido = ResultadoEntrenamientoSchema.parse(historico)
    expect(leido).toEqual(historico)
    expect(leido.series[0]).not.toHaveProperty("valores.rir")
    expect(leido).not.toHaveProperty("checkin")
    expect(leido).not.toHaveProperty("tiempoActivoSegundos")
    const ficha = ListadoResultadosSchema.parse({ resultados: [{ agenda, resultado: historico }] })
    expect(ficha.resultados[0]!.resultado).toEqual(historico)
    // Lo hecho en otra unidad que la pautada no es un resultado válido.
    for (const valores of [
      { tipoMedicion: "tiempo", pesoKg: 20, segundos: 10 },
      { tipoMedicion: "distancia", pesoKg: 20, metros: 10 },
      { tipoMedicion: "repeticiones", pesoKg: 20, repeticiones: 10, metros: 10 },
    ]) {
      expect(
        ResultadoEntrenamientoSchema.safeParse({
          ...historico,
          series: [{ ...historico.series[0], valores }, historico.series[1]],
        }).success,
      ).toBe(false)
    }
  })

  it("lo hecho en metros conserva la unidad y la carga pautadas (contrato auxiliar)", () => {
    const sinKilos = { ...objetivo, pesoKg: null }
    expect(mantieneUnidadYCarga({ ...hecho, hecha: true }, objetivo, "conCargaExterna")).toBe(true)
    expect(
      mantieneUnidadYCarga({ ...hecho, pesoKg: null, hecha: true }, objetivo, "conCargaExterna"),
    ).toBe(false)
    expect(
      mantieneUnidadYCarga({ ...hecho, pesoKg: null, hecha: true }, sinKilos, "sinCarga"),
    ).toBe(true)
    expect(mantieneUnidadYCarga({ ...hecho, hecha: true }, sinKilos, "sinCarga")).toBe(false)
    // Ni 18 repeticiones valen por 18 m, ni 18 m por repeticiones.
    const repeticiones = ValoresEjecutadosSchema.parse({
      tipoMedicion: "repeticiones",
      pesoKg: 34,
      repeticiones: 18,
    })
    expect(
      mantieneUnidadYCarga({ ...repeticiones, hecha: true }, objetivo, "conCargaExterna"),
    ).toBe(false)
    const press = SeriePrescritaSchema.parse(historico.prescripcion.ejercicios[0]!.series[0])
    expect(mantieneUnidadYCarga({ ...hecho, hecha: true }, press, undefined)).toBe(false)
    expect(ValoresEjecutadosDistanciaSchema.safeParse({ ...hecho, repeticiones: 18 }).success).toBe(
      false,
    )
  })

  // Al publicar los metros en D01.g este caso se invierte a propósito.
  it("no se publica hasta D01.g: resultado, ficha y «Anterior» aún rechazan los metros", () => {
    const enMetros = {
      ...historico,
      prescripcion: {
        ...prescripcionAnterior,
        ejercicios: [
          {
            ...prescripcionAnterior.ejercicios[0],
            tipoCarga: "conCargaExterna",
            series: [objetivo],
          },
        ],
      },
      series: [{ serieId, hecha: true, valores: hecho }],
    }
    expect(ResultadoEntrenamientoSchema.safeParse(enMetros).success).toBe(false)
    expect(
      ListadoResultadosSchema.safeParse({ resultados: [{ agenda, resultado: enMetros }] }).success,
    ).toBe(false)
    expect(
      ListadoAnterioresSchema.safeParse({
        anteriores: [{ ejercicioId: catalogoId, fecha: enviadoEn, valores: hecho }],
      }).success,
    ).toBe(false)
  })
})
