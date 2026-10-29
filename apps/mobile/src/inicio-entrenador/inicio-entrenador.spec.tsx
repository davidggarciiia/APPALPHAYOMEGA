import { act, fireEvent, render, screen } from "@testing-library/react-native"

import { listarUsuarios } from "../lib/api"
import { InicioEntrenador } from "./inicio-entrenador"

jest.mock("expo-router", () => ({
  useFocusEffect: (efecto: () => void) => {
    jest.requireActual<typeof import("react")>("react").useEffect(efecto, [efecto])
  },
}))
jest.mock("../lib/api", () => ({ listarUsuarios: jest.fn() }))

const pedir = jest.fn()
const abrir = jest.fn()

beforeEach(() => {
  jest.mocked(listarUsuarios).mockImplementation(async (_pedir, filtros) => ({
    usuarios: [],
    total: filtros.estado === "activo" ? 12 : 2,
  }))
})

it("saluda y muestra los totales de clientes sin pedir listas completas", async () => {
  await render(<InicioEntrenador nombre="Carlos" pedir={pedir} abrir={abrir} />)
  expect(screen.getByRole("header", { name: "Hola, Carlos" })).toBeOnTheScreen()
  expect(screen.getByText("Tu espacio de trabajo")).toBeOnTheScreen()
  expect(await screen.findByText("12")).toBeOnTheScreen()
  expect(screen.getByText("2")).toBeOnTheScreen()
  expect(screen.getByRole("button", { name: "Mis clientes" })).toHaveProp("accessibilityValue", {
    text: "12 activos. 2 pendientes de activar.",
  })
  expect(listarUsuarios).toHaveBeenCalledTimes(2)
  for (const estado of ["activo", "pendiente"]) {
    expect(listarUsuarios).toHaveBeenCalledWith(pedir, {
      rol: "cliente",
      estado,
      limite: 1,
      desde: 0,
    })
  }
  expect(screen.queryByRole("button", { name: /Cerrar sesión/i })).toBeNull()
})

it("abre los cinco destinos de trabajo con tarjetas accesibles", async () => {
  await render(<InicioEntrenador nombre="Carlos" pedir={pedir} abrir={abrir} />)
  await screen.findByText("12")
  for (const [nombre, ruta] of [
    ["Mis clientes", "/cartera"],
    ["Mis rutinas", "/rutinas"],
    ["Ejercicios", "/catalogo"],
    ["Nutricionista", "/nutricionista"],
    ["Mi perfil", "/perfil"],
  ]) {
    const tarjeta = screen.getByRole("button", { name: nombre })
    if (nombre !== "Mis clientes") expect(tarjeta).toHaveStyle({ minHeight: 128 })
    await fireEvent.press(tarjeta)
    expect(abrir).toHaveBeenLastCalledWith(ruta)
  }
})

it("muestra un esqueleto de cifras durante la consulta y oculta ambas si alguna falla", async () => {
  let rechazar: (error: Error) => void = () => undefined
  jest.mocked(listarUsuarios).mockReturnValue(
    new Promise((_resolver, rechazarPromesa) => {
      rechazar = rechazarPromesa
    }),
  )
  await render(<InicioEntrenador nombre="Carlos" pedir={pedir} abrir={abrir} />)
  expect(screen.getByLabelText("Cargando cifras de clientes")).toHaveProp("accessibilityState", {
    busy: true,
  })
  await act(async () => rechazar(new Error("Sin red")))
  expect(screen.queryByLabelText("Cargando cifras de clientes")).toBeNull()
  expect(screen.queryByText("activos")).toBeNull()
  expect(screen.queryByText("pendientes de activar")).toBeNull()
  expect(screen.getByRole("button", { name: "Mis clientes" })).toBeOnTheScreen()
})
