import {
  DocumentoDietaSchema,
  type ListadoMedidas,
  type ValoracionCorporal,
} from "@alpha-omega/shared"
import { aplicarPauta, type Pauta } from "./calculo"
import { pautaDesde, textosIniciales } from "./pauta"

const id = (): string => "10000000-0000-4000-8000-000000000001"
const pauta: Pauta = {
  objetivo: { kcal: 3250, hidratosG: 366, proteinaG: 203, grasaG: 108 },
  margenKcal: 100,
  suplementos: [
    { nombre: "Creatina monohidrato", dosis: "2 g al día" },
    { nombre: "Magnesio", dosis: "200 mg al día" },
  ],
  registroComidas: false,
  pesoDiario: false,
  nota: "Anterior",
  calculo: {
    pesoKg: 70,
    alturaCm: 170,
    edad: 30,
    sexo: "hombre",
    grasaPct: null,
    factorActividad: 1.55,
    nota: "Según turnos",
  },
}

const valoracion: ValoracionCorporal = {
  id: "20000000-0000-4000-8000-000000000001",
  publicacionId: "30000000-0000-4000-8000-000000000001",
  numero: 1,
  tipo: "revision",
  fechaToma: "2026-10-20",
  publicadaEn: "2026-10-21T10:00:00.000Z",
  definiciones: (
    [
      ["peso", "kg", "medidas"],
      ["altura", "cm", "medidas"],
      ["grasa", "%", "bioimpedancia"],
    ] as const
  ).map(([magnitud, unidad, bloque], n) => ({
    id: `40000000-0000-4000-8000-00000000000${n + 1}`,
    version: 1,
    nombre: magnitud,
    magnitud,
    unidad,
    bloque,
    zona: null,
    lateralidad: null,
    instrumento: null,
    protocolo: null,
    activa: true,
  })),
  corporales: [82.5, 181, 22.4].map((valor, n) => ({
    definicionId: `40000000-0000-4000-8000-00000000000${n + 1}`,
    estado: "registrado",
    valor,
  })),
  grasaPorPliegues: null,
}

it("inicia el cálculo con peso, altura y porcentaje de la valoración publicada", () => {
  expect(textosIniciales(null, null, valoracion).textos).toEqual(
    expect.objectContaining({ peso: "82,5", altura: "181", grasa: "22,4" }),
  )
})

it("una publicación parcial no completa sus huecos con medidas antiguas", () => {
  const parcial = {
    ...valoracion,
    definiciones: valoracion.definiciones.slice(0, 1),
    corporales: valoracion.corporales.slice(0, 1),
  }
  const medidas: ListadoMedidas = {
    fechaNacimiento: "1996-01-01",
    medidas: [
      {
        id: id(),
        fecha: "2026-09-01",
        pesoKg: 90,
        alturaCm: 190,
        grasaPct: 30,
        cinturaCm: null,
        creadoEn: "2026-09-01T10:00:00.000Z",
      },
    ],
  }
  expect(textosIniciales(null, medidas, parcial).textos).toEqual(
    expect.objectContaining({ peso: "82,5", altura: "", grasa: "", edad: "30" }),
  )
})

it("conserva el cálculo guardado frente a otra valoración publicada", () => {
  const original = DocumentoDietaSchema.parse(aplicarPauta(null, pauta, id))
  const formulario = textosIniciales(original, null, valoracion)
  expect(pautaDesde(formulario)).toEqual(pauta)
})

it("la grasa por pliegues publicada puede iniciar el cálculo sin confundir kg con porcentaje", () => {
  const corporal = {
    ...valoracion,
    definiciones: valoracion.definiciones.map((d) =>
      d.magnitud === "grasa" ? { ...d, unidad: "kg" as const } : d,
    ),
    grasaPorPliegues: { valorPct: 19.5, metodo: "Método declarado", fecha: "2026-10-20" },
  }
  expect(textosIniciales(null, null, corporal).textos.grasa).toBe("19,5")
  expect(textosIniciales(null, null, { ...corporal, grasaPorPliegues: null }).textos.grasa).toBe("")
})

it.each(["1", "71", "dato"])("avisa de una grasa %s que no admite el cálculo de dieta", (grasa) => {
  const formulario = textosIniciales(aplicarPauta(null, pauta, id), null)
  formulario.textos.grasa = grasa
  expect(pautaDesde(formulario)).toBe("Escribe la grasa corporal (2–70 %) o deja el campo vacío.")
})

it("modificar solo la nota conserva los suplementos, sus dosis y la nota del cálculo", () => {
  const original = DocumentoDietaSchema.parse(aplicarPauta(null, pauta, id))
  const formulario = textosIniciales(original, null)
  formulario.nota = "Nueva nota"
  const cambio = pautaDesde(formulario)
  expect(typeof cambio).not.toBe("string")
  if (typeof cambio === "string") throw Error(cambio)
  expect(aplicarPauta(original, cambio, id)).toEqual({ ...original, nota: "Nueva nota" })
})

it("modificar solo la nota conserva toda la precisión del cálculo guardado", () => {
  const original = DocumentoDietaSchema.parse(
    aplicarPauta(
      null,
      {
        ...pauta,
        calculo: { ...pauta.calculo, pesoKg: 70.25, grasaPct: 20.25, factorActividad: 1.555 },
      },
      id,
    ),
  )
  const formulario = textosIniciales(original, null)
  formulario.nota = "Nueva nota"
  const cambio = pautaDesde(formulario)
  if (typeof cambio === "string") throw Error(cambio)
  expect(aplicarPauta(original, cambio, id)).toEqual({ ...original, nota: "Nueva nota" })
  formulario.textos.peso = "71,25"
  const otro = pautaDesde(formulario)
  if (typeof otro === "string") throw Error(otro)
  expect(otro.calculo).toEqual({ ...original.calculo, pesoKg: 71.25 })
})

it("una grasa guardada como nula se conserva aunque haya una medida reciente", () => {
  const original = DocumentoDietaSchema.parse(aplicarPauta(null, pauta, id))
  const medidas: ListadoMedidas = {
    fechaNacimiento: "1996-01-01",
    medidas: [
      {
        id: "20000000-0000-4000-8000-000000000001",
        fecha: "2026-10-01",
        pesoKg: 80,
        alturaCm: 180,
        grasaPct: 25,
        cinturaCm: null,
        creadoEn: "2026-10-01T12:00:00.000Z",
      },
    ],
  }
  const formulario = textosIniciales(original, medidas)
  expect(formulario.textos.grasa).toBe("")
  formulario.nota = "Nueva nota"
  const cambio = pautaDesde(formulario)
  if (typeof cambio === "string") throw Error(cambio)
  expect(cambio.calculo).toEqual(original.calculo)
  const sinCalculo = { ...original }
  delete sinCalculo.calculo
  expect(textosIniciales(sinCalculo, medidas).textos.grasa).toBe("25")
})

it.each([
  [825, "45", "25", "30"],
  [3250, "34,5", "35,5", "30"],
])(
  "reabrir una pauta válida de %s kcal mantiene un reparto que puede publicarse",
  (kcal, hidratos, proteina, grasas) => {
    const formulario = textosIniciales(aplicarPauta(null, pauta, id), null)
    formulario.textos = {
      ...formulario.textos,
      kcal: String(kcal),
      hidratos: String(hidratos),
      proteina: String(proteina),
      grasas: String(grasas),
    }
    const creada = pautaDesde(formulario)
    if (typeof creada === "string") throw Error(creada)
    const reabierta = textosIniciales(
      DocumentoDietaSchema.parse(aplicarPauta(null, creada, id)),
      null,
    )
    const otraVez = pautaDesde(reabierta)
    expect(typeof otraVez).not.toBe("string")
    if (typeof otraVez !== "string") expect(otraVez.objetivo).toEqual(creada.objetivo)
    expect(
      Number(reabierta.textos.hidratos) +
        Number(reabierta.textos.proteina) +
        Number(reabierta.textos.grasas),
    ).toBe(100)
  },
)

it("avisa del límite en vez de descartar la indicación de peso diario", () => {
  const original = aplicarPauta(null, pauta, id)
  original.indicaciones = Array.from({ length: 10 }, (_, n) => ({
    titulo: `Pauta ${n}`,
    texto: "Conservar",
  }))
  const formulario = textosIniciales(original, null)
  formulario.pesoDiario = true
  expect(pautaDesde(formulario)).toEqual(expect.stringMatching(/diez|10/i))
  expect(() => aplicarPauta(original, { ...pauta, pesoDiario: true }, id)).toThrow(/diez|10/i)
  expect(original.indicaciones).toHaveLength(10)
})
