import { fireEvent, render, screen } from "@testing-library/react-native"
import { CONFIGURACION_SEGUIMIENTO_INICIAL, type DiaDeSeguimiento } from "@alpha-omega/shared"

import type { ApiEntrenamiento } from "../entrenamiento/api"
import { hoyAgenda } from "../entrenamiento/fechas"
import type { ApiSeguimiento } from "./api"
import { ProgresoCliente } from "./progreso"

jest.mock("expo-router", () => {
  const React = jest.requireActual<typeof import("react")>("react")
  return { useFocusEffect: (efecto: () => void) => React.useEffect(efecto, [efecto]) }
})
jest.mock("expo-crypto", () => ({ randomUUID: () => "10000000-0000-4000-8000-000000000001" }))

const entrenamiento = {
  plan: async () => ({ plan: null }),
  semana: async () => ({ sesiones: [], total: 0 }),
} as unknown as ApiEntrenamiento

function api(dias: DiaDeSeguimiento[] = []): ApiSeguimiento {
  return {
    configuracion: async () => ({ ...CONFIGURACION_SEGUIMIENTO_INICIAL, indicadores: ["peso"] }),
    dias: async () => ({ dias }),
    medidas: async () => ({ medidas: [], fechaNacimiento: null }),
    pruebas: async () => ({ pruebas: [] }),
    fuerza: async () => ({ ejercicios: [] }),
  } as unknown as ApiSeguimiento
}

const progreso = (seguimiento: ApiSeguimiento) => (
  <ProgresoCliente clienteId="cliente" seguimiento={seguimiento} entrenamiento={entrenamiento} />
)

it("el entrenador abre ejercicios con historial aunque Fuerza no esté activo y no duplica ese indicador", async () => {
  const seguimiento = api()
  seguimiento.fuerza = async () => ({
    ejercicios: [
      {
        ejercicioId: "press",
        nombre: "Press inclinado",
        puntos: [{ fecha: "2026-10-26", pesoKg: 60, repeticiones: 10, estimado: 80 }],
      },
    ],
  })
  const abrir = jest.fn()
  await render(
    <ProgresoCliente
      clienteId="cliente"
      seguimiento={seguimiento}
      entrenamiento={entrenamiento}
      modo="entrenador"
      abrirEjercicio={abrir}
    />,
  )
  await fireEvent.press(await screen.findByRole("button", { name: /^Press inclinado/ }))
  expect(abrir).toHaveBeenCalledWith("press")
  expect(screen.getByRole("tab", { name: "Peso" })).toBeOnTheScreen()
  expect(screen.queryByRole("tab", { name: "Fuerza" })).toBeNull()
})

it("muestra un esqueleto accesible mientras espera el seguimiento", async () => {
  const seguimiento = api()
  seguimiento.configuracion = () => new Promise(() => {})
  await render(progreso(seguimiento))
  expect(screen.getByRole("progressbar", { name: "Cargando progreso" })).toBeTruthy()
  expect(
    screen.getAllByTestId("esqueleto", { includeHiddenElements: true }).length,
  ).toBeGreaterThan(2)
  expect(screen.queryByText("Cargando tu progreso…")).toBeNull()
})

it("un único peso muestra la cifra y permite añadir una medida sin dibujar una gráfica", async () => {
  await render(
    progreso(
      api([
        {
          fecha: hoyAgenda(),
          pesoKg: 80.2,
          pasos: null,
          suenoMin: null,
          creatina: null,
          suplementos: [],
        },
      ]),
    ),
  )
  expect(await screen.findByText("80,2 kg")).toBeTruthy()
  expect(screen.queryByRole("image")).toBeNull()
  expect(screen.getByRole("button", { name: "Añadir medida" })).toBeTruthy()
})

it("sin registros conserva la cifra vacía y el acceso a añadir medidas", async () => {
  await render(progreso(api()))
  expect(await screen.findByText("— kg")).toBeTruthy()
  expect(screen.queryByRole("image")).toBeNull()
  expect(screen.getByRole("button", { name: "Añadir medida" })).toBeTruthy()
})

it("reintenta una carga fallida y sustituye el error por los indicadores", async () => {
  const seguimiento = api()
  seguimiento.dias = jest
    .fn()
    .mockRejectedValueOnce(new Error("sin red"))
    .mockResolvedValue({ dias: [] })
  await render(progreso(seguimiento))
  expect(await screen.findByText("No se pudo cargar tu progreso. Revisa la conexión.")).toBeTruthy()
  await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }))
  expect(await screen.findByRole("tab", { name: "Peso" })).toBeTruthy()
  expect(screen.queryByText("No se pudo cargar tu progreso. Revisa la conexión.")).toBeNull()
})

it("el indicador diario muestra su tendencia con los registros disponibles", async () => {
  const seguimiento = api([
    {
      fecha: "2026-10-01",
      pesoKg: null,
      pasos: 6000,
      suenoMin: 420,
      creatina: null,
      suplementos: [],
    },
    {
      fecha: "2026-10-02",
      pesoKg: null,
      pasos: 7000,
      suenoMin: 480,
      creatina: null,
      suplementos: [],
    },
  ])
  seguimiento.configuracion = async () => ({
    ...CONFIGURACION_SEGUIMIENTO_INICIAL,
    indicadores: ["pasos", "sueno"],
  })
  await render(progreso(seguimiento))
  expect(
    await screen.findByRole("image", { name: "Pasos por día. Último registro: 7.000 pasos." }),
  ).toBeTruthy()
  await fireEvent.press(screen.getByRole("tab", { name: "Sueño" }))
  expect(
    screen.getByRole("image", { name: "Sueño por día. Último registro: 8 h 00." }),
  ).toBeTruthy()
})
