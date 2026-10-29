import { act, fireEvent, render, screen } from "@testing-library/react-native"
import type { ListadoEjercicios } from "@alpha-omega/shared"
import {
  catalogoEnMemoria,
  ejercicioDePrueba,
} from "../catalogo-ejercicios/pruebas/catalogo-en-memoria"
import { SelectorEjercicios } from "./selector-ejercicios"

const REMO = ejercicioDePrueba("10000000-0000-4000-8000-000000000001", "Remo", "espalda")
const PRESS = ejercicioDePrueba("10000000-0000-4000-8000-000000000002", "Press", "pecho")

function peticionPendiente() {
  let resolver!: (datos: ListadoEjercicios) => void
  let rechazar!: (error: Error) => void
  const promesa = new Promise<ListadoEjercicios>((resolve, reject) => {
    resolver = resolve
    rechazar = reject
  })
  return { promesa, resolver, rechazar }
}

async function avanzar(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms)
  })
}

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

it("conserva los ejercicios durante el debounce y la petición de una nueva búsqueda", async () => {
  const pendiente = peticionPendiente()
  const api = catalogoEnMemoria([REMO, PRESS])
  const buscar = jest.spyOn(api, "buscar")
  const elegir = jest.fn()
  await render(<SelectorEjercicios api={api} elegir={elegir} />)
  await avanzar(250)
  buscar.mockReturnValueOnce(pendiente.promesa)

  await fireEvent.changeText(screen.getByLabelText("Buscar ejercicio para añadir"), "p")
  await avanzar(200)
  await fireEvent.changeText(screen.getByLabelText("Buscar ejercicio para añadir"), "press")
  expect(screen.getByRole("button", { name: "Añadir Remo" })).toBeOnTheScreen()
  expect(screen.queryByText("Buscando ejercicios…")).toBeNull()
  await avanzar(249)
  expect(buscar).toHaveBeenCalledTimes(1)
  await avanzar(1)
  expect(buscar).toHaveBeenLastCalledWith({
    buscar: "press",
    estado: "publicado",
    limite: 10,
    desplazamiento: 0,
  })
  await fireEvent.press(screen.getByRole("button", { name: "Añadir Remo" }))
  expect(elegir).toHaveBeenCalledWith(REMO)

  await act(async () => pendiente.resolver({ ejercicios: [PRESS], total: 1 }))
  expect(screen.getByRole("button", { name: "Añadir Press" })).toBeOnTheScreen()
  expect(screen.queryByRole("button", { name: "Añadir Remo" })).toBeNull()
})

it("muestra la carga inicial y espera a la respuesta antes de anunciar una búsqueda vacía", async () => {
  const pendiente = peticionPendiente()
  const api = { ...catalogoEnMemoria(), buscar: jest.fn(() => pendiente.promesa) }
  await render(<SelectorEjercicios api={api} elegir={jest.fn()} />)
  expect(screen.getByText("Buscando ejercicios…")).toBeOnTheScreen()
  expect(screen.queryByText("No hay ejercicios publicados con esa búsqueda.")).toBeNull()
  await avanzar(250)
  expect(screen.getByText("Buscando ejercicios…")).toBeOnTheScreen()

  await act(async () => pendiente.resolver({ ejercicios: [], total: 0 }))
  expect(screen.queryByText("Buscando ejercicios…")).toBeNull()
  expect(screen.getByText("No hay ejercicios publicados con esa búsqueda.")).toBeOnTheScreen()
})

it("conserva la página anterior sin permitir saltarse otra mientras llega la siguiente", async () => {
  const pendiente = peticionPendiente()
  const api = catalogoEnMemoria([REMO], 30)
  const buscar = jest.spyOn(api, "buscar")
  await render(<SelectorEjercicios api={api} elegir={jest.fn()} />)
  await avanzar(250)
  buscar.mockReturnValueOnce(pendiente.promesa)

  await fireEvent.press(screen.getByRole("button", { name: "Más ejercicios" }))
  expect(screen.getByRole("button", { name: "Añadir Remo" })).toBeOnTheScreen()
  expect(screen.getByRole("button", { name: "Más ejercicios" })).toBeDisabled()
  expect(screen.getByRole("button", { name: "Ejercicios anteriores" })).toBeDisabled()
  await avanzar(250)
  await fireEvent.press(screen.getByRole("button", { name: "Más ejercicios" }))
  await avanzar(250)
  expect(buscar).toHaveBeenCalledTimes(2)
  expect(buscar).toHaveBeenLastCalledWith({
    buscar: "",
    estado: "publicado",
    limite: 10,
    desplazamiento: 10,
  })

  await act(async () => pendiente.resolver({ ejercicios: [PRESS], total: 30 }))
  expect(screen.getByRole("button", { name: "Añadir Press" })).toBeOnTheScreen()
  expect(screen.getByRole("button", { name: "Más ejercicios" })).toBeEnabled()
  expect(screen.getByRole("button", { name: "Ejercicios anteriores" })).toBeEnabled()
})

it.each(["respuesta", "error"] as const)(
  "ignora una %s antigua que llega después de la búsqueda más reciente",
  async (tipo) => {
    const antigua = peticionPendiente()
    const api = catalogoEnMemoria([PRESS])
    const buscar = jest.spyOn(api, "buscar").mockReturnValueOnce(antigua.promesa)
    await render(<SelectorEjercicios api={api} elegir={jest.fn()} />)
    await avanzar(250)
    await fireEvent.changeText(screen.getByLabelText("Buscar ejercicio para añadir"), "press")
    await avanzar(250)
    expect(buscar).toHaveBeenCalledTimes(2)
    expect(screen.getByRole("button", { name: "Añadir Press" })).toBeOnTheScreen()

    await act(async () => {
      if (tipo === "respuesta") antigua.resolver({ ejercicios: [REMO], total: 1 })
      else antigua.rechazar(new Error("Sin red"))
    })
    expect(screen.getByRole("button", { name: "Añadir Press" })).toBeOnTheScreen()
    expect(screen.queryByRole("button", { name: "Añadir Remo" })).toBeNull()
    expect(screen.queryByRole("alert")).toBeNull()
  },
)

it("permite reintentar una carga inicial fallida sin mostrar un catálogo vacío", async () => {
  const api = catalogoEnMemoria([REMO])
  jest.spyOn(api, "buscar").mockRejectedValueOnce(new Error("Sin red"))
  await render(<SelectorEjercicios api={api} elegir={jest.fn()} />)
  await avanzar(250)
  expect(screen.getByRole("alert")).toHaveTextContent("No se pudo cargar el catálogo.")
  expect(screen.queryByText("Buscando ejercicios…")).toBeNull()
  expect(screen.queryByText("No hay ejercicios publicados con esa búsqueda.")).toBeNull()

  await fireEvent.press(screen.getByRole("button", { name: "Reintentar catálogo" }))
  expect(screen.getByText("Buscando ejercicios…")).toBeOnTheScreen()
  await avanzar(250)
  expect(screen.getByRole("button", { name: "Añadir Remo" })).toBeOnTheScreen()
  expect(screen.queryByRole("alert")).toBeNull()
})
