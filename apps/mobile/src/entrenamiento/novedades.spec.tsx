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

it.each(["resuelta", "rechazada"] as const)(
  "no abre la sesión tras desmontarse aunque llegue la lectura %s",
  async (resultado) => {
    let resolver!: (valor: { leidas: number }) => void
    let rechazar!: (error: Error) => void
    const lectura = new Promise<{ leidas: number }>((resolve, reject) => {
      resolver = resolve
      rechazar = reject
    })
    const abrir = jest.fn()
    const vista = await render(
      <NovedadesEntrenamiento
        clienteId={novedad.clienteId}
        api={
          {
            novedades: jest.fn(async () => ({ novedades: [novedad], total: 1, sinLeer: 1 })),
            leerNovedades: jest.fn(() => lectura),
          } as unknown as ApiEntrenamiento
        }
        abrir={abrir}
      />,
    )
    await fireEvent.press(await screen.findByRole("button", { name: /revisó Fuerza A/ }))
    await vista.unmount()
    await act(async () => {
      if (resultado === "resuelta") resolver({ leidas: 1 })
      else rechazar(new Error("Sin conexión"))
    })
    expect(abrir).not.toHaveBeenCalled()
  },
)

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
  expect(screen.queryByRole("header", { name: /Novedades/ })).toBeNull()
  expect(screen.queryByText("Nueva")).toBeNull()
  expect(screen.getByRole("button", { name: /revisó Fuerza A, sin leer/ })).toBeTruthy()
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
  expect(screen.getByText(/revisó Sesión 4/)).toBeOnTheScreen()
  expect(screen.queryByText(/revisó Sesión 9/)).toBeNull()
  expect(screen.getByText(/revisó Sesión 8/)).toBeOnTheScreen()
  expect(novedades).toHaveBeenCalledTimes(1)
  await fireEvent.press(screen.getByRole("button", { name: "Ver más novedades" }))
  expect(await screen.findByText(/revisó Sesión 9/)).toBeTruthy()
  await fireEvent.press(screen.getByRole("button", { name: /revisó Sesión 9/ }))
  await waitFor(() => expect(abrir).toHaveBeenCalledWith(novedad.sesionId))
  expect(novedades).toHaveBeenLastCalledWith(novedad.clienteId, 8)
})

it("la bandeja muestra toda la primera página en filas compactas sin un resumen intermedio", async () => {
  const avisos = Array.from({ length: 5 }, (_, indice) => ({
    ...novedad,
    id: String(indice),
    sesionNombre: `Fuerza ${indice + 1}`,
  }))
  const novedades = jest.fn(async () => ({ novedades: avisos, total: 5, sinLeer: 5 }))
  await render(
    <NovedadesEntrenamiento
      clienteId={novedad.clienteId}
      api={{ novedades } as unknown as ApiEntrenamiento}
      abrir={jest.fn()}
    />,
  )

  await screen.findByText("Ana revisó Fuerza 1")
  expect(screen.getByTestId("tarjeta-novedades")).toHaveStyle({ paddingHorizontal: 16 })
  expect(screen.getAllByRole("button", { name: /Ana revisó/ })).toHaveLength(5)
  for (const fila of screen.getAllByRole("button", { name: /Ana revisó/ }))
    expect(fila).toHaveStyle({ minHeight: 56 })
  expect(screen.getByText("Ana revisó Fuerza 1")).toHaveProp("numberOfLines", 1)
  expect(screen.getByText("Ana revisó Fuerza 4")).toBeOnTheScreen()
  expect(screen.getByText("Ana revisó Fuerza 5")).toBeOnTheScreen()
  expect(screen.queryByRole("button", { name: "Ver todas" })).toBeNull()
  expect(screen.queryByRole("button", { name: "Ver más novedades" })).toBeNull()
  expect(novedades).toHaveBeenCalledTimes(1)
})

it("retira solo el punto de la novedad leída y conserva la fila en el historial", async () => {
  const leerNovedades = jest.fn(async () => ({ leidas: 1 }))
  const abrir = jest.fn()
  await render(
    <NovedadesEntrenamiento
      clienteId={novedad.clienteId}
      api={
        {
          novedades: jest.fn(async () => ({ novedades: [novedad], total: 1, sinLeer: 1 })),
          leerNovedades,
        } as unknown as ApiEntrenamiento
      }
      abrir={abrir}
    />,
  )

  const fila = await screen.findByRole("button", { name: /Fuerza A, sin leer/ })
  expect(screen.getByTestId(`punto-novedad-${novedad.id}`)).toBeOnTheScreen()
  await fireEvent.press(fila)
  await waitFor(() => expect(abrir).toHaveBeenCalledWith(novedad.sesionId))
  expect(screen.queryByTestId(`punto-novedad-${novedad.id}`)).toBeNull()
  expect(screen.getByRole("button", { name: "Ana revisó Fuerza A" })).toBeOnTheScreen()
  expect(screen.getByText("Sin novedades pendientes de leer")).toBeOnTheScreen()
  expect(leerNovedades).toHaveBeenCalledWith(novedad.sesionId, { novedadIds: [novedad.id] })
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

it.each([
  [30, "hace 30 minutos"],
  [120, "hace 2 horas"],
  [4320, "hace 3 días"],
])(
  "atribuye el comentario al entrenador con fecha relativa de %s minutos",
  async (minutos, fecha) => {
    const ahora = jest
      .spyOn(Date, "now")
      .mockReturnValue(Date.parse(novedad.creadaEn) + Number(minutos) * 60_000)
    try {
      await render(
        <NovedadesEntrenamiento
          clienteId={novedad.clienteId}
          api={
            {
              novedades: jest.fn(async () => ({
                novedades: [{ ...novedad, tipo: "comentario" }],
                total: 1,
                sinLeer: 1,
              })),
            } as unknown as ApiEntrenamiento
          }
          abrir={jest.fn()}
        />,
      )
      expect(await screen.findByText(`Tu entrenador · ${fecha}`)).toBeOnTheScreen()
      expect(screen.getByText("Ana comentó Fuerza A")).toBeOnTheScreen()
    } finally {
      ahora.mockRestore()
    }
  },
)
