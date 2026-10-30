import {
  CONFIGURACION_SEGUIMIENTO_INICIAL,
  type MedioFoto,
  type SerieEvolucion,
} from "@alpha-omega/shared"

import {
  antesYAhora,
  diferencia,
  lineasDeEvolucion,
  lineasDeFuerza,
  seccionDe,
} from "./mi-progreso-modelo"

const configuracion = CONFIGURACION_SEGUIMIENTO_INICIAL

function serie(
  clave: string,
  nombre: string,
  unidad: string,
  valores: Array<[string, number]>,
  extra: Partial<SerieEvolucion> = {},
): SerieEvolucion {
  return {
    clave,
    nombre,
    unidad,
    bloque: null,
    origen: "valoracion",
    metodo: null,
    clasificada: true,
    puntos: valores.map(([fecha, valor]) => ({
      fecha,
      valor,
      publicacionId: null,
      valoracionId: null,
      corregido: false,
    })),
    ...extra,
  }
}

describe("seccionDe", () => {
  it("reparte bloques de visita e histórico, y deja fuera altura y fotos", () => {
    expect(seccionDe({ clave: "c:a:1", bloque: "medidas" })).toBe("medidas")
    expect(seccionDe({ clave: "c:a:1", bloque: "bioimpedancia" })).toBe("composicion")
    expect(seccionDe({ clave: "g:pliegues:jp3", bloque: "pliegues" })).toBe("composicion")
    expect(seccionDe({ clave: "p:a:1:m", bloque: "pruebas" })).toBe("pruebas")
    expect(seccionDe({ clave: "c:a:1", bloque: "fotos" })).toBeNull()
    expect(seccionDe({ clave: "h:dia:pesoKg", bloque: null })).toBe("medidas")
    expect(seccionDe({ clave: "h:medida:cinturaCm:autorregistro", bloque: null })).toBe("medidas")
    expect(seccionDe({ clave: "h:medida:grasaPct:historico", bloque: null })).toBe("composicion")
    expect(seccionDe({ clave: "h:medida:alturaCm:historico", bloque: null })).toBeNull()
    expect(seccionDe({ clave: "h:prueba:x:s:autorregistro", bloque: null })).toBe("pruebas")
    expect(seccionDe({ clave: "h:prueba-libre:Salto|cm:historico", bloque: null })).toBe("pruebas")
  })
})

describe("lineasDeEvolucion", () => {
  it("compara el primer y el último dato de una misma serie, ordenando por fecha", () => {
    const [linea] = lineasDeEvolucion(
      [
        serie("h:dia:pesoKg", "Peso en ayunas", "kg", [
          ["2026-10-20", 104.2],
          ["2026-09-01", 111.6],
          ["2026-09-20", 108],
        ]),
      ],
      configuracion,
    )
    expect(linea).toMatchObject({
      seccion: "medidas",
      inicio: { fecha: "2026-09-01", valor: 111.6 },
      actual: { fecha: "2026-10-20", valor: 104.2 },
      cambio: -7.4,
      sentido: "neutral",
    })
  })

  it("con un solo dato no hay cambio", () => {
    const [linea] = lineasDeEvolucion(
      [serie("c:cad:1", "Cadera", "cm", [["2026-10-01", 101]], { bloque: "medidas" })],
      configuracion,
    )
    expect(linea!.cambio).toBeNull()
  })

  it("el signo del peso solo se juzga con un objetivo pautado", () => {
    const peso = serie("h:dia:pesoKg", "Peso en ayunas", "kg", [
      ["2026-09-01", 90],
      ["2026-10-01", 88],
    ])
    const bajar = { ...configuracion, objetivoPeso: { direccion: "bajar" as const, rangoKg: null } }
    const subir = { ...configuracion, objetivoPeso: { direccion: "subir" as const, rangoKg: null } }
    expect(lineasDeEvolucion([peso], bajar)[0]!.sentido).toBe("favorable")
    expect(lineasDeEvolucion([peso], subir)[0]!.sentido).toBe("desfavorable")
    expect(lineasDeEvolucion([peso], configuracion)[0]!.sentido).toBe("neutral")
  })

  it("agrupa series del mismo nombre sin mezclarlas: la principal es la completa y más reciente", () => {
    const [linea] = lineasDeEvolucion(
      [
        serie("p:salto:1:cm:incompleto", "Salto", "cm", [["2026-10-10", 20]], {
          bloque: "pruebas",
        }),
        serie(
          "p:salto:1:cm",
          "Salto",
          "cm",
          [
            ["2026-08-01", 30],
            ["2026-10-01", 34],
          ],
          { bloque: "pruebas" },
        ),
        serie("h:prueba:salto:cm:autorregistro", "Salto", "cm", [["2026-09-01", 50]]),
      ],
      configuracion,
    )
    expect(linea!.inicio.valor).toBe(30)
    expect(linea!.actual.valor).toBe(34)
    expect(linea!.otras.map((s) => s.clave)).toEqual([
      "h:prueba:salto:cm:autorregistro",
      "p:salto:1:cm:incompleto",
    ])
  })

  it("respeta los indicadores que activó el entrenador", () => {
    const series = [
      serie("h:dia:pesoKg", "Peso en ayunas", "kg", [["2026-10-01", 80]]),
      serie("h:medida:cinturaCm:autorregistro", "Cintura", "cm", [["2026-10-01", 90]]),
      serie("p:salto:1:cm", "Salto", "cm", [["2026-10-01", 30]], { bloque: "pruebas" }),
      serie("c:brazo:1", "Brazo", "cm", [["2026-10-01", 35]], { bloque: "medidas" }),
    ]
    const nombres = (indicadores: ConfiguracionIndicadores) =>
      lineasDeEvolucion(series, { ...configuracion, indicadores }).map((l) => l.nombre)
    expect(nombres(["peso", "cintura", "pruebas"])).toEqual([
      "Peso en ayunas",
      "Cintura",
      "Brazo",
      "Salto",
    ])
    expect(nombres([])).toEqual(["Brazo"])
  })

  it("descarta series vacías, altura y fotos", () => {
    expect(
      lineasDeEvolucion(
        [
          serie("h:medida:alturaCm:historico", "Altura", "cm", [["2026-10-01", 180]]),
          serie("c:foto:1", "Frente", "foto", [["2026-10-01", 1]], { bloque: "fotos" }),
          serie("c:cad:1", "Cadera", "cm", [], { bloque: "medidas" }),
        ],
        configuracion,
      ),
    ).toEqual([])
  })
})

type ConfiguracionIndicadores = (typeof configuracion)["indicadores"]

describe("lineasDeFuerza", () => {
  it("ordena por lo último entrenado y mide la subida de la mejor serie", () => {
    const lineas = lineasDeFuerza([
      {
        ejercicioId: "a",
        nombre: "Sentadilla",
        puntos: [
          { fecha: "2026-10-01", pesoKg: 100, repeticiones: 5, estimado: 116 },
          { fecha: "2026-09-01", pesoKg: 90, repeticiones: 5, estimado: 105 },
        ],
      },
      {
        ejercicioId: "b",
        nombre: "Press banca",
        puntos: [{ fecha: "2026-10-05", pesoKg: 80, repeticiones: 8, estimado: 101 }],
      },
      { ejercicioId: "c", nombre: "Sin datos", puntos: [] },
    ])
    expect(lineas.map((l) => [l.nombre, l.cambio])).toEqual([
      ["Press banca", null],
      ["Sentadilla", 10],
    ])
  })
})

describe("antesYAhora", () => {
  const foto = (
    n: number,
    vista: MedioFoto["vista"],
    fechaToma: string,
    estado: MedioFoto["estado"] = "disponible",
  ): MedioFoto =>
    ({ id: `f${n}`, vista, fechaToma, estado, creadoEn: `${fechaToma}T09:00:00.000Z` }) as MedioFoto

  it("elige la primera y la última de frente aunque haya otras vistas", () => {
    const par = antesYAhora([
      foto(1, "espalda", "2026-08-01"),
      foto(2, "frente", "2026-10-20"),
      foto(3, "frente", "2026-08-03"),
      foto(4, "frente", "2026-09-10"),
      foto(5, "espalda", "2026-10-20"),
    ])
    expect([par?.antes.id, par?.ahora.id]).toEqual(["f3", "f2"])
  })

  it("si el frente no tiene dos fechas, usa otra vista; nunca mezcla vistas", () => {
    const par = antesYAhora([
      foto(1, "frente", "2026-08-01"),
      foto(2, "espalda", "2026-08-01"),
      foto(3, "espalda", "2026-10-01"),
    ])
    expect([par?.antes.id, par?.ahora.id]).toEqual(["f2", "f3"])
    expect(
      antesYAhora([foto(1, "frente", "2026-08-01"), foto(2, "espalda", "2026-10-01")]),
    ).toBeNull()
  })

  it("ignora fotos no disponibles y la vista «otra»", () => {
    expect(
      antesYAhora([
        foto(1, "frente", "2026-08-01"),
        foto(2, "frente", "2026-10-01", "eliminando"),
        foto(3, "otra", "2026-07-01"),
        foto(4, "otra", "2026-10-01"),
      ]),
    ).toBeNull()
  })
})

it("diferencia escribe signo, unidad legible y «Sin cambios»", () => {
  expect(diferencia(1.5, "kg")).toBe("+1,5 kg")
  expect(diferencia(-0.25, "indice")).toBe("−0,25 índice")
  expect(diferencia(0, "cm")).toBe("Sin cambios")
})
