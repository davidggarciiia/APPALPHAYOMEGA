import {
  calcularGrasaPorPliegues as calcular,
  PROTOCOLOS_GRASA_POR_PLIEGUES,
  type DefinicionCorporal,
  type EntradaCalculoGrasaPorPliegues,
  type ProtocoloGrasaPorPliegues,
  type ResultadoCorporal,
  type SexoCalculoPliegues,
} from "@alpha-omega/shared"

type Entrada = Omit<EntradaCalculoGrasaPorPliegues, "definiciones" | "corporales"> & {
  definiciones: DefinicionCorporal[]
  corporales: ResultadoCorporal[]
}

// Casos sintéticos y referencias con sustitución manual; no son datos de clientes.
const datos = (puntos: [string, number][]) => ({
  definiciones: puntos.map<DefinicionCorporal>(([nombre], indice) => ({
    id: `00000000-0000-4000-8000-${String(indice + 1).padStart(12, "0")}`,
    version: 1,
    bloque: "pliegues",
    magnitud: "pliegue",
    nombre,
    unidad: "mm",
    zona: null,
    lateralidad: "derecha",
    instrumento: "Plicómetro",
    protocolo: null,
    activa: true,
  })),
  corporales: puntos.map<ResultadoCorporal>(([, valor], indice) => ({
    definicionId: `00000000-0000-4000-8000-${String(indice + 1).padStart(12, "0")}`,
    estado: "registrado",
    valor,
    lecturas: [10, 12],
  })),
})
const hombre21 = (): Entrada => ({
  protocolo: "jacksonPollock3",
  sexo: "hombre",
  edad: 21,
  ...datos([
    ["Pectoral", 27],
    ["Abdominal", 45],
    ["Muslo anterior", 36],
  ]),
})
const siete = () =>
  datos([
    ["Pectoral", 20],
    ["Axilar media", 20],
    ["Tricipital", 20],
    ["Subescapular", 20],
    ["Abdominal", 20],
    ["Suprailíaco", 20],
    ["Muslo anterior", 20],
  ])
const cuatroDW = () =>
  datos([
    ["Bicipital", 25],
    ["Tricipital", 25],
    ["Subescapular", 25],
    ["Suprailíaco", 25],
  ])

describe("cálculo compartido de grasa por pliegues", () => {
  it("expone los cuatro protocolos para el selector", () => {
    expect(PROTOCOLOS_GRASA_POR_PLIEGUES.map((p) => p.id)).toEqual([
      "jacksonPollock3",
      "jacksonPollock7",
      "durninWomersley4",
      "faulkner4",
    ])
  })

  it("Jackson-Pollock 3 hombre de 21 años: Σ108, D1.0333534, Siri29.0229557478", () => {
    const entrada = hombre21()
    const copia = structuredClone(entrada)
    expect(calcular(entrada)).toMatchObject({
      ok: true,
      valorPct: 29.02,
      metodo: "Jackson-Pollock 3 · Siri",
      sumaMm: 108,
    })
    const resultado = calcular(entrada)
    if (!resultado.ok) throw new Error(resultado.problemas.join(" "))
    expect(resultado.densidad).toBeCloseTo(1.0333534, 10)
    expect(entrada).toEqual(copia)
  })

  it("Jackson-Pollock 3 mujer: Σ60, edad30, D1.0440221, Siri24.1278944191", () => {
    expect(
      calcular({
        protocolo: "jacksonPollock3",
        sexo: "mujer",
        edad: 30,
        ...datos([
          ["Tríceps", 20],
          ["Suprailíaco", 20],
          ["Muslo", 20],
        ]),
      }),
    ).toMatchObject({ ok: true, valorPct: 24.13, densidad: 1.0440221, sumaMm: 60 })
  })

  it.each([
    ["hombre", 21.27, 1.050351],
    ["mujer", 27.3, 1.0370854],
  ] as const)("Jackson-Pollock 7 %s: Σ140, edad40 y Siri", (sexo, valorPct, densidad) => {
    const resultado = calcular({ protocolo: "jacksonPollock7", sexo, edad: 40, ...siete() })
    expect(resultado).toMatchObject({
      ok: true,
      valorPct,
      sumaMm: 140,
      metodo: "Jackson-Pollock 7 · Siri",
    })
    if (!resultado.ok) throw new Error(resultado.problemas.join(" "))
    expect(resultado.densidad).toBeCloseTo(densidad, 10)
  })

  // Σ100 => log10(Σ)=2. Cada D se obtiene como c−2m, sin recalcular coeficientes en el test.
  it.each([
    ["hombre", 17, 1.036, 27.8],
    ["hombre", 19, 1.036, 27.8],
    ["hombre", 20, 1.0367, 27.48],
    ["hombre", 29, 1.0367, 27.48],
    ["hombre", 30, 1.0334, 29],
    ["hombre", 39, 1.0334, 29],
    ["hombre", 40, 1.022, 34.34],
    ["hombre", 49, 1.022, 34.34],
    ["hombre", 50, 1.0157, 37.35],
    ["hombre", 72, 1.0157, 37.35],
    ["mujer", 16, 1.0193, 35.63],
    ["mujer", 19, 1.0193, 35.63],
    ["mujer", 20, 1.0165, 36.97],
    ["mujer", 29, 1.0165, 36.97],
    ["mujer", 30, 1.0159, 37.25],
    ["mujer", 39, 1.0159, 37.25],
    ["mujer", 40, 1.0109, 39.66],
    ["mujer", 49, 1.0109, 39.66],
    ["mujer", 50, 1.0049, 42.59],
    ["mujer", 68, 1.0049, 42.59],
  ] as const)("Durnin-Womersley %s edad%i usa tabla y log10", (sexo, edad, densidad, valorPct) => {
    const resultado = calcular({ protocolo: "durninWomersley4", sexo, edad, ...cuatroDW() })
    expect(resultado).toMatchObject({
      ok: true,
      valorPct,
      sumaMm: 100,
      metodo: "Durnin-Womersley 4 · Siri",
    })
    if (!resultado.ok) throw new Error(resultado.problemas.join(" "))
    expect(resultado.densidad).toBeCloseTo(densidad, 10)
  })

  it("Faulkner 4: Σ100×0.153+5.783=21.083, sin densidad ni edad/sexo inferidos", () => {
    expect(
      calcular({
        protocolo: "faulkner4",
        ...datos([
          ["Tríceps", 25],
          ["Subescapular", 25],
          ["Suprailíaco", 25],
          ["Abdomen", 25],
        ]),
      }),
    ).toEqual({ ok: true, valorPct: 21.08, sumaMm: 100, densidad: null, metodo: "Faulkner 4" })
  })

  it("reconoce nombre o zona con tildes y no usa lecturas en vez del valor adoptado", () => {
    const entrada = hombre21()
    entrada.definiciones[0]!.nombre = "Pliegue pectoral (mm)"
    entrada.definiciones[1]!.nombre = "Punto 2"
    entrada.definiciones[1]!.zona = "Abdomen"
    entrada.definiciones[2]!.nombre = "Pliegue del muslo anterior derecho"
    expect(calcular(entrada)).toMatchObject({ ok: true, valorPct: 29.02 })
  })

  it("reconoce espacios exteriores y el prefijo «pliegue de la»", () => {
    const entrada = hombre21()
    entrada.definiciones[0]!.nombre = "  Pliegue del pectoral  "
    entrada.definiciones[1]!.nombre = "Pliegue de la abdominal"
    expect(calcular(entrada)).toMatchObject({ ok: true, valorPct: 29.02 })
  })

  it.each(["pendiente", "noRealizado"] as const)("un punto %s sigue faltando", (estado) => {
    const entrada = hombre21()
    entrada.corporales[0] =
      estado === "pendiente"
        ? { definicionId: entrada.definiciones[0]!.id, estado, lecturas: [27] }
        : { definicionId: entrada.definiciones[0]!.id, estado, motivo: null }
    expect(calcular(entrada)).toMatchObject({ ok: false, faltantes: ["pectoral"] })
    const resultado = calcular(entrada)
    if (resultado.ok) throw new Error("El cálculo debería pedir el punto pendiente")
    expect(resultado.problemas).toEqual(
      expect.arrayContaining([expect.stringMatching(/pectoral/i)]),
    )
  })

  it("no escoge entre dos campos del mismo punto aunque uno no esté registrado", () => {
    const entrada = hombre21()
    entrada.definiciones.push({ ...entrada.definiciones[0]!, id: "otro", lateralidad: "izquierda" })
    expect(calcular(entrada)).toMatchObject({ ok: false, ambiguos: ["pectoral"] })
    const resultado = calcular(entrada)
    if (resultado.ok) throw new Error("El cálculo debería rechazar puntos duplicados")
    expect(resultado.problemas).toEqual(
      expect.arrayContaining([expect.stringMatching(/varios|duplicad|ambigu/i)]),
    )
  })

  it("un nombre y una zona que señalan puntos distintos son ambiguos", () => {
    const entrada = hombre21()
    entrada.definiciones[0]!.zona = "Abdominal"
    expect(calcular(entrada)).toMatchObject({ ok: false })
    const resultado = calcular(entrada)
    if (resultado.ok) throw new Error("El cálculo debería rechazar puntos contradictorios")
    expect(resultado.problemas).toEqual(
      expect.arrayContaining([expect.stringMatching(/nombre.*zona/i)]),
    )
  })

  it("no escoge entre dos resultados del mismo campo", () => {
    const entrada = hombre21()
    entrada.corporales.push({ ...entrada.corporales[0]! })
    expect(calcular(entrada)).toMatchObject({ ok: false, ambiguos: ["pectoral"] })
  })

  it("no confunde supraespinal con suprailíaco", () => {
    const entrada: Entrada = {
      protocolo: "durninWomersley4",
      sexo: "hombre",
      edad: 21,
      ...cuatroDW(),
    }
    entrada.definiciones[3]!.nombre = "Supraespinal"
    expect(calcular(entrada)).toMatchObject({ ok: false, faltantes: ["suprailiaco"] })
  })

  it.each(["kg", "cm"] as const)("solo reconoce puntos de pliegue en mm, no %s", (unidad) => {
    const entrada = hombre21()
    entrada.definiciones[0]!.unidad = unidad
    expect(calcular(entrada)).toMatchObject({ ok: false, faltantes: ["pectoral"] })
  })

  it.each([0, -1, 100.01, NaN, Infinity])("rechaza un pliegue adoptado no válido: %s", (valor) => {
    const entrada = hombre21()
    entrada.corporales[0] = {
      definicionId: entrada.definiciones[0]!.id,
      estado: "registrado",
      valor,
    }
    expect(calcular(entrada)).toMatchObject({ ok: false })
    const resultado = calcular(entrada)
    if (resultado.ok) throw new Error("El cálculo debería rechazar los mm no válidos")
    expect(resultado.problemas).toEqual(expect.arrayContaining([expect.stringMatching(/mm/i)]))
  })

  it.each([undefined, null])("pide sexo sin inferirlo cuando llega %s", (sexo) => {
    const resultado = calcular({ ...hombre21(), sexo })
    if (resultado.ok) throw new Error("El cálculo debería pedir el sexo")
    expect(resultado.problemas).toEqual(expect.arrayContaining([expect.stringMatching(/sexo/i)]))
  })

  it.each([undefined, null, NaN, Infinity, 21.5, -1])(
    "rechaza edad incompleta/no válida %s",
    (edad) => {
      const resultado = calcular({ ...hombre21(), edad })
      if (resultado.ok) throw new Error("El cálculo debería pedir una edad válida")
      expect(resultado.problemas).toEqual(expect.arrayContaining([expect.stringMatching(/edad/i)]))
    },
  )

  it.each([
    ["jacksonPollock3", "hombre", 17],
    ["jacksonPollock3", "hombre", 62],
    ["jacksonPollock7", "mujer", 17],
    ["jacksonPollock7", "mujer", 56],
    ["durninWomersley4", "hombre", 16],
    ["durninWomersley4", "hombre", 73],
    ["durninWomersley4", "mujer", 15],
    ["durninWomersley4", "mujer", 69],
  ] as const)("rechaza edad fuera del estudio %s %s %i", (protocolo, sexo, edad) => {
    const resultado = calcular({ ...hombre21(), protocolo, sexo, edad })
    if (resultado.ok) throw new Error("El cálculo debería rechazar edades fuera del estudio")
    expect(resultado.problemas).toEqual(
      expect.arrayContaining([expect.stringMatching(/edad.*rango|rango.*edad/i)]),
    )
  })

  it("rechaza el tramo creciente de densidad del polinomio JP en vez de devolver un % engañoso", () => {
    expect(
      calcular({
        ...hombre21(),
        ...datos([
          ["Pectoral", 100],
          ["Abdominal", 100],
          ["Muslo", 100],
        ]),
      }),
    ).toMatchObject({ ok: false })
  })

  it("rechaza porcentajes no positivos sin recortar el resultado", () => {
    expect(
      calcular({
        ...hombre21(),
        ...datos([
          ["Pectoral", 1],
          ["Abdominal", 1],
          ["Muslo", 1],
        ]),
      }),
    ).toMatchObject({ ok: false })
  })

  it("rechaza protocolos no disponibles en tiempo de ejecución", () => {
    expect(
      calcular({ ...hombre21(), protocolo: "inventado" as ProtocoloGrasaPorPliegues }),
    ).toMatchObject({ ok: false })
  })

  it("rechaza sexo desconocido en tiempo de ejecución", () => {
    expect(calcular({ ...hombre21(), sexo: "otro" as SexoCalculoPliegues })).toMatchObject({
      ok: false,
    })
  })
})
