import * as contratos from "@alpha-omega/shared"

const uuid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`

const sinNumeros = { kcal: null, proteinaG: null, hidratosG: null, grasaG: null }

function dietaCompleta(): contratos.DocumentoDieta {
  const entreno = uuid(1)
  const descanso = uuid(2)
  return {
    formato: 1,
    nombre: "Plan de octubre",
    tiposDeDia: [
      {
        id: entreno,
        nombre: "Entreno",
        objetivo: { kcal: 2300, proteinaG: 160, hidratosG: 250, grasaG: 70 },
        comidas: [
          {
            forma: "alternativas",
            id: uuid(10),
            nombre: "Desayuno",
            hora: "08:00",
            indicacion: "Elige una de estas alternativas.",
            grupos: [
              {
                nombre: "Opciones dulces",
                alternativas: [
                  {
                    id: uuid(20),
                    titulo: "Tostadas con fruta",
                    alimentos: [
                      { nombre: "Pan integral", cantidad: "60 g" },
                      { nombre: "Pieza de fruta", cantidad: null },
                    ],
                    nota: null,
                    macros: null,
                  },
                ],
              },
              {
                nombre: null,
                alternativas: [
                  {
                    id: uuid(21),
                    titulo: "Batido de avena",
                    alimentos: [{ nombre: "Leche", cantidad: "al gusto" }],
                    nota: "Sin azúcar añadido.",
                    macros: { ...sinNumeros, kcal: 450 },
                  },
                ],
              },
            ],
          },
          {
            forma: "intercambio",
            id: uuid(11),
            nombre: "Comida",
            hora: null,
            indicacion: null,
            columnas: [
              { nombre: "Hidratos de carbono", alimentos: [{ nombre: "Arroz", cantidad: "60 g" }] },
              { nombre: "Proteína", alimentos: [{ nombre: "Pollo", cantidad: "150 g" }] },
            ],
          },
        ],
      },
      { id: descanso, nombre: "Descanso", objetivo: { ...sinNumeros, kcal: 2100 }, comidas: [] },
    ],
    semana: [entreno, descanso, entreno, descanso, entreno, descanso, descanso],
    indicaciones: [{ titulo: "Cómo seguir el plan", texto: "Pesa los alimentos en crudo." }],
  }
}

function soloObjetivos(): contratos.DocumentoDieta {
  const todos = uuid(3)
  return {
    formato: 1,
    nombre: "Objetivos diarios",
    tiposDeDia: [
      {
        id: todos,
        nombre: "Todos los días",
        objetivo: { kcal: 2100, proteinaG: 150, hidratosG: null, grasaG: null },
        comidas: [],
      },
    ],
    semana: Array.from({ length: 7 }, () => todos),
    indicaciones: [],
  }
}

describe("Contrato del documento de dieta", () => {
  it("acepta una dieta completa y conserva las cantidades escritas a mano", () => {
    const leida = contratos.DocumentoDietaSchema.parse(dietaCompleta())
    const desayuno = leida.tiposDeDia[0]?.comidas[0]
    expect(desayuno?.forma).toBe("alternativas")
    if (desayuno?.forma !== "alternativas") throw new Error("forma inesperada")
    expect(desayuno.grupos[0]?.alternativas[0]?.alimentos).toEqual([
      { nombre: "Pan integral", cantidad: "60 g" },
      { nombre: "Pieza de fruta", cantidad: null },
    ])
    expect(desayuno.grupos[1]?.alternativas[0]?.alimentos[0]?.cantidad).toBe("al gusto")
  })

  it("acepta una dieta solo de objetivos, sin comidas", () => {
    expect(contratos.DocumentoDietaSchema.safeParse(soloObjetivos()).success).toBe(true)
  })

  it("rechaza un tipo de día sin comidas y sin ningún número", () => {
    const dieta = soloObjetivos()
    dieta.tiposDeDia[0]!.objetivo = sinNumeros
    expect(contratos.DocumentoDietaSchema.safeParse(dieta).success).toBe(false)
    dieta.tiposDeDia[0]!.objetivo = null
    expect(contratos.DocumentoDietaSchema.safeParse(dieta).success).toBe(false)
  })

  it("rechaza una semana que no tiene siete días o apunta a un tipo inexistente", () => {
    const corta = dietaCompleta()
    corta.semana = corta.semana.slice(0, 6)
    expect(contratos.DocumentoDietaSchema.safeParse(corta).success).toBe(false)
    const huerfana = dietaCompleta()
    huerfana.semana[6] = uuid(99)
    expect(contratos.DocumentoDietaSchema.safeParse(huerfana).success).toBe(false)
  })

  it("rechaza identificadores repetidos entre tipos, comidas o alternativas", () => {
    const dieta = dietaCompleta()
    const comidas = dieta.tiposDeDia[0]!.comidas
    comidas[1] = { ...comidas[1]!, id: comidas[0]!.id }
    expect(contratos.DocumentoDietaSchema.safeParse(dieta).success).toBe(false)
  })

  it("rechaza campos desconocidos, números negativos y cifras por encima del límite", () => {
    expect(
      contratos.DocumentoDietaSchema.safeParse({ ...dietaCompleta(), clienteId: uuid(5) }).success,
    ).toBe(false)
    const negativa = soloObjetivos()
    negativa.tiposDeDia[0]!.objetivo = { ...sinNumeros, kcal: -1 }
    expect(contratos.DocumentoDietaSchema.safeParse(negativa).success).toBe(false)
    const enorme = soloObjetivos()
    enorme.tiposDeDia[0]!.objetivo = { ...sinNumeros, proteinaG: 2001 }
    expect(contratos.DocumentoDietaSchema.safeParse(enorme).success).toBe(false)
  })

  it("rechaza horas mal escritas y más de veinte alternativas en una comida", () => {
    const hora = dietaCompleta()
    const desayuno = hora.tiposDeDia[0]!.comidas[0]!
    hora.tiposDeDia[0]!.comidas[0] = { ...desayuno, hora: "25:00" }
    expect(contratos.DocumentoDietaSchema.safeParse(hora).success).toBe(false)

    const muchas = dietaCompleta()
    const primera = muchas.tiposDeDia[0]!.comidas[0]!
    if (primera.forma !== "alternativas") throw new Error("forma inesperada")
    const base = primera.grupos[0]!.alternativas[0]!
    primera.grupos = [
      {
        nombre: null,
        alternativas: Array.from({ length: 11 }, (_, n) => ({ ...base, id: uuid(100 + n) })),
      },
      {
        nombre: null,
        alternativas: Array.from({ length: 10 }, (_, n) => ({ ...base, id: uuid(200 + n) })),
      },
    ]
    expect(contratos.DocumentoDietaSchema.safeParse(muchas).success).toBe(false)
  })
})

describe("Contratos de las operaciones de dieta", () => {
  it("valida guardar, publicar y descartar con revisión explícita", () => {
    expect(
      contratos.GuardarBorradorDietaSchema.safeParse({ revision: 0, documento: soloObjetivos() })
        .success,
    ).toBe(true)
    expect(
      contratos.PublicarDietaSchema.safeParse({ operacionId: uuid(7), revision: 2 }).success,
    ).toBe(true)
    expect(contratos.PublicarDietaSchema.safeParse({ revision: 2 }).success).toBe(false)
    expect(contratos.DescartarBorradorDietaSchema.safeParse({ revision: -1 }).success).toBe(false)
  })

  it("no expone al cliente quién publicó la dieta", () => {
    const publicada = {
      id: uuid(8),
      clienteId: uuid(9),
      documento: soloObjetivos(),
      publicadaEn: "2026-09-24T10:00:00.000Z",
    }
    expect(contratos.DietaPublicadaSchema.safeParse(publicada).success).toBe(true)
    expect(
      contratos.DietaPublicadaSchema.safeParse({ ...publicada, publicadaPorId: uuid(4) }).success,
    ).toBe(false)
  })
})
