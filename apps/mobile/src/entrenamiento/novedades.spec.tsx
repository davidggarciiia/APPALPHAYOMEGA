import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import type { ApiEntrenamiento } from "./api"
import { crearApiEntrenamiento } from "./api"
import type { PeticionAutenticada } from "../lib/peticion-autenticada"
import { NovedadesEntrenamiento } from "./novedades"

jest.mock("expo-router", () => ({
  useFocusEffect: (efecto: () => void) =>
    jest.requireActual<typeof import("react")>("react").useEffect(efecto, [efecto]),
}))

const novedad = {
  id: "10000000-0000-4000-8000-000000000000",
  sesionId: "20000000-0000-4000-8000-000000000000",
  clienteId: "30000000-0000-4000-8000-000000000000",
  tipo: "sesion_revisada" as const,
  sesionNombre: "Fuerza A",
  autor: { id: "40000000-0000-4000-8000-000000000000", nombre: "Ana", rol: "entrenador" as const },
  creadaEn: "2026-09-24T10:00:00.000Z",
  leidaEn: null,
}

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
