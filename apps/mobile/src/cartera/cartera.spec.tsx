import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import type { ListadoUsuarios, ResumenUsuario } from "@alpha-omega/shared"
import { RefreshControl, type RefreshControlProps } from "react-native"

import Cartera from "../../app/cartera"
import { listarUsuarios, ErrorDePermiso } from "../lib/api"
import { useSesion } from "../sesion"

const mockPush = jest.fn()
let mockFoco: (() => void) | undefined
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: (efecto: () => void) => {
    mockFoco = efecto
    jest.requireActual<typeof import("react")>("react").useEffect(efecto, [efecto])
  },
}))
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
}))
jest.mock("../lib/direccion-api", () => ({ direccionDeLaApi: () => "http://localhost:3000" }))
jest.mock("../lib/api", () => ({ ...jest.requireActual("../lib/api"), listarUsuarios: jest.fn() }))
jest.mock("../sesion", () => ({ useSesion: jest.fn() }))

const pedir = jest.fn()
const cliente: ResumenUsuario = {
  id: "cliente-1",
  nombre: "Ana",
  apellidos: "García",
  email: "ana@prueba.local",
  rol: "cliente",
  estado: "activo",
}
const listado = (usuarios = [cliente], total = usuarios.length): ListadoUsuarios => ({
  usuarios,
  total,
})

beforeEach(() => {
  jest.mocked(useSesion).mockReturnValue({
    estado: { fase: "dentro", tokenAcceso: "token", usuario: { ...cliente, rol: "entrenador" } },
    sesionCaducada: false,
    sinConexion: false,
    entrar: jest.fn(async () => undefined),
    salir: jest.fn(async () => undefined),
    reintentar: jest.fn(),
    pedir,
  })
  jest.mocked(listarUsuarios).mockResolvedValue(listado())
})
afterEach(() => jest.useRealTimers())

it("presenta búsqueda y filtros sin repetir el título de la pestaña", async () => {
  await render(<Cartera />)
  await screen.findByRole("button", { name: "Ana García. ACTIVO. ana@prueba.local" })
  expect(screen.queryByText("TU CARTERA")).toBeNull()
  expect(screen.getByLabelText("Buscar cliente")).toHaveStyle({ minHeight: 52 })
  for (const nombre of ["TODOS", "PENDIENTES", "ACTIVOS", "BAJAS"]) {
    const chip = screen.getByRole("button", { name: nombre })
    expect(chip).toHaveStyle({ height: 40 })
    expect(chip).toHaveProp("hitSlop", 2)
  }
  expect(screen.getByTestId("filtros-cartera")).toHaveProp("horizontal", true)
  expect(screen.getByRole("button", { name: "TODOS" })).toBeSelected()
  expect(listarUsuarios).toHaveBeenCalledWith(pedir, {
    rol: "cliente",
    buscar: undefined,
    estado: undefined,
    limite: 100,
    desde: 0,
  })
})

it("abre una fila de 72 con avatar cuadrado y expresa las bajas también en texto", async () => {
  jest.mocked(listarUsuarios).mockResolvedValue(listado([{ ...cliente, estado: "desactivado" }]))
  await render(<Cartera />)
  const fila = await screen.findByRole("button", { name: "Ana García. BAJA. ana@prueba.local" })
  expect(fila).toHaveStyle({ minHeight: 72, opacity: 0.55 })
  expect(screen.getByTestId("avatar-cliente-1")).toHaveStyle({
    width: 44,
    height: 44,
    borderRadius: 12,
  })
  await fireEvent.press(fila)
  expect(mockPush).toHaveBeenCalledWith({
    pathname: "/entrenador/cliente/[id]",
    params: { id: cliente.id },
  })
})

it("mantiene el alta como acción flotante a 20 del borde", async () => {
  await render(<Cartera />)
  await screen.findByText("Ana García")
  expect(screen.getByTestId("nuevo-cliente")).toHaveStyle({
    position: "absolute",
    right: 20,
    bottom: 20,
  })
  const nuevo = screen.getByRole("button", { name: "Dar de alta a un cliente nuevo" })
  expect(nuevo).toHaveTextContent("+ NUEVO")
  expect(screen.getByText("+ NUEVO").parent).toHaveStyle({ minHeight: 52 })
  await fireEvent.press(nuevo)
  expect(mockPush).toHaveBeenCalledWith("/cliente/nuevo")
})

it("espera 300 ms tras escribir y conserva el filtro en la consulta", async () => {
  jest.useFakeTimers()
  await render(<Cartera />)
  await act(async () => undefined)
  await fireEvent.press(screen.getByRole("button", { name: "PENDIENTES" }))
  await act(async () => undefined)
  expect(screen.getByRole("button", { name: "PENDIENTES" })).toBeSelected()
  jest.mocked(listarUsuarios).mockClear()
  await fireEvent.changeText(screen.getByLabelText("Buscar cliente"), "  Ana  ")
  await act(async () => jest.advanceTimersByTime(299))
  expect(listarUsuarios).not.toHaveBeenCalled()
  await act(async () => jest.advanceTimersByTime(1))
  expect(listarUsuarios).toHaveBeenCalledWith(pedir, {
    rol: "cliente",
    buscar: "Ana",
    estado: "pendiente",
    limite: 100,
    desde: 0,
  })
})

it("muestra cinco filas y chips esqueleto mientras espera la primera respuesta", async () => {
  jest.mocked(listarUsuarios).mockReturnValue(new Promise(() => undefined))
  await render(<Cartera />)
  expect(screen.getByLabelText("Cargando tu cartera")).toHaveProp("accessibilityState", {
    busy: true,
  })
  expect(screen.getAllByTestId("fila-esqueleto-cartera")).toHaveLength(5)
  expect(screen.getAllByTestId("chip-esqueleto-cartera")).toHaveLength(3)
  expect(screen.queryByRole("progressbar")).toBeNull()
})

it("ofrece dar de alta al primer cliente y distingue un filtro vacío", async () => {
  jest.mocked(listarUsuarios).mockResolvedValue(listado([]))
  await render(<Cartera />)
  expect(await screen.findByText("Aún no tienes clientes")).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("button", { name: "Dar de alta" }))
  expect(mockPush).toHaveBeenCalledWith("/cliente/nuevo")
  await fireEvent.press(screen.getByRole("button", { name: "BAJAS" }))
  expect(await screen.findByText("Nadie coincide")).toBeOnTheScreen()
  expect(screen.queryByText("Aún no tienes clientes")).toBeNull()
})

it("solo muestra el pie cuando el servidor devuelve más clientes de los visibles", async () => {
  jest.mocked(listarUsuarios).mockResolvedValueOnce(listado([cliente], 120))
  await render(<Cartera />)
  expect(await screen.findByText("Mostrando 1 de 120")).toBeOnTheScreen()
  await fireEvent.press(screen.getByRole("button", { name: "ACTIVOS" }))
  await waitFor(() => expect(screen.queryByText(/Mostrando/)).toBeNull())
})

it("permite reintentar un fallo de carga", async () => {
  jest.mocked(listarUsuarios).mockRejectedValueOnce(new Error("Sin red"))
  await render(<Cartera />)
  expect(await screen.findByRole("alert")).toHaveTextContent("No hemos podido cargar tu cartera.")
  await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }))
  expect(await screen.findByText("Ana García")).toBeOnTheScreen()
})

it("respeta los errores que no permiten reintentar", async () => {
  jest.mocked(listarUsuarios).mockRejectedValueOnce(new ErrorDePermiso())
  await render(<Cartera />)
  expect(await screen.findByRole("alert")).toHaveTextContent(/No tienes permiso/)
  expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull()
})

it("recarga al volver de la ficha y con pull-to-refresh", async () => {
  await render(<Cartera />)
  await screen.findByText("Ana García")
  await act(async () => mockFoco?.())
  expect(listarUsuarios).toHaveBeenCalledTimes(2)
  // El doble oficial nativo expone la última instancia, sin reenviar props a su vista.
  const control = (
    RefreshControl as typeof RefreshControl & {
      latestRef: { props: RefreshControlProps }
    }
  ).latestRef
  expect(control.props.tintColor).toBe("#FFC34C")
  await act(async () => {
    void control.props.onRefresh?.()
  })
  expect(listarUsuarios).toHaveBeenCalledTimes(3)
})

it("una respuesta antigua no pisa los resultados de la búsqueda actual", async () => {
  jest.useFakeTimers()
  let resolverAntigua: (respuesta: ListadoUsuarios) => void = () => undefined
  jest
    .mocked(listarUsuarios)
    .mockReturnValueOnce(
      new Promise((resolver) => {
        resolverAntigua = resolver
      }),
    )
    .mockResolvedValueOnce(listado([{ ...cliente, id: "cliente-2", nombre: "Bea" }]))
  await render(<Cartera />)
  await fireEvent.changeText(screen.getByLabelText("Buscar cliente"), "Bea")
  await act(async () => jest.advanceTimersByTime(300))
  expect(screen.getByText("Bea García")).toBeOnTheScreen()
  await act(async () => resolverAntigua(listado()))
  expect(screen.getByText("Bea García")).toBeOnTheScreen()
  expect(screen.queryByText("Ana García")).toBeNull()
})
