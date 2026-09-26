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

describe("Días de calendario de la agenda", () => {
  it("la semana va de lunes a domingo, también en fin de año y años bisiestos", () => {
    expect(contratos.lunesDe("2026-09-14")).toBe("2026-09-14")
    expect(contratos.lunesDe("2026-09-20")).toBe("2026-09-14")
    expect(contratos.lunesDe("2026-09-21")).toBe("2026-09-21")
    expect(contratos.lunesDe("2027-01-01")).toBe("2026-12-28")
    expect(contratos.lunesDe("2024-03-01")).toBe("2024-02-26")
    expect(contratos.sumarDias("2024-02-28", 1)).toBe("2024-02-29")
    expect(contratos.sumarDias("2026-12-31", 1)).toBe("2027-01-01")
    expect(contratos.diaSemanaDe("2026-09-20")).toBe(7)
    expect(contratos.mismaSemana("2026-09-14", "2026-09-20")).toBe(true)
    expect(contratos.mismaSemana("2026-09-20", "2026-09-21")).toBe(false)
    expect(contratos.diasEntre("2026-09-14", "2026-09-21")).toBe(7)
  })

  it("los cambios de hora no mueven la fecha", () => {
    // Madrid pasa al horario de verano el 29 de marzo de 2026 y vuelve el 25 de octubre.
    expect(contratos.sumarDias("2026-03-28", 1)).toBe("2026-03-29")
    expect(contratos.sumarDias("2026-03-29", 1)).toBe("2026-03-30")
    expect(contratos.sumarDias("2026-10-25", 1)).toBe("2026-10-26")
    expect(contratos.lunesDe("2026-03-29")).toBe("2026-03-23")
  })

  it("hoy se calcula en Madrid y no en la zona del dispositivo", () => {
    // 23:30 UTC del domingo ya es lunes en Madrid.
    const instante = new Date("2026-09-20T23:30:00Z")
    expect(contratos.hoyEn("Europe/Madrid", instante)).toBe("2026-09-21")
    expect(contratos.hoyEn("UTC", instante)).toBe("2026-09-20")
  })
})

describe("Contratos nuevos de consulta y planificación", () => {
  const patron = contratos.PatronRutinaSchema.parse({
    sesiones: [
      {
        id: otroId,
        nombre: "Pierna",
        diaSemana: 4,
        ejercicios: [{ id, ejercicioId: id, indicaciones: null, series: [serie] }],
      },
      {
        id,
        nombre: "Torso",
        diaSemana: 1,
        ejercicios: [{ id, ejercicioId: id, indicaciones: null, series: [serie] }],
      },
    ],
  })

  it("expande el patrón en fechas concretas y ordenadas", () => {
    expect(contratos.fechasDelPlan("2026-12-28", 2, patron)).toEqual([
      { sesionPatronId: id, nombre: "Torso", semana: "2026-12-28", fecha: "2026-12-28" },
      { sesionPatronId: otroId, nombre: "Pierna", semana: "2026-12-28", fecha: "2026-12-31" },
      { sesionPatronId: id, nombre: "Torso", semana: "2027-01-04", fecha: "2027-01-04" },
      { sesionPatronId: otroId, nombre: "Pierna", semana: "2027-01-04", fecha: "2027-01-07" },
    ])
  })

  it("consulta semanas por su lunes con un número de semanas acotado", () => {
    expect(contratos.ConsultarSesionesSchema.parse({ semana: "2026-09-14" }).semanas).toBe(1)
    expect(
      contratos.ConsultarSesionesSchema.parse({ semana: "2026-09-14", semanas: "4" }).semanas,
    ).toBe(4)
    for (const invalida of [
      { semana: "2026-09-15" },
      { semana: "2026-09-14", semanas: "0" },
      { semana: "2026-09-14", semanas: "53" },
      { semana: "2026-09-14", clienteId: id },
    ]) {
      expect(contratos.ConsultarSesionesSchema.safeParse(invalida).success).toBe(false)
    }
  })

  it("el panel solo resume ejecución enviada y nunca lleva borradores ni notas", () => {
    const fila = {
      agenda: {
        id,
        clienteId: id,
        fechaOriginal: "2026-09-14",
        fechaActual: "2026-09-14",
        estado: "abierta",
        revision: 0,
      },
      nombre: "Torso",
      enviadoEn: null,
      cliente: { id, nombre: "Ana", apellidos: null },
      ejecucion: null,
    }
    expect(contratos.FilaPanelSchema.safeParse(fila).success).toBe(true)
    expect(contratos.FilaPanelSchema.safeParse({ ...fila, borrador: null }).success).toBe(false)
    expect(contratos.FilaPanelSchema.safeParse({ ...fila, notas: "x" }).success).toBe(false)
    expect(
      contratos.FilaPanelSchema.safeParse({
        ...fila,
        ejecucion: { seriesHechas: 2, seriesPrescritas: 0 },
      }).success,
    ).toBe(false)
    // Sin envío no hay resumen, y un envío siempre lo lleva.
    expect(
      contratos.FilaPanelSchema.safeParse({
        ...fila,
        ejecucion: { seriesHechas: 1, seriesPrescritas: 2 },
      }).success,
    ).toBe(false)
    expect(
      contratos.FilaPanelSchema.safeParse({ ...fila, enviadoEn: "2026-09-14T10:00:00.000Z" })
        .success,
    ).toBe(false)
  })

  it("normaliza nombres de ejercicio para compararlos", () => {
    expect(contratos.normalizarNombreEjercicio("  Sentadilla   Búlgara ")).toBe(
      "sentadilla bulgara",
    )
    expect(contratos.EjerciciosPorIdSchema.parse({ ids: `${id},${otroId}` }).ids).toEqual([
      id,
      otroId,
    ])
    expect(contratos.EjerciciosPorIdSchema.safeParse({ ids: "no-es-un-id" }).success).toBe(false)
    expect(contratos.EjerciciosPorIdSchema.safeParse({ ids: "" }).success).toBe(false)
  })

  it("cuenta las series prescritas de una sesión", () => {
    expect(contratos.seriesDe(contratos.PrescripcionSchema.parse(prescripcion))).toBe(1)
  })
})
