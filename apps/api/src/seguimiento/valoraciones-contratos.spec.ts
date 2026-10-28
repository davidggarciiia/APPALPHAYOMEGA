import {
  CambiarValoracionSchema,
  ConfiguracionSeguimientoSchema,
  CrearValoracionSchema,
  DefinicionCorporalSchema,
  DefinicionPruebaSchema,
  DocumentoPublicoSchema,
  DocumentoValoracionSchema,
  ErrorDeApiSchema,
  GuardarPlantillaValoracionSchema,
  GuardarProximaRevisionSchema,
  ListadoValoracionesPublicadasSchema,
  ProximaRevisionSchema,
  PublicacionValoracionSchema,
  PublicarValoracionSchema,
  RegistrarMedidaSchema,
  ValoracionClienteSchema,
  ValoracionCorporalSchema,
  crearPruebaEstandar,
  PRUEBAS_ESTANDAR,
  problemasDeResultadoPrueba,
  proyeccionCorporal,
  proyeccionPublica,
  versionarDefinicionCorporal,
  versionarDefinicionPrueba,
  type DefinicionCorporal,
  type DefinicionPrueba,
  type DocumentoValoracion,
} from "@alpha-omega/shared"

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`

// Datos sintéticos: ningún valor procede de una persona real.
const peso: DefinicionCorporal = {
  id: id(1),
  version: 1,
  bloque: "medidas",
  magnitud: "peso",
  nombre: "Peso",
  unidad: "kg",
  zona: null,
  lateralidad: null,
  instrumento: "Báscula del centro",
  protocolo: null,
  activa: true,
}
const pliegue: DefinicionCorporal = {
  id: id(2),
  version: 1,
  bloque: "pliegues",
  magnitud: "pliegue",
  nombre: "Punto A",
  unidad: "mm",
  zona: "Zona configurada",
  lateralidad: "derecha",
  instrumento: "Plicómetro",
  protocolo: null,
  activa: true,
}
const flexiones: DefinicionPrueba = {
  id: id(3),
  version: 1,
  tipo: "flexiones1min",
  nombre: "Flexiones en 1 minuto",
  variante: null,
  protocolo: null,
  duracionPrescritaS: 60,
  instrumento: null,
  metricas: [
    {
      clave: "repeticiones",
      nombre: "Repeticiones",
      unidad: "reps",
      principal: true,
      opcional: false,
    },
  ],
  activa: true,
}
const cooper: DefinicionPrueba = crearPruebaEstandar("cooper", id(4))

function documento(cambios: Partial<DocumentoValoracion> = {}): DocumentoValoracion {
  return {
    definiciones: { corporales: [peso, pliegue], pruebas: [flexiones, cooper] },
    bloques: ["medidas", "pliegues", "pruebas"],
    corporales: [
      { definicionId: peso.id, estado: "registrado", valor: 80.5 },
      { definicionId: pliegue.id, estado: "pendiente" },
    ],
    pruebas: [
      {
        definicionId: flexiones.id,
        estado: "registrado",
        valores: { repeticiones: 0 },
        protocoloCompleto: true,
        fecha: null,
        notas: null,
      },
      { definicionId: cooper.id, estado: "noRealizado", motivo: null },
    ],
    grasaPorPliegues: null,
    destacados: [peso.id],
    conclusion: "Buen punto de partida.",
    notasInternas: "Solo para el entrenador.",
    ...cambios,
  }
}

describe("contratos de valoración", () => {
  it("admite un autor con nombre y apellidos máximos del perfil", () => {
    const publicacion = {
      id: id(10),
      valoracionId: id(11),
      numero: 1,
      sustituyeId: null,
      tipo: "inicial",
      fechaToma: "2026-09-24",
      autor: { id: id(12), nombre: `${"n".repeat(80)} ${"a".repeat(120)}` },
      publicadaEn: "2026-09-24T10:00:00.000Z",
      documento: proyeccionPublica(DocumentoValoracionSchema.parse(documento())),
    }
    expect(PublicacionValoracionSchema.safeParse(publicacion).success).toBe(true)
  })

  it("un documento parcial distingue pendiente, registrado, no realizado y cero", () => {
    const leido = DocumentoValoracionSchema.parse(documento())
    expect(leido.corporales[1]).toEqual({ definicionId: pliegue.id, estado: "pendiente" })
    const flex = leido.pruebas[0]
    expect(flex?.estado === "registrado" && flex.valores.repeticiones).toBe(0)
    expect(leido.pruebas[1]?.estado).toBe("noRealizado")
  })

  it("rechaza valores fuera de la unidad, decimales de más y métricas que faltan o sobran", () => {
    const con = (cambios: Partial<DocumentoValoracion>) =>
      DocumentoValoracionSchema.safeParse(documento(cambios)).success
    expect(con({ corporales: [{ definicionId: peso.id, estado: "registrado", valor: 500 }] })).toBe(
      false,
    )
    expect(
      con({ corporales: [{ definicionId: peso.id, estado: "registrado", valor: 80.123 }] }),
    ).toBe(false)
    expect(
      con({
        corporales: [{ definicionId: peso.id, estado: "registrado", valor: -1 }],
      }),
    ).toBe(false)
    const cooperSin = (valores: Record<string, number>) =>
      con({
        pruebas: [
          {
            definicionId: cooper.id,
            estado: "registrado",
            valores,
            protocoloCompleto: true,
            fecha: null,
            notas: null,
          },
        ],
      })
    // Sin frecuencia cardiaca también se guarda: solo se anota si se recogió.
    expect(cooperSin({ distancia: 2400, duracion: 720 })).toBe(true)
    expect(cooperSin({ distancia: 2400 })).toBe(false)
    expect(cooperSin({ fcMedia: 150 })).toBe(false)
    expect(cooperSin({ distancia: 2400, duracion: 720, vo2: 50 })).toBe(false)
  })

  it("las lecturas repetidas solo se admiten en pliegues y dentro de su rango", () => {
    const con = (corporales: DocumentoValoracion["corporales"]) =>
      DocumentoValoracionSchema.safeParse(documento({ corporales })).success
    expect(
      con([{ definicionId: pliegue.id, estado: "registrado", valor: 12, lecturas: [11.8, 12.2] }]),
    ).toBe(true)
    expect(con([{ definicionId: peso.id, estado: "registrado", valor: 80, lecturas: [80] }])).toBe(
      false,
    )
    expect(
      con([{ definicionId: pliegue.id, estado: "registrado", valor: 12, lecturas: [12, 140] }]),
    ).toBe(false)
  })

  it("exige coherencia entre bloques, definiciones y resultados", () => {
    const valido = (cambios: Partial<DocumentoValoracion>) =>
      DocumentoValoracionSchema.safeParse(documento(cambios)).success
    expect(valido({ bloques: ["medidas", "pruebas"] })).toBe(false)
    expect(valido({ corporales: [{ definicionId: id(99), estado: "registrado", valor: 1 }] })).toBe(
      false,
    )
    expect(valido({ destacados: [id(99)] })).toBe(false)
    expect(
      valido({
        corporales: [
          { definicionId: peso.id, estado: "pendiente" },
          { definicionId: peso.id, estado: "pendiente" },
        ],
      }),
    ).toBe(false)
    expect(
      valido({
        bloques: ["medidas", "pruebas"],
        definiciones: { corporales: [peso], pruebas: [flexiones, cooper] },
        corporales: [],
        grasaPorPliegues: { valorPct: 18, metodo: "Método del entrenador", fecha: "2026-09-24" },
      }),
    ).toBe(false)
  })

  it("una definición no admite etiquetas, unidades ajenas ni bloques cruzados", () => {
    expect(DefinicionCorporalSchema.safeParse({ ...peso, nombre: "<b>Peso</b>" }).success).toBe(
      false,
    )
    expect(DefinicionCorporalSchema.safeParse({ ...peso, unidad: "cm" }).success).toBe(false)
    expect(DefinicionCorporalSchema.safeParse({ ...pliegue, bloque: "medidas" }).success).toBe(
      false,
    )
    expect(
      DefinicionCorporalSchema.safeParse({
        ...peso,
        bloque: "bioimpedancia",
        magnitud: "masaMuscular",
        unidad: "kg",
      }).success,
    ).toBe(true)
    expect(
      DefinicionPruebaSchema.safeParse({
        ...cooper,
        metricas: cooper.metricas.map((m) => ({ ...m, principal: true })),
      }).success,
    ).toBe(false)
  })

  it("renombrar o desactivar conserva la versión; cambiar cómo se mide la sube", () => {
    expect(versionarDefinicionCorporal(peso, { ...peso, nombre: "Peso en báscula" }).version).toBe(
      1,
    )
    expect(versionarDefinicionCorporal(peso, { ...peso, activa: false }).version).toBe(1)
    expect(
      versionarDefinicionCorporal(peso, { ...peso, instrumento: "Otra báscula" }).version,
    ).toBe(2)
    expect(
      versionarDefinicionPrueba(flexiones, { ...flexiones, nombre: "Flexiones" }).version,
    ).toBe(1)
    expect(
      versionarDefinicionPrueba(flexiones, { ...flexiones, duracionPrescritaS: 30 }).version,
    ).toBe(2)
    expect(
      versionarDefinicionPrueba(flexiones, {
        ...flexiones,
        metricas: [{ ...flexiones.metricas[0]!, unidad: "s" }],
      }).version,
    ).toBe(2)
  })

  it("la proyección pública quita notas internas, pendientes y definiciones sin resultado", () => {
    const publico = proyeccionPublica(DocumentoValoracionSchema.parse(documento()))
    expect(publico).not.toHaveProperty("notasInternas")
    expect(publico.corporales.map((r) => r.definicionId)).toEqual([peso.id])
    expect(publico.definiciones.corporales.map((d) => d.id)).toEqual([peso.id])
    expect(publico.pruebas.map((r) => r.estado)).toEqual(["registrado", "noRealizado"])
    expect(
      DocumentoPublicoSchema.safeParse({ ...publico, notasInternas: "Se cuela" }).success,
    ).toBe(false)
    expect(
      DocumentoPublicoSchema.safeParse({
        ...publico,
        corporales: [{ definicionId: peso.id, estado: "pendiente" }],
      }).success,
    ).toBe(false)
  })

  it("cliente y nutricionista reciben proyecciones estrictas sin datos internos", () => {
    const publicacion = PublicacionValoracionSchema.parse({
      id: id(10),
      valoracionId: id(11),
      numero: 1,
      sustituyeId: null,
      tipo: "inicial",
      fechaToma: "2026-09-24",
      autor: { id: id(12), nombre: "Entrenador" },
      publicadaEn: "2026-09-24T10:00:00.000Z",
      documento: proyeccionPublica(DocumentoValoracionSchema.parse(documento())),
    })
    expect(ValoracionClienteSchema.safeParse({ publicacion, borrador: null }).success).toBe(false)
    const corporal = proyeccionCorporal(publicacion)
    expect(corporal).not.toHaveProperty("pruebas")
    expect(corporal).not.toHaveProperty("conclusion")
    expect(ValoracionCorporalSchema.safeParse({ ...corporal, conclusion: "x" }).success).toBe(false)
  })

  it("crear distingue primera visita, revisión y corrección; ninguna copia resultados", () => {
    const base = { operacionId: id(20), fechaToma: "2026-09-24", bloques: ["medidas"] }
    expect(CrearValoracionSchema.safeParse({ ...base, tipo: "inicial" }).success).toBe(true)
    expect(CrearValoracionSchema.safeParse({ ...base, tipo: "revision" }).success).toBe(false)
    expect(
      CrearValoracionSchema.safeParse({ ...base, tipo: "revision", anteriorId: id(11) }).success,
    ).toBe(false)
    expect(
      CrearValoracionSchema.safeParse({
        ...base,
        tipo: "revision",
        anteriorId: id(11),
        cumplePauta: null,
      }).success,
    ).toBe(true)
    expect(
      CrearValoracionSchema.safeParse({
        ...base,
        tipo: "revision",
        anteriorId: id(11),
        cumplePauta: 2,
      }).success,
    ).toBe(true)
    expect(
      CrearValoracionSchema.safeParse({ operacionId: id(20), corrigePublicacionId: id(10) })
        .success,
    ).toBe(true)
    expect(
      CrearValoracionSchema.safeParse({ ...base, tipo: "inicial", corporales: [] }).success,
    ).toBe(false)
    expect(
      CrearValoracionSchema.safeParse({ ...base, tipo: "inicial", operacionId: "x" }).success,
    ).toBe(false)
  })

  it("cambiar y publicar nombran el borrador y su revisión; cambiar no toca las definiciones", () => {
    const { definiciones, ...contenido } = documento()
    const cambio = { borradorId: id(40), revision: 3, fechaToma: "2026-09-24", contenido }
    expect(CambiarValoracionSchema.safeParse(cambio).success).toBe(true)
    expect(CambiarValoracionSchema.safeParse({ ...cambio, borradorId: undefined }).success).toBe(
      false,
    )
    expect(CambiarValoracionSchema.safeParse({ ...cambio, revision: undefined }).success).toBe(
      false,
    )
    expect(
      CambiarValoracionSchema.safeParse({ ...cambio, contenido: { ...contenido, definiciones } })
        .success,
    ).toBe(false)
    const publicar = {
      operacionId: id(21),
      borradorId: id(40),
      revision: 3,
      sustituyePublicacionId: null,
    }
    expect(PublicarValoracionSchema.safeParse(publicar).success).toBe(true)
    expect(PublicarValoracionSchema.safeParse({ ...publicar, borradorId: undefined }).success).toBe(
      false,
    )
  })

  it("una lectura de pliegue puede guardarse pendiente de adoptar valor, solo en pliegues", () => {
    const con = (corporales: DocumentoValoracion["corporales"]) =>
      DocumentoValoracionSchema.safeParse(documento({ corporales })).success
    expect(con([{ definicionId: pliegue.id, estado: "pendiente", lecturas: [11.8] }])).toBe(true)
    expect(con([{ definicionId: peso.id, estado: "pendiente", lecturas: [80] }])).toBe(false)
    expect(con([{ definicionId: pliegue.id, estado: "pendiente", lecturas: [0] }])).toBe(false)
    const publico = proyeccionPublica(
      DocumentoValoracionSchema.parse(
        documento({
          corporales: [{ definicionId: pliegue.id, estado: "pendiente", lecturas: [12] }],
        }),
      ),
    )
    expect(publico.corporales).toEqual([])
  })

  it("rechaza cero en magnitudes físicas y el ruido de coma flotante; admite cero en pruebas", () => {
    const con = (cambios: Partial<DocumentoValoracion>) =>
      DocumentoValoracionSchema.safeParse(documento(cambios)).success
    const peso0 = { definicionId: peso.id, estado: "registrado" as const }
    expect(con({ corporales: [{ ...peso0, valor: 0 }] })).toBe(false)
    expect(con({ corporales: [{ ...peso0, valor: 29.9 }] })).toBe(false)
    expect(con({ corporales: [{ ...peso0, valor: 12.340000000001 }] })).toBe(false)
    expect(con({ corporales: [{ ...peso0, valor: 80.15 }] })).toBe(true)
    expect(
      con({ corporales: [{ definicionId: pliegue.id, estado: "registrado", valor: 0 }] }),
    ).toBe(false)
    expect(
      con({
        grasaPorPliegues: { valorPct: 0, metodo: "Método del entrenador", fecha: "2026-09-24" },
      }),
    ).toBe(false)
    // El documento base registra 0 flexiones: un cero real en una prueba.
    expect(con({})).toBe(true)
  })

  it("una métrica obligatoria llamada como una propiedad heredada no se da por registrada", () => {
    const rara: DefinicionPrueba = {
      ...cooper,
      id: id(5),
      tipo: "personalizada",
      metricas: [
        {
          clave: "constructor",
          nombre: "Resultado",
          unidad: "puntos",
          principal: true,
          opcional: false,
        },
      ],
    }
    const doc = documento({
      definiciones: { corporales: [peso, pliegue], pruebas: [rara] },
      pruebas: [
        {
          definicionId: rara.id,
          estado: "registrado",
          valores: {},
          protocoloCompleto: true,
          fecha: null,
          notas: null,
        },
      ],
    })
    expect(DocumentoValoracionSchema.safeParse(doc).success).toBe(false)
  })

  it("reordenar métricas conserva la versión de la prueba", () => {
    const reordenada = { ...cooper, metricas: [...cooper.metricas].reverse() }
    expect(versionarDefinicionPrueba(cooper, reordenada).version).toBe(1)
  })

  it("las notas de prueba y el motivo de un no realizado se publican; las internas no", () => {
    const doc = documento({
      pruebas: [
        {
          definicionId: flexiones.id,
          estado: "registrado",
          valores: { repeticiones: 20 },
          protocoloCompleto: false,
          fecha: null,
          notas: "Nota visible",
        },
        { definicionId: cooper.id, estado: "noRealizado", motivo: "Motivo visible" },
      ],
    })
    const publico = proyeccionPublica(DocumentoValoracionSchema.parse(doc))
    expect(publico.pruebas).toEqual(doc.pruebas)
    expect(JSON.stringify(publico)).not.toContain("Solo para el entrenador.")
  })

  it("las salidas públicas no admiten definiciones sin resultado ni pendientes", () => {
    const publico = proyeccionPublica(DocumentoValoracionSchema.parse(documento()))
    expect(
      DocumentoPublicoSchema.safeParse({
        ...publico,
        definiciones: { ...publico.definiciones, corporales: [peso, pliegue] },
      }).success,
    ).toBe(false)
    const publicacion = PublicacionValoracionSchema.parse({
      id: id(10),
      valoracionId: id(11),
      numero: 1,
      sustituyeId: null,
      tipo: "inicial",
      fechaToma: "2026-09-24",
      autor: { id: id(12), nombre: "Entrenador" },
      publicadaEn: "2026-09-24T10:00:00.000Z",
      documento: publico,
    })
    const corporal = proyeccionCorporal(publicacion)
    expect(
      ValoracionCorporalSchema.safeParse({
        ...corporal,
        corporales: [{ definicionId: peso.id, estado: "pendiente" }],
      }).success,
    ).toBe(false)
    expect(
      ValoracionCorporalSchema.safeParse({ ...corporal, definiciones: [peso, pliegue] }).success,
    ).toBe(false)
  })

  it("el historial del cliente no lleva estado de trabajo ni visitas sin publicar", () => {
    const fila = {
      id: id(11),
      tipo: "inicial",
      fechaToma: "2026-09-24",
      publicadaEn: "2026-09-24T10:00:00.000Z",
      numeroPublicacion: 2,
    }
    const valido = (valoraciones: unknown[]) =>
      ListadoValoracionesPublicadasSchema.safeParse({ valoraciones, total: valoraciones.length })
        .success
    expect(valido([fila])).toBe(true)
    expect(valido([{ ...fila, estado: "corrigiendo" }])).toBe(false)
    expect(valido([{ ...fila, publicadaEn: null }])).toBe(false)
  })

  it("la plantilla rechaza definiciones repetidas y la próxima revisión admite «Sin programar»", () => {
    expect(
      GuardarPlantillaValoracionSchema.safeParse({
        revision: 0,
        corporales: [peso, { ...peso, nombre: "Otra" }],
        pruebas: [],
      }).success,
    ).toBe(false)
    expect(GuardarProximaRevisionSchema.safeParse({ revision: 0, pauta: null }).success).toBe(true)
    expect(
      ProximaRevisionSchema.safeParse({
        revision: 2,
        pauta: { fecha: "2026-10-24", intervaloSemanas: null, bloques: ["medidas"] },
        cumplidaPorId: id(11),
        actualizadaEn: "2026-09-24T10:00:00.000Z",
      }).success,
    ).toBe(true)
    expect(
      GuardarProximaRevisionSchema.safeParse({
        revision: 0,
        pauta: { fecha: "2026-10-24", intervaloSemanas: 4, bloques: ["medidas"] },
      }).success,
    ).toBe(false)
    expect(
      GuardarProximaRevisionSchema.safeParse({
        revision: 0,
        pauta: { fecha: null, intervaloSemanas: 6, bloques: ["medidas", "pruebas"] },
      }).success,
    ).toBe(true)
  })

  it("las cinco pruebas estándar son válidas y no hay una sexta", () => {
    expect(PRUEBAS_ESTANDAR).toEqual([
      "dominadas",
      "suspension",
      "flexiones1min",
      "sentadillas1min",
      "pressBanca1rm",
      "cooper",
    ])
    for (const tipo of PRUEBAS_ESTANDAR)
      expect(DefinicionPruebaSchema.safeParse(crearPruebaEstandar(tipo, id(60))).success).toBe(true)
    const dominadas = crearPruebaEstandar("dominadas", id(61), "Agarre prono")
    const suspension = crearPruebaEstandar("suspension", id(62))
    expect(dominadas.metricas[0]).toMatchObject({ unidad: "reps", principal: true })
    expect(suspension.metricas[0]).toMatchObject({ unidad: "s", principal: true })
    expect(crearPruebaEstandar("flexiones1min", id(63)).duracionPrescritaS).toBe(60)
    expect(crearPruebaEstandar("sentadillas1min", id(64)).duracionPrescritaS).toBe(60)
    expect(crearPruebaEstandar("pressBanca1rm", id(65)).metricas).toEqual([
      expect.objectContaining({ clave: "carga", unidad: "kg" }),
    ])
  })

  it("cada tipo estándar conserva su unidad y su duración; la personalizada es libre", () => {
    const valida = (d: DefinicionPrueba) => DefinicionPruebaSchema.safeParse(d).success
    const dominadas = crearPruebaEstandar("dominadas", id(66))
    expect(valida({ ...dominadas, metricas: [{ ...dominadas.metricas[0]!, unidad: "s" }] })).toBe(
      false,
    )
    expect(
      valida({ ...crearPruebaEstandar("flexiones1min", id(67)), duracionPrescritaS: 30 }),
    ).toBe(false)
    expect(
      valida({
        ...cooper,
        metricas: cooper.metricas.filter((m) => m.clave !== "duracion"),
      }),
    ).toBe(false)
    expect(
      valida({
        ...crearPruebaEstandar("dominadas", id(68)),
        tipo: "personalizada",
        nombre: "Salto vertical",
        metricas: [
          { clave: "altura", nombre: "Altura", unidad: "cm", principal: true, opcional: false },
        ],
      }),
    ).toBe(true)
  })

  it("variante o duración distintas son otra versión, y otra serie", () => {
    const dominadas = crearPruebaEstandar("dominadas", id(69), "Agarre prono")
    expect(
      versionarDefinicionPrueba(dominadas, { ...dominadas, variante: "Agarre supino" }).version,
    ).toBe(2)
    expect(versionarDefinicionPrueba(cooper, { ...cooper, variante: "Pista" }).version).toBe(2)
  })

  it("valida los resultados: enteros donde toca, FC opcional y recuperación completa", () => {
    expect(problemasDeResultadoPrueba(cooper, { distancia: 2400, duracion: 720 })).toEqual([])
    expect(
      problemasDeResultadoPrueba(cooper, { distancia: 2400, duracion: 720, fcRecuperacion: 110 }),
    ).toHaveLength(1)
    expect(
      problemasDeResultadoPrueba(cooper, {
        distancia: 2400,
        duracion: 720,
        fcRecuperacion: 110,
        tiempoRecuperacion: 60,
      }),
    ).toEqual([])
    expect(
      problemasDeResultadoPrueba(cooper, { distancia: 2400, duracion: 720, fcMedia: 150.5 }),
    ).toHaveLength(1)
    const flexionesEstandar = crearPruebaEstandar("flexiones1min", id(70))
    expect(problemasDeResultadoPrueba(flexionesEstandar, { repeticiones: 0 })).toEqual([])
    expect(problemasDeResultadoPrueba(flexionesEstandar, { repeticiones: 12.5 })).toHaveLength(1)
  })

  it("conserva los contratos anteriores y añade un conflicto de estado", () => {
    expect(
      RegistrarMedidaSchema.safeParse({
        operacionId: id(30),
        fecha: "2026-09-24",
        pesoKg: 80,
        cinturaCm: null,
        grasaPct: null,
        alturaCm: null,
      }).success,
    ).toBe(true)
    expect(
      ConfiguracionSeguimientoSchema.safeParse({
        revision: 0,
        indicadores: ["peso"],
        registrosSolicitados: [],
        objetivoPeso: null,
        pruebasPrescritas: [],
      }).success,
    ).toBe(true)
    expect(
      ErrorDeApiSchema.safeParse({
        statusCode: 409,
        codigo: "estado_incompatible",
        message: "La publicación ya no es la vigente",
      }).success,
    ).toBe(true)
  })
})
