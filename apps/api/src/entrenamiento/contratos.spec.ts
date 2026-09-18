import * as contratos from "@alpha-omega/shared"

const id = "11111111-1111-4111-8111-111111111111"
const otroId = "22222222-2222-4222-8222-222222222222"
const serie = { id, tipoMedicion: "repeticiones", pesoKg: 40, repeticiones: 10 }
const ejercicioPrescrito = {
  id,
  ejercicioId: id,
  nombre: "Press de banca",
  indicaciones: null,
  series: [serie],
}
const prescripcion = { nombre: "Día de fuerza", ejercicios: [ejercicioPrescrito] }
const registroSerie = {
  serieId: id,
  tipoMedicion: "repeticiones",
  pesoKg: 0,
  repeticiones: 8,
  hecha: true,
}

describe("Contratos del catálogo y agenda", () => {
  it("acepta un ejercicio textual sin medios y rechaza campos de permisos", () => {
    const ejercicio = {
      nombre: "  Press de banca  ",
      grupoPrincipal: "pecho",
      gruposSecundarios: ["triceps"],
      instrucciones: "Usar la técnica indicada por el entrenador.",
    }
    expect(contratos.CrearEjercicioSchema.parse(ejercicio).nombre).toBe("Press de banca")
    expect(
      contratos.CrearEjercicioSchema.safeParse({ ...ejercicio, rol: "entrenador" }).success,
    ).toBe(false)
    expect(
      contratos.EjercicioSchema.parse({
        ...ejercicio,
        id,
        estado: "publicado",
        figura: null,
        video: null,
      }).figura,
    ).toBeNull()
  })

  it("rechaza grupos inventados, duplicados o repetidos como principales", () => {
    const ejercicio = {
      nombre: "Remo",
      grupoPrincipal: "espalda",
      instrucciones: "Remar.",
      gruposSecundarios: [],
    }
    for (const cambios of [
      { grupoPrincipal: "todo" },
      { gruposSecundarios: ["biceps", "biceps"] },
      { gruposSecundarios: ["espalda"] },
    ]) {
      expect(contratos.CrearEjercicioSchema.safeParse({ ...ejercicio, ...cambios }).success).toBe(
        false,
      )
    }
  })

  it.each(["2026-02-31", "2025-02-29", "2026-09-18T00:00:00Z"])("rechaza el día %s", (fecha) => {
    expect(contratos.CambiarFechaSchema.safeParse({ fecha, revision: 1 }).success).toBe(false)
  })

  it("la semana empieza en lunes, sin depender de la zona del dispositivo", () => {
    expect(contratos.ConsultarSemanaSchema.safeParse({ semana: "2026-09-14" }).success).toBe(true)
    expect(contratos.ConsultarSemanaSchema.safeParse({ semana: "2026-09-15" }).success).toBe(false)
    expect(contratos.CambiarFechaSchema.parse({ fecha: "2024-02-29", revision: 0 }).fecha).toBe(
      "2024-02-29",
    )
  })

  it("la agenda rechaza contenido privado y revisiones negativas", () => {
    const sesion = {
      id,
      clienteId: id,
      fechaOriginal: "2026-09-14",
      fechaActual: "2026-09-15",
      estado: "abierta",
      revision: 0,
    }
    expect(contratos.SesionProgramadaSchema.safeParse(sesion).success).toBe(true)
    expect(contratos.SesionProgramadaSchema.safeParse({ ...sesion, borrador: {} }).success).toBe(
      false,
    )
    expect(
      contratos.CambiarFechaSchema.safeParse({ fecha: "2026-09-14", revision: -1 }).success,
    ).toBe(false)
  })
})

describe("Contratos de prescripción", () => {
  it("distingue repeticiones y tiempo, sin permitir ambos ni cifras inválidas", () => {
    expect(contratos.SeriePrescritaSchema.safeParse(serie).success).toBe(true)
    expect(
      contratos.SeriePrescritaSchema.safeParse({
        id,
        tipoMedicion: "tiempo",
        pesoKg: null,
        segundos: 45,
      }).success,
    ).toBe(true)
    for (const cambio of [
      { segundos: 30 },
      { repeticiones: 0 },
      { repeticiones: 2.5 },
      { pesoKg: -1 },
    ]) {
      expect(contratos.SeriePrescritaSchema.safeParse({ ...serie, ...cambio }).success).toBe(false)
    }
  })

  it("las series son identificables en toda la sesión, incluso entre ejercicios", () => {
    expect(contratos.PrescripcionSchema.safeParse(prescripcion).success).toBe(true)
    expect(
      contratos.PrescripcionSchema.safeParse({
        ...prescripcion,
        ejercicios: [ejercicioPrescrito, { ...ejercicioPrescrito, id: otroId }],
      }).success,
    ).toBe(false)
    expect(
      contratos.PrescripcionSchema.safeParse({
        ...prescripcion,
        ejercicios: [{ ...ejercicioPrescrito, series: [serie, serie] }],
      }).success,
    ).toBe(false)
  })

  it("la asignación lleva operación estable y patrón sin nombres inventados ni datos reales", () => {
    const patron = {
      sesiones: [
        {
          id,
          diaSemana: 1,
          nombre: "Fuerza",
          ejercicios: [{ id, ejercicioId: id, indicaciones: null, series: [serie] }],
        },
      ],
    }
    const asignacion = {
      operacionId: id,
      nombre: "Bloque inicial",
      semanaInicial: "2026-09-14",
      semanas: 4,
      patron,
    }
    expect(contratos.AsignarPlanSchema.safeParse(asignacion).success).toBe(true)
    for (const cambio of [
      { semanas: 0 },
      { operacionId: "" },
      { semanaInicial: "2026-09-15" },
      { clienteId: otroId },
      { borrador: {} },
    ]) {
      expect(contratos.AsignarPlanSchema.safeParse({ ...asignacion, ...cambio }).success).toBe(
        false,
      )
    }
    expect(
      contratos.PatronRutinaSchema.safeParse({
        sesiones: [{ ...patron.sesiones[0], ejercicios: [ejercicioPrescrito] }],
      }).success,
    ).toBe(false)
  })
})

describe("Registro privado y envío", () => {
  it("conserva campos vacíos sin convertirlos en ceros ni copiar objetivos", () => {
    const parcial = {
      series: [
        {
          serieId: id,
          tipoMedicion: "repeticiones",
          pesoKg: null,
          repeticiones: null,
          hecha: false,
        },
      ],
      notas: null,
    }
    expect(contratos.RegistroSchema.parse(parcial)).toEqual(parcial)
    expect(
      contratos.RegistroSchema.safeParse({
        ...parcial,
        series: [{ ...parcial.series[0], hecha: true }],
      }).success,
    ).toBe(false)
  })

  it("valida la ejecución contra la prescripción auténtica de esa sesión", () => {
    const esquema = contratos.crearRegistroDeSesionSchema(
      contratos.PrescripcionSchema.parse(prescripcion),
    )
    expect(esquema.safeParse({ series: [registroSerie], notas: null }).success).toBe(true)
    for (const invalida of [
      { ...registroSerie, serieId: otroId },
      { ...registroSerie, pesoKg: null },
      { serieId: id, tipoMedicion: "tiempo", pesoKg: 0, segundos: 30, hecha: true },
    ]) {
      expect(esquema.safeParse({ series: [invalida], notas: null }).success).toBe(false)
    }
    expect(esquema.safeParse({ series: [registroSerie, registroSerie], notas: null }).success).toBe(
      false,
    )
  })

  it("permite series por tiempo sin peso cuando la prescripción no requiere carga", () => {
    const sinCarga = contratos.PrescripcionSchema.parse({
      ...prescripcion,
      ejercicios: [
        {
          ...ejercicioPrescrito,
          series: [{ id, tipoMedicion: "tiempo", pesoKg: null, segundos: 45 }],
        },
      ],
    })
    const esquema = contratos.crearRegistroDeSesionSchema(sinCarga)
    expect(
      esquema.safeParse({
        series: [{ serieId: id, tipoMedicion: "tiempo", pesoKg: null, segundos: 35, hecha: true }],
        notas: null,
      }).success,
    ).toBe(true)
  })

  it("el borrador puede estar vacío, el envío exige una serie hecha", () => {
    const solicitud = {
      operacionId: id,
      revisionPrescripcion: 0,
      revisionBorrador: 0,
      registro: { series: [], notas: null },
    }
    expect(contratos.GuardarBorradorSchema.safeParse(solicitud).success).toBe(true)
    expect(contratos.EnviarEntrenamientoSchema.safeParse(solicitud).success).toBe(false)
    expect(
      contratos.EnviarEntrenamientoSchema.safeParse({
        ...solicitud,
        registro: { series: [registroSerie], notas: null },
      }).success,
    ).toBe(true)
  })
})

describe("Respuestas públicas y privadas", () => {
  const agenda = {
    id,
    clienteId: id,
    fechaOriginal: "2026-09-14",
    fechaActual: "2026-09-15",
    estado: "abierta",
    revision: 0,
  }
  const publica = {
    agenda,
    prescripcion,
    revisionPrescripcion: 0,
    permiteAjuste: true,
    enviadoEn: null,
  }
  const borrador = {
    revision: 1,
    revisionPrescripcion: 0,
    registro: { series: [registroSerie], notas: "Privado" },
    actualizadoEn: "2026-09-18T18:00:00Z",
  }

  it("el DTO de entrenador rechaza borradores y su revisión", () => {
    expect(contratos.SesionEntrenadorSchema.safeParse(publica).success).toBe(true)
    expect(contratos.SesionEntrenadorSchema.safeParse({ ...publica, borrador }).success).toBe(false)
    expect(
      contratos.SesionEntrenadorSchema.safeParse({ ...publica, revisionBorrador: 1 }).success,
    ).toBe(false)
    expect(contratos.SesionClienteSchema.safeParse({ ...publica, borrador }).success).toBe(true)
    expect(
      contratos.ListadoSesionesSchema.safeParse({
        sesiones: [{ agenda, nombre: prescripcion.nombre, enviadoEn: null, notas: "Privado" }],
        total: 1,
      }).success,
    ).toBe(false)
  })

  it("un resultado no publica valores de series sin marcar", () => {
    const resultado = {
      sesionId: id,
      prescripcion,
      revisionPrescripcion: 0,
      enviadoEn: "2026-09-18T18:00:00Z",
      notas: null,
      series: [
        {
          serieId: id,
          hecha: true,
          valores: { tipoMedicion: "repeticiones", pesoKg: 35, repeticiones: 8 },
        },
      ],
    }
    expect(contratos.ResultadoEntrenamientoSchema.safeParse(resultado).success).toBe(true)
    expect(
      contratos.ResultadoEntrenamientoSchema.safeParse({
        ...resultado,
        series: [{ ...resultado.series[0], hecha: false }],
      }).success,
    ).toBe(false)
    expect(
      contratos.ResultadoEntrenamientoSchema.safeParse({
        ...resultado,
        series: [{ ...resultado.series[0], serieId: otroId }],
      }).success,
    ).toBe(false)
    expect(
      contratos.ResultadoEntrenamientoSchema.safeParse({ ...resultado, series: [] }).success,
    ).toBe(false)
  })

  it("un envío parcial representa explícitamente las series omitidas", () => {
    const dosSeries = {
      ...prescripcion,
      ejercicios: [{ ...ejercicioPrescrito, series: [serie, { ...serie, id: otroId }] }],
    }
    const resultado = {
      sesionId: id,
      prescripcion: dosSeries,
      revisionPrescripcion: 0,
      enviadoEn: "2026-09-18T18:00:00Z",
      notas: null,
      series: [
        {
          serieId: id,
          hecha: true,
          valores: { tipoMedicion: "repeticiones", pesoKg: 0, repeticiones: 8 },
        },
        { serieId: otroId, hecha: false },
      ],
    }
    expect(contratos.ResultadoEntrenamientoSchema.safeParse(resultado).success).toBe(true)
    expect(
      contratos.ResultadoEntrenamientoSchema.safeParse({
        ...resultado,
        series: [resultado.series[0]],
      }).success,
    ).toBe(false)
    expect(
      contratos.ResultadoEntrenamientoSchema.safeParse({
        ...resultado,
        series: [resultado.series[0], resultado.series[0]],
      }).success,
    ).toBe(false)
  })
})
