import { render, screen } from "@testing-library/react-native"
import { CONFIGURACION_SEGUIMIENTO_INICIAL, type Medida } from "@alpha-omega/shared"

import type { ApiSeguimiento } from "./api"
import { ProgresoRedisenado } from "./progreso-redisenado"
import { hoyAgenda } from "../entrenamiento/fechas"

jest.mock("expo-router", () => {
  const React = jest.requireActual<typeof import("react")>("react")
  return { useFocusEffect: (efecto: () => void) => React.useEffect(efecto, [efecto]) }
})
jest.mock("expo-crypto", () => ({ randomUUID: () => "10000000-0000-4000-8000-000000000001" }))

const medidas: Medida[] = [
  {
    id: "40000000-0000-4000-8000-000000000001",
    fecha: "2026-01-10",
    pesoKg: 80,
    cinturaCm: 95,
    grasaPct: null,
    alturaCm: null,
    creadoEn: "2026-01-10T08:00:00.000Z",
  },
  {
    id: "40000000-0000-4000-8000-000000000002",
    fecha: "2026-09-15",
    pesoKg: 76,
    cinturaCm: 90,
    grasaPct: null,
    alturaCm: null,
    creadoEn: "2026-09-15T08:00:00.000Z",
  },
]

function seguimientoConDatos(
  indicadores: typeof CONFIGURACION_SEGUIMIENTO_INICIAL.indicadores,
): ApiSeguimiento {
  return {
    configuracion: async () => ({ ...CONFIGURACION_SEGUIMIENTO_INICIAL, indicadores }),
    dias: async () => ({ dias: [] }),
    medidas: async () => ({ medidas, fechaNacimiento: null }),
    pruebas: async () => ({
      pruebas: [
        {
          id: "50000000-0000-4000-8000-000000000001",
          pruebaId: null,
          fecha: "2026-09-15",
          nombre: "Plancha",
          valor: 60,
          unidad: "seg",
          creadoEn: "2026-09-15T08:00:00.000Z",
        },
      ],
    }),
    fuerza: async () => ({
      ejercicios: [
        {
          ejercicioId: "60000000-0000-4000-8000-000000000001",
          nombre: "Press inclinado",
          puntos: [{ fecha: "2026-09-15", pesoKg: 60, repeticiones: 10, estimado: 80 }],
        },
      ],
    }),
  } as unknown as ApiSeguimiento
}

it("muestra las secciones con datos en orden y sin pestañas para el cliente", async () => {
  await render(
    <ProgresoRedisenado
      clienteId="cliente"
      seguimiento={seguimientoConDatos(["peso", "cintura", "fuerza", "pruebas"])}
    />,
  )
  const medidas = await screen.findByRole("header", { name: /^medidas$/i })
  const fuerza = screen.getByRole("header", { name: /^fuerza$/i })
  const pruebas = screen.getByRole("header", { name: /^pruebas$/i })
  const cabeceras = screen.getAllByRole("header")
  expect(cabeceras.indexOf(medidas)).toBeLessThan(cabeceras.indexOf(fuerza))
  expect(cabeceras.indexOf(fuerza)).toBeLessThan(cabeceras.indexOf(pruebas))
  expect(screen.queryAllByRole("tab")).toHaveLength(0)
})

it("sin datos muestra el mensaje único de punto de partida", async () => {
  const seguimiento = seguimientoConDatos(["peso"])
  seguimiento.medidas = async () => ({ medidas: [], fechaNacimiento: null })
  seguimiento.pruebas = async () => ({ pruebas: [] })
  seguimiento.fuerza = async () => ({ ejercicios: [] })
  await render(<ProgresoRedisenado clienteId="cliente" seguimiento={seguimiento} />)
  expect(
    await screen.findByText(
      "Tu entrenador registrará tu punto de partida en la primera valoración",
    ),
  ).toBeOnTheScreen()
  expect(screen.queryAllByRole("tab")).toHaveLength(0)
})

it("oculta medidas e indicadores desactivados aunque existan registros", async () => {
  await render(
    <ProgresoRedisenado clienteId="cliente" seguimiento={seguimientoConDatos(["peso"])} />,
  )
  expect(await screen.findByRole("button", { name: /^Peso, 80 a 76 kg, −4 kg/ })).toBeOnTheScreen()
  expect(screen.queryByText(/cintura/i)).toBeNull()
  expect(screen.queryByText("Press inclinado")).toBeNull()
  expect(screen.queryByText("Plancha")).toBeNull()
})

it("no ofrece añadir medidas cuando solo están activos pasos y sueño", async () => {
  const seguimiento = seguimientoConDatos(["pasos", "sueno"])
  seguimiento.dias = async () => ({
    dias: [
      {
        fecha: hoyAgenda(),
        pesoKg: null,
        pasos: 8000,
        suenoMin: 420,
        creatina: null,
        suplementos: [],
      },
    ],
  })
  await render(<ProgresoRedisenado clienteId="cliente" seguimiento={seguimiento} />)
  expect(await screen.findByRole("header", { name: "Medidas" })).toBeOnTheScreen()
  expect(screen.getByText("Pasos")).toBeOnTheScreen()
  expect(screen.getByText("Sueño")).toBeOnTheScreen()
  expect(screen.queryByRole("button", { name: "Añadir medida" })).toBeNull()
})
