import { act, fireEvent, render, screen } from "@testing-library/react-native"
import type { ResumenUsuario } from "@alpha-omega/shared"

import { ErrorDePermiso } from "../lib/http"
import { cargarTrabajo, type TrabajoEntrenador } from "./cargar-trabajo"
import { InicioEntrenador } from "./inicio-entrenador"

jest.mock("expo-router", () => ({
  useFocusEffect: (efecto: () => void) => {
    jest.requireActual<typeof import("react")>("react").useEffect(efecto, [efecto])
  },
}))
jest.mock("./cargar-trabajo", () => ({
  ...jest.requireActual("./cargar-trabajo"),
  cargarTrabajo: jest.fn(),
}))

const pedir = jest.fn()
const abrir = jest.fn()
const cliente = { id: "a", nombre: "Ana", apellidos: "López" } as ResumenUsuario
const vacio: TrabajoEntrenador = {
  activos: { usuarios: [], total: 0 },
  pendientes: { usuarios: [], total: 0 },
  clientes: [],
}

beforeEach(() => jest.mocked(cargarTrabajo).mockResolvedValue(vacio))

it("muestra qué toca hoy y Todo al día al completar una consulta vacía", async () => {
  await render(<InicioEntrenador nombre="Carlos" pedir={pedir} abrir={abrir} />)
  expect(screen.getByRole("header", { name: "Hola, Carlos" })).toBeOnTheScreen()
  expect(screen.queryByText("Tu espacio de trabajo")).toBeNull()
  expect(screen.queryByRole("button", { name: "Mi perfil" })).toBeNull()
  expect(await screen.findByText("Todo al día")).toBeOnTheScreen()
  expect(screen.getByText(/Última sesión enviada/)).toBeOnTheScreen()
  expect(cargarTrabajo).toHaveBeenCalledWith(pedir, 0, 0)
})

it("abre revisión, Resumen de molestias, plan y activación desde sus filas", async () => {
  jest.mocked(cargarTrabajo).mockResolvedValue({
    activos: { usuarios: [cliente], total: 1 },
    pendientes: { usuarios: [{ ...cliente, id: "p", nombre: "Paz" }], total: 1 },
    clientes: [
      {
        cliente,
        sinPlan: true,
        sesion: {
          agenda: { id: "s" },
          prescripcion: { nombre: "Fuerza" },
          revisadaEn: null,
        } as never,
        molestias: [{ id: "m", zona: "hombro", intensidad: 5, nivel: "ambar" } as never],
        totalMolestias: 1,
      },
    ],
  })
  await render(<InicioEntrenador nombre="Carlos" pedir={pedir} abrir={abrir} />)
  for (const [nombre, ruta] of [
    [
      "Revisar Fuerza de Ana López",
      { pathname: "/entrenamiento/[id]", params: { id: "s", nombre: "Ana" } },
    ],
    [
      "Atender molestia de Ana López: Hombro, 5 de 10",
      { pathname: "/entrenador/cliente/[id]", params: { id: "a" } },
    ],
    [
      "Crear plan para Ana López",
      { pathname: "/entrenador/cliente/[id]/plan", params: { id: "a" } },
    ],
    ["Activar a Paz López", { pathname: "/cliente/[id]", params: { id: "p" } }],
  ] as const) {
    await fireEvent.press(await screen.findByRole("button", { name: nombre }))
    expect(abrir).toHaveBeenLastCalledWith(ruta)
  }
  expect(screen.queryByText("Todo al día")).toBeNull()
})

it("pagina clientes activos y activaciones con alcance visible sin declarar vacía toda la cartera", async () => {
  jest.mocked(cargarTrabajo).mockResolvedValue({
    activos: { usuarios: [cliente], total: 12 },
    pendientes: { usuarios: [], total: 9 },
    clientes: [],
  })
  await render(<InicioEntrenador nombre="Carlos" pedir={pedir} abrir={abrir} />)
  expect(await screen.findByText("Al día en esta página")).toBeOnTheScreen()
  expect(screen.getByText("Clientes activos · 1–1 de 12")).toBeOnTheScreen()
  expect(screen.queryByText("Todo al día")).toBeNull()
  await fireEvent.press(screen.getByRole("button", { name: "Siguientes clientes activos" }))
  expect(cargarTrabajo).toHaveBeenLastCalledWith(pedir, 4, 0)
  await fireEvent.press(screen.getByRole("button", { name: "Siguientes pendientes de activar" }))
  expect(cargarTrabajo).toHaveBeenLastCalledWith(pedir, 4, 8)
  await fireEvent.press(screen.getByRole("button", { name: "Clientes activos anteriores" }))
  expect(cargarTrabajo).toHaveBeenLastCalledWith(pedir, 0, 8)
})

it("muestra esqueletos y permite reintentar un fallo sin afirmar Todo al día", async () => {
  let rechazar!: (error: Error) => void
  jest.mocked(cargarTrabajo).mockReturnValueOnce(
    new Promise((_resolver, rechazo) => {
      rechazar = rechazo
    }),
  )
  await render(<InicioEntrenador nombre="Carlos" pedir={pedir} abrir={abrir} />)
  expect(screen.getByLabelText("Cargando tareas del entrenador")).toHaveProp("accessibilityState", {
    busy: true,
  })
  await act(async () => rechazar(new Error("Sin red")))
  expect(screen.getByRole("alert")).toBeOnTheScreen()
  expect(screen.queryByText("Todo al día")).toBeNull()
  await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }))
  expect(await screen.findByText("Todo al día")).toBeOnTheScreen()
})

it("un error de permiso no se presenta como una lista sin tareas", async () => {
  jest.mocked(cargarTrabajo).mockRejectedValueOnce(new ErrorDePermiso())
  await render(<InicioEntrenador nombre="Carlos" pedir={pedir} abrir={abrir} />)
  expect(await screen.findByRole("alert")).toHaveTextContent(/No tienes permiso/)
  expect(screen.queryByText("Todo al día")).toBeNull()
})
