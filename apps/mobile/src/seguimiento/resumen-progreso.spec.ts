import {
  CONFIGURACION_SEGUIMIENTO_INICIAL,
  type ConfiguracionSeguimiento,
  type Medida,
  type ProgresionFuerza,
  type SerieEvolucion,
} from "@alpha-omega/shared"
import { crearResumenProgreso } from "./resumen-progreso"

const configuracion: ConfiguracionSeguimiento = {
  ...CONFIGURACION_SEGUIMIENTO_INICIAL,
  indicadores: ["peso", "cintura", "fuerza"],
}
const medida = (
  id: string,
  fecha: string,
  pesoKg: number | null,
  cinturaCm: number | null,
  creadoEn = `${fecha}T10:00:00.000Z`,
): Medida => ({
  id,
  fecha,
  creadoEn,
  pesoKg,
  cinturaCm,
  grasaPct: null,
  alturaCm: null,
})
const punto = (fecha: string, pesoKg: number, repeticiones = 8) => ({
  fecha,
  pesoKg,
  repeticiones,
  estimado: pesoKg * (1 + repeticiones / 30),
})
const fuerza: ProgresionFuerza["ejercicios"] = [
  {
    ejercicioId: "press",
    nombre: "Press",
    puntos: [punto("2026-01-02", 80, 8), punto("2026-10-01", 95, 6)],
  },
]

const serieCorporal = (
  clave: string,
  metodo: string,
  unidad: string,
  puntos: SerieEvolucion["puntos"],
): SerieEvolucion => ({
  clave,
  nombre: "Grasa corporal",
  bloque: "bioimpedancia",
  origen: "valoracion",
  clasificada: true,
  metodo,
  unidad,
  puntos,
})
const puntoCorporal = (fecha: string, valor: number, valoracionId: string | null) => ({
  fecha,
  valor,
  valoracionId,
  publicacionId: valoracionId,
  corregido: false,
})

const pesoDiario = (puntos: SerieEvolucion["puntos"]): SerieEvolucion => ({
  clave: "h:dia:pesoKg",
  nombre: "Peso en ayunas",
  bloque: null,
  origen: "autorregistro",
  clasificada: false,
  metodo: null,
  unidad: "kg",
  puntos,
})

it("ordena las medidas por fecha, creación e id sin mezclar peso y cintura ni mutar entradas", () => {
  const medidas = [
    medida("c", "2026-02-01", 80, 90),
    medida("b", "2026-01-01", 90, null),
    medida("a", "2026-01-01", 100, 100),
  ]
  const resultado = crearResumenProgreso({ configuracion, medidas, fuerza: [] })
  expect(resultado).toMatchObject([
    {
      tipo: "peso",
      inicial: 100,
      actual: 80,
      diferencia: -20,
      unidad: "kg",
      fechaInicial: "2026-01-01",
      fechaActual: "2026-02-01",
      sentido: "neutral",
    },
    {
      tipo: "cintura",
      inicial: 100,
      actual: 90,
      diferencia: -10,
      unidad: "cm",
      sentido: "neutral",
    },
  ])
  expect(medidas.map((m) => m.id)).toEqual(["c", "b", "a"])
})

it("no muestra datos ni permite inferir valores de indicadores desactivados", () => {
  const resultado = crearResumenProgreso({
    configuracion: { ...configuracion, indicadores: ["cintura"] },
    medidas: [medida("a", "2026-01-01", 90, 100), medida("b", "2026-02-01", 80, 95)],
    fuerza,
  })
  expect(resultado.map((fila) => fila.tipo)).toEqual(["cintura"])
})

it("muestra un único dato sin inventar una diferencia", () => {
  expect(
    crearResumenProgreso({
      configuracion,
      medidas: [medida("a", "2026-01-01", 80, null)],
      fuerza: [],
    }),
  ).toMatchObject([
    {
      tipo: "peso",
      inicial: null,
      fechaInicial: null,
      actual: 80,
      diferencia: null,
      sentido: "neutral",
    },
  ])
})

it.each([
  ["bajar", 100, 90, "favorable"],
  ["bajar", 90, 100, "desfavorable"],
  ["subir", 80, 90, "favorable"],
  ["subir", 90, 80, "desfavorable"],
  ["mantener", 90, 80, "neutral"],
  ["bajar", 90, 90, "neutral"],
] as const)("interpreta el objetivo %s con %s → %s", (direccion, inicial, actual, sentido) => {
  const resultado = crearResumenProgreso({
    configuracion: { ...configuracion, objetivoPeso: { direccion, rangoKg: null } },
    medidas: [medida("a", "2026-01-01", inicial, null), medida("b", "2026-02-01", actual, null)],
    fuerza: [],
  })
  expect(resultado[0]).toMatchObject({ sentido, diferencia: actual - inicial })
})

it.each([
  [100, 95, "favorable"],
  [95, 100, "desfavorable"],
  [85, 85, "neutral"],
  [85, 86, "neutral"],
  [91, 79, "neutral"],
] as const)("compara la distancia al rango de peso %s → %s", (inicial, actual, sentido) => {
  const resultado = crearResumenProgreso({
    configuracion: {
      ...configuracion,
      objetivoPeso: { direccion: "mantener", rangoKg: { minimo: 80, maximo: 90 } },
    },
    medidas: [medida("a", "2026-01-01", inicial, null), medida("b", "2026-02-01", actual, null)],
    fuerza: [],
  })
  expect(resultado[0]).toMatchObject({ sentido })
})

it("muestra fuerza neutra con repeticiones y primer registro disponible, no el inicio absoluto", () => {
  expect(crearResumenProgreso({ configuracion, medidas: [], fuerza })).toMatchObject([
    {
      tipo: "fuerza",
      ejercicioId: "press",
      nombre: "Press",
      inicial: 80,
      actual: 95,
      diferencia: 15,
      unidad: "kg",
      repeticionesInicial: 8,
      repeticionesActual: 6,
      sentido: "neutral",
      origen: "primer registro disponible",
    },
  ])
})

it("compara el primer registro con la mejor marca disponible aunque la sesión más reciente sea inferior", () => {
  const ejercicios = [
    {
      ejercicioId: "press",
      nombre: "Press",
      puntos: [punto("2026-03-01", 70, 8), punto("2026-02-01", 80, 8), punto("2026-01-01", 60, 10)],
    },
  ]
  expect(crearResumenProgreso({ configuracion, medidas: [], fuerza: ejercicios })[0]).toMatchObject(
    {
      inicial: 60,
      fechaInicial: "2026-01-01",
      actual: 80,
      fechaActual: "2026-02-01",
      diferencia: 20,
      repeticionesInicial: 10,
      repeticionesActual: 8,
    },
  )
})

it("desempata marcas de la misma carga por repeticiones y conserva la primera de las idénticas", () => {
  const ejercicios = [
    {
      ejercicioId: "press",
      nombre: "Press",
      puntos: [
        punto("2026-01-01", 60, 8),
        punto("2026-02-01", 80, 6),
        punto("2026-03-01", 80, 9),
        punto("2026-04-01", 80, 9),
      ],
    },
  ]
  expect(crearResumenProgreso({ configuracion, medidas: [], fuerza: ejercicios })[0]).toMatchObject(
    {
      actual: 80,
      repeticionesActual: 9,
      fechaActual: "2026-03-01",
    },
  )
})

it("conserva las fracciones de kilo que admite el entrenamiento", () => {
  const ejercicios = [
    {
      ejercicioId: "press",
      nombre: "Press",
      puntos: [punto("2026-01-01", 12.25), punto("2026-02-01", 12.5)],
    },
  ]
  expect(crearResumenProgreso({ configuracion, medidas: [], fuerza: ejercicios })[0]).toMatchObject(
    {
      inicial: 12.25,
      actual: 12.5,
      diferencia: 0.25,
    },
  )
})

it("omite ejercicios sin puntos y limita las filas a cinco en orden estable", () => {
  const ejercicios = Array.from({ length: 6 }, (_, i) => ({
    ejercicioId: `e${i}`,
    nombre: `Ejercicio ${i}`,
    puntos: [punto("2026-01-01", 20 + i)],
  }))
  ejercicios.unshift({ ejercicioId: "vacio", nombre: "Vacío", puntos: [] })
  const resultado = crearResumenProgreso({
    configuracion,
    medidas: [medida("a", "2026-01-01", 80, 90)],
    fuerza: ejercicios,
  })
  expect(resultado.map((fila) => fila.tipo)).toEqual([
    "peso",
    "cintura",
    "fuerza",
    "fuerza",
    "fuerza",
  ])
  expect(resultado).toHaveLength(5)
  expect(resultado[2]).toMatchObject({ ejercicioId: "e0", inicial: null, diferencia: null })
})

it("compara composicion de la misma serie, metodo y unidad entre valoraciones ordenadas", () => {
  const bio = serieCorporal("bio:grasa", "Báscula A", "%", [
    puntoCorporal("2026-05-01", 22.25, "visita-b"),
    puntoCorporal("2026-01-01", 28.5, "visita-a"),
  ])
  const resultado = crearResumenProgreso({
    configuracion,
    medidas: [],
    fuerza: [],
    evolucion: [bio],
  })
  expect(resultado).toMatchObject([
    {
      tipo: "composicion",
      clave: "bio:grasa",
      nombre: "Grasa corporal",
      unidad: "%",
      metodo: "Báscula A",
      origen: "valoraciones",
      inicial: 28.5,
      actual: 22.25,
      diferencia: -6.25,
      fechaInicial: "2026-01-01",
      fechaActual: "2026-05-01",
      sentido: "neutral",
    },
  ])
  expect(bio.puntos.map((p) => p.fecha)).toEqual(["2026-05-01", "2026-01-01"])
})

it("nunca une series o métodos distintos ni trata un histórico no clasificado como valoración", () => {
  const una = serieCorporal("bio:a", "A", "%", [puntoCorporal("2026-01-01", 20, "visita-a")])
  const otra = serieCorporal("bio:b", "B", "%", [puntoCorporal("2026-02-01", 21, "visita-b")])
  const historico = {
    ...serieCorporal("historico", "A", "%", [
      puntoCorporal("2026-01-01", 20, "v1"),
      puntoCorporal("2026-02-01", 18, "v2"),
    ]),
    clasificada: false,
  }
  expect(
    crearResumenProgreso({
      configuracion,
      medidas: [],
      fuerza: [],
      evolucion: [una, otra, historico],
    }),
  ).toEqual([])
})

it("mantiene separadas series con nombres coincidentes, métodos y unidades diferentes", () => {
  const bio = serieCorporal("bio:a", "A", "%", [
    puntoCorporal("2026-01-01", 25, "v1"),
    puntoCorporal("2026-02-01", 20, "v2"),
  ])
  const otra = serieCorporal("bio:b", "B", "kg", [
    puntoCorporal("2026-01-01", 40, "v1"),
    puntoCorporal("2026-02-01", 42, "v2"),
  ])
  expect(
    crearResumenProgreso({ configuracion, medidas: [], fuerza: [], evolucion: [bio, otra] }),
  ).toMatchObject([
    { tipo: "composicion", clave: "bio:a", metodo: "A", unidad: "%", diferencia: -5 },
    { tipo: "composicion", clave: "bio:b", metodo: "B", unidad: "kg", diferencia: 2 },
  ])
})

it("solo compara dos valoraciones distintas de la misma serie", () => {
  const repetida = serieCorporal("bio:duplicada", "A", "%", [
    puntoCorporal("2026-01-01", 20, "visita-a"),
    puntoCorporal("2026-01-02", 18, "visita-a"),
    puntoCorporal("2026-01-03", 17, null),
  ])
  expect(
    crearResumenProgreso({ configuracion, medidas: [], fuerza: [], evolucion: [repetida] }),
  ).toEqual([])
})

it("incluye composición y fuerza dentro del máximo de cinco aunque haya muchos ejercicios", () => {
  const bio = {
    ...serieCorporal("pliegues", "Jackson", "%", [
      puntoCorporal("2026-01-01", 24, "v1"),
      puntoCorporal("2026-02-01", 20, "v2"),
    ]),
    bloque: "pliegues" as const,
  }
  const ejercicios = Array.from({ length: 8 }, (_, i) => ({
    ejercicioId: `e${i}`,
    nombre: `Ejercicio ${i}`,
    puntos: [punto("2026-01-01", 20 + i)],
  }))
  const resultado = crearResumenProgreso({
    configuracion,
    medidas: [medida("a", "2026-01-01", 80, 90)],
    fuerza: ejercicios,
    evolucion: [bio],
  })
  expect(resultado).toHaveLength(5)
  expect(resultado.map((fila) => fila.tipo)).toEqual([
    "peso",
    "cintura",
    "fuerza",
    "composicion",
    "fuerza",
  ])
})

it("usa el histórico diario completo si no hay medidas de peso y conserva su origen", () => {
  const diario = pesoDiario([
    puntoCorporal("2026-10-01", 78.2, null),
    puntoCorporal("2025-01-01", 92.5, null),
  ])
  const resultado = crearResumenProgreso({
    configuracion: { ...configuracion, objetivoPeso: { direccion: "bajar", rangoKg: null } },
    medidas: [medida("cintura", "2025-05-01", null, 90)],
    fuerza: [],
    evolucion: [diario],
  })
  expect(resultado).toMatchObject([
    {
      tipo: "peso",
      origen: "registro diario",
      inicial: 92.5,
      fechaInicial: "2025-01-01",
      actual: 78.2,
      fechaActual: "2026-10-01",
      diferencia: -14.3,
      unidad: "kg",
      sentido: "favorable",
    },
    { tipo: "cintura", actual: 90 },
  ])
  expect(diario.puntos.map((p) => p.fecha)).toEqual(["2026-10-01", "2025-01-01"])
})

it("no mezcla el peso de medidas con el diario aunque el diario sea más reciente", () => {
  const diario = pesoDiario([puntoCorporal("2026-12-01", 70, null)])
  const resultado = crearResumenProgreso({
    configuracion,
    medidas: [medida("a", "2026-01-01", 90, null), medida("b", "2026-02-01", 85, null)],
    fuerza: [],
    evolucion: [diario],
  })
  expect(resultado).toMatchObject([
    {
      tipo: "peso",
      origen: "medidas",
      inicial: 90,
      actual: 85,
      fechaActual: "2026-02-01",
      diferencia: -5,
    },
  ])
})

it("no usa datos diarios de otra unidad, otro origen o con peso desactivado", () => {
  const serie = pesoDiario([puntoCorporal("2026-01-01", 80, null)])
  expect(
    crearResumenProgreso({
      configuracion,
      medidas: [],
      fuerza: [],
      evolucion: [{ ...serie, unidad: "lb" }],
    }),
  ).toEqual([])
  expect(
    crearResumenProgreso({
      configuracion,
      medidas: [],
      fuerza: [],
      evolucion: [{ ...serie, origen: "historico" }],
    }),
  ).toEqual([])
  expect(
    crearResumenProgreso({
      configuracion: { ...configuracion, indicadores: [] },
      medidas: [],
      fuerza: [],
      evolucion: [serie],
    }),
  ).toEqual([])
})
