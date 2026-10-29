import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import type { NovedadEntrenamiento } from "@alpha-omega/shared"
import type { ApiEntrenamiento } from "./api"
import { crearApiEntrenamiento } from "./api"
import type { PeticionAutenticada } from "../lib/peticion-autenticada"
import { NovedadesEntrenamiento } from "./novedades"

let mockFoco = 0
jest.mock("expo-router", () => ({
  useFocusEffect: (efecto: () => void) =>
    jest.requireActual<typeof import("react")>("react").useEffect(efecto, [efecto, mockFoco]),
}))

const novedad: NovedadEntrenamiento = {
  id: "10000000-0000-4000-8000-000000000000",
  sesionId: "20000000-0000-4000-8000-000000000000",
  clienteId: "30000000-0000-4000-8000-000000000000",
  tipo: "sesion_revisada" as const,
  sesionNombre: "Fuerza A",
  autor: { id: "40000000-0000-4000-8000-000000000000", nombre: "Ana", rol: "entrenador" as const },
  creadaEn: "2026-09-24T10:00:00.000Z",
  leidaEn: null,
}

it("no duplica la lectura ni la apertura y permite volver a abrir tras recuperar el foco", async () => {
  let confirmar!: () => void
  const novedades = jest.fn(async () => ({ novedades: [novedad], total: 1, sinLeer: 1 }))
  const leerNovedades = jest.fn(
    () =>
      new Promise<{ leidas: number }>((resolve) => {
        confirmar = () => resolve({ leidas: 1 })
      }),
  )
  const abrir = jest.fn()
  const propiedades = {
    clienteId: novedad.clienteId,
    api: { novedades, leerNovedades } as unknown as ApiEntrenamiento,
    abrir,
  }
  const vista = await render(<NovedadesEntrenamiento {...propiedades} />)
  const boton = await screen.findByRole("button", { name: /revisó Fuerza A/ })
  await fireEvent.press(boton)
  await fireEvent.press(boton)
  expect(leerNovedades).toHaveBeenCalledTimes(1)

  await vista.rerender(<NovedadesEntrenamiento {...propiedades} api={{ ...propiedades.api }} />)
  await fireEvent.press(await screen.findByRole("button", { name: /revisó Fuerza A/ }))
  expect(leerNovedades).toHaveBeenCalledTimes(1)
  await act(async () => confirmar())
  expect(abrir).toHaveBeenCalledTimes(1)

  novedades.mockResolvedValue({
    novedades: [{ ...novedad, leidaEn: novedad.creadaEn }],
    total: 1,
    sinLeer: 0,
  })
  mockFoco += 1
  await vista.rerender(<NovedadesEntrenamiento {...propiedades} />)
  await fireEvent.press(await screen.findByRole("button", { name: /revisó Fuerza A/ }))
  expect(abrir).toHaveBeenCalledTimes(2)
})

it("muestra la revisión y guarda la lectura al abrir la sesión", async () => {
  const novedades = jest.fn(async () => ({ novedades: [novedad], total: 1, sinLeer: 1 }))
  const leerNovedades = jest.fn(async () => ({ leidas: 1 }))
  const abrir = jest.fn()
  await render(
    <NovedadesEntrenamiento
      clienteId={novedad.clienteId}
      api={{ novedades, leerNovedades } as unknown as ApiEntrenamiento}
      abrir={abrir}
    />,
  )
  await waitFor(() => expect(screen.getByText(/revisó Fuerza A/)).toBeTruthy())
  await fireEvent.press(screen.getByRole("button", { name: /revisó Fuerza A/ }))
  await waitFor(() =>
    expect(leerNovedades).toHaveBeenCalledWith(novedad.sesionId, { novedadIds: [novedad.id] }),
  )
  expect(abrir).toHaveBeenCalledWith(novedad.sesionId)
})

it("permite consultar y abrir avisos posteriores a los ocho primeros", async () => {
  const avisos = Array.from({ length: 9 }, (_, indice) => ({
    ...novedad,
    id: `10000000-0000-4000-8000-${String(indice + 1).padStart(12, "0")}`,
    sesionNombre: `Sesión ${indice + 1}`,
  }))
  const novedades = jest.fn(async (_clienteId: string, desplazamiento = 0) => ({
    novedades: avisos.slice(desplazamiento, desplazamiento + 8),
    total: avisos.length,
    sinLeer: avisos.length,
  }))
  const abrir = jest.fn()
  await render(
    <NovedadesEntrenamiento
      clienteId={novedad.clienteId}
      api={
        {
          novedades,
          leerNovedades: jest.fn(async () => ({ leidas: 1 })),
        } as unknown as ApiEntrenamiento
      }
      abrir={abrir}
    />,
  )

  expect(await screen.findByText(/revisó Sesión 1/)).toBeTruthy()
  expect(screen.queryByText(/revisó Sesión 9/)).toBeNull()
  await fireEvent.press(screen.getByRole("button", { name: "Ver más novedades" }))
  expect(await screen.findByText(/revisó Sesión 9/)).toBeTruthy()
  await fireEvent.press(screen.getByRole("button", { name: /revisó Sesión 9/ }))
  await waitFor(() => expect(abrir).toHaveBeenCalledWith(novedad.sesionId))
  expect(novedades).toHaveBeenLastCalledWith(novedad.clienteId, 8)
})

it("envía el desplazamiento y el límite de página al API", async () => {
  const pedir = jest.fn(async () => ({ novedades: [], total: 0, sinLeer: 0 }))
  const api = crearApiEntrenamiento(pedir as unknown as PeticionAutenticada)
  await api.novedades(novedad.clienteId, 8)
  expect(pedir).toHaveBeenCalledWith(
    `/entrenamiento/clientes/${novedad.clienteId}/novedades?limite=8&desplazamiento=8`,
    expect.anything(),
  )
})
