import { fireEvent, render, screen } from "@testing-library/react-native"
import {
  CONFIGURACION_SEGUIMIENTO_INICIAL,
  type ConfiguracionSeguimiento,
  type SerieEvolucion,
} from "@alpha-omega/shared"
import { tema } from "../tema"
import type { ApiSeguimiento } from "./api"
import type { ApiEvolucionAvisos, ApiValoracionesCliente } from "./valoraciones-api"
import { ProgresoRedisenado } from "./progreso-redisenado"

jest.mock("expo-router", () => {
  const React = jest.requireActual<typeof import("react")>("react")
  return { useFocusEffect: (efecto: () => void) => React.useEffect(efecto, [efecto]) }
})

function seguimiento(
  indicadores: ConfiguracionSeguimiento["indicadores"] = ["peso", "cintura"],
): ApiSeguimiento {
  return {
    configuracion: async () => ({ ...CONFIGURACION_SEGUIMIENTO_INICIAL, indicadores }),
    dias: async () => ({ dias: [] }),
    medidas: async () => ({
      fechaNacimiento: null,
      medidas: [
        {
          id: "legacy-1",
          fecha: "2026-01-10",
          pesoKg: 79,
          cinturaCm: 95,
          grasaPct: null,
          alturaCm: null,
          creadoEn: "2026-01-10T08:00:00.000Z",
        },
        {
          id: "legacy-2",
          fecha: "2026-03-10",
          pesoKg: 78,
          cinturaCm: 94,
          grasaPct: null,
          alturaCm: null,
          creadoEn: "2026-03-10T08:00:00.000Z",
        },
      ],
    }),
    fuerza: async () => ({ ejercicios: [] }),
    pruebas: async () => ({ pruebas: [] }),
  } as unknown as ApiSeguimiento
}

function serie(
  clave: string,
  nombre: string,
  valores: [string, number][],
  metodo = "Cinta métrica",
): SerieEvolucion {
  return {
    clave,
    nombre,
    unidad: "cm",
    bloque: "medidas",
    origen: "valoracion",
    metodo,
    clasificada: true,
    puntos: valores.map(([fecha, valor], indice) => ({
      fecha,
      valor,
      publicacionId: `10000000-0000-4000-8000-${String(indice + 1).padStart(12, "0")}`,
      valoracionId: `20000000-0000-4000-8000-${String(indice + 1).padStart(12, "0")}`,
      corregido: false,
    })),
  }
}

function valoraciones(
  series: SerieEvolucion[],
): ApiValoracionesCliente & Pick<ApiEvolucionAvisos, "evolucion"> {
  return {
    evolucion: async () => ({ series }),
    listarPublicadas: async () => ({ valoraciones: [], total: 0 }),
    leerPublicada: async () => {
      throw new Error("Esta prueba no abre una valoración individual")
    },
    proximaRevision: async () => ({
      revision: 0,
      pauta: null,
      cumplidaPorId: null,
      actualizadaEn: null,
    }),
  }
}

it("muestra Cadera y Brazo publicados con cambio neutro y conserva Peso legacy", async () => {
  const cadera = serie("c:cadera:1", "Cadera", [
    ["2026-01-10", 100],
    ["2026-04-10", 98],
  ])
  const brazo = serie("c:brazo:1", "Brazo", [
    ["2026-01-10", 38],
    ["2026-04-10", 39],
  ])
  await render(
    <ProgresoRedisenado
      clienteId="cliente"
      seguimiento={seguimiento()}
      valoraciones={valoraciones([
        cadera,
        brazo,
        { ...serie("c:peso:1", "Peso", [["2026-04-10", 120]]), unidad: "kg" },
        {
          ...cadera,
          clave: "historico",
          nombre: "Histórico sin método",
          origen: "historico",
          clasificada: false,
        },
      ])}
    />,
  )
  expect(
    await screen.findByRole("button", { name: /^Cadera, 100 a 98 cm, −2 cm/ }),
  ).toBeOnTheScreen()
  expect(screen.getByRole("button", { name: /^Brazo, 38 a 39 cm, \+1 cm/ })).toBeOnTheScreen()
  expect(screen.getByText("−2 cm")).toHaveStyle({ color: tema.textoSecundario })
  expect(screen.getAllByRole("button", { name: /^Peso,/ })).toHaveLength(1)
  expect(screen.getByRole("button", { name: /^Peso, 79 a 78 kg/ })).toBeOnTheScreen()
  expect(screen.queryByText("Histórico sin método")).toBeNull()
  await fireEvent.press(screen.getByRole("button", { name: /^Cadera,/ }))
  expect(screen.getByRole("header", { name: "Cadera · Cinta métrica" })).toBeOnTheScreen()
  expect(screen.getByText("2026-04-10: 98 cm")).toBeOnTheScreen()
})

it("no muestra medidas publicadas en cm cuando cintura está desactivada", async () => {
  await render(
    <ProgresoRedisenado
      clienteId="cliente"
      seguimiento={seguimiento(["peso"])}
      valoraciones={valoraciones([
        serie("c:cadera:1", "Cadera", [["2026-01-10", 100]]),
        serie("c:brazo:1", "Brazo", [["2026-01-10", 38]]),
      ])}
    />,
  )
  await screen.findByRole("button", { name: /^Peso,/ })
  expect(screen.queryByText("Cadera")).toBeNull()
  expect(screen.queryByText("Brazo")).toBeNull()
  expect(screen.queryByText("Cintura")).toBeNull()
})

it.each([
  { ultima: "2026-04-10", inicial: 110, actual: 108 },
  { ultima: "2026-03-10", inicial: 110, actual: 108 },
  { ultima: "2026-02-10", inicial: 95, actual: 94 },
])(
  "Cintura elige un origen completo por su última fecha: $ultima",
  async ({ ultima, inicial, actual }) => {
    await render(
      <ProgresoRedisenado
        clienteId="cliente"
        seguimiento={seguimiento()}
        valoraciones={valoraciones([
          serie("c:cintura:1", "Cintura", [
            ["2026-01-10", 110],
            [ultima, 108],
          ]),
        ])}
      />,
    )
    const filas = await screen.findAllByRole("button", { name: /^Cintura,/ })
    expect(filas).toHaveLength(1)
    expect(filas[0]!.props.accessibilityLabel).toMatch(
      new RegExp(`Cintura, ${inicial} a ${actual} cm`),
    )
  },
)

it("mantiene versiones y métodos distintos separados y visibles, sin inventar un cambio", async () => {
  await render(
    <ProgresoRedisenado
      clienteId="cliente"
      seguimiento={seguimiento()}
      valoraciones={valoraciones([
        serie(
          "c:cadera:1",
          "Cadera",
          [
            ["2026-01-10", 110],
            ["2026-02-10", 108],
          ],
          "Cinta A",
        ),
        serie("c:cadera:2", "Cadera", [["2026-04-10", 80]], "Cinta B"),
      ])}
    />,
  )
  expect(await screen.findByText("Cadera · Cinta A")).toBeOnTheScreen()
  expect(screen.getByText("Cadera · Cinta B")).toBeOnTheScreen()
  expect(
    screen.getByRole("button", { name: /^Cadera · Cinta A, 110 a 108 cm, −2 cm/ }),
  ).toBeOnTheScreen()
  const segunda = screen.getByRole("button", { name: /^Cadera · Cinta B, 80 cm/ })
  expect(segunda.props.accessibilityLabel).not.toMatch(/−30|110 a 80/)
  await fireEvent.press(segunda)
  expect(screen.getByRole("header", { name: "Cadera · Cinta B" })).toBeOnTheScreen()
  expect(screen.getByText("2026-04-10: 80 cm")).toBeOnTheScreen()
  expect(screen.queryByText("2026-01-10: 110 cm")).toBeNull()
})
